const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getDb } = require('../database/connection');
const { sanitizeInput, validatePositiveNumber } = require('../utils/validators');
const { createHandler } = require('./helpers');

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

function registerFbrHandlers() {
  // ===== FBR HANDLERS =====
  ipcMain.handle('db:getFbrInvoiceBySaleId', createHandler(async (event, saleId) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.prepare("SELECT * FROM fbr_invoices WHERE sale_id = ?").get(saleId);
  }));

  ipcMain.handle('db:getFbrInvoiceById', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.prepare("SELECT * FROM fbr_invoices WHERE id = ?").get(id);
  }));

  ipcMain.handle('db:getFbrInvoices', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) return [];

    let sql = `
      SELECT fi.*, s.customer_name, s.grand_total, s.date
      FROM fbr_invoices fi
      LEFT JOIN sales s ON fi.sale_id = s.id
    `;
    const params = [];
    const whereClauses = [];

    if (filters.status) { whereClauses.push("fi.fbr_status = ?"); params.push(filters.status); }
    if (filters.fromDate) { whereClauses.push("fi.created_at >= ?"); params.push(filters.fromDate); }
    if (filters.toDate) { whereClauses.push("fi.created_at <= ?"); params.push(filters.toDate); }
    if (filters.invoiceNo) { whereClauses.push("fi.invoice_no LIKE ?"); params.push('%' + filters.invoiceNo + '%'); }

    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ");
    }

    sql += " ORDER BY fi.created_at DESC";
    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:updateFbrInvoice', createHandler(async (event, id, data) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const allowedFields = [
      'fbr_status', 'fbr_reference', 'fbr_qr_code', 'error_message',
      'fbr_response', 'retry_count', 'synced_at', 'last_retry_at',
      'fbr_tax_rate', 'fbr_tax_amount'
    ];

    const sanitized = require('../utils/validators').sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE fbr_invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    if (data.fbr_status || data.fbr_reference) {
      const fbr = db.prepare("SELECT sale_id FROM fbr_invoices WHERE id = ?").get(id);
      if (fbr) {
        const updates = [];
        const updateValues = [];
        if (data.fbr_status) {
          updates.push('fbr_status = ?');
          updateValues.push(data.fbr_status);
        }
        if (data.fbr_reference) {
          updates.push('fbr_reference = ?');
          updateValues.push(data.fbr_reference);
        }
        if (data.fbr_status === 'SYNCED' || data.synced_at) {
          updates.push('fbr_synced_at = ?');
          updateValues.push(data.synced_at || new Date().toISOString());
        }
        if (data.fbr_tax_rate !== undefined) {
          updates.push('fbr_tax_rate = ?');
          updateValues.push(validatePositiveNumber(data.fbr_tax_rate, 0));
        }
        if (data.fbr_tax_amount !== undefined) {
          updates.push('fbr_tax_amount = ?');
          updateValues.push(validatePositiveNumber(data.fbr_tax_amount, 0));
        }

        if (updates.length > 0) {
          updateValues.push(fbr.sale_id);
          db.prepare(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`).run(...updateValues);
        }
      }
    }

    return { changes: result.changes };
  }));

  ipcMain.handle('db:getPendingFbrInvoices', createHandler(async (event, limit = 50) => {
    const db = getDb();
    if (!db) return [];

    const maxRetries = 5;
    const retryDelayMinutes = 60;

    return db.prepare(`
      SELECT fi.*, s.customer_name, s.grand_total, s.date, s.customer_ntn
      FROM fbr_invoices fi
      LEFT JOIN sales s ON fi.sale_id = s.id
      WHERE fi.fbr_status IN ('PENDING', 'FAILED')
      AND COALESCE(fi.retry_count, 0) < ?
      AND (
        fi.last_retry_at IS NULL 
        OR datetime(fi.last_retry_at) < datetime('now', '-' || ? || ' minutes')
      )
      ORDER BY fi.created_at ASC LIMIT ?
    `).all(maxRetries, retryDelayMinutes, limit) || [];
  }));

  ipcMain.handle('db:getFbrStats', createHandler(async () => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    return db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN fbr_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN fbr_status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN fbr_status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN fbr_status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN fbr_status = 'MANUAL' THEN 1 ELSE 0 END) as manual,
        SUM(CASE WHEN DATE(synced_at) = DATE('now') THEN 1 ELSE 0 END) as todaySynced
      FROM fbr_invoices
    `).get() || { total: 0, pending: 0, synced: 0, failed: 0, cancelled: 0, manual: 0, todaySynced: 0 };
  }));

  ipcMain.handle('fbr-post-invoice', async (event, { url, token, data }) => {
    return new Promise((resolve) => {
      const postData = JSON.stringify(data);
      const parsedUrl = new URL(url);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-POS-ID': data.bposId || '001',
          'X-Business-NTN': data.businessNtn || ''
        },
        rejectUnauthorized: !isDev,
        timeout: 30000,
      };

      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const req = protocol.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(responseData);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: json,
            });
          } catch (e) {
            resolve({
              ok: false,
              status: res.statusCode,
              data: { errorMessage: responseData || 'Invalid JSON response' },
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          ok: false,
          status: 0,
          data: { errorMessage: err.message || 'Connection failed' },
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: false,
          status: 0,
          data: { errorMessage: 'Request timeout (30s)' },
        });
      });

      req.write(postData);
      req.end();
    });
  });
}

module.exports = { registerFbrHandlers };