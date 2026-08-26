// ============================================================
//  sync.js - Cloud Sync Controller
// ============================================================

import { SYNC_ENABLED } from './config.js';
import { cloudSync as _cloudSyncModule } from '../../cloudSync.js';

// ==================== CLOUD SYNC MODULE ====================
const _cloudSync = _cloudSyncModule || null;
const _cloudSyncLoaded = !!_cloudSyncModule;

if (_cloudSyncLoaded) {
  console.log('[Storage] Cloud sync loaded successfully');
} else {
  console.warn('[Storage] Cloud sync not available - running offline');
}

export { _cloudSync as cloudSync };

// ==================== SYNC QUEUE TYPE ====================
/** @typedef {{ collection: string; data: Record<string, any> & { id: string }; operation: 'push' | 'remove' }} SyncJob */

// ==================== SYNC STATE ====================
/** @type {SyncJob[]} */
const _syncQueue = [];
let _isSyncProcessing = false;
let _backupLock = false;

export function getSyncQueue() { return [..._syncQueue]; }
export function getIsSyncProcessing() { return _isSyncProcessing; }
export function getBackupLock() { return _backupLock; }
export function setBackupLock(val) { _backupLock = val; }

// ==================== PROCESS SINGLE JOB ====================
/**
 * @param {SyncJob} job
 * @returns {Promise<void>}
 */
async function processSingleJob(job) {
  if (!_cloudSyncLoaded || !_cloudSync) {
    _syncQueue.unshift(job);
    console.log('[Sync] Cloud sync not ready yet, re-queued job');
    return;
  }

  const { collection, data, operation } = job;
  try {
    if (operation === 'push') {
      await _cloudSync.push(collection, data);
    } else if (operation === 'remove') {
      const id = typeof data === 'string' ? data : data.id;
      await _cloudSync.remove(collection, id);
    }
  } catch (err) {
    console.error(`[Storage] Cloud sync failed for ${collection}:`, err);
  }
}

// ==================== PROCESS QUEUE ====================
/** @returns {Promise<void>} */
export async function processSyncQueue() {
  if (_isSyncProcessing || _syncQueue.length === 0) return;
  
  if (!_cloudSyncLoaded || !_cloudSync) {
    console.log('[Sync] Waiting for cloud sync module to load...');
    return;
  }

  _isSyncProcessing = true;

  try {
    while (_syncQueue.length > 0) {
      const batch = _syncQueue.splice(0, 10);
      const promises = batch.map((job) => processSingleJob(job));
      await Promise.allSettled(promises);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    _isSyncProcessing = false;
    if (_syncQueue.length > 0) {
      processSyncQueue();
    }
  }
}

// ==================== SYNC WRAPPER ====================
/**
 * @param {string} collection
 * @param {Record<string, any> & { id: string }} data
 * @param {'push' | 'remove'} [operation]
 */
export async function syncToCloud(collection, data, operation = 'push') {
  if (!SYNC_ENABLED) return;
  if (!data || !data.id) {
    console.warn('[Storage] Sync skipped - no id in data');
    return;
  }
  if (_backupLock) {
    console.log('[Sync] Backup in progress, queuing sync');
    _syncQueue.push({ collection, data, operation });
    return;
  }
  
  _syncQueue.push({ collection, data, operation });
  
  if (_cloudSyncLoaded && _cloudSync) {
    processSyncQueue();
  } else {
    console.log('[Sync] Queued for cloud sync (module loading...)');
  }
}