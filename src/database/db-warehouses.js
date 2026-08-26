// ============================================================
//  db-warehouses.js — Warehouses & Stock Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachWarehouseMethods(StorageClass) {

  StorageClass.prototype.getWarehouses = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM warehouses WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('warehouses').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getWarehouseById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM warehouses WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('warehouses', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createWarehouse = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO warehouses (name, location, manager_name, phone) VALUES (?, ?, ?, ?)", [data.name, data.location, data.manager_name, data.phone]);
      if (SYNC_ENABLED) {
        await syncToCloud('warehouses', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('warehouses', { ...data, is_deleted: 0 });
  };

  StorageClass.prototype.updateWarehouse = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE warehouses SET name = ?, location = ?, manager_name = ?, phone = ? WHERE id = ?", [data.name, data.location, data.manager_name, data.phone, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('warehouses', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('warehouses', id);
    if (!e) return { changes: 0 };
    return idbPut('warehouses', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteWarehouse = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE warehouses SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('warehouses', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('warehouses', id);
    if (!e) return { changes: 0 };
    return idbPut('warehouses', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.getWarehouseStocks = async function(warehouseId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT ws.*, w.name as warehouse_name, pv.sku, p.name as product_name FROM warehouse_stocks ws JOIN warehouses w ON ws.warehouse_id = w.id JOIN product_variants pv ON ws.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id`;
      if (warehouseId) sql += ` WHERE ws.warehouse_id = ?`;
      return this.electronQuery(sql, warehouseId ? [warehouseId] : []);
    }
    const [stocks, warehouses, variants, products] = await Promise.all([
      idbGetAll('warehouse_stocks'),
      idbGetAll('warehouses'),
      idbGetAll('product_variants'),
      idbGetAll('products')
    ]);
    let result = stocks.map(s => {
      const w = warehouses.find(x => x.id === s.warehouse_id);
      const v = variants.find(x => x.id === s.product_variant_id);
      const p = products.find(x => x.id === v?.product_id);
      return {
        ...s,
        warehouse_name: w?.name || '',
        sku: v?.sku || '',
        product_name: p?.name || ''
      };
    });
    if (warehouseId) {
      result = result.filter(s => String(s.warehouse_id) === String(warehouseId));
    }
    return result;
  };

  StorageClass.prototype.updateWarehouseStock = async function(data) {
    if (this.mode === 'electron') {
      const existing = await this.electronQuery(
        "SELECT id FROM warehouse_stocks WHERE warehouse_id = ? AND product_variant_id = ?",
        [data.warehouse_id, data.product_variant_id]
      );
      if (existing.length > 0) {
        const _res = await this.electronQuery(
          "UPDATE warehouse_stocks SET quantity = quantity + ? WHERE id = ?",
          [data.quantity, existing[0].id]
        );
        if (SYNC_ENABLED) {
          await syncToCloud('warehouse_stocks', { id: existing[0].id, quantity_delta: data.quantity });
        }
        return _res;
      }
      const _res = await this.electronQuery(
        "INSERT INTO warehouse_stocks (warehouse_id, product_variant_id, quantity) VALUES (?, ?, ?)",
        [data.warehouse_id, data.product_variant_id, data.quantity]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('warehouse_stocks', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    
    const allStocks = await idbGetAll('warehouse_stocks');
    const existing = allStocks.find(s => 
      String(s.warehouse_id) === String(data.warehouse_id) && 
      String(s.product_variant_id) === String(data.product_variant_id) &&
      !s.is_deleted
    );
    
    if (existing) {
      const updatedQty = this.safeAdd(existing.quantity, data.quantity);
      await idbPut('warehouse_stocks', { ...existing, quantity: updatedQty });
      if (SYNC_ENABLED) {
        await syncToCloud('warehouse_stocks', { id: existing.id, quantity_delta: data.quantity });
      }
      return { lastInsertRowid: existing.id, changes: 1 };
    }
    
    const result = await idbAdd('warehouse_stocks', { 
      warehouse_id: data.warehouse_id, 
      product_variant_id: data.product_variant_id, 
      quantity: data.quantity,
      is_deleted: 0 
    });
    if (SYNC_ENABLED) {
      await syncToCloud('warehouse_stocks', { ...data, id: result.lastInsertRowid });
    }
    return result;
  };

}