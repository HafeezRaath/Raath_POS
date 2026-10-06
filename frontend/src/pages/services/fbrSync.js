// ============================================================
// fbrSync.js - FBR Background Sync Controller
// Runs in renderer, calls Electron main process for API calls
// ============================================================

import db from '../db';
import { 
  getClientConfig, 
  formatFBRInvoice, 
  postInvoiceToFBR, 
  generateQRData,
  isFBRConfigured 
} from './fbrService';

let _syncInterval = null;
let _isSyncing = false;

/**
 * Start automatic background sync
 * @param {number} intervalMs - Sync interval in ms (default: 2 min)
 */
function startAutoSync(intervalMs = 2 * 60 * 1000) {
  if (_syncInterval) clearInterval(_syncInterval);
  
  console.log(`[FBR Sync] Auto-sync started (${intervalMs}ms)`);
  
  _syncInterval = setInterval(async () => {
    await syncPendingInvoices();
  }, intervalMs);
  
  // Immediate first sync
  syncPendingInvoices();
}

/**
 * Stop automatic sync
 */
function stopAutoSync() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    console.log('[FBR Sync] Auto-sync stopped');
  }
}

/**
 * Manually trigger sync
 */
async function syncPendingInvoices() {
  if (_isSyncing) return;
  if (!isFBRConfigured()) {
    console.log('[FBR Sync] Not configured, skipping');
    return;
  }

  _isSyncing = true;
  
  try {
    // Check internet first
    const online = await checkInternet();
    if (!online) {
      console.log('[FBR Sync] No internet, skipping');
      return;
    }

    // Get pending invoices (limit 5 per batch to avoid overload)
    let pending;
    if (db.mode === 'electron') {
      pending = await db.electronQuery(
        `SELECT * FROM fbr_invoices 
         WHERE fbr_status = 'PENDING' 
         AND retry_count < max_retries 
         ORDER BY created_at ASC 
         LIMIT 5`
      );
    } else {
      const all = await db.query("SELECT * FROM fbr_invoices WHERE fbr_status = 'PENDING'");
      pending = all
        .filter(x => (x.retry_count || 0) < (x.max_retries || 10))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, 5);
    }

    if (!pending || pending.length === 0) return;

    console.log(`[FBR Sync] Processing ${pending.length} pending invoices...`);

    for (const fbrRecord of pending) {
      await processSingleInvoice(fbrRecord);
    }
  } catch (err) {
    console.error('[FBR Sync] Error:', err.message);
  } finally {
    _isSyncing = false;
  }
}

/**
 * Process a single pending invoice
 */
async function processSingleInvoice(fbrRecord) {
  try {
    // Fetch sale data
    let sale, items, customer;
    
    if (db.mode === 'electron') {
      const saleRows = await db.electronQuery(
        "SELECT * FROM sales WHERE id = ?", 
        [fbrRecord.sale_id]
      );
      sale = saleRows[0];
      
      items = await db.electronQuery(
        `SELECT si.*, p.name as product_name, pv.sku 
         FROM sale_items si 
         JOIN products p ON si.product_id = p.id 
         JOIN product_variants pv ON si.product_variant_id = pv.id 
         WHERE si.sale_id = ?`,
        [fbrRecord.sale_id]
      );
      
      if (sale?.customer_id) {
        const custRows = await db.electronQuery(
          "SELECT * FROM customers WHERE id = ?", 
          [sale.customer_id]
        );
        customer = custRows[0];
      }
    } else {
      sale = await db.getSaleById(fbrRecord.sale_id);
      items = await db.getSaleItems(fbrRecord.sale_id);
      customer = sale?.customer_id 
        ? await db.getCustomerById(sale.customer_id) 
        : null;
    }

    if (!sale) {
      await markFailed(fbrRecord.id, 'Sale not found');
      return;
    }

    // Format and send
    const fbrPayload = formatFBRInvoice(sale, items, customer);
    const result = await postInvoiceToFBR(fbrPayload);

    if (result.success) {
      await markSynced(fbrRecord.id, result.reference, sale, result.response);
      console.log(`[FBR Sync] ${sale.invoice_no} synced. Ref: ${result.reference}`);
    } else {
      await markRetry(fbrRecord.id, result.error, result.response);
      console.error(`[FBR Sync] ${sale.invoice_no} failed: ${result.error}`);
    }
  } catch (err) {
    await markRetry(fbrRecord.id, err.message);
    console.error(`[FBR Sync] Invoice ${fbrRecord.id} error:`, err.message);
  }
}

async function markSynced(fbrId, reference, sale, responseJson) {
  const qrData = generateQRData(reference, sale);
  const responseStr = JSON.stringify(responseJson);
  
  if (db.mode === 'electron') {
    await db.electronQuery(
      `UPDATE fbr_invoices 
       SET fbr_status = 'SYNCED', 
           fbr_reference = ?, 
           fbr_qr_code = ?,
           fbr_response = ?,
           synced_at = datetime('now'),
           error_message = NULL,
           last_retry_at = datetime('now')
       WHERE id = ?`,
      [reference, qrData, responseStr, fbrId]
    );
    await db.electronQuery(
      `UPDATE sales SET fbr_status = 'SYNCED', fbr_reference = ?, fbr_synced_at = datetime('now') WHERE id = ?`,
      [reference, sale.id]
    );
  } else {
    // Browser mode - use idbPut
    const all = await db.query("SELECT * FROM fbr_invoices");
    const record = all.find(x => String(x.id) === String(fbrId));
    if (record) {
      record.fbr_status = 'SYNCED';
      record.fbr_reference = reference;
      record.fbr_qr_code = qrData;
      record.fbr_response = responseStr;
      record.synced_at = new Date().toISOString();
      record.last_retry_at = new Date().toISOString();
      record.error_message = null;
      await db.query("UPDATE fbr_invoices SET ? WHERE id = ?", [record, fbrId]);
    }
  }
}

async function markRetry(fbrId, error, responseJson = null) {
  const responseStr = responseJson ? JSON.stringify(responseJson) : null;
  
  if (db.mode === 'electron') {
    await db.electronQuery(
      `UPDATE fbr_invoices 
       SET retry_count = retry_count + 1,
           error_message = ?,
           fbr_response = ?,
           last_retry_at = datetime('now')
       WHERE id = ?`,
      [error, responseStr, fbrId]
    );
  } else {
    const all = await db.query("SELECT * FROM fbr_invoices");
    const record = all.find(x => String(x.id) === String(fbrId));
    if (record) {
      record.retry_count = (record.retry_count || 0) + 1;
      record.error_message = error;
      record.fbr_response = responseStr;
      record.last_retry_at = new Date().toISOString();
      await db.query("UPDATE fbr_invoices SET ? WHERE id = ?", [record, fbrId]);
    }
  }
}

async function markFailed(fbrId, error) {
  if (db.mode === 'electron') {
    await db.electronQuery(
      `UPDATE fbr_invoices 
       SET fbr_status = 'FAILED', 
           error_message = ?,
           last_retry_at = datetime('now')
       WHERE id = ?`,
      [error, fbrId]
    );
  }
}

/**
 * Check internet connectivity
 */
async function checkInternet() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://gw.fbr.gov.pk', { 
      method: 'HEAD', 
      signal: controller.signal,
      mode: 'no-cors'
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get sync statistics for dashboard
 */
async function getFBRStats() {
  if (!isFBRConfigured()) return null;
  
  if (db.mode === 'electron') {
    const pending = await db.electronQuery(
      "SELECT COUNT(*) as count FROM fbr_invoices WHERE fbr_status = 'PENDING'"
    );
    const synced = await db.electronQuery(
      "SELECT COUNT(*) as count FROM fbr_invoices WHERE fbr_status = 'SYNCED'"
    );
    const failed = await db.electronQuery(
      "SELECT COUNT(*) as count FROM fbr_invoices WHERE fbr_status = 'FAILED'"
    );
    const today = await db.electronQuery(
      `SELECT COUNT(*) as count FROM fbr_invoices 
       WHERE fbr_status = 'SYNCED' AND DATE(synced_at) = DATE('now')`
    );
    return {
      pending: pending[0]?.count || 0,
      synced: synced[0]?.count || 0,
      failed: failed[0]?.count || 0,
      todaySynced: today[0]?.count || 0,
    };
  }
  
  // Browser fallback
  const all = await db.query("SELECT * FROM fbr_invoices");
  return {
    pending: all.filter(x => x.fbr_status === 'PENDING').length,
    synced: all.filter(x => x.fbr_status === 'SYNCED').length,
    failed: all.filter(x => x.fbr_status === 'FAILED').length,
    todaySynced: all.filter(x => {
      if (x.fbr_status !== 'SYNCED' || !x.synced_at) return false;
      return x.synced_at.startsWith(new Date().toISOString().split('T')[0]);
    }).length,
  };
}

export {
  startAutoSync,
  stopAutoSync,
  syncPendingInvoices,
  getFBRStats,
  processSingleInvoice,
  checkInternet,
};