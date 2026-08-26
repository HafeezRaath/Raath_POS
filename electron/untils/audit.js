const { getDb } = require('../database/connection');
const { log, LOG_LEVELS } = require('./logger');

function logAudit(userId, action, tableName, recordId, oldValues = null, newValues = null) {
  try {
    const db = getDb();
    if (!db || typeof db.prepare !== 'function') {
      log(LOG_LEVELS.WARN, 'Audit log skipped - database not available', { action, tableName });
      return;
    }
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      action,
      tableName,
      recordId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    );
  } catch (error) {
    log(LOG_LEVELS.WARN, 'Audit log failed:', error);
  }
}

module.exports = { logAudit };


