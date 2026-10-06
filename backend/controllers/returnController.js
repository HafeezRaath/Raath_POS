// ============================================================
//  backend/controllers/returnController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// --- Sale Returns ---
exports.getSaleReturns = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { customer_id, sale_id } = req.query;
    let sql = `
      SELECT sr.*, 
             sr.return_number AS return_no,
             sr.total_refund AS refund_amount,
             sr.total_refund AS total_amount,
             sr.payment_method AS payment_mode,
             s.invoice_no,
             COALESCE(c.name, s.customer_name) AS customer_name, 
             c.phone AS customer_phone
      FROM sale_returns sr
      LEFT JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.tenant_id = ? AND sr.is_deleted = 0
    `;
    const params = [tenantId];
    if (customer_id) { sql += ` AND sr.customer_id = ?`; params.push(customer_id); }
    if (sale_id) { sql += ` AND sr.sale_id = ?`; params.push(sale_id); }
    sql += ` ORDER BY sr.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getSaleReturnById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const [rows] = await query(`SELECT * FROM sale_returns WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (!rows) return res.status(404).json({ success: false, error: 'Sale return not found' });

    const items = await query(`SELECT * FROM sale_return_items WHERE tenant_id = ? AND sale_return_id = ?`, [tenantId, id]);
    rows.items = items;
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createSaleReturn = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      sale_id = null, invoice_no = '', customer_id = null,
      return_no = '', return_number = '',
      total_amount = 0, refund_amount = 0, total_refund = 0,
      payment_mode = 'cash', payment_method = 'cash',
      account_id = null, reason = '', return_date, items = []
    } = req.body;

    const returnNumber = return_no || return_number || ('SR-' + Date.now().toString().slice(-6));
    const refAmt = parseFloat(refund_amount) || parseFloat(total_refund) || parseFloat(total_amount) || 0;
    const payMethod = payment_mode || payment_method || 'cash';
    const retDate = return_date ? new Date(return_date) : new Date();

    const retId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO sale_returns 
         (tenant_id, return_number, sale_id, customer_id, total_refund, payment_method, account_id, reason, return_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, returnNumber, sale_id || null, customer_id || null, refAmt, payMethod, account_id || null, reason || '', retDate]
      );

      const id = ins.insertId;

      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const prodId = item.product_id || item.productId || null;
          const varId = item.product_variant_id || item.variant_id || item.variantId || null;
          const qty = parseFloat(item.quantity !== undefined ? item.quantity : (item.returnQty || 1)) || 1;
          const uPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : (item.price || item.returnPrice || 0)) || 0;
          const tot = parseFloat(item.total !== undefined ? item.total : (item.sub_total || (qty * uPrice))) || (qty * uPrice);

          await conn.query(
            `INSERT INTO sale_return_items (tenant_id, sale_return_id, product_id, quantity, unit_price, total)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tenantId, id, prodId, qty, uPrice, tot]
          );

          // Restore product stock
          if (prodId) {
            await conn.query(`UPDATE products SET stock = stock + ? WHERE tenant_id = ? AND id = ?`, [qty, tenantId, prodId]);
          }
          // Restore variant stock
          if (varId) {
            await conn.query(`UPDATE product_variants SET stock = stock + ? WHERE tenant_id = ? AND id = ?`, [qty, tenantId, varId]);
          }
        }
      }

      // If refunded from account, deduct account balance and record transaction
      if (account_id && refAmt > 0) {
        await conn.query(`UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`, [refAmt, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
           VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'sale_return', ?, CURDATE())`,
          [tenantId, account_id, refAmt, tenantId, account_id, `Refund for Return #${returnNumber}`, id]
        );
      }

      // If customer balance adjustment
      if (customer_id && refAmt > 0) {
        await conn.query(`UPDATE customers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`, [refAmt, tenantId, customer_id]);
        await conn.query(
          `INSERT INTO customer_ledger (tenant_id, customer_id, date, description, debit, credit, balance, reference_type, reference_id)
           VALUES (?, ?, CURDATE(), ?, 0, ?, (SELECT current_balance FROM customers WHERE tenant_id = ? AND id = ?), 'sale_return', ?)`,
          [tenantId, customer_id, `Return #${returnNumber}`, refAmt, tenantId, customer_id, id]
        );
      }

      return id;
    });

    res.status(201).json({
      success: true,
      message: 'Sale return created',
      data: {
        id: retId,
        lastInsertRowid: retId,
        return_number: returnNumber,
        return_no: returnNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Purchase Returns ---
exports.getPurchaseReturns = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { supplier_id, purchase_id } = req.query;
    let sql = `
      SELECT pr.*, s.name AS supplier_name, s.phone AS supplier_phone
      FROM purchase_returns pr
      JOIN suppliers s ON pr.supplier_id = s.id
      WHERE pr.tenant_id = ? AND pr.is_deleted = 0
    `;
    const params = [tenantId];
    if (supplier_id) { sql += ` AND pr.supplier_id = ?`; params.push(supplier_id); }
    if (purchase_id) { sql += ` AND pr.purchase_id = ?`; params.push(purchase_id); }
    sql += ` ORDER BY pr.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createPurchaseReturn = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      purchase_id = null, supplier_id, total_amount = 0,
      grand_total, notes = '', items = []
    } = req.body;

    const returnNo = 'PR-' + Date.now();
    const gTotal = parseFloat(grand_total) || parseFloat(total_amount) || 0;

    const retId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO purchase_returns (tenant_id, purchase_id, return_no, supplier_id, total_amount, grand_total, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'processed')`,
        [tenantId, purchase_id, returnNo, supplier_id, total_amount, gTotal, notes]
      );

      const id = ins.insertId;

      for (const item of items) {
        await conn.query(
          `INSERT INTO purchase_return_items (tenant_id, purchase_return_id, product_id, product_variant_id, quantity, return_price, sub_total, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, id, item.product_id || null, item.product_variant_id || null, item.quantity || 1, item.return_price || item.price || 0, item.sub_total || item.total || 0, item.reason || '']
        );

        // Deduct inventory
        if (item.product_id) {
          await conn.query(`UPDATE products SET stock = stock - ? WHERE tenant_id = ? AND id = ?`, [item.quantity || 1, tenantId, item.product_id]);
        }
        if (item.product_variant_id) {
          await conn.query(`UPDATE product_variants SET stock = stock - ? WHERE tenant_id = ? AND id = ?`, [item.quantity || 1, tenantId, item.product_variant_id]);
        }
      }

      // Update supplier balance
      if (supplier_id && gTotal > 0) {
        await conn.query(`UPDATE suppliers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`, [gTotal, tenantId, supplier_id]);
        await conn.query(
          `INSERT INTO supplier_ledger (tenant_id, supplier_id, type, amount, debit, balance, description, reference_type, reference_id, date)
           VALUES (?, ?, 'return', ?, ?, (SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?), ?, 'purchase_return', ?, NOW())`,
          [tenantId, supplier_id, gTotal, gTotal, tenantId, supplier_id, `Purchase Return #${returnNo}`, id]
        );
      }

      return id;
    });

    res.status(201).json({ success: true, message: 'Purchase return created', data: { id: retId, return_no: returnNo } });
  } catch (error) {
    next(error);
  }
};
