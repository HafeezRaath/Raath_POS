const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate, requiredId } = require('../utils/validators');
const { getCustomerBalance } = require('../utils/calculations');
const { createHandler } = require('./helpers');

function registerReturnHandlers() {
  // Sale Returns
  ipcMain.handle('db:getSaleReturns', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT sr.*, c.name as customer_name, s.invoice_no as original_invoice
      FROM sale_returns sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN sales s ON sr.sale_id = s.id
      WHERE sr.is_deleted = 0
    `;
    const params = [];
    if (filters.customerId) { sql += " AND sr.customer_id = ?"; params.push(filters.customerId); }
    if (filters.fromDate) { sql += " AND DATE(sr.return_date) >= DATE(?)"; params.push(filters.fromDate); }
    if (filters.toDate) { sql += " AND DATE(sr.return_date) <= DATE(?)"; params.push(filters.toDate); }
    sql += " ORDER BY sr.id DESC";
    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:createSaleReturn', createHandler(async (event, data) => {
    const db = getDb();
    const transaction = db.transaction((returnData) => {
      if (returnData.sale_id) {
        const saleItems = db.prepare("SELECT product_variant_id, quantity FROM sale_items WHERE sale_id = ?").all(returnData.sale_id);
        const saleItemMap = {};
        for (const item of saleItems) saleItemMap[item.product_variant_id] = (saleItemMap[item.product_variant_id] || 0) + item.quantity;
        for (const item of returnData.items || []) {
          const availableQty = saleItemMap[item.product_variant_id] || 0;
          if (availableQty < item.quantity) {
            throw new Error(`Cannot return ${item.quantity} of variant ${item.product_variant_id}. Only ${availableQty} was sold.`);
          }
        }
      }

      let totalAmount = 0;
      for (const item of returnData.items || []) totalAmount += (item.price || 0) * (item.quantity || 0);
      const discountAmount = validatePositiveNumber(returnData.discount_amount, 0);
      const taxAmount = validatePositiveNumber(returnData.tax_amount, 0);
      const refundAmount = totalAmount - discountAmount + taxAmount;

      const tolerance = 0.01;
      if (Math.abs(refundAmount - validatePositiveNumber(returnData.refund_amount, 0)) > tolerance) {
        throw new Error(`Refund amount mismatch. Client: ${returnData.refund_amount}, Server: ${refundAmount}`);
      }

      const result = db.prepare(`
        INSERT INTO sale_returns (
          sale_id, invoice_no, return_no, customer_id, return_date,
          total_amount, discount_amount, tax_amount, refund_amount,
          payment_mode, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        returnData.sale_id || null,
        returnData.invoice_no,
        returnData.return_no,
        returnData.customer_id || null,
        returnData.return_date || new Date().toISOString(),
        totalAmount,
        discountAmount,
        taxAmount,
        refundAmount,
        sanitizeInput(returnData.payment_mode || 'cash'),
        sanitizeInput(returnData.notes || ''),
        new Date().toISOString()
      );

      const returnId = result.lastInsertRowid;
      if (returnData.items && Array.isArray(returnData.items)) {
        const itemStmt = db.prepare(`
          INSERT INTO sale_return_items (
            sale_return_id, product_variant_id, quantity, price, sub_total, reason
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        const updateStock = db.prepare(`UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?`);
        for (const item of returnData.items) {
          itemStmt.run(returnId, item.product_variant_id, validatePositiveNumber(item.quantity, 0), validatePositiveNumber(item.price, 0), validatePositiveNumber(item.sub_total, 0), sanitizeInput(item.reason || ''));
          updateStock.run(item.quantity, item.product_variant_id);
        }
      }

      if (returnData.customer_id && refundAmount > 0) {
        const prevBalance = getCustomerBalance(db, returnData.customer_id);
        db.prepare(`UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`).run(refundAmount, returnData.customer_id);
        const newBalance = getCustomerBalance(db, returnData.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, sale_id, date, items_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnData.customer_id,
          'sale_return',
          -refundAmount,
          prevBalance,
          newBalance,
          `Sale Return ${returnData.return_no}`,
          returnData.payment_mode || 'cash',
          returnData.return_no,
          returnId,
          returnData.return_date || new Date().toISOString(),
          JSON.stringify((returnData.items || []).map(item => ({
            product_variant_id: item.product_variant_id,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            sub_total: Number(item.sub_total) || 0,
            reason: item.reason || ''
          })))
        );
      }

      logAudit(returnData.created_by || 1, 'create', 'sale_returns', returnId);
      return { id: returnId };
    });
    return transaction(data);
  }));

  ipcMain.handle('db:deleteSaleReturn', createHandler(async (event, id) => {
    const db = getDb();
    const transaction = db.transaction(() => {
      const returnData = db.prepare("SELECT customer_id, refund_amount FROM sale_returns WHERE id = ? AND is_deleted = 0").get(id);
      const items = db.prepare(`SELECT product_variant_id, quantity FROM sale_return_items WHERE sale_return_id = ?`).all(id);
      for (const item of items) {
        db.prepare(`UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?`).run(item.quantity, item.product_variant_id);
      }
      if (returnData && returnData.customer_id && returnData.refund_amount > 0) {
        const prevBalance = getCustomerBalance(db, returnData.customer_id);
        db.prepare(`UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`).run(returnData.refund_amount, returnData.customer_id);
        const newBalance = getCustomerBalance(db, returnData.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnData.customer_id,
          'return_reversal',
          returnData.refund_amount,
          prevBalance,
          newBalance,
          `Sale Return Deleted - Reversal`,
          'adjustment',
          `REV-${id}`,
          new Date().toISOString()
        );
      }
      db.prepare(`UPDATE sale_returns SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?`).run(id);
      logAudit(event.sender?.userId || 1, 'delete', 'sale_returns', id);
    });
    transaction();
    return { success: true };
  }));

  // Purchase Returns
  ipcMain.handle('db:getPurchaseReturns', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT pr.*, p.purchase_no, s.name as supplier_name,
        (SELECT COUNT(*) FROM purchase_return_items WHERE purchase_return_id = pr.id) as items_count
      FROM purchase_returns pr
      LEFT JOIN purchases p ON pr.purchase_id = p.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      WHERE pr.is_deleted = 0
    `;
    const params = [];
    if (filters.supplierId) { sql += " AND pr.supplier_id = ?"; params.push(filters.supplierId); }
    if (filters.fromDate) { sql += " AND DATE(pr.return_date) >= DATE(?)"; params.push(filters.fromDate); }
    if (filters.toDate) { sql += " AND DATE(pr.return_date) <= DATE(?)"; params.push(filters.toDate); }
    if (filters.status) { sql += " AND pr.status = ?"; params.push(filters.status); }
    sql += " ORDER BY pr.id DESC";
    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:getPurchaseReturnById', createHandler(async (event, id) => {
    const db = getDb();
    const row = db.prepare(`
      SELECT pr.*, p.purchase_no, s.name as supplier_name
      FROM purchase_returns pr
      LEFT JOIN purchases p ON pr.purchase_id = p.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      WHERE pr.id = ? AND pr.is_deleted = 0
    `).get(id);
    if (!row) return null;
    const items = db.prepare(`
      SELECT pri.*, pv.sku, p.name as product_name, pv.variant_name
      FROM purchase_return_items pri
      LEFT JOIN product_variants pv ON pri.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE pri.purchase_return_id = ?
    `).all(id);
    return { ...row, items: items || [] };
  }));

  ipcMain.handle('db:getPurchaseReturnItems', createHandler(async (event, returnId) => {
    const db = getDb();
    return db.prepare(`
      SELECT pri.*, pv.sku, p.name as product_name, pv.variant_name
      FROM purchase_return_items pri
      LEFT JOIN product_variants pv ON pri.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE pri.purchase_return_id = ?
    `).all(returnId) || [];
  }));

  ipcMain.handle('db:getPurchaseItemsForReturn', createHandler(async (event, purchaseId) => {
    const db = getDb();
    return db.prepare(`
      SELECT pi.*, pv.sku, p.name as product_name, pv.variant_name,
        (SELECT COALESCE(SUM(quantity), 0) FROM purchase_return_items WHERE purchase_item_id = pi.id) as returned_quantity
      FROM purchase_items pi
      LEFT JOIN product_variants pv ON pi.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(purchaseId) || [];
  }));

  ipcMain.handle('db:createPurchaseReturn', createHandler(async (event, data) => {
    const db = getDb();
    const transaction = db.transaction((returnData, items) => {
      for (const item of items) {
        const purchaseItem = db.prepare("SELECT quantity FROM purchase_items WHERE id = ?").get(item.purchase_item_id);
        if (!purchaseItem) throw new Error(`Purchase item ${item.purchase_item_id} not found`);
        const returned = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total_returned FROM purchase_return_items WHERE purchase_item_id = ?`).get(item.purchase_item_id);
        const availableToReturn = purchaseItem.quantity - (returned?.total_returned || 0);
        if (availableToReturn < item.quantity) {
          throw new Error(`Cannot return ${item.quantity} of item. Only ${availableToReturn} available to return.`);
        }
      }

      let totalAmount = 0;
      for (const item of items) totalAmount += (item.return_price || 0) * (item.quantity || 0);
      const discountAmount = validatePositiveNumber(returnData.discount_amount, 0);
      const taxAmount = validatePositiveNumber(returnData.tax_amount, 0);
      const grandTotal = totalAmount - discountAmount + taxAmount;

      const tolerance = 0.01;
      if (Math.abs(grandTotal - validatePositiveNumber(returnData.grand_total, 0)) > tolerance) {
        throw new Error(`Grand total mismatch. Client: ${returnData.grand_total}, Server: ${grandTotal}`);
      }

      const result = db.prepare(`
        INSERT INTO purchase_returns (
          purchase_id, return_no, return_date, supplier_id,
          total_amount, discount_amount, tax_amount, grand_total,
          notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        returnData.purchase_id,
        returnData.return_no,
        returnData.return_date || new Date().toISOString(),
        returnData.supplier_id,
        totalAmount,
        discountAmount,
        taxAmount,
        grandTotal,
        sanitizeInput(returnData.notes || ''),
        sanitizeInput(returnData.status || 'processed'),
        returnData.created_by || 1
      );

      const returnId = result.lastInsertRowid;
      const itemSql = `
        INSERT INTO purchase_return_items (
          purchase_return_id, purchase_item_id, product_variant_id,
          quantity, return_price, tax_percentage, sub_total, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertItem = db.prepare(itemSql);
      const updateStock = db.prepare(`UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?`);

      for (const item of items) {
        insertItem.run(returnId, item.purchase_item_id, item.product_variant_id, validatePositiveNumber(item.quantity, 0), validatePositiveNumber(item.return_price, 0), validatePositiveNumber(item.tax_percentage, 0), validatePositiveNumber(item.sub_total, 0), sanitizeInput(item.reason || ''));
        updateStock.run(item.quantity, item.product_variant_id);
      }

      db.prepare(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`).run(grandTotal, returnData.supplier_id);
      db.prepare(`INSERT INTO ledger (supplier_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)`)
        .run(returnData.supplier_id, 'return', -grandTotal, `Purchase Return ${returnData.return_no}`, returnData.return_date || new Date().toISOString());

      logAudit(returnData.created_by || 1, 'create', 'purchase_returns', returnId);
      return { id: returnId };
    });
    return transaction(data, data.items || []);
  }));

  ipcMain.handle('db:deletePurchaseReturn', createHandler(async (event, id) => {
    const db = getDb();
    const returnData = db.prepare(`SELECT purchase_id, supplier_id, grand_total FROM purchase_returns WHERE id = ? AND is_deleted = 0`).get(id);
    if (!returnData) throw new Error('Return not found');

    const transaction = db.transaction(() => {
      const items = db.prepare(`SELECT product_variant_id, quantity FROM purchase_return_items WHERE purchase_return_id = ?`).all(id);
      for (const item of items) {
        db.prepare(`UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?`).run(item.quantity, item.product_variant_id);
      }
      db.prepare(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`).run(returnData.grand_total, returnData.supplier_id);
      db.prepare(`UPDATE purchase_returns SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?`).run(id);
      db.prepare(`INSERT INTO ledger (supplier_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)`)
        .run(returnData.supplier_id, 'return_reversal', returnData.grand_total, `Return Reversal - ID: ${id}`, new Date().toISOString());
      logAudit(event.sender?.userId || 1, 'delete', 'purchase_returns', id);
    });
    transaction();
    return { success: true };
  }));

  ipcMain.handle('db:getPurchaseReturnStats', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT COUNT(*) as total_returns, SUM(grand_total) as total_amount,
        AVG(grand_total) as average_amount, COUNT(DISTINCT supplier_id) as total_suppliers
      FROM purchase_returns WHERE is_deleted = 0
    `;
    const params = [];
    if (filters.fromDate) { sql += " AND DATE(return_date) >= DATE(?)"; params.push(filters.fromDate); }
    if (filters.toDate) { sql += " AND DATE(return_date) <= DATE(?)"; params.push(filters.toDate); }
    return db.prepare(sql).get(...params) || { total_returns: 0, total_amount: 0, average_amount: 0, total_suppliers: 0 };
  }));
}

module.exports = { registerReturnHandlers };