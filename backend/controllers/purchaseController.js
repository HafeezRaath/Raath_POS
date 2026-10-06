// ============================================================
//  server/controllers/purchaseController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

function generatePONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `PO-${dateStr}-${randomNum}`;
}

exports.getPurchases = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { supplierId, startDate, endDate, limit = 100 } = req.query;
    let sql = `
      SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, w.name AS warehouse_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.tenant_id = ? AND p.is_deleted = 0
    `;
    const params = [tenantId];

    if (supplierId) {
      sql += ' AND p.supplier_id = ?';
      params.push(supplierId);
    }
    if (startDate) {
      sql += ' AND p.purchase_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND p.purchase_date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    sql += ' ORDER BY p.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const purchases = await query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (purchases.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    const purchase = purchases[0];
    const items = await query('SELECT * FROM purchase_items WHERE tenant_id = ? AND purchase_id = ?', [tenantId, id]);
    purchase.items = items;
    res.json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      purchase_number,
      supplier_id = null,
      supplier_name = '',
      warehouse_id = null,
      items = [],
      subtotal = 0,
      discount = 0,
      tax = 0,
      shipping_cost = 0,
      grand_total,
      paid_amount = 0,
      due_amount = 0,
      payment_method = 'cash',
      account_id = null,
      notes = '',
      purchase_date
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Purchase items required' });
    }

    const calculatedTotal = parseFloat(grand_total) || 0;
    const poNum = purchase_number || generatePONumber();

    const createdId = await transaction(async (conn) => {
      // 1. Insert into purchases
      const insertSql = `
        INSERT INTO purchases (
          tenant_id, purchase_number, supplier_id, supplier_name, warehouse_id,
          subtotal, discount, tax, shipping_cost, grand_total,
          paid_amount, due_amount, payment_method, account_id,
          notes, purchase_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
      `;
      const [pRes] = await conn.query(insertSql, [
        tenantId, poNum, supplier_id || null, supplier_name, warehouse_id || null,
        subtotal, discount, tax, shipping_cost, calculatedTotal,
        paid_amount, due_amount, payment_method, account_id || null,
        notes, purchase_date || null
      ]);

      const purchaseId = pRes.insertId;

      // 2. Insert items & increase inventory
      for (const it of items) {
        const prodId = it.product_id || it.id;
        const qty = parseFloat(it.quantity) || 1;
        const unitCost = parseFloat(it.unit_cost || it.purchase_price) || 0;
        const total = parseFloat(it.total) || (qty * unitCost);

        await conn.query(
          `INSERT INTO purchase_items (tenant_id, purchase_id, product_id, product_name, quantity, unit_cost, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, purchaseId, prodId, it.product_name || it.name || '', qty, unitCost, total]
        );

        // Increase product stock & update purchase price
        await conn.query(
          'UPDATE products SET stock = stock + ?, purchase_price = ? WHERE tenant_id = ? AND id = ?',
          [qty, unitCost, tenantId, prodId]
        );
      }

      // 3. Update Supplier balance & ledger if due
      if (supplier_id && due_amount > 0) {
        await conn.query(
          'UPDATE suppliers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?',
          [due_amount, tenantId, supplier_id]
        );

        await conn.query(
          `INSERT INTO supplier_ledger (tenant_id, supplier_id, description, debit, credit, balance, reference_type, reference_id)
           VALUES (?, ?, 0, ?, (SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?), 'purchase', ?)`,
          [tenantId, supplier_id, `Purchase #${poNum}`, due_amount, tenantId, supplier_id, purchaseId]
        );
      }

      // 4. Deduct payment from Account if paid
      if (account_id && paid_amount > 0) {
        await conn.query(
          'UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?',
          [paid_amount, tenantId, account_id]
        );

        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
           VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'purchase', ?, CURDATE())`,
          [tenantId, account_id, paid_amount, tenantId, account_id, `Purchase: ${poNum}`, purchaseId]
        );
      }

      return purchaseId;
    });

    const [finalPurchase] = await query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ?', [tenantId, createdId]);
    const finalItems = await query('SELECT * FROM purchase_items WHERE tenant_id = ? AND purchase_id = ?', [tenantId, createdId]);
    finalPurchase.items = finalItems;

    res.status(201).json({ success: true, data: finalPurchase });
  } catch (error) {
    next(error);
  }
};

exports.getAllPurchaseItems = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { purchaseId } = req.query;
    let sql = `
      SELECT pi.*, p.name AS product_name
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.tenant_id = ?
    `;
    const params = [tenantId];
    if (purchaseId) {
      sql += ' AND pi.purchase_id = ?';
      params.push(purchaseId);
    }
    sql += ' ORDER BY pi.id DESC';
    const items = await query(sql, params);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE purchases SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchase = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { notes, status, payment_status } = req.body;
    await query(
      'UPDATE purchases SET notes = COALESCE(?, notes), status = COALESCE(?, status), payment_status = COALESCE(?, payment_status) WHERE tenant_id = ? AND id = ?',
      [notes, status, payment_status, tenantId, id]
    );
    res.json({ success: true, message: 'Purchase updated successfully' });
  } catch (error) {
    next(error);
  }
};
