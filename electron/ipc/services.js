const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { sanitizeObject, validatePositiveNumber } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerServiceHandlers() {
  ipcMain.handle('db:getServices', createHandler(async () => {
    const db = getDb();
    return db.prepare("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name").all() || [];
  }));

  ipcMain.handle('db:getServiceById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare("SELECT * FROM services WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:addService', createHandler(async (event, service) => {
    const db = getDb();
    const sanitized = sanitizeObject(service, ['name', 'description', 'base_price', 'estimated_time', 'status']);

    const result = db.prepare(`
      INSERT INTO services (name, description, base_price, estimated_time, status) VALUES (?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.description || '',
      validatePositiveNumber(sanitized.base_price, 0),
      sanitized.estimated_time || '',
      sanitized.status || 'active'
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateService', createHandler(async (event, id, service) => {
    const db = getDb();
    const sanitized = sanitizeObject(service, ['name', 'description', 'base_price', 'estimated_time', 'status']);

    const result = db.prepare(`
      UPDATE services SET name = ?, description = ?, base_price = ?, estimated_time = ?, status = ? WHERE id = ?
    `).run(
      sanitized.name,
      sanitized.description || '',
      validatePositiveNumber(sanitized.base_price, 0),
      sanitized.estimated_time || '',
      sanitized.status || 'active',
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteService', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare("UPDATE services SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));
}

module.exports = { registerServiceHandlers };