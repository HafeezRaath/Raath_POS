// ============================================================
//  electron/main.js - Main Process Entry for RAATH POS
//  ✅ Window Setup | ✅ IPC Handlers | ✅ Dev/Prod Paths
// ============================================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const isDev = !app.isPackaged;
let mainWindow;

// ==================== WINDOW SETUP ====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // ✅ Fixed: Preload path works in both dev and production
      preload: path.join(__dirname, isDev ? '../public/preload.js' : 'preload.js'),
    },
    title: 'RAATH POS',
    show: false,
    // ✅ Fixed: Icon path works in both dev and production
    icon: path.join(__dirname, isDev ? '../public/favicon.ico' : 'favicon.ico'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  require('./ipc'); // Load all IPC handlers
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==================== ENV INFO (used by preload) ====================
ipcMain.handle('get-env-info', async () => ({
  isDev,
  isProduction: !isDev,
  platform: process.platform,
  arch: process.arch,
  version: app.getVersion(),
}));

// ==================== BASIC DIALOG HELPERS ====================
ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) throw new Error('Main window not available');
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  if (!mainWindow) throw new Error('Main window not available');
  return dialog.showOpenDialog(mainWindow, options);
});