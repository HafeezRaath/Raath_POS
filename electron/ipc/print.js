const { ipcMain, BrowserWindow } = require('electron');
const { createHandler } = require('./helpers');
const { log, LOG_LEVELS } = require('../utils/logger');
const { loadBackupSettings, saveBackupSettings } = require('../utils/settings');

function registerPrintHandlers() {
  ipcMain.handle('get-printers', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!win) return [];

      const printers = await win.webContents.getPrintersAsync();
      return printers.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: p.isDefault,
      }));
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Get printers error:', err);
      try {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!win) return [];
        const printers = win.webContents.getPrinters();
        return printers.map(p => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: p.isDefault,
        }));
      } catch (fallbackErr) {
        log(LOG_LEVELS.ERROR, 'Fallback printers error:', fallbackErr);
        return [];
      }
    }
  });

  ipcMain.handle('print-receipt', async (event, htmlContent, options = {}) => {
    try {
      const settings = loadBackupSettings();
      const printerName = options?.printerName || settings?.defaultPrinter || '';
      const silent = options?.silent !== undefined ? options.silent : true;
      const copies = options?.copies || 1;

      const printWindow = new BrowserWindow({
        width: 350,
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
        silent: silent,
        printBackground: true,
        deviceName: printerName || undefined,
        copies: copies,
        margins: { marginType: 'none' }
      };

      // Handle thermal receipt & barcode page sizes properly for Electron
      if (options?.pageSize) {
        if (typeof options.pageSize === 'string') {
          const lower = options.pageSize.toLowerCase().trim();
          if (lower === '80mm') {
            printOptions.pageSize = { width: 80000, height: 300000 };
          } else if (lower === '58mm') {
            printOptions.pageSize = { width: 58000, height: 300000 };
          } else if (lower.endsWith('mm')) {
            const mm = parseFloat(lower) || 80;
            printOptions.pageSize = { width: Math.round(mm * 1000), height: 300000 };
          } else {
            // Standard string sizes: A4, Legal, etc.
            printOptions.pageSize = options.pageSize;
          }
        } else if (typeof options.pageSize === 'object' && options.pageSize.width && options.pageSize.height) {
          printOptions.pageSize = options.pageSize;
        }
      }

      return new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (!success) {
            log(LOG_LEVELS.ERROR, 'Print failed:', failureReason);
          }
          setTimeout(() => {
            if (!printWindow.isDestroyed()) {
              printWindow.close();
            }
            resolve({ success, failureReason });
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