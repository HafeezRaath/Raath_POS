// ============================================================
//  backend/middleware/auth.js - JWT Authentication Middleware
// ============================================================

const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'raath_pos_super_secret_jwt_key_2026_!@#$';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (decoded.tenant_id) {
      req.tenant_id = decoded.tenant_id;
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (decoded.tenant_id) {
        req.tenant_id = decoded.tenant_id;
      }
    } catch (e) {}
  }
  next();
}

module.exports = {
  requireAuth,
  verifyToken: requireAuth,
  optionalAuth,
  JWT_SECRET
};
