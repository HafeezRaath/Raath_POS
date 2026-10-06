// ============================================================
//  server/middleware/errorHandler.js - Global Error Handler
// ============================================================

function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err.stack || err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;

