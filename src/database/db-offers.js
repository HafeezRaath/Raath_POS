// ============================================================
//  db-offers.js — Offers & Offer Items Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbDelete } from './core/idb-core.js';

export function attachOfferMethods(StorageClass) {

  // ==================== OFFERS ====================
  StorageClass.prototype.getOffers = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM offers WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY created_at DESC");
    }
    return idbGetAll('offers').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getOfferById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM offers WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('offers', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.addOffer = async function(data) {
    const clean = {
      name: data.name || '',
      description: data.description || '',
      discount_type: data.discount_type || 'percentage',
      discount_value: Number(data.discount_value) || 0,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      status: data.status || 'active',
      original_total: Number(data.original_total) || 0,
      final_total: Number(data.final_total) || 0,
      items_count: Number(data.items_count) || 0
    };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO offers (name, description, discount_type, discount_value, start_date, end_date, status, original_total, final_total, items_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clean.name, clean.description, clean.discount_type, clean.discount_value, clean.start_date, clean.end_date, clean.status, clean.original_total, clean.final_total, clean.items_count]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('offers', { ...clean, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    const browserRes = await idbAdd('offers', { ...clean, is_deleted: 0, created_at: new Date().toISOString() });
    if (SYNC_ENABLED) {
      await syncToCloud('offers', { ...clean, id: browserRes.lastInsertRowid, is_deleted: 0 });
    }
    return browserRes;
  };

  StorageClass.prototype.updateOffer = async function(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.discount_type !== undefined) { fields.push('discount_type = ?'); values.push(data.discount_type); }
    if (data.discount_value !== undefined) { fields.push('discount_value = ?'); values.push(Number(data.discount_value) || 0); }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.original_total !== undefined) { fields.push('original_total = ?'); values.push(Number(data.original_total) || 0); }
    if (data.final_total !== undefined) { fields.push('final_total = ?'); values.push(Number(data.final_total) || 0); }
    if (data.items_count !== undefined) { fields.push('items_count = ?'); values.push(Number(data.items_count) || 0); }

    if (fields.length === 0) return { changes: 0 };

    values.push(id);

    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`, values);
      if (SYNC_ENABLED) {
        await syncToCloud('offers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('offers', id);
    if (!e) return { changes: 0 };
    return idbPut('offers', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteOffer = async function(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE offers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('offers', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('offers', id);
    if (!e) return { changes: 0 };
    return idbPut('offers', { ...e, is_deleted: 1, id: e.id });
  };

  // ==================== OFFER ITEMS ====================
  StorageClass.prototype.getOfferItems = async function(offerId) {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM offer_items WHERE offer_id = ?", [offerId]);
    }
    return idbGetAll('offer_items').then(r => r.filter(x => x.offer_id === Number(offerId)));
  };

  StorageClass.prototype.addOfferItem = async function(data) {
    const clean = {
      offer_id: data.offer_id,
      product_id: data.product_id || null,
      variant_id: data.variant_id || null,
      product_name: data.product_name || '',
      variant_name: data.variant_name || '',
      sku: data.sku || '',
      original_price: Number(data.original_price) || 0,
      offer_price: Number(data.offer_price) || 0,
      category_id: data.category_id || null
    };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO offer_items (offer_id, product_id, variant_id, product_name, variant_name, sku, original_price, offer_price, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clean.offer_id, clean.product_id, clean.variant_id, clean.product_name, clean.variant_name, clean.sku, clean.original_price, clean.offer_price, clean.category_id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('offer_items', { ...clean, id: _res.lastInsertRowid });
      }
      return _res;
    }
    const browserRes = await idbAdd('offer_items', clean);
    if (SYNC_ENABLED) {
      await syncToCloud('offer_items', { ...clean, id: browserRes.lastInsertRowid });
    }
    return browserRes;
  };

  StorageClass.prototype.deleteOfferItems = async function(offerId) {
    if (this.mode === 'electron') {
      return this.electronQuery("DELETE FROM offer_items WHERE offer_id = ?", [offerId]);
    }
    const all = await idbGetAll('offer_items');
    for (const item of all.filter(x => x.offer_id === Number(offerId))) {
      await idbDelete('offer_items', item.id);
    }
    return { changes: 1 };
  };

}