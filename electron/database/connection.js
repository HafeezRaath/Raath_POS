const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { log, LOG_LEVELS } = require('../utils/logger');

let Mutex;
try {
  const asyncMutex = require('async-mutex');
  Mutex = asyncMutex.Mutex;
} catch (e) {
  class MutexFallback {
    constructor() { this._locked = false; this._queue = []; }
    async acquire() {
      return new Promise((resolve) => {
        const tryAcquire = () => {
          if (!this._locked) {
            this._locked = true;
            resolve(() => { this._locked = false; this._processQueue(); });
          } else {
            this._queue.push(tryAcquire);
          }
        };
        tryAcquire();
      });
    }
    _processQueue() {
      if (this._queue.length > 0) {
        const next = this._queue.shift();
        next();
      }
    }
  }
  Mutex = MutexFallback;
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  log(LOG_LEVELS.ERROR, 'Failed to load better-sqlite3', err.message);
  try {
    Database = require('better-sqlite3');
  } catch (err2) {
    dialog.showErrorBox(
      'Database Module Error',
      `Failed to load native database module.\n${err.message}\n\nPlease run: npm run rebuild`
    );
    app.quit();
    process.exit(1);
  }
}

let db = null;
let isDbOpen = false;

function getDbPath() {
  return path.join(app.getPath('userData'), 'raath-pos.db');
}

function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

function initDatabase() {
  const dbPath = getDbPath();
  const backupDir = getBackupDir();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    db = new Database(dbPath);
    isDbOpen = true;
    log(LOG_LEVELS.INFO, 'Database initialized at:', dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 30000');
    db.pragma('cache_size = 10000');
    db.pragma('temp_store = MEMORY');

    const walStatus = db.prepare("PRAGMA journal_mode").get();
    if (walStatus.journal_mode !== 'wal') {
      log(LOG_LEVELS.WARN, 'WAL mode not active, falling back to DELETE');
      db.pragma('journal_mode = DELETE');
    }

    const { createAllTables } = require('./schema');
    const { runMigrations } = require('./migrations');
    const { createIndexes } = require('./indexes');
    const { seedDefaultData } = require('./seeds');

    createAllTables(db);
    runMigrations(db);
    seedDefaultData(db);
    createIndexes(db);

    log(LOG_LEVELS.INFO, 'All databases initialized successfully.');
    return db;
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Database initialization failed:', err);
    throw err;
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    isDbOpen = false;
    log(LOG_LEVELS.INFO, 'Database closed successfully');
  }
}

module.exports = {
  Mutex, Database,
  initDatabase, getDb, closeDb,
  getDbPath, getBackupDir, getSettingsPath,
  isDbOpen
};