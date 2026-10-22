// ============================================================
//  imeiController.js — Mobile Shop: Bulk IMEI scan, lifecycle, lookup
//  Serialized devices: one DB row per physical phone. Rows are
//  NEVER deleted — resale/exchange appends history and flips status.
// ============================================================
const { query, transaction } = require('../config/db');

// FIX E-1: dates computed in JS and bound as plain params — the SQLite
// adapter (LOCAL_MODE) mangles CURDATE()/NOW() inside INSERT ... VALUES
// for syncable tables such as device_imei.
const pktToday = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

const VALID_STATUSES = ['IN_STOCK', 'SOLD', 'RETURNED'];

// --- Bulk IMEI stock-in: common specs once + N scanned IMEIs -> N rows ---
exports.bulkAddImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      product_id = null, product_variant_id = null,
      category_id = null, brand_id = null,
      brand = '', model = '', ram = '', rom = '', color = '',
      condition_type = 'new',
      purchase_price = 0, sale_price = 0,
      supplier_id = null, purchase_id = null,
      warranty_months = 0, notes = '',
      product_name = '', // when creating a product on the fly
      imeis = [], // [{ imei1, imei2 }]
    } = req.body;

    if (!Array.isArray(imeis) || imeis.length === 0) {
      return res.status(400).json({ success: false, error: 'imeis array is required (at least 1 IMEI)' });
    }

    const clean = [];
    const seen = new Set();
    for (const it of imeis) {
      const imei1 = String(it.imei1 || '').replace(/\D/g, '');
      if (!imei1) continue;
      if (seen.has(imei1)) {
        return res.status(400).json({ success: false, error: `Duplicate IMEI in this batch: ${imei1}` });
      }
      seen.add(imei1);
      clean.push({ imei1, imei2: String(it.imei2 || '').replace(/\D/g, '') || null });
    }
    if (clean.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid IMEI numbers provided' });
    }

    // Guard: IMEI must not already exist for this tenant (even SOLD — history preserved)
    const existing = await query(
      `SELECT imei1 FROM device_imei WHERE tenant_id = ? AND imei1 IN (${clean.map(() => '?').join(',')}) AND is_deleted = 0`,
      [tenantId, ...clean.map(c => c.imei1)]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `IMEI already in system: ${existing.map(e => e.imei1).join(', ')} — use Buyback/Resale flow instead`,
        duplicates: existing.map(e => e.imei1),
      });
    }

    let pid = product_id, pvid = product_variant_id;

    await transaction(async (conn) => {
      // Create the product on the fly if not supplied
      if (!pid) {
        let bId = brand_id;
        if (!bId && brand) {
          const [bRows] = await conn.query('SELECT id FROM brands WHERE tenant_id = ? AND name = ? AND is_deleted = 0 LIMIT 1', [tenantId, brand]);
          if (bRows && bRows.length > 0) bId = bRows[0].id;
        }
        const name = product_name || `${brand} ${model}`.trim() || 'Mobile Phone';
        const [pr] = await conn.query(
          `INSERT INTO products (tenant_id, name, type, category_id, brand_id, is_serialized, purchase_price, retail_price, sale_price, stock, status)
           VALUES (?, ?, 'mobile', ?, ?, 1, ?, ?, ?, 0, 'active')`,
          [tenantId, name, category_id || null, bId || null, purchase_price, sale_price, sale_price]
        );
        pid = pr.insertId;
        const [vr] = await conn.query(
          `INSERT INTO product_variants (tenant_id, product_id, variant_name, sku, purchase_price, retail_price, sale_price, current_stock, stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
          [tenantId, pid, `${ram}/${rom} ${color}`.trim(), `${brand}-${model}-${Date.now()}`.slice(0, 60), purchase_price, sale_price, sale_price]
        );
        pvid = vr.insertId;
      }

      for (const c of clean) {
        const [ir] = await conn.query(
          `INSERT INTO device_imei
             (tenant_id, product_id, product_variant_id, imei1, imei2, brand, model, ram, rom, color,
              condition_type, purchase_price, sale_price, status, supplier_id, purchase_id, warranty_months, warranty_start, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, ?)`,
          [tenantId, pid, pvid, c.imei1, c.imei2, brand, model, ram, rom, color,
           condition_type, purchase_price, sale_price, supplier_id, purchase_id, warranty_months, pktToday(), notes]
        );
        await conn.query(
          `INSERT INTO device_imei_history
             (tenant_id, device_imei_id, action, from_status, to_status, ref_type, ref_id, amount, user_id, notes)
           VALUES (?, ?, 'STOCK_IN', NULL, 'IN_STOCK', ?, ?, ?, ?, ?)`,
          [tenantId, ir.insertId, purchase_id ? 'purchase' : 'manual', purchase_id, purchase_price, req.user?.id || null, notes]
        );
      }

      // Aggregate counter on variant for quick display (serialized truth stays in device_imei)
      if (pvid) {
        await conn.query(
          `UPDATE product_variants SET current_stock = (SELECT COUNT(*) FROM device_imei WHERE tenant_id = ? AND product_variant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0) WHERE id = ?`,
          [tenantId, pvid, pvid]
        );
      }
    });

    res.status(201).json({ success: true, message: `${clean.length} IMEI units added to stock`, count: clean.length, product_id: pid, product_variant_id: pvid });
  } catch (error) {
    next(error);
  }
};

// --- List with filters ---
exports.listImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status = '', search = '', condition_type = '', limit = 200 } = req.query;
    let sql = `SELECT * FROM device_imei WHERE tenant_id = ? AND is_deleted = 0`;
    const params = [tenantId];
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (condition_type) { sql += ` AND condition_type = ?`; params.push(condition_type); }
    if (search) {
      sql += ` AND (imei1 LIKE ? OR imei2 LIKE ? OR model LIKE ? OR brand LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ` ORDER BY id DESC LIMIT ${Math.min(Number(limit) || 200, 1000)}`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- IMEI lookup: full history timeline ---
exports.lookupImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const imei = String(req.params.imei || '').replace(/\D/g, '');
    const rows = await query(
      `SELECT * FROM device_imei WHERE tenant_id = ? AND (imei1 = ? OR imei2 = ?) AND is_deleted = 0 LIMIT 1`,
      [tenantId, imei, imei]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'IMEI not found in system', debug_tenant: tenantId });
    }
    const device = rows[0];
    const history = await query(
      `SELECT * FROM device_imei_history WHERE tenant_id = ? AND device_imei_id = ? ORDER BY id ASC`,
      [tenantId, device.id]
    );
    const repairs = await query(
      `SELECT id, order_number, problem_description, status, total_amount, created_at
       FROM work_orders WHERE tenant_id = ? AND imei = ? AND is_deleted = 0 ORDER BY id DESC`,
      [tenantId, imei]
    );
    let warranty = null;
    if (device.warranty_months > 0 && device.warranty_start) {
      const start = new Date(device.warranty_start);
      const end = new Date(start);
      end.setMonth(end.getMonth() + Number(device.warranty_months));
      warranty = {
        months: device.warranty_months,
        start: device.warranty_start,
        end: end.toISOString().slice(0, 10),
        active: end >= new Date(),
      };
    }
    res.json({ success: true, data: { device, history, repairs, warranty } });
  } catch (error) {
    next(error);
  }
};

// --- Sell: IN_STOCK -> SOLD (links invoice + customer) ---
exports.sellImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { sale_id = null, customer_id = null, customer_name = '', amount = 0 } = req.body;
    const rows = await query(`SELECT * FROM device_imei WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'IMEI not found' });
    const d = rows[0];
    if (d.status !== 'IN_STOCK') {
      return res.status(409).json({ success: false, error: `Cannot sell — current status is ${d.status}` });
    }
    await transaction(async (conn) => {
      await conn.query(
        `UPDATE device_imei SET status = 'SOLD', sale_id = ?, customer_id = ?, customer_name = ? WHERE id = ?`,
        [sale_id, customer_id, customer_name, id]
      );
      await conn.query(
        `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, ref_type, ref_id, customer_id, customer_name, amount, user_id)
         VALUES (?, ?, 'SOLD', 'IN_STOCK', 'SOLD', 'sale', ?, ?, ?, ?, ?)`,
        [tenantId, id, sale_id, customer_id, customer_name, amount, req.user?.id || null]
      );
      if (d.product_variant_id) {
        await conn.query(
          `UPDATE product_variants SET current_stock = (SELECT COUNT(*) FROM device_imei WHERE tenant_id = ? AND product_variant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0) WHERE id = ?`,
          [tenantId, d.product_variant_id, d.product_variant_id]
        );
      }
    });
    res.json({ success: true, message: `IMEI ${d.imei1} marked SOLD` });
  } catch (error) {
    next(error);
  }
};

// --- Buyback / Resale / Exchange: any non-stock status -> IN_STOCK (row never deleted) ---
exports.buybackImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { purchase_price = 0, sale_price = 0, notes = '', action = 'BUYBACK', seller_name = '' } = req.body;
    const rows = await query(`SELECT * FROM device_imei WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'IMEI not found' });
    const d = rows[0];
    if (d.status === 'IN_STOCK') {
      return res.status(409).json({ success: false, error: 'Already IN_STOCK — no buyback needed' });
    }
    await transaction(async (conn) => {
      await conn.query(
        `UPDATE device_imei SET status = 'IN_STOCK', purchase_price = ?, sale_price = ?, sale_id = NULL, customer_id = NULL, customer_name = NULL WHERE id = ?`,
        [purchase_price || d.purchase_price, sale_price || d.sale_price, id]
      );
      const bbNotes = [seller_name ? `Seller: ${seller_name}` : '', notes].filter(Boolean).join(' | ') || null;
      await conn.query(
        `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, ref_type, amount, customer_name, user_id, notes)
         VALUES (?, ?, ?, ?, 'IN_STOCK', 'buyback', ?, ?, ?, ?)`,
        [tenantId, id, action, d.status, purchase_price, seller_name || null, req.user?.id || null, bbNotes]
      );
      if (d.product_variant_id) {
        await conn.query(
          `UPDATE product_variants SET current_stock = (SELECT COUNT(*) FROM device_imei WHERE tenant_id = ? AND product_variant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0) WHERE id = ?`,
          [tenantId, d.product_variant_id, d.product_variant_id]
        );
      }
    });
    res.json({ success: true, message: `IMEI ${d.imei1} restored to IN_STOCK (${action})` });
  } catch (error) {
    next(error);
  }
};

// --- Mark returned (customer return, kept in shop) ---
exports.returnImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { notes = '' } = req.body;
    const rows = await query(`SELECT * FROM device_imei WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'IMEI not found' });
    const d = rows[0];
    await transaction(async (conn) => {
      await conn.query(`UPDATE device_imei SET status = 'RETURNED' WHERE id = ?`, [id]);
      await conn.query(
        `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, user_id, notes)
         VALUES (?, ?, 'RETURNED', ?, 'RETURNED', ?, ?)`,
        [tenantId, id, d.status, req.user?.id || null, notes]
      );
    });
    res.json({ success: true, message: `IMEI ${d.imei1} marked RETURNED` });
  } catch (error) {
    next(error);
  }
};

// --- Update specs/pricing ---
exports.updateImei = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const allowed = ['imei2', 'brand', 'model', 'ram', 'rom', 'color', 'condition_type', 'purchase_price', 'sale_price', 'warranty_months', 'notes'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { sets.push(`${k} = ?`); params.push(req.body[k]); }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });
    params.push(tenantId, id);
    await query(`UPDATE device_imei SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`, params);
    res.json({ success: true, message: 'IMEI updated' });
  } catch (error) {
    next(error);
  }
};

// --- In-stock picker for POS (model search -> available units) ---
exports.inStockPicker = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { search = '' } = req.query;
    let sql = `SELECT id, imei1, imei2, brand, model, ram, rom, color, condition_type, sale_price, product_id, product_variant_id
               FROM device_imei WHERE tenant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0`;
    const params = [tenantId];
    if (search) {
      sql += ` AND (model LIKE ? OR brand LIKE ? OR imei1 LIKE ? OR imei2 LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ` ORDER BY id DESC LIMIT 100`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows, debug_tenant: tenantId });
  } catch (error) {
    next(error);
  }
};
