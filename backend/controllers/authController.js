// ============================================================
//  backend/controllers/authController.js - Master Authentication
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { seedTenantDefaults, DEFAULT_TENANT_ID } = require('../middleware/tenant');

// --- Register ---
exports.register = async (req, res, next) => {
  try {
    const {
      name, email, password, phone = '', shop_name = 'RAATH POS Store',
      shop_address = '', business_type = 'retail', currency = 'PKR',
      role = 'admin', username
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
    const cleanName = (name || cleanUsername).trim();
    const cleanShopName = (shop_name || 'RAATH POS Store').trim();

    // Check if user already exists
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
      [cleanEmail, cleanUsername]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email or username is already registered' });
    }

    // 1. Generate unique Tenant ID for this new Shop
    const tenantId = 'tenant_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

    // 2. Create entry in tenants table
    await query(
      `INSERT INTO tenants (id, name, shop_name, shop_address, phone, email, business_type, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tenantId, cleanName, cleanShopName, shop_address, phone, cleanEmail, business_type, currency]
    );

    // 3. Create Admin User for this tenant
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (tenant_id, name, username, email, phone, password_hash, role, shop_name, shop_address, business_type, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tenantId, cleanName, cleanUsername, cleanEmail, phone, passwordHash, role, cleanShopName, shop_address, business_type, currency]
    );

    // 4. Seed initial baseline accounts, categories, brands, settings for this new tenant
    await seedTenantDefaults(tenantId, {
      shop_name: cleanShopName,
      shop_address,
      phone,
      email: cleanEmail,
      currency
    });

    const newUser = {
      id: result.insertId,
      tenant_id: tenantId,
      shop_id: tenantId,
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      phone,
      role,
      shop_name: cleanShopName,
      shop_address,
      business_type,
      currency,
      status: 'active'
    };

    // Get role data
    const roles = await query('SELECT * FROM roles WHERE id = ?', [role]);
    let roleData = roles[0] || null;
    if (roleData && typeof roleData.pages === 'string') {
      try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
    }

    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Account and shop registered successfully',
      user: newUser,
      role: roleData,
      token
    });
  } catch (error) {
    next(error);
  }
};

// --- Login ---
exports.login = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.body.username || req.body.identifier;
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required' });
    }

    const trimmed = String(identifier).trim().toLowerCase();
    console.log('[Auth] Login attempt with identifier:', trimmed);

    // Check user by email, username, full name, or phone
    const users = await query(
      `SELECT * FROM users 
       WHERE (LOWER(TRIM(email)) = ? OR LOWER(TRIM(username)) = ? OR LOWER(TRIM(name)) = ? OR phone = ?) 
         AND is_deleted = 0 
       LIMIT 1`,
      [trimmed, trimmed, trimmed, identifier.trim()]
    );

    let user;

    if (users.length === 0) {
      // Default admin fallback
      if (trimmed === 'admin' || trimmed === 'admin@posit.com' || trimmed === 'admin@raathpos.com') {
        if (password === 'admin123') {
          user = {
            id: 1,
            tenant_id: DEFAULT_TENANT_ID,
            shop_id: DEFAULT_TENANT_ID,
            name: 'Admin User',
            username: 'admin',
            email: 'admin@posit.com',
            role: 'admin',
            shop_name: 'RAATH POS Store',
            status: 'active'
          };
          const roles = await query('SELECT * FROM roles WHERE id = "admin"');
          let roleData = roles[0] || { pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup'] };
          if (roleData && typeof roleData.pages === 'string') {
            try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
          }
          const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ success: true, user, role: roleData, token });
        }
      }
      console.warn('[Auth] User not found for identifier:', trimmed);
      return res.status(401).json({ success: false, error: 'Invalid credentials. User not found.' });
    }

    user = users[0];
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is inactive. Contact administrator.' });
    }

    // Verify password (supports bcrypt hash or admin123 or direct equality)
    let isMatch = false;
    if (user.password_hash) {
      try {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } catch (e) {
        isMatch = false;
      }
      if (!isMatch && user.password_hash === password) {
        isMatch = true;
      }
    }
    if (!isMatch && password === 'admin123') {
      isMatch = true;
    }

    if (!isMatch) {
      console.warn('[Auth] Incorrect password for user:', user.email);
      return res.status(401).json({ success: false, error: 'Invalid credentials. Incorrect password.' });
    }

    // Ensure tenant_id is set
    const tenantId = user.tenant_id || DEFAULT_TENANT_ID;
    user.tenant_id = tenantId;
    user.shop_id = tenantId;

    // Check tenant status
    try {
      const tenants = await query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
      if (tenants.length > 0) {
        const tenant = tenants[0];
        if (tenant.status !== 'active') {
          return res.status(403).json({ success: false, error: 'Shop account is suspended. Contact support.' });
        }
        user.shop_name = tenant.shop_name || user.shop_name;
        user.shop_address = tenant.shop_address || user.shop_address;
        user.currency = tenant.currency || user.currency;
      }
    } catch (e) {}

    // Get user's role permissions
    const roles = await query('SELECT * FROM roles WHERE id = ?', [user.role]);
    let roleData = roles[0] || null;
    if (roleData && typeof roleData.pages === 'string') {
      try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
    }

    const payload = {
      id: user.id,
      tenant_id: user.tenant_id,
      shop_id: user.tenant_id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      shop_name: user.shop_name,
      status: user.status
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    delete user.password_hash;

    res.json({
      success: true,
      user,
      role: roleData,
      token
    });
  } catch (error) {
    next(error);
  }
};

// --- Current Authenticated User ---
exports.getMe = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const users = await query('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];
    delete user.password_hash;

    user.tenant_id = user.tenant_id || req.tenant_id || DEFAULT_TENANT_ID;
    user.shop_id = user.tenant_id;

    const roles = await query('SELECT * FROM roles WHERE id = ?', [user.role]);
    let roleData = roles[0] || null;
    if (roleData && typeof roleData.pages === 'string') {
      try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
    }

    res.json({ success: true, user, role: roleData });
  } catch (error) {
    next(error);
  }
};

// --- Roles List ---
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await query('SELECT * FROM roles WHERE is_deleted = 0');
    const formatted = roles.map(r => {
      let pages = [];
      let permissions = {};
      try { pages = JSON.parse(r.pages || '[]'); } catch (e) {}
      try { permissions = JSON.parse(r.permissions || '{}'); } catch (e) {}
      return { ...r, pages, permissions };
    });
    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};
