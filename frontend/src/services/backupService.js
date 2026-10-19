// ============================================================
//  frontend/src/services/backupService.js — Database Backup & Restore
//  Direct REST API Implementation (No IndexedDB / No SQLite)
// ============================================================

import db from '../database/db';

/**
 * Export all data from the database into a JSON payload
 */
export async function exportFullDatabase() {
  // QA-062: never silently return an empty backup as "success" — throw so the
  // UI shows a real error instead of a misleading "Backup downloaded!" toast.
  const backupData = await db.exportBackup();
  if (!backupData || !backupData.data || Object.keys(backupData.data).length === 0) {
    throw new Error('Backup export returned no data — nothing was downloaded');
  }
  backupData.settings = {
    shop_profile: JSON.parse(localStorage.getItem('shop_profile') || '{}'),
    receipt_settings: JSON.parse(localStorage.getItem('receipt_settings') || '{}'),
    tax_settings: JSON.parse(localStorage.getItem('tax_settings') || '{}')
  };
  return backupData;
}

/**
 * Trigger browser file download with the database export JSON
 */
export function downloadLocalBackupFile(backupPayload) {
  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `Raath_POS_Backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Restore database from an imported JSON payload
 */
export async function restoreDatabaseFromPayload(backupPayload, options = { clearBeforeRestore: false }) {
  if (!backupPayload || typeof backupPayload !== 'object') {
    throw new Error('Invalid backup file. Could not parse database payload.');
  }

  // Restore local storage settings if present
  if (backupPayload.settings) {
    try {
      if (backupPayload.settings.shop_profile) {
        localStorage.setItem('shop_profile', JSON.stringify(backupPayload.settings.shop_profile));
      }
      if (backupPayload.settings.receipt_settings) {
        localStorage.setItem('receipt_settings', JSON.stringify(backupPayload.settings.receipt_settings));
      }
      if (backupPayload.settings.tax_settings) {
        localStorage.setItem('tax_settings', JSON.stringify(backupPayload.settings.tax_settings));
      }
    } catch (e) {
      console.warn('Failed to restore settings:', e);
    }
  }

  return {
    success: true,
    message: 'Settings and local preferences restored successfully.',
    timestamp: new Date().toISOString()
  };
}
