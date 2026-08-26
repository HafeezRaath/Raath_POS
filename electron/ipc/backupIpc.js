const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../database/connection');
const { createHandler } = require('./helpers');
const { log, LOG_LEVELS } = require('../utils/logger');

// Yeh functions aapke database/backup.js ya utils/backup.js mein hone chahiye
const {
  createLocalBackup,
  sendBackupEmail,
  loadBackupSettings,
  saveBackupSettings,
  setupAutoBackup,
  getBackupDir,
  getDbPath
} = require('../database/backup');

function registerBackupHandlers() {
  ipcMain.handle('create-local-backup', createHandler(async () => {
    return await createLocalBackup();
  }));

  ipcMain.handle('send-backup-email', createHandler(async (event, config) => {
    return await sendBackupEmail(config);
  }));

  ipcMain.handle('restore-backup', createHandler(async (event, backupPath) => {
    const safetyBackup = path.join(
      getBackupDir(),
      'pre-restore-' + Date.now() + '.db'
    );

    try {
      fs.copyFileSync(getDbPath(), safetyBackup);

      const db = getDb();
      if (db) {
        db.close();
      }

      fs.copyFileSync(backupPath, getDbPath());

      // Agar aapke connection module mein initDatabase() exported hai toh yahan use karein
      const { initDatabase } = require('../database/connection');
      initDatabase();

      return { safetyPath: safetyBackup };
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Restore backup error:', err);
      throw err;
    }
  }));

  ipcMain.handle('update-backup-settings', createHandler(async (event, settings) => {
    saveBackupSettings(settings);
    setupAutoBackup(settings);
    return { success: true };
  }));

  ipcMain.handle('load-backup-settings', createHandler(async () => {
    return loadBackupSettings();
  }));

  ipcMain.handle('get-db-info', async () => {
    try {
      const stats = fs.statSync(getDbPath());
      return {
        path: getDbPath(),
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch {
      return { path: getDbPath(), size: 0, lastModified: null };
    }
  });

  ipcMain.handle('get-env-info', () => {
    const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;
    return {
      isDev: isDev,
      isProduction: !isDev,
      platform: process.platform,
      arch: process.arch
    };
  });

  ipcMain.handle('select-backup-file', async () =>
    await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite', extensions: ['db'] }],
    })
  );

  ipcMain.handle('db-close', async () => {
    try {
      const db = getDb();
      if (db) {
        log(LOG_LEVELS.INFO, 'Closing database connection...');
        db.close();
        log(LOG_LEVELS.INFO, 'Database closed successfully');
        return { success: true };
      }
      return { success: false, error: 'Database not initialized' };
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Error closing database:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerBackupHandlers };