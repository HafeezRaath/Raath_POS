// ============================================================
//  backend/middleware/tenant.js - Multi-Tenancy Middleware & Context
// ============================================================

const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();
const { query } = require('../config/db');

const DEFAULT_TENANT_ID = 'tenant_default';

/**
 * Get current tenant ID from async execution context
 */
function getCurrentTenantId() {
  const store = asyncLocalStorage.getStore();
  return store?.tenantId || DEFAULT_TENANT_ID;
}

/**
 * Express middleware to identify and set tenant context for the request
 */
async function resolveTenant(req, res, next) {
  try {
    let tenantId = null;

    // 1. Check req.user from JWT (if already decoded by auth middleware)
    if (req.user && req.user.tenant_id) {
      tenantId = req.user.tenant_id;
    }

    // 2. Check X-Tenant-Id header
    if (!tenantId && req.headers['x-tenant-id']) {
      tenantId = String(req.headers['x-tenant-id']).trim();
    }

    // 3. Fallback: if user is logged in (req.user.id) but no tenant_id in token, query DB
    if (!tenantId && req.user && req.user.id) {
      try {
        const rows = await query('SELECT tenant_id FROM users WHERE id = ?', [req.user.id]);
        if (rows.length > 0 && rows[0].tenant_id) {
          tenantId = rows[0].tenant_id;
          req.user.tenant_id = tenantId;
        }
      } catch (e) {}
    }

    // 4. Default tenant fallback
    if (!tenantId) {
      tenantId = DEFAULT_TENANT_ID;
    }

    req.tenant_id = tenantId;

    // Run next middleware/handler within the AsyncLocalStorage context
    asyncLocalStorage.run({ tenantId }, () => {
      next();
    });
  } catch (error) {
    console.error('[Tenant Middleware Error]:', error);
    next(error);
  }
}

/**
 * Seed initial baseline data for a newly registered tenant/shop
 */
async function seedTenantDefaults(tenantId, shopData = {}) {
  const shopName = shopData.shop_name || 'My Shop';
  const currency = shopData.currency || 'PKR';
  const phone = shopData.phone || '';
  const email = shopData.email || '';
  const address = shopData.shop_address || '';

  try {
    // 1. Default Accounts
    await query(
      `INSERT INTO accounts (tenant_id, name, type, opening_balance, current_balance, status)
       VALUES (?, 'Cash in Hand', 'cash', 0.00, 0.00, 'active'),
              (?, 'Main Bank Account', 'bank', 0.00, 0.00, 'active')`,
      [tenantId, tenantId]
    ).catch(err => console.warn('[Seed Accounts Warn]:', err.message));

    // 2. Default Category & Brand
    const catSlug = `general-${tenantId.substring(0, 8)}`;
    await query(
      `INSERT INTO categories (tenant_id, name, slug, status)
       VALUES (?, 'General', ?, 'active')`,
      [tenantId, catSlug]
    ).catch(err => console.warn('[Seed Category Warn]:', err.message));

    await query(
      `INSERT INTO brands (tenant_id, name, status)
       VALUES (?, 'General', 'active')`,
      [tenantId]
    ).catch(err => console.warn('[Seed Brand Warn]:', err.message));

    // 3. Default Expense Categories
    const defaultExpCats = [
      ['Rent', '#f44336', 'Shop & Warehouse Rent'],
      ['Utilities', '#ff9800', 'Electricity, Water, Internet'],
      ['Salaries', '#4caf50', 'Staff & Employee Salaries'],
      ['Stationery', '#2196f3', 'Office & Printing supplies'],
      ['Maintenance', '#9c27b0', 'Repairs & Maintenance'],
      ['Other', '#757575', 'Miscellaneous Expenses']
    ];

    for (const [name, color, desc] of defaultExpCats) {
      await query(
        `INSERT INTO expense_categories (tenant_id, name, color, description)
         VALUES (?, ?, ?, ?)`,
        [tenantId, name, color, desc]
      ).catch(() => {});
    }

    // 4. Default System Settings
    const settings = [
      ['shop_name', shopName, 'Business Store Name'],
      ['shop_address', address, 'Store Address'],
      ['phone', phone, 'Contact Phone'],
      ['email', email, 'Contact Email'],
      ['currency', currency, 'Default System Currency'],
      ['tax_rate', '0', 'Default Sales Tax %'],
      ['fbr_enabled', '0', 'Enable FBR Integration (1/0)'],
      ['invoice_prefix', 'INV-', 'Invoice Prefix']
    ];

    for (const [k, v, desc] of settings) {
      await query(
        `INSERT INTO system_settings (tenant_id, \`key\`, \`value\`, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
        [tenantId, k, String(v), desc]
      ).catch(() => {});
    }

    console.log(`[Tenant] Seeded defaults for tenant: ${tenantId} (${shopName})`);
  } catch (err) {
    console.error(`[Tenant] Failed to seed defaults for ${tenantId}:`, err);
  }
}

module.exports = {
  resolveTenant,
  getCurrentTenantId,
  seedTenantDefaults,
  DEFAULT_TENANT_ID,
  asyncLocalStorage
};
