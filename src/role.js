import db from './database/db';

// ==================== AVAILABLE PAGES FOR PERMISSIONS ====================
export const AVAILABLE_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pos', label: 'POS / Billing' },
  { id: 'sales', label: 'Sales History' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'emi', label: 'EMI System' },
  { id: 'users', label: 'User Management' },
  { id: 'backup', label: 'Backup' },
];

// ==================== DEFAULT ROLES ====================
export const DEFAULT_ROLES = [
  { id: 'admin', label: 'Administrator', color: 'error', permissions: ['All Access'], pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup'] },
  { id: 'manager', label: 'Manager', color: 'warning', permissions: ['Sales', 'Inventory', 'Reports', 'Customers', 'Suppliers', 'Purchases', 'Expenses', 'EMI'], pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi'] },
  { id: 'cashier', label: 'Cashier / Seller', color: 'primary', permissions: ['POS / Billing Only', 'View Products', 'Customers'], pages: ['dashboard', 'pos', 'sales', 'customers'] },
  { id: 'viewer', label: 'Viewer', color: 'default', permissions: ['View Only'], pages: ['dashboard', 'sales', 'reports'] },
];

// ==================== DB SYNC HELPERS ====================

// Build permissions map from roles array
function buildPermissionsMap(roles) {
  const perms = {};
  roles.forEach(r => { perms[r.id] = r.pages || []; });
  return perms;
}

// FIXED: getRoles - localStorage first, then DB fallback
export async function getRoles() {
  // Step 1: Pehle localStorage check karo
  try {
    const stored = localStorage.getItem('pos_roles');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  // Step 2: DB se try karo
  let dbRoles = null;
  try {
    dbRoles = await db.getRoles();
    if (dbRoles && dbRoles.length > 0) {
      localStorage.setItem('pos_roles', JSON.stringify(dbRoles));
      localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(dbRoles)));
      return dbRoles;
    }
  } catch (e) {
    console.warn('[Roles] DB load failed:', e.message);
  }

  // Step 3: Seed defaults to DB if empty
  try {
    await db.seedDefaultRoles(DEFAULT_ROLES);
    dbRoles = await db.getRoles();
    if (dbRoles && dbRoles.length > 0) {
      localStorage.setItem('pos_roles', JSON.stringify(dbRoles));
      localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(dbRoles)));
      return dbRoles;
    }
  } catch (e) {
    console.warn('[Roles] DB seed failed:', e.message);
  }

  // Step 4: Final fallback - hardcoded defaults
  const defaults = JSON.parse(JSON.stringify(DEFAULT_ROLES));
  localStorage.setItem('pos_roles', JSON.stringify(defaults));
  localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(defaults)));
  return defaults;
}

export async function getRolePermissions() {
  const roles = await getRoles();
  return buildPermissionsMap(roles);
}

export async function hasPermission(role, page) {
  if (!role) return false;
  if (role === 'admin') return true; // Admin bypass
  const perms = await getRolePermissions();
  return perms[role]?.includes(page) || false;
}

export async function getRoleLabel(roleId) {
  const roles = await getRoles();
  return roles.find(r => r.id === roleId)?.label || roleId;
}

export async function getRoleColor(roleId) {
  const roles = await getRoles();
  return roles.find(r => r.id === roleId)?.color || 'default';
}

// ==================== SYNC VERSIONS (for backward compatibility) ====================
// These read from localStorage cache for synchronous access

export function getRolesSync() {
  try {
    const stored = localStorage.getItem('pos_roles');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_ROLES));
}

export function getRolePermissionsSync() {
  try {
    const stored = localStorage.getItem('pos_permissions');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {}
  const perms = {};
  DEFAULT_ROLES.forEach(r => { perms[r.id] = r.pages; });
  return perms;
}

export function hasPermissionSync(role, page) {
  if (!role) return false;
  if (role === 'admin') return true;
  return getRolePermissionsSync()[role]?.includes(page) || false;
}

export function getRoleLabelSync(roleId) {
  return getRolesSync().find(r => r.id === roleId)?.label || roleId;
}

export function getRoleColorSync(roleId) {
  return getRolesSync().find(r => r.id === roleId)?.color || 'default';
}

// ==================== PERSIST TO DB ====================
export async function persistRolesToDB(newRoles) {
  const perms = buildPermissionsMap(newRoles);

  // Save each role to DB
  const existing = await db.getRoles();
  const existingIds = new Set(existing.map(r => r.id));

  for (const role of newRoles) {
    if (existingIds.has(role.id)) {
      await db.updateRole(role.id, role);
    } else {
      await db.createRole(role);
    }
  }

  // Delete roles that are no longer in the list
  const newIds = new Set(newRoles.map(r => r.id));
  for (const old of existing) {
    if (!newIds.has(old.id)) {
      await db.deleteRole(old.id);
    }
  }

  // Sync to localStorage cache
  localStorage.setItem('pos_roles', JSON.stringify(newRoles));
  localStorage.setItem('pos_permissions', JSON.stringify(perms));

  return { roles: newRoles, permissions: perms };
}

// ==================== CACHE CLEAR ====================
export function clearRoleCache() {
  localStorage.removeItem('pos_roles');
  localStorage.removeItem('pos_permissions');
}