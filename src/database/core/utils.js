// ============================================================
//  util.js - Utilities, ID Generation, Password & Helpers
// ============================================================

import { isElectron } from './config.js';

// ==================== ID GENERATION ====================
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const counter = (window._idCounter = (window._idCounter || 0) + 1);
  return `${timestamp}-${random}-${counter}`;
}

// ==================== DUPLICATE HANDLER ====================
export const DUPLICATE_TRACKERS = {
  sku: new Set(),
  invoice_no: new Set()
};

export function resetDuplicateTrackers() {
  DUPLICATE_TRACKERS.sku.clear();
  DUPLICATE_TRACKERS.invoice_no.clear();
}

/**
 * Agar koi field duplicate ho toh auto-unique bana dega
 */
export function ensureUnique(value, type) {
  if (!value || String(value).trim() === '') {
    return type === 'sku' ? `SKU-${Date.now()}` : `INV-${Date.now()}`;
  }
  
  let uniqueValue = String(value).trim();
  let counter = 1;
  const tracker = DUPLICATE_TRACKERS[type];
  
  while (tracker.has(uniqueValue)) {
    const suffix = type === 'sku' 
      ? `-D${counter}` 
      : `-D${String(counter).padStart(3, '0')}`;
    uniqueValue = `${String(value).trim()}${suffix}`;
    counter++;
  }
  
  tracker.add(uniqueValue);
  return uniqueValue;
}

// ==================== PASSWORD HASHING ====================
export function hashPassword(password) {
  const salt = crypto.randomBytes ? 
    crypto.randomBytes(16).toString('hex') : 
    Math.random().toString(36).substring(2, 18);
  
  if (isElectron && window.electronAPI && window.electronAPI.pbkdf2Hash) {
    return window.electronAPI.pbkdf2Hash(password, salt);
  }
  
  const encoder = new TextEncoder();
  const saltBuffer = encoder.encode(salt);
  const passwordBuffer = encoder.encode(password);
  
  return crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits'])
    .then(key => crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' },
      key, 256
    ))
    .then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `${salt}:${hash}`;
    });
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  
  const [salt, hash] = storedHash.split(':');
  
  if (isElectron && window.electronAPI && window.electronAPI.pbkdf2Verify) {
    return window.electronAPI.pbkdf2Verify(password, salt, hash);
  }
  
  const encoder = new TextEncoder();
  const saltBuffer = encoder.encode(salt);
  const passwordBuffer = encoder.encode(password);
  
  const key = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hash === computedHash;
}

// ==================== MATH HELPERS ====================
export function safeAdd(a, b) { 
  const val = (parseFloat(a || 0) + parseFloat(b || 0));
  return Math.round(val * 10000) / 10000;
}

export function safeSub(a, b) { 
  const val = (parseFloat(a || 0) - parseFloat(b || 0));
  return Math.round(val * 10000) / 10000;
}

export function safeMul(a, b) { 
  const val = (parseFloat(a || 0) * parseFloat(b || 0));
  return Math.round(val * 10000) / 10000;
}

export function sleep(ms) { 
  return new Promise(resolve => setTimeout(resolve, ms)); 
}