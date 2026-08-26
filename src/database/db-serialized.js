// ============================================================
//  db-serialized.js — Serialized / IMEI Items Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbDelete } from './core/idb-core.js';

export function attachSerializedMethods(StorageClass) {

  StorageClass.prototype.getSerializedItems = async function(variantId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT psi.*, p.name as product_name, pv.sku, pv.variant_name FROM product_serialized_items psi JOIN product_variants pv ON psi.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id`;
      if (variantId) sql += ` WHERE psi.product_variant_id = ?`;
      return this.electronQuery(sql, variantId ? [variantId] : []);
    }
    const items = await idbGetAll('product_serialized_items');
    if (variantId) {
      return items.filter(x => x.product_variant_id === Number(variantId));
    }
    return items;
  };

  StorageClass.prototype.getSerializedItemById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM product_serialized_items WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('product_serialized_items', id);
  };

  StorageClass.prototype.addMultipleSerializedItems = async function(variantId, imeiList) {
    if (!Array.isArray(imeiList) || imeiList.length === 0) return { success: false };
    const uniqueImeis = [...new Set(imeiList.map(i => String(i).trim()).filter(Boolean))];
    
    if (this.mode === 'electron') {
      const duplicates = [];
      const validImeis = [];
      
      for (const imei of uniqueImeis) {
        const existing = await this.electronQuery(
          "SELECT id, is_deleted FROM product_serialized_items WHERE serial_number_or_imei = ?",
          [imei]
        );
        if (existing.length > 0 && existing[0].is_deleted === 0) {
          duplicates.push(imei);
        } else {
          validImeis.push(imei);
        }
      }
      
      if (validImeis.length > 0) {
        const placeholders = validImeis.map(() => '(?, ?, ?, ?)').join(', ');
        const flatParams = [];
        validImeis.forEach(imei => flatParams.push(variantId, imei, 'available', null));
        await this.electronQuery(
          `INSERT OR IGNORE INTO product_serialized_items (product_variant_id, serial_number_or_imei, status, sale_id) 
           VALUES ${placeholders}`,
          flatParams
        );
        
        if (SYNC_ENABLED) {
          for (const imei of validImeis) {
            await syncToCloud('product_serialized_items', { 
              product_variant_id: variantId, 
              serial_number_or_imei: imei, 
              status: 'available' 
            });
          }
        }
      }
      
      return { success: true, added: validImeis.length, duplicates, total: uniqueImeis.length };
    }
    
    const duplicates = [];
    const validImeis = [];
    
    for (const imei of uniqueImeis) {
      const allItems = await idbGetAll('product_serialized_items');
      const existing = allItems.find(i => i.serial_number_or_imei === imei && !i.is_deleted);
      if (existing) {
        duplicates.push(imei);
      } else {
        validImeis.push(imei);
      }
    }
    
    for (const imei of validImeis) {
      await idbAdd('product_serialized_items', {
        product_variant_id: variantId,
        serial_number_or_imei: imei,
        status: 'available',
        sale_id: null
      });
    }
    
    return { success: true, added: validImeis.length, duplicates };
  };

  StorageClass.prototype.updateSerializedItem = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE product_serialized_items SET serial_number_or_imei = ?, status = ?, sale_id = ? WHERE id = ?", [data.serial_number_or_imei, data.status, data.sale_id, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('product_serialized_items', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('product_serialized_items', id);
    if (!e) return { changes: 0 };
    return idbPut('product_serialized_items', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteSerializedItem = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM product_serialized_items WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('product_serialized_items', id, 'remove');
      }
      return _res;
    }
    return idbDelete('product_serialized_items', id);
  };

  StorageClass.prototype.trackProductByIMEI = async function(imei) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT psi.*, p.name as product_name, pv.sku, pv.retail_price, s.invoice_no as sale_invoice, s.date as sold_on, c.name as sold_to FROM product_serialized_items psi LEFT JOIN product_variants pv ON psi.product_variant_id = pv.id LEFT JOIN products p ON pv.product_id = p.id LEFT JOIN sales s ON psi.sale_id = s.id LEFT JOIN customers c ON s.customer_id = c.id WHERE psi.serial_number_or_imei = ? OR psi.id = ?`, [imei, imei]);
    }
    const items = await idbGetAll('product_serialized_items');
    const item = items.find(i => i.serial_number_or_imei === imei || String(i.id) === imei);
    if (!item) return [];
    const [variants, products, sales, customers] = await Promise.all([
      idbGetAll('product_variants'),
      idbGetAll('products'),
      idbGetAll('sales'),
      idbGetAll('customers')
    ]);
    const v = variants.find(x => x.id === item.product_variant_id);
    const p = products.find(x => x.id === v?.product_id);
    const s = sales.find(x => x.id === item.sale_id);
    const c = customers.find(x => x.id === s?.customer_id);
    return [{
      ...item,
      product_name: p?.name || '',
      sku: v?.sku || '',
      retail_price: v?.retail_price || 0,
      sale_invoice: s?.invoice_no || '',
      sold_on: s?.date || '',
      sold_to: c?.name || ''
    }];
  };

}