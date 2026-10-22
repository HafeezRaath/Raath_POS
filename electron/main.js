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
function getBackendPath() {
  const candidates = [
    path.join(__dirname, '../backend/server.js'),
    path.join(process.resourcesPath, 'backend/server.js'),
    path.join(process.resourcesPath, 'app/backend/server.js'),
    path.join(app.getAppPath(), '../backend/server.js')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, '../backend/server.js');
}

function startBackendServer() {
  try {
    const backendServerPath = getBackendPath();
    if (fs.existsSync(backendServerPath)) {
      const userDataPath = app.getPath('userData');
      const localDbPath = process.env.LOCAL_DB_PATH || path.join(userDataPath, 'raath_pos.sqlite3');
      const cloudApiUrl = process.env.CLOUD_API_URL || 'https://pos.raathdeveloper.com/api';

      const env = {
        ...process.env,
        PORT: process.env.PORT || '5000',
        NODE_ENV: isDev ? 'development' : 'production',
        LOCAL_MODE: '1',
        LOCAL_DB_PATH: localDbPath,
        CLOUD_API_URL: cloudApiUrl
      };

      serverProcess = fork(backendServerPath, [], {
        env,
        silent: false
      });
      console.log(`[Electron] Backend server launched at ${backendServerPath} with LOCAL_MODE=1`);
      console.log(`[Electron] SQLite DB location (userData): ${localDbPath}`);
      console.log(`[Electron] Cloud API target: ${cloudApiUrl}`);
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

  if (isDev && !process.env.ELECTRON_SERVE_BUILD) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const candidates = [
      path.join(__dirname, '../frontend/build/index.html'),
      path.join(process.resourcesPath, 'frontend/build/index.html'),
      path.join(process.resourcesPath, 'app/frontend/build/index.html'),
      path.join(__dirname, '../build/index.html')
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (found) {
      mainWindow.loadFile(found);
    } else {
      mainWindow.loadURL('http://localhost:3000');
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