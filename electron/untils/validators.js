
const fs = require('fs');
const path = require('path');
const { log, LOG_LEVELS } = require('./logger');
const { CONFIG } = require('../constants/config');
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '')
      .replace(/['";()]/g, '')
      .trim()
      .slice(0, 10000);
  }
  if (typeof input === 'number' && !isFinite(input)) return 0;
  if (input === null || input === undefined) return null;
  return input;
}

function sanitizeObject(obj, allowedFields = null) {
  if (!obj || typeof obj !== 'object') return {};
  const sanitized = {};
  const fields = allowedFields || Object.keys(obj);
  for (const key of fields) {
    if (obj[key] === undefined || obj[key] === null) {
      sanitized[key] = null;
      continue;
    }
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeInput(obj[key]);
    } else if (typeof obj[key] === 'number') {
      sanitized[key] = isFinite(obj[key]) ? obj[key] : 0;
    } else if (Array.isArray(obj[key])) {
      sanitized[key] = obj[key].map(item => typeof item === 'string' ? sanitizeInput(item) : item);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
}

function validatePositiveNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return (isNaN(num) || num < 0) ? defaultValue : Math.round(num * 100) / 100;
}

function validateDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function requiredId(value, name) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${name} is invalid`);
  return id;
}

function finiteMoney(value, name = 'amount', allowNegative = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || (!allowNegative && n < 0)) throw new Error(`${name} is invalid`);
  return Math.round(n * 100) / 100;
}

function positiveQty(value, name = 'quantity') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be greater than zero`);
  return Math.round(n * 1000) / 1000;
}

function normalizeOptional(value) {
  return value === undefined || value === null || value === '' ? null : sanitizeInput(value);
}

function validateStockAvailability(db, variantId, quantity) {
  try {
    const stock = db.prepare(
      "SELECT current_stock FROM product_variants WHERE id = ? AND is_deleted = 0"
    ).get(variantId);
    if (!stock) return { available: false, error: 'Product variant not found' };
    const currentStock = parseFloat(stock.current_stock) || 0;
    const requestedQty = parseFloat(quantity) || 0;
    if (requestedQty > currentStock) {
      return {
        available: false,
        error: `Insufficient stock. Available: ${currentStock}, Requested: ${requestedQty}`,
        currentStock,
        requestedQty
      };
    }
    return { available: true, currentStock };
  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Stock validation error:', error);
    return { available: false, error: error.message };
  }
}

module.exports = {
  sanitizeInput, sanitizeObject, validatePositiveNumber, validateDate,
  safeJsonParse, requiredId, finiteMoney, positiveQty, normalizeOptional,
  validateStockAvailability
};


