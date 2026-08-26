// ============================================================
//  db-roles.js — Roles & Permissions Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachRoleMethods(StorageClass) {

  // ==================== ROLES / PERMISSIONS ====================
  StorageClass.prototype.getRoles = async function() { 
    if (this.mode === 'electron') {
      const rows = await this.electronQuery("SELECT * FROM roles WHERE is_deleted = 0 ORDER BY label");
      return rows.map(r => {
        try {
          const parsedPages = typeof r.pages === 'string' ? JSON.parse(r.pages || '[]') : r.pages;
          const parsedPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : r.permissions;
          return { ...r, pages: Array.isArray(parsedPages) ? parsedPages : [], permissions: (parsedPerms && typeof parsedPerms === 'object' && !Array.isArray(parsedPerms)) ? parsedPerms : {} };
        } catch (e) {
          return { ...r, pages: [], permissions: {} };
        }
      });
    }
    const rows = await idbGetAll('roles');
    return rows.filter(x => !x.is_deleted).map(r => ({ ...r, pages: Array.isArray(r.pages) ? r.pages : [], permissions: (r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions)) ? r.permissions : {} }));
  };

  StorageClass.prototype.getRoleById = async function(id) { 
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM roles WHERE id = ? AND is_deleted = 0", [id]);
      if (!r[0]) return null;
      try {
        const parsedPages = typeof r[0].pages === 'string' ? JSON.parse(r[0].pages || '[]') : r[0].pages;
        const parsedPerms = typeof r[0].permissions === 'string' ? JSON.parse(r[0].permissions || '{}') : r[0].permissions;
        return { ...r[0], pages: Array.isArray(parsedPages) ? parsedPages : [], permissions: (parsedPerms && typeof parsedPerms === 'object' && !Array.isArray(parsedPerms)) ? parsedPerms : {} };
      } catch (e) {
        return { ...r[0], pages: [], permissions: {} };
      }
    }
    const r = await idbGetById('roles', id);
    if (!r || r.is_deleted) return null;
    return { ...r, pages: Array.isArray(r.pages) ? r.pages : [], permissions: (r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions)) ? r.permissions : {} };
  };

  StorageClass.prototype.createRole = async function(data) {
    const payload = { id: data.id, label: data.label, color: data.color || 'primary', pages: Array.isArray(data.pages) ? data.pages : [], permissions: (data.permissions && typeof data.permissions === 'object' && !Array.isArray(data.permissions)) ? data.permissions : {} };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO roles (id, label, color, pages, permissions, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`, [payload.id, payload.label, payload.color, JSON.stringify(payload.pages), JSON.stringify(payload.permissions)]);
      if (SYNC_ENABLED) {
        await syncToCloud('roles', { ...payload, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('roles', { ...payload, is_deleted: 0 });
  };

  StorageClass.prototype.updateRole = async function(id, data) {
    const existing = await this.getRoleById(id);
    if (!existing) return { changes: 0 };
    const updated = { ...existing, ...data };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE roles SET label = ?, color = ?, pages = ?, permissions = ? WHERE id = ?`, [updated.label, updated.color, JSON.stringify(updated.pages), JSON.stringify(updated.permissions), id]);
      if (SYNC_ENABLED) {
        await syncToCloud('roles', { ...updated, id });
      }
      return _res;
    }
    return idbPut('roles', { ...updated, is_deleted: 0, id: existing.id });
  };

  StorageClass.prototype.deleteRole = async function(id) {
    if (id === 'admin') throw new Error('Cannot delete admin role');
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE roles SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('roles', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('roles', id);
    if (!e) return { changes: 0 };
    return idbPut('roles', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.seedDefaultRoles = async function(defaultRoles) {
    // ✅ DISABLED: Default roles seeding removed.
    // Admin must manually create roles from Settings > Users > Role Management.
    // This prevents hardcoded roles from overriding custom permission setups.
    return;
  };

  // ==================== BACKWARD COMPATIBILITY ALIASES ====================
  StorageClass.prototype.addRole = async function(data) { return this.createRole(data); };

}