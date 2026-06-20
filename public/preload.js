const { contextBridge, ipcRenderer } = require('electron');

// Security: Only allow these channels
const VALID_CHANNELS = [
  'db-query',
  'get-db-info',
  'create-local-backup',
  'send-backup-email',
  'restore-backup',
  'update-backup-settings',
  'load-backup-settings',
  'select-backup-file'
];

contextBridge.exposeInMainWorld('electronAPI', {
  // Database
  dbQuery: (sql, params) => {
    if (!VALID_CHANNELS.includes('db-query')) throw new Error('Unauthorized channel');
    return ipcRenderer.invoke('db-query', sql, params);
  },

  // Backup & Restore
  getDbInfo: () => ipcRenderer.invoke('get-db-info'),
  
  createLocalBackup: () => ipcRenderer.invoke('create-local-backup'),
  
  sendBackupEmail: (config) => ipcRenderer.invoke('send-backup-email', config),
  
  restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
  
  updateBackupSettings: (settings) => ipcRenderer.invoke('update-backup-settings', settings),
  
  loadBackupSettings: () => ipcRenderer.invoke('load-backup-settings'),
  
  selectBackupFile: () => ipcRenderer.invoke('select-backup-file'),

  // Utility flags
  isElectron: true,
  platform: process.platform
});