// ============================================================
//  electron/main.js - Electron Main Process for RAATH POS
//  Desktop Shell: Window Management, Printing, Backend Orchestration
// ============================================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

const isDev = !app.isPackaged;
let mainWindow;
let serverProcess = null;

// ==================== BACKEND SERVER LAUNCHER ====================
function startBackendServer() {
  try {
    const backendServerPath = path.join(__dirname, '../backend/server.js');
    if (fs.existsSync(backendServerPath)) {
      serverProcess = fork(backendServerPath, [], {
        env: { ...process.env, PORT: 5000, NODE_ENV: isDev ? 'development' : 'production' },
        silent: false
      });
      console.log('[Electron] Node.js Express + MySQL backend process launched on port 5000.');
    } else {
      console.warn('[Electron] Backend server file not found at:', backendServerPath);
    }
  } catch (err) {
    console.error('[Electron] Failed to start backend server:', err.message);
  }
}

function stopBackendServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
      serverProcess = null;
      console.log('[Electron] Backend server process stopped.');
    } catch (e) {}
  }
}

// ==================== WINDOW CREATION ====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, isDev ? '../public/preload.js' : 'preload.js'),
    },
    title: 'RAATH POS',
    show: false,
    icon: path.join(__dirname, isDev ? '../public/favicon.ico' : 'favicon.ico'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const prodIndex = path.join(__dirname, '../frontend/build/index.html');
    const legacyIndex = path.join(__dirname, '../build/index.html');
    if (fs.existsSync(prodIndex)) {
      mainWindow.loadFile(prodIndex);
    } else {
      mainWindow.loadFile(legacyIndex);
    }
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

// ==================== APP LIFECYCLE ====================
app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  // Load print handlers if available
  try {
    const { registerPrintHandlers } = require('./ipc/print');
    registerPrintHandlers();
  } catch (e) {
    console.log('[Electron] Thermal print handler loaded or skipped:', e.message);
  }
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ==================== BASIC DIALOG HELPERS ====================
ipcMain.handle('get-env-info', async () => ({
  isDev,
  isProduction: !isDev,
  platform: process.platform,
  arch: process.arch,
  version: app.getVersion(),
  apiBase: process.env.API_URL || 'http://localhost:5000/api'
}));

ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) throw new Error('Main window not available');
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  if (!mainWindow) throw new Error('Main window not available');
  return dialog.showOpenDialog(mainWindow, options);
});