// ============================================================
//  backend/controllers/returnController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');
const batchController = require('./batchController');

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
      account_id = null, reason = '', return_date, items = [],
      split_payments = null, actual_refunded = 0, unrefunded_amount = 0
    } = req.body;

    const returnNumber = return_no || return_number || ('SR-' + Date.now().toString().slice(-6));
    const refAmt = parseFloat(refund_amount) || parseFloat(total_refund) || parseFloat(total_amount) || 0;
    const payMethod = payment_mode || payment_method || 'cash';
    const retDate = return_date ? new Date(return_date) : new Date();
    const splitJson = (Array.isArray(split_payments) && split_payments.length > 0) ? JSON.stringify(split_payments) : null;

    // ─── DUPLICATE-RETURN GUARD (QA-031): never return more than was sold ───
    if (sale_id && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.product_id || item.productId || null;
        if (!prodId) continue;
        const qty = parseFloat(item.quantity !== undefined ? item.quantity : (item.returnQty || 1)) || 1;
        const soldRows = await query(
          `SELECT COALESCE(SUM(quantity),0) AS q FROM sale_items WHERE tenant_id = ? AND sale_id = ? AND product_id = ?`,
          [tenantId, sale_id, prodId]
        );
        const retRows = await query(
          `SELECT COALESCE(SUM(sri.quantity),0) AS q FROM sale_return_items sri
           JOIN sale_returns sr ON sr.id = sri.sale_return_id
           WHERE sr.tenant_id = ? AND sr.sale_id = ? AND sr.is_deleted = 0 AND sri.product_id = ?`,
          [tenantId, sale_id, prodId]
        );
        const soldQ = parseFloat(soldRows[0]?.q) || 0;
        const retQ = parseFloat(retRows[0]?.q) || 0;
        if (soldQ > 0 && retQ + qty > soldQ) {
          return res.status(409).json({
            success: false,
            error: `Already returned: only ${Math.max(0, soldQ - retQ)} more of "${item.product_name || item.name || 'this item'}" can be returned for invoice #${invoice_no || sale_id}`
          });
        }
      }
    }

    const retId = await transaction(async (conn) => {
      let id;
      try {
        const [ins] = await conn.query(
          `INSERT INTO sale_returns 
           (tenant_id, return_number, sale_id, customer_id, total_refund, payment_method, account_id, reason, return_date, split_payments, actual_refunded, unrefunded_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, returnNumber, sale_id || null, customer_id || null, refAmt, payMethod, account_id || null, reason || '', retDate, splitJson, actual_refunded || 0, unrefunded_amount || 0]
        );
        id = ins.insertId;
      } catch (colErr) {
        // Fallback if extra columns not yet present in table
        const [ins] = await conn.query(
          `INSERT INTO sale_returns 
           (tenant_id, return_number, sale_id, customer_id, total_refund, payment_method, account_id, reason, return_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, returnNumber, sale_id || null, customer_id || null, refAmt, payMethod, account_id || null, reason || '', retDate]
        );
        id = ins.insertId;
      }

      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const prodId = item.product_id || item.productId || null;
          const varId = item.product_variant_id || item.variant_id || item.variantId || null;
          const qty = parseFloat(item.quantity !== undefined ? item.quantity : (item.returnQty || 1)) || 1;
          const uPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : (item.price || item.returnPrice || 0)) || 0;
          const tot = parseFloat(item.total !== undefined ? item.total : (item.sub_total || (qty * uPrice))) || (qty * uPrice);

          // v78/QA-048: product_variant_id bhi store karo (pehle drop ho raha tha)
          await conn.query(
            `INSERT INTO sale_return_items (tenant_id, sale_return_id, product_id, product_variant_id, quantity, unit_price, total)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, id, prodId, varId, qty, uPrice, tot]
          );

          // 1. Resolve product_id if only variant was passed
          let resolvedProdId = prodId;
          if (!resolvedProdId && varId) {
            const [pvRows] = await conn.query(`SELECT product_id FROM product_variants WHERE tenant_id = ? AND id = ?`, [tenantId, varId]);
            if (pvRows && pvRows.length > 0) resolvedProdId = pvRows[0].product_id;
          }

          // 2. Restore base product stock
          if (resolvedProdId) {
            await conn.query(`UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE tenant_id = ? AND id = ?`, [qty, tenantId, resolvedProdId]);
          }

          // 3. Restore variant stock (both stock and current_stock)
          if (varId) {
            await conn.query(
              `UPDATE product_variants SET 
                stock = COALESCE(stock, 0) + ?, 
                current_stock = COALESCE(current_stock, 0) + ? 
               WHERE tenant_id = ? AND id = ?`,
              [qty, qty, tenantId, varId]
            );
          }

          // 4. Restore batch stock if applicable
          if (resolvedProdId && batchController.restoreBatches) {
            await batchController.restoreBatches(conn, tenantId, resolvedProdId, varId, qty);
          }
        }
      }

      // ─── RESTORE SERIALIZED / IMEI DEVICES TO IN_STOCK ───
      if (sale_id) {
        try {
          const [soldDevices] = await conn.query(
            `SELECT id, product_id, product_variant_id, imei1, imei2 FROM device_imei 
             WHERE tenant_id = ? AND sale_id = ? AND status = 'SOLD'`,
            [tenantId, sale_id]
          );
          if (Array.isArray(soldDevices) && soldDevices.length > 0) {
            for (const dev of soldDevices) {
              await conn.query(
                `UPDATE device_imei SET status = 'IN_STOCK', sale_id = NULL, customer_id = NULL, customer_name = NULL WHERE id = ?`,
                [dev.id]
              );
              await conn.query(
                `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, ref_type, ref_id, user_id, notes)
                 VALUES (?, ?, 'RETURN', 'SOLD', 'IN_STOCK', 'sale_return', ?, ?, ?)`,
                [tenantId, dev.id, id, req.user?.id || null, `Returned via #${returnNumber}`]
              );
              if (dev.product_variant_id) {
                await conn.query(
                  `UPDATE product_variants SET current_stock = (SELECT COUNT(id) FROM device_imei WHERE tenant_id = ? AND product_variant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0) WHERE id = ?`,
                  [tenantId, dev.product_variant_id, dev.product_variant_id]
                );
              }
            }
          }
        } catch (devErr) {
          console.warn('[Return] Serialized device restoration error (continuing):', devErr.message);
        }
      }

      // ─── ACCOUNT DEDUCTIONS (Only deduct up to available balance: "sirf utni hi jay zyda nhi") ───
      if ((payMethod === 'split' || Array.isArray(split_payments)) && Array.isArray(split_payments) && split_payments.length > 0) {
        for (const sp of split_payments) {
          const spAccId = sp.account_id || sp.accountId;
          const spAmount = parseFloat(sp.amount) || 0;
          if (!spAccId || spAmount <= 0) continue;

          // Check current account balance — "sirf utni hi jay zyda nhi"
          const [accRows] = await conn.query(`SELECT current_balance, name FROM accounts WHERE tenant_id = ? AND id = ?`, [tenantId, spAccId]);
          const spAccRow = Array.isArray(accRows) && accRows.length > 0 ? accRows[0] : null;
          const currentBal = spAccRow ? (parseFloat(spAccRow.current_balance) || 0) : 0;
          const maxDeductible = Math.max(0, currentBal);
          const actualDeduct = Math.min(spAmount, maxDeductible);

          if (actualDeduct > 0) {
            await conn.query(`UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`, [actualDeduct, tenantId, spAccId]);
            await conn.query(
              `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
               VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'sale_return', ?, CURDATE())`,
              [tenantId, spAccId, actualDeduct, tenantId, spAccId, `Refund for Return #${returnNumber} (Split: ${spAccRow?.name || ''})`, id]
            );
          }
        }
      } else if (account_id && refAmt > 0) {
        // Single account: only deduct up to available balance
        const [accRows] = await conn.query(`SELECT current_balance, name FROM accounts WHERE tenant_id = ? AND id = ?`, [tenantId, account_id]);
        const accRow = Array.isArray(accRows) && accRows.length > 0 ? accRows[0] : null;
        const currentBal = accRow ? (parseFloat(accRow.current_balance) || 0) : 0;
        const maxDeductible = Math.max(0, currentBal);
        const actualDeduct = Math.min(refAmt, maxDeductible);

        if (actualDeduct > 0) {
          await conn.query(`UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`, [actualDeduct, tenantId, account_id]);
          await conn.query(
            `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
             VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'sale_return', ?, CURDATE())`,
            [tenantId, account_id, actualDeduct, tenantId, account_id, `Refund for Return #${returnNumber}`, id]
          );
        }
      }

      // ─── CUSTOMER BALANCE & COMPLETE LEDGER ENTRY ───
      if (customer_id && refAmt > 0) {
        const [custRows] = await conn.query(`SELECT current_balance, name FROM customers WHERE tenant_id = ? AND id = ?`, [tenantId, customer_id]);
        const cust = (Array.isArray(custRows) && custRows.length > 0) ? custRows[0] : null;
        const prevBal = cust ? (parseFloat(cust.current_balance) || 0) : 0;

        let balReduction = 0;
        if (sale_id) {
          const [saleRows] = await conn.query(`SELECT due_amount FROM sales WHERE tenant_id = ? AND id = ?`, [tenantId, sale_id]);
          const sale = (Array.isArray(saleRows) && saleRows.length > 0) ? saleRows[0] : null;
          const curDue = sale ? (parseFloat(sale.due_amount) || 0) : 0;
          balReduction = Math.min(curDue, refAmt);
        } else {
          balReduction = Math.min(prevBal, refAmt);
        }

        const newBal = Math.max(0, prevBal - balReduction);
        if (balReduction > 0) {
          await conn.query(`UPDATE customers SET current_balance = ? WHERE tenant_id = ? AND id = ?`, [newBal, tenantId, customer_id]);
        }

        const retItemsJson = (Array.isArray(items) && items.length > 0)
          ? JSON.stringify(items.map(it => ({
              name: it.product_name || it.name || 'Returned Item',
              quantity: parseFloat(it.quantity !== undefined ? it.quantity : (it.returnQty || 1)) || 1,
              price: parseFloat(it.unit_price !== undefined ? it.unit_price : (it.price || 0)) || 0,
              total: parseFloat(it.total !== undefined ? it.total : ((it.quantity || it.returnQty || 1) * (it.unit_price || it.price || 0))) || 0
            })))
          : null;

        await conn.query(
          `INSERT INTO customer_ledger 
           (tenant_id, customer_id, date, type, amount, previous_balance, balance_after, debit, credit, balance, description, payment_mode, reference_type, reference_no, reference_id, sale_id, items_json)
           VALUES (?, ?, ?, 'sale_return', ?, ?, ?, 0, ?, ?, ?, ?, 'sale_return', ?, ?, ?, ?)`,
          [
            tenantId,
            customer_id,
            retDate,
            -balReduction,
            prevBal,
            newBal,
            balReduction,
            newBal,
            `Sale Return #${returnNumber} for Invoice #${invoice_no || sale_id || ''}`,
            payMethod,
            returnNumber,
            id,
            sale_id || null,
            retItemsJson
          ]
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

// v77: purchase return detail (items ke sath) — frontend dialog isko call karta hai
exports.getPurchaseReturnById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(
      `SELECT pr.*, s.name AS supplier_name, s.phone AS supplier_phone, p.purchase_no
       FROM purchase_returns pr
       LEFT JOIN suppliers s ON s.id = pr.supplier_id AND s.tenant_id = pr.tenant_id
       LEFT JOIN purchases p ON p.id = pr.purchase_id AND p.tenant_id = pr.tenant_id
       WHERE pr.tenant_id = ? AND pr.id = ?`,
      [tenantId, id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase return not found' });
    }
    const ret = rows[0];
    const items = await query(
      `SELECT pri.*, p.name AS product_name, pv.variant_name, pv.sku AS variant_sku
       FROM purchase_return_items pri
       LEFT JOIN products p ON p.id = pri.product_id AND p.tenant_id = pri.tenant_id
       LEFT JOIN product_variants pv ON pv.id = pri.product_variant_id AND pv.tenant_id = pri.tenant_id
       WHERE pri.tenant_id = ? AND pri.purchase_return_id = ?`,
      [tenantId, id]
    );
    ret.items = items || [];
    res.json({ success: true, data: ret });
  } catch (error) {
    next(error);
  }
};

// v78/QA-048: sale return ke items — product name/variant ke saath (raw /query path bypass)
exports.getSaleReturnItemsById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const items = await query(
      `SELECT sri.*, p.name AS product_name, pv.variant_name, pv.sku AS variant_sku
       FROM sale_return_items sri
       LEFT JOIN products p ON p.id = sri.product_id AND p.tenant_id = sri.tenant_id
       LEFT JOIN product_variants pv ON pv.id = sri.product_variant_id AND pv.tenant_id = sri.tenant_id
       WHERE sri.tenant_id = ? AND sri.sale_return_id = ?
       ORDER BY sri.id ASC`,
      [tenantId, id]
    );
    res.json({ success: true, data: items || [] });
  } catch (error) {
    next(error);
  }
};

exports.createPurchaseReturn = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      purchase_id = null, supplier_id, total_amount = 0,
      grand_total, notes = '', items = [],
      payment_mode = 'credit', account_id = null
    } = req.body;

    const returnNo = 'PR-' + Date.now();
    const gTotal = parseFloat(grand_total) || parseFloat(total_amount) || 0;

    // Validate: a return must carry at least one item, otherwise it would
    // move supplier money with no stock movement (phantom return).
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Return must include at least one item' });
    }
    if (purchase_id) {
      const purch = await query('SELECT id FROM purchases WHERE tenant_id = ? AND id = ?', [tenantId, purchase_id]);
      if (purch.length === 0) {
        return res.status(400).json({ success: false, error: 'Purchase not found' });
      }
    }

    const retId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO purchase_returns (tenant_id, purchase_id, return_no, supplier_id, total_amount, grand_total, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'processed')`,
        [tenantId, purchase_id, returnNo, supplier_id, total_amount, gTotal, notes]
      );

      const id = ins.insertId;

      for (const item of items) {
        let prodId = item.product_id || item.productId || null;
        let variantId = (item.product_variant_id && Number(item.product_variant_id) !== 0) ? item.product_variant_id : (item.variant_id || null);
        const purchaseItemId = item.purchase_item_id || item.purchaseItemId || item.id || null;
        const qty = parseFloat(item.quantity || item.return_quantity) || 1;
        const returnPrice = parseFloat(item.return_price || item.price || item.purchase_price) || 0;
        const subTotal = parseFloat(item.sub_total || item.total) || (qty * returnPrice);

        // Fallback: If prodId is missing from client, resolve it from purchase_items!
        if ((!prodId || !variantId) && purchaseItemId) {
          const [piRows] = await conn.query(
            'SELECT product_id, product_variant_id FROM purchase_items WHERE tenant_id = ? AND id = ?',
            [tenantId, purchaseItemId]
          );
          if (Array.isArray(piRows) && piRows.length > 0) {
            if (!prodId) prodId = piRows[0].product_id;
            if (!variantId && piRows[0].product_variant_id) variantId = piRows[0].product_variant_id;
          }
        }

        await conn.query(
          `INSERT INTO purchase_return_items (tenant_id, purchase_return_id, purchase_item_id, product_id, product_variant_id, quantity, return_price, sub_total, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, id, purchaseItemId, prodId, variantId, qty, returnPrice, subTotal, item.reason || '']
        );

        // Deduct inventory from products table
        if (prodId) {
          await conn.query(
            `UPDATE products SET stock = GREATEST(0, stock - ?) WHERE tenant_id = ? AND id = ?`,
            [qty, tenantId, prodId]
          );
        }

        // Deduct inventory from product_variants table
        if (variantId) {
          await conn.query(
            `UPDATE product_variants SET stock = GREATEST(0, stock - ?), current_stock = GREATEST(0, COALESCE(current_stock, 0) - ?) WHERE tenant_id = ? AND id = ?`,
            [qty, qty, tenantId, variantId]
          );
        } else if (prodId) {
          await conn.query(
            `UPDATE product_variants SET stock = GREATEST(0, stock - ?), current_stock = GREATEST(0, COALESCE(current_stock, 0) - ?) WHERE tenant_id = ? AND product_id = ?`,
            [qty, qty, tenantId, prodId]
          );
        }

        // Handle serialized IMEI device if returned
        const imeiVal = item.imei || item.imei1 || (Array.isArray(item.imeis) ? item.imeis : null);
        if (imeiVal) {
          const imeiList = Array.isArray(imeiVal) ? imeiVal : [imeiVal];
          for (const oneImei of imeiList) {
            await conn.query(
              `UPDATE device_imei SET status = 'RETURNED_TO_SUPPLIER', notes = CONCAT(COALESCE(notes, ''), ' [Returned to supplier via #${returnNo}]')
               WHERE tenant_id = ? AND imei1 = ?`,
              [tenantId, String(oneImei).trim()]
            );
          }
        }
      }

      // Update supplier balance / Cash refund
      const isCashRefund = (payment_mode === 'cash' || payment_mode === 'bank') && account_id;
      if (isCashRefund && gTotal > 0) {
        // Direct cash/bank refund from supplier into account
        await conn.query(
          `UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?`,
          [gTotal, tenantId, account_id]
        );
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
           VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'purchase_return', ?, CURDATE())`,
          [tenantId, account_id, gTotal, tenantId, account_id, `Supplier Refund for Purchase Return #${returnNo}`, id]
        );
      } else if (supplier_id && gTotal > 0) {
        // Supplier credit: reduce supplier payable balance
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
