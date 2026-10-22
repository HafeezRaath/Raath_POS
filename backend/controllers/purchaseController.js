// ============================================================
//  server/controllers/purchaseController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// FIX E-1: balances/dates computed in JS and bound as plain params — the
// SQLite adapter (LOCAL_MODE) mangles parenthesised expressions inside
// INSERT ... VALUES for syncable tables. Balance is re-read on the same
// connection AFTER the balance UPDATE, identical to the old subquery value.
const pktToday = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const pktNow = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
async function readBalanceAfter(conn, sql, params) {
  const [rows] = await conn.query(sql, params);
  return (Array.isArray(rows) && rows.length > 0) ? parseFloat(rows[0].current_balance) || 0 : 0;
}
async function readBalanceAfterQ(sql, params) {
  const rows = await query(sql, params);
  return (Array.isArray(rows) && rows.length > 0) ? parseFloat(rows[0].current_balance) || 0 : 0;
}

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
      SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, w.name AS warehouse_name,
        COALESCE((SELECT SUM(pr.grand_total) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.tenant_id = p.tenant_id AND pr.is_deleted = 0 AND COALESCE(pr.is_cash_refund, 0) = 0), 0) AS returned_amount
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
    const purchases = await query(`
      SELECT p.*, COALESCE(p.supplier_name, s.name) AS supplier_name, s.phone AS supplier_phone, w.name AS warehouse_name,
        COALESCE((SELECT SUM(pr.grand_total) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.tenant_id = p.tenant_id AND pr.is_deleted = 0 AND COALESCE(pr.is_cash_refund, 0) = 0), 0) AS returned_amount
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.tenant_id = ? AND p.id = ? AND p.is_deleted = 0
    `, [tenantId, id]);
    if (purchases.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    const purchase = purchases[0];
    const items = await query(`
      SELECT pi.*,
        COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri WHERE pri.purchase_item_id = pi.id AND pri.tenant_id = ?), 0) AS returned_quantity
      FROM purchase_items pi
      WHERE pi.tenant_id = ? AND pi.purchase_id = ?
    `, [tenantId, tenantId, id]);
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
      purchase_no,
      supplier_id = null,
      supplier_name = '',
      warehouse_id = null,
      items = [],
      subtotal = 0,
      total_amount = 0,
      discount = 0,
      discount_amount = 0,
      tax = 0,
      tax_amount = 0,
      shipping_cost = 0,
      shipping_charges = 0,
      grand_total,
      paid_amount = 0,
      due_amount,
      payment_method = 'cash',
      payment_mode = 'cash',
      payment_status,
      account_id = null,
      split_payments = null,
      notes = '',
      purchase_date
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Purchase items required' });
    }

    const calculatedTotal = parseFloat(grand_total) || 0;
    const finalPaid = parseFloat(paid_amount) || 0;
    let finalDue = (due_amount !== undefined && due_amount !== null && !isNaN(parseFloat(due_amount)))
      ? parseFloat(due_amount)
      : Math.max(0, calculatedTotal - finalPaid);

    const poNum = purchase_no || purchase_number || generatePONumber();
    const finalPaymentMode = payment_mode || payment_method || 'cash';
    const finalPaymentStatus = finalDue <= 0 ? 'paid' : (finalPaid > 0 ? 'partial' : 'due');

    const createdId = await transaction(async (conn) => {
      // Auto-fetch supplier_name if not provided but supplier_id exists
      let finalSupplierName = supplier_name ? String(supplier_name).trim() : '';
      if (supplier_id && !finalSupplierName) {
        const [supRows] = await conn.query('SELECT name FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, supplier_id]);
        if (supRows && supRows.length > 0 && supRows[0].name) {
          finalSupplierName = supRows[0].name;
        }
      }

      // 1. Insert into purchases (populate both purchase_number and purchase_no)
      const insertSql = `
        INSERT INTO purchases (
          tenant_id, purchase_no, purchase_number, supplier_id, supplier_name, warehouse_id,
          subtotal, discount, tax, shipping_cost, grand_total,
          paid_amount, due_amount, payment_method, payment_mode, payment_status, account_id,
          notes, purchase_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [pRes] = await conn.query(insertSql, [
        tenantId, poNum, poNum, supplier_id || null, finalSupplierName, warehouse_id || null,
        subtotal || total_amount || 0, discount || discount_amount || 0, tax || tax_amount || 0, shipping_cost || shipping_charges || 0, calculatedTotal,
        finalPaid, finalDue, finalPaymentMode, finalPaymentMode, finalPaymentStatus, account_id || null,
        notes, purchase_date || pktNow()
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
        const total = parseFloat(it.total || it.sub_total) || (qty * unitCost);
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

        // Also update variant stock (both stock and current_stock)
        const variantId = it.product_variant_id || it.variant_id;
        if (variantId) {
          await conn.query(
            'UPDATE product_variants SET stock = stock + ?, current_stock = COALESCE(current_stock, 0) + ? WHERE tenant_id = ? AND id = ?',
            [qty, qty, tenantId, variantId]
          );
        } else {
          await conn.query(
            'UPDATE product_variants SET stock = stock + ?, current_stock = COALESCE(current_stock, 0) + ? WHERE tenant_id = ? AND product_id = ?',
            [qty, qty, tenantId, prodId]
          );
        }

        // QA-028: create serialized IMEI devices when imei_list is provided
        const imeiRaw = it.imei_list || it.imeiList || '';
        if (imeiRaw && String(imeiRaw).trim()) {
          const imeis = String(imeiRaw).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
          for (const imei of imeis) {
            const [imeiRes] = await conn.query(
              `INSERT INTO device_imei (tenant_id, product_id, product_variant_id, imei1, purchase_price, sale_price, status, supplier_id, purchase_id, notes)
               VALUES (?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, 'Added via purchase')`,
              [tenantId, prodId, variantId || null, imei, unitCost, unitCost, supplier_id || null, purchaseId]
            );
            await conn.query(
              `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, ref_type, ref_id, amount, notes)
               VALUES (?, ?, 'STOCK_IN', NULL, 'IN_STOCK', 'purchase', ?, ?, 'Added via purchase')`,
              [tenantId, imeiRes.insertId, purchaseId, unitCost]
            );
          }
        }
      }

      // 3. Update Supplier balance & ledger if supplier assigned and due amount > 0
      if (supplier_id && finalDue > 0) {
        await conn.query(
          'UPDATE suppliers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?',
          [finalDue, tenantId, supplier_id]
        );

        const supBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, supplier_id]);
        await conn.query(
          `INSERT INTO supplier_ledger (
            tenant_id, supplier_id, date, type, amount, description, debit, credit, balance, reference_type, reference_id
          ) VALUES (?, ?, ?, 'purchase', ?, ?, 0, ?, ?, 'purchase', ?)`,
          [
            tenantId, supplier_id, purchase_date || pktNow(), finalDue,
            `Purchase #${poNum}${finalPaid > 0 ? ` (Total: ${calculatedTotal}, Paid: ${finalPaid})` : ''}`,
            finalDue, supBalAfter, purchaseId
          ]
        );
      }

      // 4. Record advance/on-the-spot payment in payments table if supplier_id & paid_amount > 0
      if (supplier_id && finalPaid > 0) {
        await conn.query(
          `INSERT INTO payments (
            tenant_id, supplier_id, amount, type, payment_mode, note, date, account_id, reference_no
          ) VALUES (?, ?, ?, 'purchase_payment', ?, ?, ?, ?, ?)`,
          [
            tenantId, supplier_id, finalPaid, finalPaymentMode,
            `Paid at purchase #${poNum}`,
            purchase_date || pktNow(), account_id || null, poNum
          ]
        );
      }

      // 5. Deduct payment from Account(s) if paid
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
          const spBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, spAccountId]);
          await conn.query(
            `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
             VALUES (?, ?, 'debit', ?, ?, ?, 'purchase', ?, ?)`,
            [tenantId, spAccountId, spAmount, spBalAfter, `Purchase (split): ${poNum}`, purchaseId, pktToday()]
          );
        }
      } else if (account_id && finalPaid > 0) {
        await conn.query(
          'UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?',
          [finalPaid, tenantId, account_id]
        );

        const purBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
           VALUES (?, ?, 'debit', ?, ?, ?, 'purchase', ?, ?)`,
          [tenantId, account_id, finalPaid, purBalAfter, `Purchase: ${poNum}`, purchaseId, pktToday()]
        );
      }

      return purchaseId;
    });

    const purchases = await query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ?', [tenantId, createdId]);
    const finalPurchase = purchases[0] || {};
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
      SELECT pi.*, p.name AS product_name,
        COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri WHERE pri.purchase_item_id = pi.id AND pri.tenant_id = ?), 0) AS returned_quantity
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.tenant_id = ?
    `;
    const params = [tenantId, tenantId];
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
    const purchases = await query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (purchases.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    const purchase = purchases[0];
    const items = await query('SELECT * FROM purchase_items WHERE tenant_id = ? AND purchase_id = ?', [tenantId, id]);

    await query('START TRANSACTION');
    try {
      // 1. Reverse stock (deduct what was added)
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        if (item.product_id) {
          await query('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE tenant_id = ? AND id = ?', [qty, tenantId, item.product_id]);
          await query('UPDATE product_variants SET stock = GREATEST(0, stock - ?), current_stock = GREATEST(0, COALESCE(current_stock, 0) - ?) WHERE tenant_id = ? AND product_id = ?', [qty, qty, tenantId, item.product_id]);
        }
      }

      // 2. Reverse supplier balance
      if (purchase.supplier_id && parseFloat(purchase.due_amount) > 0) {
        const dueAmt = parseFloat(purchase.due_amount);
        await query('UPDATE suppliers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [dueAmt, tenantId, purchase.supplier_id]);
        const cancelSupBalAfter = await readBalanceAfterQ('SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, purchase.supplier_id]);
        await query(
          `INSERT INTO supplier_ledger (tenant_id, supplier_id, date, type, amount, description, debit, credit, balance, reference_type, reference_id)
           VALUES (?, ?, ?, 'purchase_cancel', ?, ?, ?, 0, ?, 'purchase_cancel', ?)`,
          [tenantId, purchase.supplier_id, pktNow(), dueAmt, `Reversal of Purchase #${purchase.purchase_number || purchase.purchase_no}`, dueAmt, cancelSupBalAfter, id]
        );
      }

      // Reverse payment record if any
      if (purchase.supplier_id && parseFloat(purchase.paid_amount) > 0) {
        await query(
          'UPDATE payments SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND supplier_id = ? AND reference_no = ?',
          [tenantId, purchase.supplier_id, purchase.purchase_number || purchase.purchase_no]
        );
      }

      // 3. Reverse account debit (if paid via account)
      if (purchase.account_id && parseFloat(purchase.paid_amount) > 0) {
        await query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [purchase.paid_amount, tenantId, purchase.account_id]);
        await query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, description, reference_type, reference_id, date)
           VALUES (?, ?, 'credit', ?, 'Purchase deletion reversal', 'purchase', ?, ?)`,
          [tenantId, purchase.account_id, purchase.paid_amount, id, pktToday()]
        );
      }

      // 4. Mark as deleted
      await query('UPDATE purchases SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);

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
      // 1. Insert into purchases (both purchase_no and purchase_number)
      const [pRes] = await conn.query(
        `INSERT INTO purchases (
          tenant_id, purchase_no, purchase_number, supplier_id, supplier_name, subtotal,
          tax, shipping_cost, grand_total, paid_amount, due_amount,
          payment_method, payment_mode, payment_status, account_id, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
        [
          tenantId, purchaseNum, purchaseNum, po.supplier_id, po.supplier_name, po.subtotal,
          po.tax, po.shipping_cost, po.total_amount, paid_amount, dueAmount,
          payment_method, payment_method, (dueAmount <= 0 ? 'paid' : (paid_amount > 0 ? 'partial' : 'due')),
          account_id || null, `Converted from PO: ${po.po_no}`
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

      // 3. Update supplier balance & ledger if due
      if (po.supplier_id && dueAmount > 0) {
        await conn.query('UPDATE suppliers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [dueAmount, tenantId, po.supplier_id]);
        const poSupBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, po.supplier_id]);
        await conn.query(
          `INSERT INTO supplier_ledger (
            tenant_id, supplier_id, date, type, amount, description, debit, credit, balance, reference_type, reference_id
          ) VALUES (?, ?, ?, 'purchase', ?, ?, 0, ?, ?, 'purchase', ?)`,
          [tenantId, po.supplier_id, pktNow(), dueAmount, `Purchase #${purchaseNum} (Converted from PO ${po.po_no})`, dueAmount, poSupBalAfter, newPurchId]
        );
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
