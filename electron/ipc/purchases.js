const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate, requiredId, positiveQty, finiteMoney, normalizeOptional } = require('../utils/validators');
const { getSupplierBalance } = require('../utils/calculations');
const { createHandler } = require('./helpers');
const { log, LOG_LEVELS } = require('../utils/logger');

function registerPurchaseHandlers() {
  ipcMain.handle('getPurchases', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.is_deleted = 0`;
    const params = [];
    if (filters.supplierId) { sql += ` AND p.supplier_id = ?`; params.push(requiredId(filters.supplierId, 'supplierId')); }
    if (filters.fromDate) { sql += ` AND DATE(p.purchase_date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(p.purchase_date) <= DATE(?)`; params.push(filters.toDate); }
    if (filters.status) { sql += ` AND p.status = ?`; params.push(sanitizeInput(filters.status)); }
    sql += ` ORDER BY p.purchase_date DESC, p.id DESC`;
    return db.prepare(sql).all(...params);
  }));

  ipcMain.handle('getPurchaseById', createHandler(async (event, id) => {
    const db = getDb();
    const purchaseId = requiredId(id, 'purchaseId');
    const purchase = db.prepare(`SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ? AND p.is_deleted = 0`).get(purchaseId);
    if (!purchase) return null;
    purchase.items = db.prepare(`SELECT pi.*, pv.sku, pv.variant_name, pr.name AS product_name FROM purchase_items pi LEFT JOIN product_variants pv ON pv.id = pi.product_variant_id LEFT JOIN products pr ON pr.id = pv.product_id WHERE pi.purchase_id = ? ORDER BY pi.id`).all(purchaseId);
    return purchase;
  }));

  ipcMain.handle('addPurchase', createHandler(async (event, data = {}) => {
    const db = getDb();
    const supplierId = data.supplier_id ? requiredId(data.supplier_id, 'supplierId') : null;
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) throw new Error('Purchase must contain items');
    
    const transaction = db.transaction(() => {
      if (supplierId && !db.prepare(`SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0`).get(supplierId)) throw new Error('Supplier not found');
      let subtotal = 0;
      const cleanItems = items.map(item => {
        const variantId = requiredId(item.product_variant_id || item.variantId, 'variantId');
        const quantity = positiveQty(item.quantity, 'quantity');
        const price = finiteMoney(item.purchase_price ?? item.price, 'purchase price');
        const taxPct = finiteMoney(item.tax_percentage || 0, 'tax percentage');
        const line = Math.round(price * quantity * 100) / 100;
        subtotal += line;
        if (!db.prepare(`SELECT id FROM product_variants WHERE id = ? AND is_deleted = 0`).get(variantId)) throw new Error(`Variant ${variantId} not found`);
        return { variantId, quantity, price, taxPct, line, expiry: validateDate(item.expiry_date) };
      });
      subtotal = Math.round(subtotal * 100) / 100;
      const discount = finiteMoney(data.discount_amount || 0, 'discount');
      const tax = finiteMoney(data.tax_amount || 0, 'tax');
      const shipping = finiteMoney(data.shipping_charges || 0, 'shipping');
      if (discount > subtotal) throw new Error('Discount cannot exceed subtotal');
      const grandTotal = Math.round((subtotal - discount + tax + shipping) * 100) / 100;
      const paid = finiteMoney(data.paid_amount || 0, 'paid amount');
      if (paid > grandTotal) throw new Error('Paid amount cannot exceed grand total');
      const due = Math.round((grandTotal - paid) * 100) / 100;
      const paymentStatus = due === 0 ? 'paid' : paid > 0 ? 'partial' : 'due';
      const purchaseNo = sanitizeInput(data.purchase_no || `PUR-${Date.now()}`);
      const result = db.prepare(`INSERT INTO purchases (supplier_id,purchase_no,supplier_invoice_no,purchase_date,due_date,status,total_amount,discount_amount,tax_amount,shipping_charges,grand_total,paid_amount,payment_status,payment_mode,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(supplierId, purchaseNo, normalizeOptional(data.supplier_invoice_no), validateDate(data.purchase_date) || new Date().toISOString(), validateDate(data.due_date), 'received', subtotal, discount, tax, shipping, grandTotal, paid, paymentStatus, sanitizeInput(data.payment_mode || 'cash'), sanitizeInput(data.notes || ''), data.created_by || 1);
      const purchaseId = result.lastInsertRowid;
      for (const item of cleanItems) {
        db.prepare(`INSERT INTO purchase_items (purchase_id,product_variant_id,quantity,purchase_price,tax_percentage,sub_total,expiry_date) VALUES (?,?,?,?,?,?,?)`).run(purchaseId, item.variantId, item.quantity, item.price, item.taxPct, item.line, item.expiry);
        const changed = db.prepare(`UPDATE product_variants SET current_stock = current_stock + ?, purchase_price = ? WHERE id = ? AND is_deleted = 0`).run(item.quantity, item.price, item.variantId);
        if (changed.changes !== 1) throw new Error('Stock update failed');
      }
      if (supplierId) {
        const previous = getSupplierBalance(db, supplierId);
        const balanceChange = due;
        db.prepare(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`).run(balanceChange, supplierId);
        db.prepare(`INSERT INTO ledger (supplier_id,type,amount,description,date) VALUES (?,?,?,?,?)`).run(supplierId, 'purchase', balanceChange, `Purchase ${purchaseNo}`, new Date().toISOString());
        if (paid > 0) db.prepare(`INSERT INTO ledger (supplier_id,type,amount,description,date) VALUES (?,?,?,?,?)`).run(supplierId, 'payment', -paid, `Payment for ${purchaseNo}`, new Date().toISOString());
        void previous;
      }
      logAudit(data.created_by || 1, 'create', 'purchases', purchaseId);
      return { id: purchaseId, purchase_no: purchaseNo, subtotal, grand_total: grandTotal, due_amount: due };
    });
    
    try {
      return transaction();
    } catch (error) {
      log(LOG_LEVELS.ERROR, 'Purchase transaction failed:', error);
      throw new Error('Purchase failed: ' + error.message);
    }
  }));

  ipcMain.handle('updatePurchase', createHandler(async (event, id, data = {}) => {
    const db = getDb();
    const purchaseId = requiredId(id, 'purchaseId');
    const allowed = ['supplier_invoice_no','due_date','status','payment_mode','notes'];
    const sanitized = sanitizeObject(data, allowed);
    const fields = [], values = [];
    for (const key of allowed) if (sanitized[key] !== undefined) { fields.push(`${key} = ?`); values.push(key === 'due_date' ? validateDate(sanitized[key]) : sanitized[key]); }
    if (!fields.length) return { changes: 0 };
    values.push(purchaseId);
    const result = db.prepare(`UPDATE purchases SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...values);
    if (result.changes !== 1) throw new Error('Purchase not found or already deleted');
    logAudit(data.updated_by || 1, 'update', 'purchases', purchaseId);
    return { changes: result.changes };
  }));

  ipcMain.handle('deletePurchase', createHandler(async (event, id) => {
    const db = getDb();
    const purchaseId = requiredId(id, 'purchaseId');
    const transaction = db.transaction(() => {
      const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ? AND is_deleted = 0`).get(purchaseId);
      if (!purchase) throw new Error('Purchase not found or already deleted');
      const items = db.prepare(`SELECT product_variant_id, quantity FROM purchase_items WHERE purchase_id = ?`).all(purchaseId);
      for (const item of items) {
        const stock = db.prepare(`SELECT current_stock FROM product_variants WHERE id = ?`).get(item.product_variant_id);
        if (!stock || Number(stock.current_stock) < Number(item.quantity)) throw new Error('Cannot delete purchase: stock has already been sold or transferred');
        db.prepare(`UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?`).run(item.quantity, item.product_variant_id);
      }
      if (purchase.supplier_id) {
        db.prepare(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`).run(purchase.due_amount, purchase.supplier_id);
        db.prepare(`INSERT INTO ledger (supplier_id,type,amount,description,date) VALUES (?,?,?,?,?)`).run(purchase.supplier_id, 'purchase_reversal', -Number(purchase.due_amount), `Purchase deleted: ${purchase.purchase_no}`, new Date().toISOString());
      }
      db.prepare(`UPDATE purchases SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0`).run(purchaseId);
      logAudit(event.sender?.userId || 1, 'delete', 'purchases', purchaseId);
    });
    transaction();
    return { success: true };
  }));
}

module.exports = { registerPurchaseHandlers };