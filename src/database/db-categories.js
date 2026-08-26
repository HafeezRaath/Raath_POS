// ============================================================
//  db-categories.js — Categories Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachCategoryMethods(StorageClass) {
  
  StorageClass.prototype.getCategories = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT c1.*, c2.name as parent_name 
         FROM categories c1 
         LEFT JOIN categories c2 ON c1.parent_id = c2.id 
         WHERE c1.is_deleted = 0 
         ORDER BY c1.name`
      );
    }
    const cats = await idbGetAll('categories');
    return cats
      .filter(x => !x.is_deleted)
      .map(c => ({ 
        ...c, 
        parent_name: cats.find(p => p.id === c.parent_id)?.name || '' 
      }));
  };
  
  StorageClass.prototype.getCategoryById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery(
        "SELECT * FROM categories WHERE id = ? AND is_deleted = 0", 
        [id]
      );
      return r[0] || null;
    }
    const result = await idbGetById('categories', id);
    return result && !result.is_deleted ? result : null;
  };
  
  StorageClass.prototype.createCategory = async function(data) { 
    const cleanSlug = String(data.slug || '').trim().toLowerCase();
    if (!cleanSlug) throw new Error('Category slug is required');
    
    const parentId = data.parent_id !== undefined && data.parent_id !== null && data.parent_id !== '' 
      ? Number(data.parent_id) 
      : null;
    
    if (this.mode === 'electron') {
      const existing = await this.electronQuery(
        "SELECT id FROM categories WHERE slug = ? AND is_deleted = 0", 
        [cleanSlug]
      );
      if (existing.length > 0) throw new Error(`Category slug '${cleanSlug}' already exists`);
      
      const _res = await this.electronQuery(
        "INSERT INTO categories (name, slug, parent_id, status) VALUES (?, ?, ?, ?)", 
        [data.name, cleanSlug, parentId, data.status || 'active']
      );
      if (SYNC_ENABLED) {
        await syncToCloud('categories', { 
          ...data, 
          slug: cleanSlug, 
          id: _res.lastInsertRowid, 
          is_deleted: 0 
        });
      }
      return _res;
    }
    
    const allCats = await idbGetAll('categories');
    if (allCats.some(c => c.slug === cleanSlug && !c.is_deleted)) {
      throw new Error(`Category slug '${cleanSlug}' already exists`);
    }
    
    return idbAdd('categories', { 
      ...data, 
      slug: cleanSlug, 
      parent_id: parentId, 
      is_deleted: 0 
    });
  };
  
  StorageClass.prototype.updateCategory = async function(id, data) { 
    const parentId = data.parent_id !== undefined && data.parent_id !== null && data.parent_id !== '' 
      ? Number(data.parent_id) 
      : null;
    
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE categories SET name = ?, slug = ?, parent_id = ?, status = ? WHERE id = ?", 
        [data.name, data.slug, parentId, data.status, id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('categories', { ...data, parent_id: parentId, id });
      }
      return _res;
    }
    const e = await idbGetById('categories', id);
    if (!e) return { changes: 0 };
    return idbPut('categories', { ...e, ...data, parent_id: parentId, id: e.id });
  };
  
  StorageClass.prototype.deleteCategory = async function(id) { 
    if (this.mode === 'electron') {
      await this.electronQuery(
        "UPDATE products SET category_id = NULL WHERE category_id = ?", 
        [id]
      );
      const _res = await this.electronQuery(
        "UPDATE categories SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('categories', { 
          id, 
          is_deleted: 1, 
          deleted_at: new Date().toISOString() 
        });
      }
      return _res;
    }
    
    const e = await idbGetById('categories', id);
    if (!e) return { changes: 0 };
    
    const products = await idbGetAll('products');
    for (const p of products) {
      if (String(p.category_id) === String(id) && !p.is_deleted) {
        p.category_id = null;
        p.updated_at = new Date().toISOString();
        await idbPut('products', { ...p, id: p.id }, true);
      }
    }
    
    return idbPut('categories', { ...e, is_deleted: 1, id: e.id });
  };

}