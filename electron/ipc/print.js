const { ipcMain, BrowserWindow } = require('electron');
const { createHandler } = require('./helpers');
const { log, LOG_LEVELS } = require('../utils/logger');
const { loadBackupSettings, saveBackupSettings } = require('../utils/settings');

function registerPrintHandlers() {
  ipcMain.handle('get-printers', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return [];

      const printers = await win.webContents.getPrintersAsync();
      return printers.map(p => ({
        name: p.name,
        displayName: p.displayName,
        isDefault: p.isDefault,
      }));
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Get printers error:', err);
      try {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return [];
        const printers = win.webContents.getPrinters();
        return printers.map(p => ({
          name: p.name,
          displayName: p.displayName,
          isDefault: p.isDefault,
        }));
      } catch (fallbackErr) {
        log(LOG_LEVELS.ERROR, 'Fallback printers error:', fallbackErr);
        return [];
      }
    }
  });

  ipcMain.handle('print-receipt', async (event, htmlContent) => {
    try {
      const settings = loadBackupSettings();
      const printerName = settings?.defaultPrinter || '';

      const printWindow = new BrowserWindow({
        width: 300,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      printWindow.on('closed', () => {
        printWindow.destroy();
      });

      await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
      await new Promise(resolve => setTimeout(resolve, 800));

      const printOptions = {
        silent: true,
        printBackground: true,
        deviceName: printerName || undefined,
        margins: { marginType: 'none' }
      };

      return new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (!success) {
            log(LOG_LEVELS.ERROR, 'Print failed:', failureReason);
          }
          setTimeout(() => {
            if (!printWindow.isDestroyed()) {
              printWindow.close();
            }
            resolve({ success });
          }, 500);
        });
      });
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Print error:', err);
      throw err;
    }
  });

  ipcMain.handle('get-default-printer', createHandler(async () => {
    const settings = loadBackupSettings();
    return settings?.defaultPrinter || '';
  }));

  ipcMain.handle('set-default-printer', createHandler(async (event, printerName) => {
    const settings = loadBackupSettings();
    settings.defaultPrinter = printerName;
    saveBackupSettings(settings);
    return { success: true };
  }));
}

module.exports = { registerPrintHandlers };