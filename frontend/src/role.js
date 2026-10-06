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
function buildPermissionsMap(roles) {
  const perms = {};
  roles.forEach(r => {
    if (r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions)) {
      perms[r.id] = r.permissions;
    } else {
      const pagePerms = {};
      (r.pages || []).forEach(pid => {
        pagePerms[pid] = { view: true, add: true, edit: true, delete: true };
      });
      perms[r.id] = pagePerms;
    }
  });
  return perms;
}

// ==================== GET ROLES ====================
export async function getRoles() {
  try {
    // First try to get from DB
    let dbRoles = await db.getRoles();
    
    if (dbRoles && dbRoles.length > 0) {
      // Ensure all roles have proper permissions object
      const enhanced = dbRoles.map(role => {
        if (!role.permissions || typeof role.permissions !== 'object' || Array.isArray(role.permissions)) {
          const pagePerms = {};
          (role.pages || []).forEach(pid => {
            pagePerms[pid] = { view: true, add: true, edit: true, delete: true };
          });
          return { ...role, permissions: pagePerms };
        }
        return role;
      });
      
      // Update localStorage cache
      localStorage.setItem('pos_roles', JSON.stringify(enhanced));
      localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(enhanced)));
      return enhanced;
    }
  } catch (e) {
    console.warn('[Roles] DB load failed:', e.message);
  }

  // No roles in DB, try to seed defaults
  try {
    await db.seedDefaultRoles(DEFAULT_ROLES);
    let dbRoles = await db.getRoles();
    if (dbRoles && dbRoles.length > 0) {
      const enhanced = dbRoles.map(role => {
        if (!role.permissions || typeof role.permissions !== 'object' || Array.isArray(role.permissions)) {
          const pagePerms = {};
          (role.pages || []).forEach(pid => {
            pagePerms[pid] = { view: true, add: true, edit: true, delete: true };
          });
          return { ...role, permissions: pagePerms };
        }
        return role;
      });
      localStorage.setItem('pos_roles', JSON.stringify(enhanced));
      localStorage.setItem('pos_permissions', JSON.stringify(buildPermissionsMap(enhanced)));
      return enhanced;
    }
  } catch (e) {
    console.warn('[Roles] DB seed failed:', e.message);
  }

  // Final fallback - use hardcoded defaults
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
  if (role === 'admin') return true;
  const perms = await getRolePermissions();
  return perms[role]?.[page]?.view || false;
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
        return parsed.map(role => {
          if (!role.permissions || typeof role.permissions !== 'object' || Array.isArray(role.permissions)) {
            const pagePerms = {};
            (role.pages || []).forEach(pid => {
              pagePerms[pid] = { view: true, add: true, edit: true, delete: true };
            });
            return { ...role, permissions: pagePerms };
          }
          return role;
        });
      }
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
  return buildPermissionsMap(DEFAULT_ROLES);
}

export function hasPermissionSync(role, page) {
  if (!role) return false;
  if (role === 'admin') return true;
  const perms = getRolePermissionsSync()[role];
  return perms?.[page]?.view || false;
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

  const perms = buildPermissionsMap(newRoles);

  try {
    // FIX: Directly clear and re-insert all roles to avoid duplicate key errors
    // First, try to get existing roles
    let existing = [];
    try {
      existing = await db.getRoles();
    } catch (e) {
      console.warn('[persistRolesToDB] Could not get existing roles:', e.message);
    }

    // FIX: For each role, use createRole which handles INSERT OR REPLACE
    for (const role of newRoles) {
      try {
        await db.createRole(role);
      } catch (err) {
        // If create fails, try update
        if (err.message && err.message.includes('exists')) {
          await db.updateRole(role.id, role);
        } else {
          throw err;
        }
      }
    }

    // Delete roles that are no longer in the list (except admin)
    if (existing && existing.length > 0) {
      const newIds = new Set(newRoles.map(r => r.id));
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
    localStorage.setItem('pos_roles', JSON.stringify(newRoles));
    localStorage.setItem('pos_permissions', JSON.stringify(perms));

    return { roles: newRoles, permissions: perms };
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