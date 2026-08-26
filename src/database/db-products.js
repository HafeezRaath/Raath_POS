// ============================================================
//  db-products.js — Products & Variants Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { 
  idbGetAll, idbGetById, idbAdd, idbPut 
} from './core/idb-core.js';

export function attachProductMethods(StorageClass) {

  // ==================== GET PRODUCTS (with brand & category names) ====================
  StorageClass.prototype.getProducts = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT p.*, b.name as brand_name, c.name as category_name 
         FROM products p 
         LEFT JOIN brands b ON p.brand_id = b.id 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE p.is_deleted = 0 
         ORDER BY p.id DESC`
      );
    }
    const [p, b, c] = await Promise.all([
      idbGetAll('products'), 
      idbGetAll('brands'), 
      idbGetAll('categories')
    ]);
    const brandMap = new Map(b.map(x => [String(x.id), x]));
    const catMap = new Map(c.map(x => [String(x.id), x]));
    return p.filter(x => !x.is_deleted).map(item => ({ 
      ...item, 
      brand_name: brandMap.get(String(item.brand_id))?.name || '', 
      category_name: catMap.get(String(item.category_id))?.name || '' 
    }));
  };

  // ==================== GET ALL VARIANTS (enriched) ====================
  StorageClass.prototype.getAllVariants = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT pv.*, p.name as product_name, p.type as product_type, 
                p.category_id, p.image_url, c.name as category_name 
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE pv.is_deleted = 0 AND p.is_deleted = 0 
         ORDER BY p.id DESC`
      );
    }
    const [v, p, c] = await Promise.all([
      idbGetAll('product_variants'), 
      idbGetAll('products'), 
      idbGetAll('categories')
    ]);
    const prodMap = new Map(p.map(x => [String(x.id), x]));
    const catMap = new Map(c.map(x => [String(x.id), x]));
    return v.filter(x => !x.is_deleted).map(item => { 
      const parent = prodMap.get(String(item.product_id)); 
      return { 
        ...item, 
        product_name: parent?.name || '', 
        product_type: parent?.type || 'single', 
        category_id: parent?.category_id || null,
        image_url: parent?.image_url || '',
        category_name: catMap.get(String(parent?.category_id))?.name || '' 
      }; 
    });
  };

  // ==================== GET VARIANTS BY PRODUCT ====================
  StorageClass.prototype.getProductVariants = async function(productId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT pv.*, p.name as product_name, p.type as product_type, p.category_id 
                 FROM product_variants pv 
                 JOIN products p ON pv.product_id = p.id 
                 WHERE pv.is_deleted = 0 AND p.is_deleted = 0`;
      return productId 
        ? this.electronQuery(sql + " AND pv.product_id = ?", [productId]) 
        : this.electronQuery(sql);
    }
    const [v, p] = await Promise.all([
      idbGetAll('product_variants'), 
      idbGetAll('products')
    ]);
    const prodMap = new Map(p.map(x => [String(x.id), x]));
    let res = v.filter(x => !x.is_deleted);
    if (productId) res = res.filter(x => String(x.product_id) === String(productId));
    return res.map(item => { 
      const parent = prodMap.get(String(item.product_id)); 
      return { 
        ...item, 
        product_name: parent?.name || '', 
        product_type: parent?.type || 'single', 
        category_id: parent?.category_id || null 
      }; 
    });
  };

  // ==================== GET PRODUCT BY ID ====================
  StorageClass.prototype.getProductById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery(
        "SELECT * FROM products WHERE id = ? AND is_deleted = 0", 
        [id]
      );
      return r[0] || null;
    }
    const result = await idbGetById('products', id);
    return result && !result.is_deleted ? result : null;
  };

  // ==================== GET VARIANT BY SKU ====================
  StorageClass.prototype.getVariantBySKU = async function(sku) {
    const cleanSku = String(sku || '').trim();
    if (!cleanSku) return null;
    
    if (this.mode === 'electron') {
      const rows = await this.electronQuery(
        "SELECT * FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0 LIMIT 1", 
        [cleanSku]
      );
      return rows[0] || null;
    }
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('RAATH_POS_DEMO'); // ya config se DB_NAME
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('product_variants', 'readonly');
      const store = tx.objectStore('product_variants');
      
      if (store.indexNames.contains('sku')) {
        const index = store.index('sku');
        const range = IDBKeyRange.only(cleanSku);
        const request = index.get(range);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result && !result.is_deleted ? result : null);
        };
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => {
          const result = request.result.find(v => 
            v.sku?.toLowerCase() === cleanSku.toLowerCase() && !v.is_deleted
          );
          resolve(result || null);
        };
        request.onerror = () => reject(request.error);
      }
    });
  };

  // ==================== ADD PRODUCT ====================
  StorageClass.prototype.addProduct = async function(data) { 
    if (data.brand_id) {
      const brand = await this.getBrandById(data.brand_id);
      if (!brand) throw new Error(`Brand ID ${data.brand_id} not found`);
    }
    if (data.category_id) {
      const cat = await this.getCategoryById(data.category_id);
      if (!cat) throw new Error(`Category ID ${data.category_id} not found`);
    }
    
    const cleanData = {
      ...data,
      type: data.type || 'single',
      status: data.status || 'active',
      image_url: data.image_url || null
    };
    
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO products (name, brand_id, category_id, type, unit, tax_type, description, status, image_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          cleanData.name, cleanData.brand_id, cleanData.category_id, 
          cleanData.type, cleanData.unit, cleanData.tax_type, 
          cleanData.description, cleanData.status, cleanData.image_url
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('products', { ...cleanData, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbPut('products', { ...cleanData, is_deleted: 0 });
  };

  // ==================== CREATE VARIANT (with SKU merge) ====================
  StorageClass.prototype.createVariant = async function(data) {
    const cleanSku = String(data.sku || '').trim();
    if (!cleanSku) throw new Error('SKU required');
    
    // ==================== ELECTRON MODE ====================
    if (this.mode === 'electron') {
      const existing = await this.electronQuery(
        "SELECT id, purchase_price, retail_price, wholesale_price, current_stock  FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0", 
        [cleanSku]
      );
      
      if (existing.length > 0) {
        const updates = [];
        const params = [];
        
        if (data.current_stock !== undefined && data.current_stock !== null) {
          updates.push("current_stock = current_stock + ?");
          params.push(Number(data.current_stock) || 0);
        }
        if (data.purchase_price !== undefined && data.purchase_price !== null) {
          updates.push("purchase_price = ?");
          params.push(data.purchase_price);
        }
        if (data.retail_price !== undefined && data.retail_price !== null) {
          updates.push("retail_price = ?");
          params.push(data.retail_price);
        }
        if (data.wholesale_price !== undefined && data.wholesale_price !== null) {
          updates.push("wholesale_price = ?");
          params.push(data.wholesale_price);
        }
        if (data.variant_name !== undefined && data.variant_name !== null) {
          updates.push("variant_name = ?");
          params.push(data.variant_name);
        }
        if (data.barcode !== undefined && data.barcode !== null) {
          updates.push("barcode = ?");
          params.push(data.barcode);
        }
        if (data.stock_alert_quantity !== undefined && data.stock_alert_quantity !== null) {
          updates.push("stock_alert_quantity = ?");
          params.push(data.stock_alert_quantity);
        }
        
        if (updates.length > 0) {
          params.push(existing[0].id);
          await this.electronQuery(
            `UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`, 
            params
          );
        }
        
        if (SYNC_ENABLED) {
          await syncToCloud('product_variants', { 
            id: existing[0].id, 
            ...data,
            merged: true 
          });
        }
        return { lastInsertRowid: existing[0].id, changes: 1, merged: true };
      }
      
      const _res = await this.electronQuery(
        `INSERT INTO product_variants (
          product_id, sku, barcode, variant_name, purchase_price, retail_price, 
          wholesale_price, minimum_retail_price, stock_alert_quantity, current_stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          data.product_id, cleanSku, data.barcode, data.variant_name || 'Default', 
          data.purchase_price || 0, data.retail_price || 0, data.wholesale_price || 0, 
          data.minimum_retail_price || 0, data.stock_alert_quantity || 5, data.current_stock || 0
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('product_variants', { 
          ...data, 
          sku: cleanSku, 
          id: _res.lastInsertRowid, 
          is_deleted: 0 
        });
      }
      return _res;
    }
    
    // ==================== BROWSER MODE (Mutex locked) ====================
    return this._withMutex(async () => {
      const existing = await this.getVariantBySKU(cleanSku);
      if (existing) {
        const updates = { ...existing };
        if (data.current_stock !== undefined && data.current_stock !== null) {
          updates.current_stock = this.safeAdd(existing.current_stock, data.current_stock);
        }
        if (data.purchase_price !== undefined && data.purchase_price !== null) {
          updates.purchase_price = data.purchase_price;
        }
        if (data.retail_price !== undefined && data.retail_price !== null) {
          updates.retail_price = data.retail_price;
        }
        if (data.wholesale_price !== undefined && data.wholesale_price !== null) {
          updates.wholesale_price = data.wholesale_price;
        }
        if (data.variant_name !== undefined && data.variant_name !== null) {
          updates.variant_name = data.variant_name;
        }
        updates.updated_at = new Date().toISOString();
        await idbPut('product_variants', updates);
        if (SYNC_ENABLED) {
          await syncToCloud('product_variants', { ...updates, merged: true });
        }
        return { lastInsertRowid: existing.id, changes: 1, merged: true };
      }
      
      return idbPut('product_variants', { ...data, sku: cleanSku, is_deleted: 0 });
    }, 'createVariant_' + cleanSku);
  };

  // ==================== ALIAS ====================
  StorageClass.prototype.addVariant = async function(data) { 
    return this.createVariant(data); 
  };

  // ==================== UPDATE PRODUCT ====================
  StorageClass.prototype.updateProduct = async function(id, data) { 
    if (data.brand_id) {
      const brand = await this.getBrandById(data.brand_id);
      if (!brand) throw new Error(`Brand ID ${data.brand_id} not found`);
    }
    if (data.category_id) {
      const cat = await this.getCategoryById(data.category_id);
      if (!cat) throw new Error(`Category ID ${data.category_id} not found`);
    }
    
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      const allowed = ['name','brand_id','category_id','type','unit','tax_type','description','status','image_url'];
      
      for (const key of allowed) {
        if (data[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(key === 'image_url' ? (data[key] || null) : data[key]);
        }
      }
      if (fields.length === 0) return { changes: 0 };
      values.push(id);
      
      const _res = await this.electronQuery(
        `UPDATE products SET ${fields.join(', ')} WHERE id = ?`, 
        values
      );
      if (SYNC_ENABLED) {
        await syncToCloud('products', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('products', id);
    if (!e) return { changes: 0 };
    return idbPut('products', { ...e, ...data, id: e.id });
  };

  // ==================== UPDATE VARIANT ====================
  StorageClass.prototype.updateVariant = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE product_variants SET 
          sku = ?, barcode = ?, variant_name = ?, purchase_price = ?, 
          retail_price = ?, wholesale_price = ?, minimum_retail_price = ?, 
          stock_alert_quantity = ?, current_stock = ? 
         WHERE id = ?`, 
        [
          data.sku, data.barcode, data.variant_name, data.purchase_price, 
          data.retail_price, data.wholesale_price, data.minimum_retail_price, 
          data.stock_alert_quantity, data.current_stock, id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('product_variants', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('product_variants', id);
    if (!e) return { changes: 0 };
    
    if (data.current_stock !== undefined && Number(data.current_stock) < 0) {
      throw new Error('Stock cannot be negative');
    }
    
    return idbPut('product_variants', { ...e, ...data, id: e.id });
  };

  // ==================== UPDATE VARIANT IMAGE ====================
  StorageClass.prototype.updateVariantImage = async function(id, imageUrl) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE product_variants SET image_url = ? WHERE id = ?",
        [imageUrl, id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('product_variants', { id, image_url: imageUrl });
      }
      return _res;
    }
    const variant = await idbGetById('product_variants', id);
    if (!variant) return { changes: 0 };
    variant.image_url = imageUrl;
    variant.updated_at = new Date().toISOString();
    const result = await idbPut('product_variants', { ...variant, id: variant.id });
    if (SYNC_ENABLED) {
      await syncToCloud('product_variants', { id, image_url: imageUrl });
    }
    return result;
  };

  // ==================== ATOMIC STOCK UPDATE (with retry) ====================
  StorageClass.prototype.updateVariantStock = async function(id, qty) { 
    if (this.mode === 'electron') {
      let retries = 5;
      let delay = 50;
      
      const attempt = async () => {
        try {
          const result = await this.electronQuery(
            "UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ? AND current_stock + ? >= 0",
            [qty, id, qty]
          );
          if (result.changes === 0 && qty < 0) {
            throw new Error(`Insufficient stock for variant ${id}`);
          }
          if (SYNC_ENABLED) {
            await syncToCloud('product_variants', { id, current_stock_delta: qty });
          }
          return result;
        } catch (err) {
          if (retries > 0 && err.message?.includes('SQLITE_BUSY')) {
            retries--;
            console.log(`🔄 Stock retry ${5 - retries}/5 for variant ${id}`);
            await this._sleep(delay);
            delay *= 2;
            return attempt();
          }
          throw err;
        }
      };
      return attempt();
    }
    
    // Browser mode
    const v = await idbGetById('product_variants', id);
    if (!v) return { success: false };
    const newStock = this.safeAdd(v.current_stock, qty);
    if (newStock < 0) {
      throw new Error(`Insufficient stock for variant ${id}`);
    }
    v.current_stock = newStock;
    await idbPut('product_variants', { ...v, id: v.id });
    if (SYNC_ENABLED) {
      await syncToCloud('product_variants', { id, current_stock: v.current_stock });
    }
    return { success: true };
  };

  // ==================== DELETE VARIANT ====================
  StorageClass.prototype.deleteVariant = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE product_variants SET is_deleted = 1 WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('product_variants', { id, is_deleted: 1 });
      }
      return _res;
    }
    const v = await idbGetById('product_variants', id);
    if (!v) return { changes: 0 };
    v.is_deleted = 1;
    await idbPut('product_variants', { ...v, id: v.id });
    return { changes: 1 };
  };

  // ==================== DELETE PRODUCT (cascades to variants) ====================
  StorageClass.prototype.deleteProduct = async function(id) { 
    if (this.mode === 'electron') {
      await this.electronQuery(
        "UPDATE product_variants SET is_deleted = 1 WHERE product_id = ?", 
        [id]
      );
      const _res = await this.electronQuery(
        "UPDATE products SET is_deleted = 1 WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('products', { id, is_deleted: 1 });
      }
      return _res;
    }
    const p = await idbGetById('products', id);
    if (!p) return { changes: 0 };
    p.is_deleted = 1;
    await idbPut('products', { ...p, id: p.id });
    
    const variants = await idbGetAll('product_variants');
    for (const v of variants) {
      if (String(v.product_id) === String(id) && !v.is_deleted) {
        v.is_deleted = 1;
        v.updated_at = new Date().toISOString();
        await idbPut('product_variants', { ...v, id: v.id }, true);
      }
    }
    return { changes: 1 };
  };

}