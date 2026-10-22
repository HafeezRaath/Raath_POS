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

      // In local mode: If user not found locally, attempt first online login against cloud
      if (String(process.env.LOCAL_MODE || '') === '1') {
        const cloudUrl = (process.env.CLOUD_API_URL || 'https://pos.raathdeveloper.com/api').replace(/\/+$/, '');
        try {
          console.log('[Auth] Attempting first-time online login against cloud:', cloudUrl);
          const cloudRes = await fetch(`${cloudUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password }),
            signal: AbortSignal.timeout(5000)
          });
          if (cloudRes.ok) {
            const cloudData = await cloudRes.json();
            if (cloudData.success && cloudData.user) {
              const cu = cloudData.user;
              const passwordHash = await bcrypt.hash(password, 10);
              const tenantId = cu.tenant_id || cu.shop_id || 'tenant_default';

              // Store tenant snapshot locally
              await query(`
                INSERT INTO tenants (id, name, shop_name, status)
                VALUES (?, ?, ?, 'active')
                ON DUPLICATE KEY UPDATE name = VALUES(name)
              `, [tenantId, cu.shop_name || 'Store', cu.shop_name || 'Store']).catch(() => {});

              // Store user row with bcrypt hash locally (never plain-text)
              await query(`
                INSERT INTO users (tenant_id, name, username, email, phone, password_hash, role, shop_name, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
                ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
              `, [
                tenantId,
                cu.name || trimmed,
                cu.username || trimmed,
                cu.email || `${trimmed}@shop.local`,
                cu.phone || '',
                passwordHash,
                cu.role || 'cashier',
                cu.shop_name || 'RAATH POS Store'
              ]).catch(() => {});

              // Store cloud auth token for sync client
              if (cloudData.token) {
                await query(`
                  INSERT INTO system_settings (tenant_id, \`key\`, \`value\`, description)
                  VALUES (?, 'sync_auth_token', ?, 'Cloud Auth Token')
                  ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)
                `, [tenantId, cloudData.token]).catch(() => {});

                await query(`
                  INSERT INTO system_settings (tenant_id, \`key\`, \`value\`, description)
                  VALUES (?, 'sync_tenant_id', ?, 'Cloud Tenant ID')
                  ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)
                `, [tenantId, tenantId]).catch(() => {});
              }

              console.log('[Auth] First online login succeeded and credentials cached locally.');
              return res.json(cloudData);
            }
          }
        } catch (cloudErr) {
          console.warn('[Auth] Cloud verification failed or offline:', cloudErr.message);
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
        // v85: business type SHOP (tenant) ki property hai — tenant ki type hi final,
        // taa ke ek hi shop ke har user ko usi shop ke features milen
        if (tenant.business_type) user.business_type = tenant.business_type;
      }
    } catch (e) {}

    // Get user's role permissions
    const roles = await query('SELECT * FROM roles WHERE id = ?', [user.role]);
    let roleData = roles[0] || null;
    if (roleData) {
      if (typeof roleData.pages === 'string') {
        try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
      }
      if (typeof roleData.permissions === 'string') {
        try { roleData.permissions = JSON.parse(roleData.permissions); } catch (e) {}
      }
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

    // v85: tenant (shop) ki business_type hi final hai
    try {
      const tRows = await query('SELECT business_type FROM tenants WHERE id = ?', [user.tenant_id]);
      if (tRows.length > 0 && tRows[0].business_type) user.business_type = tRows[0].business_type;
    } catch (e) {}

    const roles = await query('SELECT * FROM roles WHERE id = ?', [user.role]);
    let roleData = roles[0] || null;
    if (roleData) {
      if (typeof roleData.pages === 'string') {
        try { roleData.pages = JSON.parse(roleData.pages); } catch (e) {}
      }
      if (typeof roleData.permissions === 'string') {
        try { roleData.permissions = JSON.parse(roleData.permissions); } catch (e) {}
      }
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

// --- Create / Upsert Role ---
exports.createRole = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id || req.tenant_id || DEFAULT_TENANT_ID;
    const { id, label, color = 'primary', pages = [], permissions = {}, is_default = 0 } = req.body;
    if (!id || !label) {
      return res.status(400).json({ success: false, error: 'Role id and label are required' });
    }

    const pagesJson = typeof pages === 'string' ? pages : JSON.stringify(pages);
    const permsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);

    await query(
      `INSERT INTO roles (id, label, color, pages, permissions, is_default, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         color = VALUES(color),
         pages = VALUES(pages),
         permissions = VALUES(permissions),
         is_default = VALUES(is_default),
         is_deleted = 0`,
      [id, label, color, pagesJson, permsJson, is_default ? 1 : 0]
    );

    res.json({
      success: true,
      message: 'Role saved successfully',
      data: { id, label, color, pages, permissions, is_default }
    });
  } catch (error) {
    next(error);
  }
};

// --- Update Role ---
exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, color, pages, permissions, is_default } = req.body;

    const updates = [];
    const params = [];

    if (label !== undefined) {
      updates.push('label = ?');
      params.push(label);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (pages !== undefined) {
      updates.push('pages = ?');
      params.push(typeof pages === 'string' ? pages : JSON.stringify(pages));
    }
    if (permissions !== undefined) {
      updates.push('permissions = ?');
      params.push(typeof permissions === 'string' ? permissions : JSON.stringify(permissions));
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      params.push(is_default ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Delete Role ---
exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot delete admin role' });
    }
    await query('UPDATE roles SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    next(error);
  }
};

