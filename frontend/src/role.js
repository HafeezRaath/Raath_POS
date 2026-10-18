import db from './database/db';

// ==================== AVAILABLE PAGES FOR PERMISSIONS ====================
export const AVAILABLE_PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '' },
  { id: 'pos', label: 'POS / Billing', icon: '' },
  { id: 'sales', label: 'Sales History', icon: '' },
  { id: 'inventory', label: 'Inventory', icon: '' },
  { id: 'products', label: 'Products', icon: '' },
  { id: 'customers', label: 'Customers', icon: '' },
  { id: 'suppliers', label: 'Suppliers', icon: '' },
  { id: 'purchases', label: 'Purchases', icon: '' },
  { id: 'expenses', label: 'Expenses', icon: '' },
  { id: 'reports', label: 'Reports', icon: '' },
  { id: 'settings', label: 'Settings', icon: '' },
  { id: 'emi', label: 'EMI System', icon: '' },
  { id: 'workorders', label: 'Work Orders', icon: '' },
  { id: 'distribution', label: 'Distribution', icon: '' },
  { id: 'users', label: 'User Management', icon: '' },
  { id: 'backup', label: 'Backup', icon: '' },
];

// ==================== DEFAULT ROLES ====================
const getDefaultPages = () => AVAILABLE_PAGES.map(p => p.id);

export const DEFAULT_ROLES = [
  { 
    id: 'admin', 
    label: 'Administrator', 
    color: 'error', 
    pages: getDefaultPages(),
    permissions: AVAILABLE_PAGES.reduce((acc, p) => {
      acc[p.id] = { view: true, add: true, edit: true, delete: true };
      return acc;
    }, {})
  },
  { 
    id: 'manager', 
    label: 'Manager', 
    color: 'warning', 
    pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi'],
    permissions: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi'].reduce((acc, p) => {
      acc[p] = { view: true, add: true, edit: true, delete: true };
      return acc;
    }, {})
  },
  { 
    id: 'cashier', 
    label: 'Cashier / Seller', 
    color: 'primary', 
    pages: ['dashboard', 'pos', 'sales', 'customers'],
    permissions: ['dashboard', 'pos', 'sales', 'customers'].reduce((acc, p) => {
      acc[p] = { view: true, add: true, edit: false, delete: false };
      return acc;
    }, {})
  },
  { 
    id: 'viewer', 
    label: 'Viewer', 
    color: 'default', 
    pages: ['dashboard', 'sales', 'reports'],
    permissions: ['dashboard', 'sales', 'reports'].reduce((acc, p) => {
      acc[p] = { view: true, add: false, edit: false, delete: false };
      return acc;
    }, {})
  },
];

// ==================== BUILD PERMISSIONS MAP ====================
// ==================== ROLE NORMALIZATION ====================
export function normalizeRole(role) {
  if (!role) return null;
  let pages = role.pages || [];
  if (typeof pages === 'string') {
    try { pages = JSON.parse(pages); } catch (e) { pages = []; }
  }
  let perms = role.permissions;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
  }

  // If permissions is empty or missing, populate from pages
  if (!perms || typeof perms !== 'object' || Array.isArray(perms) || Object.keys(perms).length === 0) {
    perms = {};
    (pages || []).forEach(pid => {
      perms[pid] = { view: true, add: true, edit: true, delete: true };
    });
  } else {
    // If permissions object exists, synchronize pages array with pages that have view: true
    const activePages = Object.entries(perms)
      .filter(([_, p]) => p && (p.view === true || p === true))
      .map(([pid]) => pid);
    if (activePages.length > 0) {
      pages = activePages;
    }
  }

  return { ...role, pages, permissions: perms };
}

// ==================== BUILD PERMISSIONS MAP ====================
export function buildPermissionsMap(roles) {
  const perms = {};
  (roles || []).forEach(r => {
    const normalized = normalizeRole(r);
    if (normalized && normalized.id) {
      perms[normalized.id] = normalized.permissions;
    }
  });
  return perms;
}

// ==================== GET ROLES ====================
export async function getRoles() {
  try {
    let dbRoles = await db.getRoles();
    if (dbRoles && dbRoles.length > 0) {
      const enhanced = dbRoles.map(role => normalizeRole(role)).filter(Boolean);
      localStorage.setItem('pos_roles', JSON.stringify(enhanced));
      localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(enhanced)));
      return enhanced;
    }
  } catch (e) {
    console.warn('[Roles] DB load failed:', e.message);
  }

  // Fallback to cache or defaults
  const cached = getRolesSync();
  return cached;
}

export async function getRolePermissions() {
  const roles = await getRoles();
  return buildPermissionsMap(roles);
}

export function hasPermission(role, page) {
  return hasPermissionSync(role, page);
}

export async function getRoleLabel(roleId) {
  const roles = await getRoles();
  return roles.find(r => r.id === roleId)?.label || roleId;
}

export async function getRoleColor(roleId) {
  const roles = await getRoles();
  return roles.find(r => r.id === roleId)?.color || 'default';
}

// ==================== SYNC VERSIONS ====================
export function getRolesSync() {
  try {
    const stored = localStorage.getItem('pos_roles');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(role => normalizeRole(role)).filter(Boolean);
      }
    }
  } catch (e) {}
  return DEFAULT_ROLES.map(role => normalizeRole(role));
}

export function getRolePermissionsSync() {
  try {
    const stored = localStorage.getItem('pos_permissions');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return buildPermissionsMap(getRolesSync());
}

export function hasPermissionSync(role, page) {
  if (!role || !page) return false;
  if (role === 'admin') return true;

  const roles = getRolesSync();
  const r = roles.find(item => item.id === role);
  if (!r) {
    const allPerms = getRolePermissionsSync();
    const rolePerms = allPerms[role];
    if (rolePerms) {
      const pagePerm = rolePerms[page];
      if (typeof pagePerm === 'boolean') return pagePerm;
      if (pagePerm && typeof pagePerm === 'object') return Boolean(pagePerm.view);
    }
    return false;
  }

  const normalized = normalizeRole(r);
  if (!normalized) return false;

  const pagePerm = normalized.permissions?.[page];
  if (typeof pagePerm === 'boolean') return pagePerm;
  if (pagePerm && typeof pagePerm === 'object') return Boolean(pagePerm.view);

  if (Array.isArray(normalized.pages)) {
    return normalized.pages.includes(page);
  }

  return false;
}

export function getRoleLabelSync(roleId) {
  return getRolesSync().find(r => r.id === roleId)?.label || roleId;
}

export function getRoleColorSync(roleId) {
  return getRolesSync().find(r => r.id === roleId)?.color || 'default';
}

// ==================== PERSIST ROLES TO DB ====================
export async function persistRolesToDB(newRoles) {
  if (!newRoles || newRoles.length === 0) {
    throw new Error('Cannot persist empty roles');
  }

  const normalizedRoles = newRoles.map(role => normalizeRole(role)).filter(Boolean);
  const perms = buildPermissionsMap(normalizedRoles);

  try {
    let existing = [];
    try {
      existing = await db.getRoles();
    } catch (e) {
      console.warn('[persistRolesToDB] Could not get existing roles:', e.message);
    }

    for (const role of normalizedRoles) {
      try {
        await db.createRole(role);
      } catch (err) {
        if (err.message && err.message.includes('exists')) {
          await db.updateRole(role.id, role);
        } else {
          throw err;
        }
      }
    }

    if (existing && existing.length > 0) {
      const newIds = new Set(normalizedRoles.map(r => r.id));
      for (const old of existing) {
        if (!newIds.has(old.id) && old.id !== 'admin') {
          try {
            await db.deleteRole(old.id);
          } catch (e) {
            console.warn('[persistRolesToDB] Could not delete role:', old.id, e.message);
          }
        }
      }
    }

    // Sync to localStorage cache
    localStorage.setItem('pos_roles', JSON.stringify(normalizedRoles));
    localStorage.setItem('pos_permissions', JSON.stringify(perms));

    return { roles: normalizedRoles, permissions: perms };
  } catch (error) {
    console.error('[persistRolesToDB] Error:', error);
    throw error;
  }
}

// ==================== CACHE CLEAR ====================
export function clearRoleCache() {
  localStorage.removeItem('pos_roles');
  localStorage.removeItem('pos_permissions');
}