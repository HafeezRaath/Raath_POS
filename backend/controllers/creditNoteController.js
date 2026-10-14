// ============================================================
//  creditNoteController.js — Supplier Credit Notes / Rebates
//  The Rs. 7,500 vs Rs. 7,200 dilemma: historical purchases stay
//  intact; the post-purchase price drop is credited to the
//  supplier ledger AND to a Purchase Discount / Rebate account.
// ============================================================
const { query, transaction } = require('../config/db');

// --- Create credit note ---
exports.createCreditNote = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { supplier_id, amount, reason = '', purchase_id = null, note_no = '' } = req.body;

    if (!supplier_id) return res.status(400).json({ success: false, error: 'Supplier is required' });
    if (!(Number(amount) > 0)) return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });

    const amt = Number(amount);
    const result = await transaction(async (conn) => {
      const no = note_no || `CN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Date.now().toString().slice(-5)}`;

      const [cn] = await conn.query(
        `INSERT INTO supplier_credit_notes (tenant_id, supplier_id, note_no, purchase_id, amount, reason, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'applied', ?)`,
        [tenantId, supplier_id, no, purchase_id, amt, reason, req.user?.id || null]
      );

      // 1. Reduce supplier payable (we owe them less now)
      await conn.query(
        `UPDATE suppliers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?`,
        [amt, tenantId, supplier_id]
      );

      // 2. Ledger entry: credit reduces payable; balance snapshot after update
      await conn.query(
        `INSERT INTO supplier_ledger (tenant_id, supplier_id, description, debit, credit, balance, reference_type, reference_id)
         VALUES (?, ?, ?, 0, ?, (SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?), 'credit_note', ?)`,
        [tenantId, supplier_id, `Credit Note ${no} — ${reason || 'price drop / rebate'}`, amt, tenantId, supplier_id, cn.insertId]
      );

      // 3. Book to Purchase Discount / Rebate income account (profit, past invoices untouched)
      const [acc] = await conn.query(
        `SELECT id FROM accounts WHERE tenant_id = ? AND (name LIKE '%rebate%' OR name LIKE '%discount%') AND is_deleted = 0 LIMIT 1`,
        [tenantId]
      );
      let accountId = acc?.id || null;
      if (!accountId) {
        const [na] = await conn.query(
          `INSERT INTO accounts (tenant_id, name, type, current_balance) VALUES (?, 'Purchase Discount / Rebate', 'income', 0)`,
          [tenantId]
        );
        accountId = na.insertId;
      }
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [amt, accountId]
      );
      await conn.query(
        `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
         VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE id = ?), ?, 'supplier_credit_note', CURDATE())`,
        [tenantId, accountId, amt, accountId, `Supplier Credit Note ${no} — supplier #${supplier_id}`]
      );

      return { id: cn.insertId, note_no: no };
    });

    res.status(201).json({ success: true, message: `Credit note ${result.note_no} applied — Rs. ${amt.toLocaleString()} credited`, data: result });
  } catch (error) {
    next(error);
  }
};

// --- List credit notes for a supplier ---
exports.listCreditNotes = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { supplier_id = '' } = req.query;
    let sql = `SELECT cn.*, s.name AS supplier_name
               FROM supplier_credit_notes cn JOIN suppliers s ON s.id = cn.supplier_id
               WHERE cn.tenant_id = ?`;
    const params = [tenantId];
    if (supplier_id) { sql += ` AND cn.supplier_id = ?`; params.push(supplier_id); }
    sql += ` ORDER BY cn.id DESC LIMIT 200`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Void a credit note (reverses ledger + account effects) ---
exports.voidCreditNote = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(`SELECT * FROM supplier_credit_notes WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Credit note not found' });
    const cn = rows[0];
    if (cn.status === 'void') return res.status(409).json({ success: false, error: 'Already voided' });

    await transaction(async (conn) => {
      await conn.query(`UPDATE supplier_credit_notes SET status = 'void' WHERE id = ?`, [id]);
      // Reverse supplier payable
      await conn.query(`UPDATE suppliers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?`, [cn.amount, tenantId, cn.supplier_id]);
      await conn.query(
        `INSERT INTO supplier_ledger (tenant_id, supplier_id, description, debit, credit, balance, reference_type, reference_id)
         VALUES (?, ?, ?, ?, 0, (SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?), 'credit_note_void', ?)`,
        [tenantId, cn.supplier_id, `VOID Credit Note ${cn.note_no}`, cn.amount, tenantId, cn.supplier_id, id]
      );
      // Reverse rebate account
      const [acc] = await conn.query(
        `SELECT id FROM accounts WHERE tenant_id = ? AND name = 'Purchase Discount / Rebate' LIMIT 1`, [tenantId]
      );
      if (acc) {
        await conn.query(`UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`, [cn.amount, acc.id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
           VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE id = ?), ?, 'supplier_credit_note_void', CURDATE())`,
          [tenantId, acc.id, cn.amount, acc.id, `VOID Credit Note ${cn.note_no}`]
        );
      }
    });

    res.json({ success: true, message: `Credit note ${cn.note_no} voided and reversed` });
  } catch (error) {
    next(error);
  }
};
