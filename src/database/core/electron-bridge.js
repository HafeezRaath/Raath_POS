// ============================================================
//  electron-bridge.js - Electron SQLite Bridge with Mutex
// ============================================================

export class ElectronBridge {
  constructor() {
    this._inTransaction = false;
    this._dbMutex = Promise.resolve();
    this._mutexCounter = 0;
    this._reentrantGuard = new Set();
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== REENTRANT MUTEX ====================
  async _withMutex(fn, callerId = 'default') {
    const lockId = `${callerId}_${++this._mutexCounter}`;
    
    if (this._reentrantGuard.has(callerId)) {
      console.warn(`[Mutex] Reentrant call detected for ${callerId}, allowing`);
      return fn();
    }
    
    this._reentrantGuard.add(callerId);
    
    const oldMutex = this._dbMutex;
    let release;
    const newMutex = new Promise(resolve => { release = resolve; });
    this._dbMutex = oldMutex.then(() => newMutex).catch(() => newMutex);
    await oldMutex.catch(() => {});
    
    try {
      return await fn();
    } finally {
      this._reentrantGuard.delete(callerId);
      release();
    }
  }

  // ==================== QUERY WITH RETRY & BUSY HANDLING ====================
  async query(sql, params = [], retries = 5) {
    if (this._inTransaction) {
      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          if (!window.electronAPI || !window.electronAPI.dbQuery) {
            throw new Error('Electron API not available');
          }
          return await window.electronAPI.dbQuery(sql, params);
        } catch (error) {
          lastError = error;
          if (error.message && error.message.includes('SQLITE_BUSY')) {
            await this._sleep(50 * Math.pow(2, i) + Math.random() * 50);
            continue;
          }
          throw error;
        }
      }
      throw lastError || new Error('Query failed after retries');
    }
    
    return this._withMutex(async () => {
      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          if (!window.electronAPI || !window.electronAPI.dbQuery) {
            throw new Error('Electron API not available');
          }
          return await window.electronAPI.dbQuery(sql, params);
        } catch (error) {
          lastError = error;
          if (error.message && error.message.includes('SQLITE_BUSY')) {
            await this._sleep(50 * Math.pow(2, i) + Math.random() * 50);
            continue;
          }
          throw error;
        }
      }
      throw lastError || new Error('Query failed after retries');
    }, 'electronQuery');
  }

  // ==================== TRANSACTION WRAPPER ====================
  async transaction(callback) {
    this._inTransaction = true;
    try {
      await this.query('BEGIN TRANSACTION');
      const result = await callback();
      await this.query('COMMIT');
      return result;
    } catch (error) {
      try { await this.query('ROLLBACK'); } catch (e) {}
      throw error;
    } finally {
      this._inTransaction = false;
    }
  }
}