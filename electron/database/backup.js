// ============================================================
//  backup.js - Database Backup logic
// ============================================================
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { log, LOG_LEVELS } = require('../logger');
const CONFIG = require('../config');
const { getDbPath, getBackupDir } = require('./connection');

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

const backupMutex = new Mutex();
let autoBackupJob = null;

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

function loadBackupSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Load backup settings error:', err);
  }
  return {
    autoBackup: false,
    backupInterval: 'daily',
    backupDestination: 'local',
    gmail: { email: '', appPassword: '', toEmail: '', enabled: false },
    defaultPrinter: '',
  };
}

function saveBackupSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Save backup settings error:', err);
  }
}

async function createLocalBackup() {
  const release = await backupMutex.acquire();
  try {
    const dbPath = getDbPath();
    const backupDir = getBackupDir();

    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found at: ' + dbPath);
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, 'backup-' + timestamp + '.db');
    
    // We cannot access 'db' easily here if it's imported, so we instantiate it for backup
    const backupDb = new Database(dbPath, { readonly: true });
    backupDb.backup(backupPath)
    backupDb.close()

    // Verify backup integrity
    try {
      const testDb = new Database(backupPath, { readonly: true });
      testDb.prepare("SELECT 1").get();
      testDb.close();
      log(LOG_LEVELS.INFO, 'Backup integrity verified');
    } catch (verifyErr) {
      log(LOG_LEVELS.ERROR, 'Backup integrity check failed:', verifyErr);
      fs.unlinkSync(backupPath);
      throw new Error('Backup integrity check failed');
    }

    const desktopPath = path.join(
      app.getPath('desktop'),
      'POS-Backup-' + Date.now() + '.db'
    );
    fs.copyFileSync(backupPath, desktopPath);

    cleanupOldBackups(CONFIG.backupRetention);

    return {
      success: true,
      path: desktopPath,
      backupDirPath: backupPath,
      size: fs.statSync(backupPath).size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Backup creation failed:', error);
    throw new Error('Backup creation failed: ' + error.message);
  } finally {
    release();
  }
}

function cleanupOldBackups(maxToKeep = 30) {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return;

  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > maxToKeep) {
      const toDelete = files.slice(maxToKeep);
      let deleted = 0;
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          deleted++;
        } catch (e) {
          log(LOG_LEVELS.ERROR, 'Failed to delete ' + file.name + ':', e.message);
        }
      }
      if (deleted > 0) {
        log(LOG_LEVELS.INFO, 'Cleaned up ' + deleted + ' old backups');
      }
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Cleanup failed:', err);
  }
}

async function sendBackupEmail(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config object provided');
  }

  const { email, appPassword, toEmail } = config;

  if (!email) throw new Error('Sender email is required');
  if (!appPassword) throw new Error('App password is required');
  if (!toEmail) throw new Error('Recipient email is required');

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) throw new Error('Database file not found');

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const tempBackup = path.join(backupDir, 'email-backup-' + Date.now() + '.db');

  try {
     const backupDb = new Database(dbPath, { readonly: true });
     backupDb.backup(tempBackup)
     backupDb.close()

    const stats = fs.statSync(tempBackup);
    if (stats.size === 0) throw new Error('Backup file is empty');
    
    if (stats.size > 25 * 1024 * 1024) {
      log(LOG_LEVELS.WARN, 'File size exceeds 25MB, Gmail may reject');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: email, pass: appPassword },
      timeout: 30000,
      maxMessages: 1,
    });

    try {
      await transporter.verify();
      log(LOG_LEVELS.INFO, 'Email connection verified');
    } catch (verifyErr) {
      throw new Error(`Email authentication failed: ${verifyErr.message}`);
    }

    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const timeStr = new Date().toLocaleString('en-GB');

    const mailOptions = {
      from: `"RAATH POS Backup" <${email}>`,
      to: toEmail,
      subject: 'POS Auto Backup - ' + timeStr,
      text: 'Your RAATH POS database backup is attached.\n\nBackup Date: ' + timeStr + '\nFile: raath-pos-backup-' + dateStr + '.db\n\nThis is an automated backup from RAATH POS.',
      attachments: [
        {
          filename: 'raath-pos-backup-' + dateStr + '.db',
          path: tempBackup,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    log(LOG_LEVELS.INFO, 'Email sent:', info.messageId);

    if (fs.existsSync(tempBackup)) {
      try { fs.unlinkSync(tempBackup); } catch (e) { 
        log(LOG_LEVELS.WARN, 'Failed to delete temp backup:', e.message);
      }
    }

    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
      size: stats.size
    };

  } catch (err) {
    if (fs.existsSync(tempBackup)) {
      try { fs.unlinkSync(tempBackup); } catch (e) {}
    }
    log(LOG_LEVELS.ERROR, 'Email backup failed:', err);
    throw new Error('Email backup failed: ' + err.message);
  }
}

async function cleanupOldBackups(maxToKeep = 30) {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return;

  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > maxToKeep) {
      const toDelete = files.slice(maxToKeep);
      let deleted = 0;
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          deleted++;
        } catch (e) {
          log(LOG_LEVELS.ERROR, 'Failed to delete ' + file.name + ':', e.message);
        }
      }
      if (deleted > 0) {
        log(LOG_LEVELS.INFO, 'Cleaned up ' + deleted + ' old backups');
      }
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Cleanup failed:', err);
  }
}

function setupAutoBackup(settings) {
  if (autoBackupJob) {
    autoBackupJob.stop();
    if (autoBackupJob.destroy) autoBackupJob.destroy();
    autoBackupJob = null;
  }

  if (!settings.autoBackup) {
    log(LOG_LEVELS.INFO, 'Auto-backup disabled');
    return;
  }

  let cronExpression = '0 2 * * *';
  if (settings.backupInterval === 'weekly') cronExpression = '0 2 * * 0';
  if (settings.backupInterval === 'monthly') cronExpression = '0 2 1 * *';

  autoBackupJob = cron.schedule(
    cronExpression,
    async () => {
      log(LOG_LEVELS.INFO, 'Running scheduled backup at ' + new Date().toISOString());
      const results = { local: false, email: false, errors: [] };

      try {
        const dest = settings.backupDestination || 'local';

        if (dest === 'local' || dest === 'both') {
          try {
            await createLocalBackup();
            results.local = true;
            log(LOG_LEVELS.INFO, 'Local backup successful');
          } catch (err) {
            results.errors.push('Local backup failed: ' + err.message);
            log(LOG_LEVELS.ERROR, 'Local backup failed:', err);
          }
        }

        if ((dest === 'gmail' || dest === 'both') && settings.gmail?.enabled) {
          try {
            await sendBackupEmail(settings.gmail);
            results.email = true;
            log(LOG_LEVELS.INFO, 'Email backup successful');
          } catch (err) {
            results.errors.push('Email backup failed: ' + err.message);
            log(LOG_LEVELS.ERROR, 'Email backup failed:', err);
          }
        }

        if (results.local || results.email) {
          log(LOG_LEVELS.INFO, 'Backup completed: Local=' + results.local + ', Email=' + results.email);
        } else {
          log(LOG_LEVELS.WARN, 'Backup failed: ' + results.errors.join('; '));
        }
      } catch (err) {
        log(LOG_LEVELS.ERROR, 'Backup job failed:', err);
      }
    },
    {
      scheduled: true,
      timezone: CONFIG.timezone,
      name: 'auto-backup'
    }
  );

  log(LOG_LEVELS.INFO, 'Auto-backup scheduled: ' + cronExpression);
}

module.exports = { setupAutoBackup, loadBackupSettings, saveBackupSettings, createLocalBackup, sendBackupEmail };