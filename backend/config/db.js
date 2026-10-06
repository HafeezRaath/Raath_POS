// ============================================================
//  server/config/db.js - MySQL Connection Pool
// ============================================================

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'raath_pos_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
};

const pool = mysql.createPool(poolConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[MySQL] Connected successfully to database: ${poolConfig.database} at ${poolConfig.host}:${poolConfig.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('[MySQL] Connection failed:', error.message);
    return false;
  }
}

// Helper: Run queries safely
async function query(sql, params = []) {
  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('[MySQL Query Error]:', error.message, '\nSQL:', sql, '\nParams:', params);
    throw error;
  }
}

// Helper: Run transactions
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('[MySQL Transaction Error]:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  poolConfig
};

