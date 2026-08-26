const fs = require('fs');
const path = require('path');
const { log, LOG_LEVELS } = require('./logger');
const { CONFIG } = require('../constants/config');

function safeFileOperation(operation, fallback = null) {
  try {
    return operation();
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'File operation failed:', err);
    return fallback;
  }
}

function safeReadFile(filePath, encoding = 'utf8') {
  try {
    if (!fs.existsSync(filePath)) {
      log(LOG_LEVELS.WARN, 'File not found:', filePath);
      return null;
    }
    const stats = fs.statSync(filePath);
    if (stats.size > CONFIG.maxFileSize) {
      log(LOG_LEVELS.WARN, 'File too large:', filePath);
      return null;
    }
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Read file failed:', err);
    return null;
  }
}

function safeWriteFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Write file failed:', err);
    return false;
  }
}

module.exports = { safeFileOperation, safeReadFile, safeWriteFile };