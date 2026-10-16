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
      split_payments = null,
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
        if (!prodId) {
          throw new Error(`Purchase item "${it.product_name || it.name || '?'}" has no product_id — select the product from the dropdown.`);
        }
        const qty = parseFloat(it.quantity) || 1;
        const unitCost = parseFloat(it.unit_cost || it.purchase_price) || 0;
        const total = parseFloat(it.total) || (qty * unitCost);
        const itemExpiry = it.expiry_date || null;

        await conn.query(
          `INSERT INTO purchase_items (tenant_id, purchase_id, product_id, product_name, quantity, unit_cost, total, expiry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, purchaseId, prodId, it.product_name || it.name || '', qty, unitCost, total, itemExpiry]
        );

        // Increase product stock & update purchase price & expiry date
        await conn.query(
          'UPDATE products SET stock = stock + ?, purchase_price = ?, expiry_date = COALESCE(?, expiry_date) WHERE tenant_id = ? AND id = ?',
          [qty, unitCost, itemExpiry, tenantId, prodId]
        );

        // Also update variant stock if variant specified (H1 fix: variant stock was drifting)
        const variantId = it.product_variant_id || it.variant_id;
        if (variantId) {
          await conn.query(
            'UPDATE product_variants SET stock = stock + ? WHERE tenant_id = ? AND id = ?',
            [qty, tenantId, variantId]
          );
        }
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

      // 4. Deduct payment from Account(s) if paid
      // Split payment: debit each account separately
      if (Array.isArray(split_payments) && split_payments.length > 0) {
        for (const sp of split_payments) {
          const spAccountId = sp.account_id;
          const spAmount = Number(sp.amount) || 0;
          if (!spAccountId || spAmount <= 0) continue;
          await conn.query(
            'UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?',
            [spAmount, tenantId, spAccountId]
          );
          await conn.query(
            `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
             VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'purchase', ?, CURDATE())`,
            [tenantId, spAccountId, spAmount, tenantId, spAccountId, `Purchase (split): ${poNum}`, purchaseId]
          );
        }
      } else if (account_id && paid_amount > 0) {
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

    // Get purchase details for reversal
    const [purchases] = await query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (purchases.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    const purchase = purchases[0];
    const [items] = await query('SELECT * FROM purchase_items WHERE tenant_id = ? AND purchase_id = ?', [tenantId, id]);

    await query('START TRANSACTION');
    try {
      // 1. Reverse stock (deduct what was added)
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        if (item.product_id) {
          await query('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE tenant_id = ? AND id = ?', [qty, tenantId, item.product_id]);
        }
      }

      // 2. Reverse supplier balance
      if (purchase.supplier_id && purchase.due_amount > 0) {
        await query('UPDATE suppliers SET balance = balance - ? WHERE tenant_id = ? AND id = ?', [purchase.due_amount, tenantId, purchase.supplier_id]);
      }

      // 3. Reverse account debit (if paid via account)
      if (purchase.account_id && purchase.paid_amount > 0) {
        await query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [purchase.paid_amount, tenantId, purchase.account_id]);
        await query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, description, reference_type, reference_id, date)
           VALUES (?, ?, 'credit', ?, 'Purchase deletion reversal', 'purchase', ?, CURDATE())`,
          [tenantId, purchase.account_id, purchase.paid_amount, id]
        );
      }

      // 4. Mark as deleted
      await query('UPDATE purchases SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);

      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true, message: 'Purchase deleted successfully with reversal' });
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

// ==================== PURCHASE ORDERS (PO) ====================
function generatePOOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `PO-ORD-${dateStr}-${randomNum}`;
}

exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { supplierId, status, limit = 100 } = req.query;
    let sql = `
      SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
             (SELECT COUNT(id) FROM purchase_order_items WHERE po_id = po.id) AS items_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.tenant_id = ? AND po.is_deleted = 0
    `;
    const params = [tenantId];
    if (supplierId) {
      sql += ' AND po.supplier_id = ?';
      params.push(supplierId);
    }
    if (status && status !== 'all') {
      sql += ' AND po.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY po.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const orders = await query(
      `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.company_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.tenant_id = ? AND po.id = ? AND po.is_deleted = 0`,
      [tenantId, id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found' });
    }
    const order = orders[0];
    const items = await query('SELECT * FROM purchase_order_items WHERE tenant_id = ? AND po_id = ?', [tenantId, id]);
    order.items = items;
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      po_no,
      supplier_id = null,
      supplier_name = '',
      expected_delivery_date = null,
      notes = '',
      items = [],
      subtotal = 0,
      tax = 0,
      shipping_cost = 0,
      total_amount = 0,
      status = 'draft'
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Purchase Order items required' });
    }

    const orderNumber = po_no || generatePOOrderNumber();
    const grandTotal = parseFloat(total_amount) || parseFloat(subtotal) || 0;

    const createdId = await transaction(async (conn) => {
      const [insertRes] = await conn.query(
        `INSERT INTO purchase_orders (
          tenant_id, po_no, supplier_id, supplier_name, expected_delivery_date,
          status, subtotal, tax, shipping_cost, total_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId, orderNumber, supplier_id || null, supplier_name,
          expected_delivery_date || null, status, subtotal, tax, shipping_cost,
          grandTotal, notes
        ]
      );

      const poId = insertRes.insertId;

      for (const it of items) {
        const prodId = it.product_id || it.id || null;
        const vId = it.product_variant_id || it.variant_id || null;
        const qty = parseFloat(it.quantity) || 1;
        const cost = parseFloat(it.unit_cost || it.purchase_price) || 0;
        const lineTotal = parseFloat(it.total) || (qty * cost);

        await conn.query(
          `INSERT INTO purchase_order_items (
            tenant_id, po_id, product_id, product_variant_id, product_name,
            quantity, unit_cost, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, poId, prodId, vId, it.product_name || it.name || '', qty, cost, lineTotal]
        );
      }

      return poId;
    });

    const [finalPO] = await query('SELECT * FROM purchase_orders WHERE tenant_id = ? AND id = ?', [tenantId, createdId]);
    const finalItems = await query('SELECT * FROM purchase_order_items WHERE tenant_id = ? AND po_id = ?', [tenantId, createdId]);
    finalPO.items = finalItems;

    res.status(201).json({ success: true, data: finalPO });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { status, expected_delivery_date, notes } = req.body;
    await query(
      `UPDATE purchase_orders SET 
        status = COALESCE(?, status),
        expected_delivery_date = COALESCE(?, expected_delivery_date),
        notes = COALESCE(?, notes)
       WHERE tenant_id = ? AND id = ?`,
      [status, expected_delivery_date, notes, tenantId, id]
    );
    res.json({ success: true, message: 'Purchase Order updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deletePurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE purchase_orders SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Purchase Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.convertPOToPurchase = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { paid_amount = 0, payment_method = 'cash', account_id = null } = req.body;

    const orders = await query('SELECT * FROM purchase_orders WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found' });
    }
    const po = orders[0];
    const items = await query('SELECT * FROM purchase_order_items WHERE tenant_id = ? AND po_id = ?', [tenantId, id]);

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Purchase Order has no items' });
    }

    const dueAmount = (parseFloat(po.total_amount) || 0) - (parseFloat(paid_amount) || 0);
    const purchaseNum = generatePONumber();

    const purchaseId = await transaction(async (conn) => {
      // 1. Insert into purchases
      const [pRes] = await conn.query(
        `INSERT INTO purchases (
          tenant_id, purchase_number, supplier_id, supplier_name, subtotal,
          tax, shipping_cost, grand_total, paid_amount, due_amount,
          payment_method, account_id, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
        [
          tenantId, purchaseNum, po.supplier_id, po.supplier_name, po.subtotal,
          po.tax, po.shipping_cost, po.total_amount, paid_amount, dueAmount,
          payment_method, account_id || null, `Converted from PO: ${po.po_no}`
        ]
      );

      const newPurchId = pRes.insertId;

      // 2. Insert items & increase stock
      for (const it of items) {
        await conn.query(
          `INSERT INTO purchase_items (tenant_id, purchase_id, product_id, product_name, quantity, unit_cost, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, newPurchId, it.product_id, it.product_name, it.quantity, it.unit_cost, it.total]
        );

        if (it.product_id) {
          await conn.query(
            'UPDATE products SET stock = stock + ?, purchase_price = ? WHERE tenant_id = ? AND id = ?',
            [it.quantity, it.unit_cost, tenantId, it.product_id]
          );
        }
      }

      // 3. Update supplier balance if due
      if (po.supplier_id && dueAmount > 0) {
        await conn.query('UPDATE suppliers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [dueAmount, tenantId, po.supplier_id]);
      }

      // 4. Mark PO as received
      await conn.query('UPDATE purchase_orders SET status = "received" WHERE tenant_id = ? AND id = ?', [tenantId, id]);

      return newPurchId;
    });

    res.json({ success: true, message: 'Purchase Order successfully converted to Purchase', purchaseId });
  } catch (error) {
    next(error);
  }
};
