// ============================================================
//  db-brands.js — Brands Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachBrandMethods(StorageClass) {
  
  StorageClass.prototype.getBrands = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM brands WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('brands').then(r => r.filter(x => !x.is_deleted));
  };
  
  StorageClass.prototype.getBrandById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM brands WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('brands', id);
    return result && !result.is_deleted ? result : null;
  };
  
  StorageClass.prototype.createBrand = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "INSERT INTO brands (name, status) VALUES (?, ?)", 
        [data.name, data.status || 'active']
      );
      if (SYNC_ENABLED) {
        await syncToCloud('brands', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('brands', { ...data, is_deleted: 0 });
  };
  
  StorageClass.prototype.updateBrand = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE brands SET name = ?, status = ? WHERE id = ?", 
        [data.name, data.status, id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('brands', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('brands', id);
    if (!e) return { changes: 0 };
    return idbPut('brands', { ...e, ...data, id: e.id });
  };
  
  StorageClass.prototype.deleteBrand = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE brands SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('brands', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('brands', id);
    if (!e) return { changes: 0 };
    return idbPut('brands', { ...e, is_deleted: 1, id: e.id });
  };

}