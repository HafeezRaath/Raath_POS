// ============================================================
//  server/server.js - RAATH POS Main Backend Entry Point
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { testConnection } = require('./config/db');
const { initializeDatabase } = require('./database/initDb');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'x-tenant-id', 'Accept', 'Origin']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==================== ROUTES ====================
app.use('/api', apiRoutes);

// Root test endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to RAATH POS MySQL Backend Server',
    apiDocumentation: '/api/health',
    status: 'online'
  });
});

// Centralized error handling
app.use(errorHandler);

// ==================== SERVER STARTUP ====================
async function startServer() {
  try {
    // Attempt database connection & migration
    console.log('[Server] Connecting to MySQL...');
    await initializeDatabase().catch(err => {
      console.warn('[Server] MySQL init deferred or MySQL service offline:', err.message);
      console.warn('[Server] Make sure MySQL is running on port', process.env.DB_PORT || 3306);
    });

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`RAATH POS Server is running on port: ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('[Server] Failed to start:', error);
  }
}

startServer();

module.exports = app;

