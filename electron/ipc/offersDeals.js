const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { sanitizeObject, validatePositiveNumber, validateDate } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerOffersDealsHandlers() {
  // ===== DEALS =====
  ipcMain.handle('db:getDeals', createHandler(async () => {
    const db = getDb();
    if (!db) return [];
    return db.prepare("SELECT * FROM deals WHERE is_deleted = 0 ORDER BY created_at DESC").all() || [];
  }));

  ipcMain.handle('db:getDealById', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.prepare("SELECT * FROM deals WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:addDeal', createHandler(async (event, deal) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(deal, ['title', 'description', 'discount_type', 'discount_value', 'start_date', 'end_date', 'min_purchase_amount', 'applicable_to', 'status']);

    if (sanitized.start_date && sanitized.end_date && new Date(sanitized.end_date) <= new Date(sanitized.start_date)) {
      throw new Error('End date must be after start date');
    }

    const result = db.prepare(`
      INSERT INTO deals (title, description, discount_type, discount_value, start_date, end_date, min_purchase_amount, applicable_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.title,
      sanitized.description || '',
      sanitized.discount_type || 'percentage',
      validatePositiveNumber(sanitized.discount_value, 0),
      validateDate(sanitized.start_date),
      validateDate(sanitized.end_date),
      validatePositiveNumber(sanitized.min_purchase_amount, 0),
      sanitized.applicable_to || 'all',
      sanitized.status || 'active'
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateDeal', createHandler(async (event, id, deal) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(deal, ['title', 'description', 'discount_type', 'discount_value', 'start_date', 'end_date', 'min_purchase_amount', 'applicable_to', 'status']);

    if (sanitized.start_date && sanitized.end_date && new Date(sanitized.end_date) <= new Date(sanitized.start_date)) {
      throw new Error('End date must be after start date');
    }

    const result = db.prepare(`
      UPDATE deals SET title = ?, description = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, min_purchase_amount = ?, applicable_to = ?, status = ? WHERE id = ?
    `).run(
      sanitized.title,
      sanitized.description || '',
      sanitized.discount_type || 'percentage',
      validatePositiveNumber(sanitized.discount_value, 0),
      validateDate(sanitized.start_date),
      validateDate(sanitized.end_date),
      validatePositiveNumber(sanitized.min_purchase_amount, 0),
      sanitized.applicable_to || 'all',
      sanitized.status || 'active',
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteDeal', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const result = db.prepare("UPDATE deals SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ===== OFFERS =====
  ipcMain.handle('db:getOffers', createHandler(async () => {
    const db = getDb();
    if (!db) return [];
    return db.prepare("SELECT * FROM offers WHERE is_deleted = 0 ORDER BY created_at DESC").all() || [];
  }));

  ipcMain.handle('db:getOfferById', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.prepare("SELECT * FROM offers WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:addOffer', createHandler(async (event, offer) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(offer, ['name', 'description', 'discount_type', 'discount_value', 'start_date', 'end_date', 'status', 'original_total', 'final_total', 'items_count']);

    if (sanitized.start_date && sanitized.end_date && new Date(sanitized.end_date) <= new Date(sanitized.start_date)) {
      throw new Error('End date must be after start date');
    }

    const result = db.prepare(`
      INSERT INTO offers (name, description, discount_type, discount_value, start_date, end_date, status, original_total, final_total, items_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.description || '',
      sanitized.discount_type || 'percentage',
      validatePositiveNumber(sanitized.discount_value, 0),
      validateDate(sanitized.start_date),
      validateDate(sanitized.end_date),
      sanitized.status || 'active',
      validatePositiveNumber(sanitized.original_total, 0),
      validatePositiveNumber(sanitized.final_total, 0),
      validatePositiveNumber(sanitized.items_count, 0)
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateOffer', createHandler(async (event, id, offer) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(offer, ['name', 'description', 'discount_type', 'discount_value', 'start_date', 'end_date', 'status', 'original_total', 'final_total', 'items_count']);

    if (sanitized.start_date && sanitized.end_date && new Date(sanitized.end_date) <= new Date(sanitized.start_date)) {
      throw new Error('End date must be after start date');
    }

    const result = db.prepare(`
      UPDATE offers SET name = ?, description = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, status = ?, original_total = ?, final_total = ?, items_count = ? WHERE id = ?
    `).run(
      sanitized.name,
      sanitized.description || '',
      sanitized.discount_type || 'percentage',
      validatePositiveNumber(sanitized.discount_value, 0),
      validateDate(sanitized.start_date),
      validateDate(sanitized.end_date),
      sanitized.status || 'active',
      validatePositiveNumber(sanitized.original_total, 0),
      validatePositiveNumber(sanitized.final_total, 0),
      validatePositiveNumber(sanitized.items_count, 0),
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteOffer', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const result = db.prepare("UPDATE offers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:getOfferItems', createHandler(async (event, offerId) => {
    const db = getDb();
    if (!db) return [];
    return db.prepare("SELECT * FROM offer_items WHERE offer_id = ?").all(offerId) || [];
  }));

  ipcMain.handle('db:addOfferItem', createHandler(async (event, item) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(item, ['offer_id', 'product_id', 'variant_id', 'product_name', 'variant_name', 'sku', 'original_price', 'offer_price', 'category_id']);

    const result = db.prepare(`
      INSERT INTO offer_items (offer_id, product_id, variant_id, product_name, variant_name, sku, original_price, offer_price, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.offer_id,
      sanitized.product_id || null,
      sanitized.variant_id || null,
      sanitized.product_name || '',
      sanitized.variant_name || '',
      sanitized.sku || '',
      validatePositiveNumber(sanitized.original_price, 0),
      validatePositiveNumber(sanitized.offer_price, 0),
      sanitized.category_id || null
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:deleteOfferItems', createHandler(async (event, offerId) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const result = db.prepare("DELETE FROM offer_items WHERE offer_id = ?").run(offerId);
    return { changes: result.changes };
  }));
}

module.exports = { registerOffersDealsHandlers };