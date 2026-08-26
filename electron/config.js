const { app } = require('electron');

const CONFIG = {
  timezone: process.env.TZ || 'Asia/Karachi',
  backupInterval: process.env.BACKUP_INTERVAL || '0 2 * * *',
  backupRetention: parseInt(process.env.BACKUP_RETENTION) || 30,
  maxLoginAttempts: 5,
  loginWindowMinutes: 15,
  logFlushInterval: 5000,
  maxLogBufferSize: 1000,
  walMode: true,
  busyTimeout: 30000,
  cacheSize: 10000,
  taxDecimalPlaces: 2,
  currencyDecimalPlaces: 2,
  maxDiscountPercent: 100,
  maxFileSize: 50 * 1024 * 1024,
  PBKDF2_ITERATIONS: 600000,
  PBKDF2_KEY_LENGTH: 64,
  PBKDF2_DIGEST: 'sha512',
};

module.exports = { CONFIG };