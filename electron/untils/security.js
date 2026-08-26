const crypto = require('crypto');
const { CONFIG } = require('../constants/config');
const { log, LOG_LEVELS } = require('./logger');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    CONFIG.PBKDF2_ITERATIONS,
    CONFIG.PBKDF2_KEY_LENGTH,
    CONFIG.PBKDF2_DIGEST
  ).toString('hex');
  return `${CONFIG.PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    let iterations = CONFIG.PBKDF2_ITERATIONS;
    let salt, hash;
    if (parts.length === 3) {
      iterations = parseInt(parts[0]);
      salt = parts[1];
      hash = parts[2];
    } else if (parts.length === 2) {
      salt = parts[0];
      hash = parts[1];
      iterations = 1000;
    } else {
      return false;
    }
    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      CONFIG.PBKDF2_KEY_LENGTH,
      CONFIG.PBKDF2_DIGEST
    ).toString('hex');
    return hash === computedHash;
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Password verification error:', error);
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
