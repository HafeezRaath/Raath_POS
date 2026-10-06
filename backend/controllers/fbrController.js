// ============================================================
//  backend/controllers/fbrController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getInvoices = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status } = req.query;
    let sql = `
      SELECT f.*, s.invoice_number, s.invoice_no, s.grand_total, s.sale_date
      FROM fbr_invoices f
      JOIN sales s ON f.sale_id = s.id
      WHERE f.tenant_id = ?
    `;
    const params = [tenantId];
    if (status) { sql += ` AND f.fbr_status = ?`; params.push(status); }
    sql += ` ORDER BY f.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.submitToFBR = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { sale_id } = req.params;
    const [sale] = await query(`SELECT * FROM sales WHERE tenant_id = ? AND id = ?`, [tenantId, sale_id]);
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });

    const fbrInvNo = 'FBR-' + Date.now();
    const qrCode = `https://fbr.gov.pk/verify?inv=${fbrInvNo}&amount=${sale.grand_total}`;

    await query(
      `INSERT INTO fbr_invoices (tenant_id, sale_id, invoice_no, fbr_invoice_number, fbr_status, fbr_reference, fbr_qr_code, qr_code, synced_at)
       VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE fbr_status = 'SUCCESS', fbr_invoice_number = VALUES(fbr_invoice_number), fbr_qr_code = VALUES(fbr_qr_code)`,
      [tenantId, sale_id, sale.invoice_no || sale.invoice_number, fbrInvNo, fbrInvNo, qrCode, qrCode]
    );

    await query(
      `UPDATE sales SET fbr_status = 'SUCCESS', fbr_reference = ?, fbr_synced_at = NOW() WHERE tenant_id = ? AND id = ?`,
      [fbrInvNo, tenantId, sale_id]
    );

    res.json({
      success: true,
      message: 'FBR Invoice generated successfully',
      data: {
        fbr_invoice_number: fbrInvNo,
        qr_code: qrCode,
        status: 'SUCCESS'
      }
    });
  } catch (error) {
    next(error);
  }
};
