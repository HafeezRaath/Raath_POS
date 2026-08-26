// ============================================================
//  db-users.js — Users & Authentication Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachUserMethods(StorageClass) {

  // ==================== USERS / AUTH ====================
  StorageClass.prototype.getUsers = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('users').then(r => r.filter(x => !x.is_deleted).map(u => { 
      const { password, password_hash, ...safe } = u; 
      return safe; 
    }));
  };

  StorageClass.prototype.getUserById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const u = await idbGetById('users', id);
    if (u) { 
      const { password, password_hash, ...safe } = u; 
      return safe; 
    }
    return null;
  };

  StorageClass.prototype.getUserByEmail = async function(email) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1", [email]);
      return r[0] || null;
    }
    const all = await idbGetAll('users');
    const user = all.find(u => u.email?.toLowerCase() === email?.toLowerCase() && !u.is_deleted);
    if (user) { 
      const { password, password_hash, ...safe } = user; 
      return safe; 
    }
    return null;
  };

  StorageClass.prototype.createUser = async function(data) { 
    const plainPassword = data.password || data.password_hash || '12345678';
    const shopId = data.shop_id || localStorage.getItem('raath_shop_id') || `shop_${Date.now()}`;
    
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO users (name, email, phone, password, role, shop_name, shop_address, business_type, currency, status, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`, 
        [data.name, data.email, data.phone || '', plainPassword, data.role || 'cashier', data.shop_name || '', data.shop_address || '', data.business_type || 'retail', data.currency || 'PKR', data.status || 'active', 0]
      );
      
      const safe = { 
        ...data, 
        id: _res.lastInsertRowid, 
        shop_id: shopId,
        password_hash: plainPassword,
        is_deleted: 0 
      };
      delete safe.password;

      if (SYNC_ENABLED) {
        await syncToCloud('users', safe);
      }
      return _res;
    }

    const { password: _, ...safeData } = data;
    return idbAdd('users', { 
      ...safeData, 
      password: plainPassword, 
      password_hash: plainPassword,
      shop_id: shopId,
      is_deleted: 0, 
      created_at: new Date().toISOString() 
    });
  };

  StorageClass.prototype.updateUser = async function(id, data) {
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
      if (data.shop_name !== undefined) { fields.push('shop_name = ?'); values.push(data.shop_name); }
      if (data.shop_address !== undefined) { fields.push('shop_address = ?'); values.push(data.shop_address); }
      if (data.business_type !== undefined) { fields.push('business_type = ?'); values.push(data.business_type); }
      if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.password) { 
        fields.push('password = ?'); 
        values.push(data.password); 
      }
      if (fields.length === 0) throw new Error('No fields provided for update');
      fields.push("updated_at = datetime('now')");
      values.push(id);
      const _res = await this.electronQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      
      const safe = { ...data, id };
      delete safe.password;
      if (SYNC_ENABLED) {
        await syncToCloud('users', safe);
      }
      return _res;
    }
    const e = await idbGetById('users', id);
    if (!e) return { changes: 0 };
    const { password: _, ...safeData } = data;
    const updateData = { ...e, ...safeData, id: e.id, updated_at: new Date().toISOString() };
    if (data.password) {
      updateData.password = data.password;
    }
    return idbPut('users', updateData);
  };

  StorageClass.prototype.deleteUser = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE users SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('users', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('users', id);
    if (!e) return { changes: 0 };
    return idbPut('users', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.verifyUser = async function(email, password) {
    let user;
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1", [email]);
      user = r[0] || null;
    } else {
      const all = await idbGetAll('users');
      user = all.find(u => u.email?.toLowerCase() === email?.toLowerCase() && !u.is_deleted) || null;
    }
    
    if (!user) return null;
    
    const storedPassword = user.password || user.password_hash;
    
    if (storedPassword === password) {
      const { password, password_hash, ...safeUser } = user;
      return safeUser;
    }
    return null;
  };

}