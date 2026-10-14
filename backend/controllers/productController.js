// ============================================================
//  server/controllers/productController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

exports.getProducts = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const sql = `
      SELECT 
        p.*, 
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(p.stock, 0) AS current_stock,
        COALESCE(p.retail_price, p.sale_price, 0) AS retail_price,
        COALESCE(p.sale_price, p.retail_price, 0) AS sale_price,
        b.name AS brand_name, 
        c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = ? AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.id DESC
    `;
    const products = await query(sql, [tenantId]);
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const sql = `
      SELECT p.*, b.name AS brand_name, c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = ? AND p.id = ? AND p.is_deleted = 0
    `;
    const rows = await query(sql, [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      name, brand_id, category_id, type = 'single', unit = 'pc',
      sku, barcode, purchase_price = 0, sale_price = 0, retail_price = 0,
      wholesale_price = 0, min_price = 0, stock = 0, min_stock = 5,
      tax_type = 'inclusive', tax_rate = 0, is_serialized = 0,
      description = '', image_url = '', status = 'active', variants = [],
      article_no = null, season = null, rack_location = null
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }

    let defaultVariantId = null;

    const result = await transaction(async (conn) => {
      const insertSql = `
        INSERT INTO products (
          tenant_id, name, brand_id, category_id, type, unit, sku, barcode,
          purchase_price, sale_price, retail_price, wholesale_price, min_price,
          stock, min_stock, tax_type, tax_rate, is_serialized, description,
          image_url, status, article_no, season, rack_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [insRes] = await conn.query(insertSql, [
        tenantId, name.trim(), brand_id || null, category_id || null, type, unit,
        sku || null, barcode || null, purchase_price, sale_price, retail_price,
        wholesale_price, min_price, stock, min_stock, tax_type, tax_rate,
        is_serialized ? 1 : 0, description, image_url, status,
        article_no || null, season || null, rack_location || null
      ]);

      const productId = insRes.insertId;
      if (!productId) {
        throw new Error('Product insert did not return an id (products.id may lack AUTO_INCREMENT).');
      }

      // Handle variants or create default variant
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          const vName = v.variant_name || v.name || 'Default';
          const vBuy = v.purchase_price !== undefined ? v.purchase_price : purchase_price;
          const vSale = v.sale_price !== undefined ? v.sale_price : (v.retail_price !== undefined ? v.retail_price : (sale_price || retail_price));
          const vStock = v.stock !== undefined ? v.stock : (v.current_stock !== undefined ? v.current_stock : stock);
          const vDesc = v.attributes ? JSON.stringify(v.attributes)
            : (v.description ? (typeof v.description === 'string' ? v.description : JSON.stringify(v.description)) : null);
          const [vRes] = await conn.query(
            `INSERT INTO product_variants (tenant_id, product_id, variant_name, name, sku, barcode, purchase_price, retail_price, sale_price, current_stock, stock, article_no, color, size, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              productId,
              vName,
              vName,
              v.sku || sku || null,
              v.barcode || barcode || null,
              vBuy,
              vSale,
              vSale,
              vStock,
              vStock,
              v.article_no || article_no || null,
              v.color || null,
              v.size || null,
              vDesc
            ]
          );
          if (!defaultVariantId) defaultVariantId = vRes.insertId;
        }
      } else {
        const vSale = sale_price || retail_price || 0;
        const [vRes] = await conn.query(
          `INSERT INTO product_variants (tenant_id, product_id, variant_name, name, sku, barcode, purchase_price, retail_price, sale_price, current_stock, stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, productId, 'Default', 'Default', sku || null, barcode || null, purchase_price || 0, vSale, vSale, stock || 0, stock || 0]
        );
        defaultVariantId = vRes.insertId;
      }

      return productId;
    });

    const created = await query('SELECT * FROM products WHERE tenant_id = ? AND id = ?', [tenantId, result]);
    const prodObj = created[0] || {};
    res.status(201).json({
      success: true,
      data: {
        ...prodObj,
        id: result,
        product_id: result,
        product_name: prodObj.name,
        current_stock: prodObj.stock,
        lastInsertRowid: result,
        variant_id: defaultVariantId
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      name, brand_id, category_id, type, unit, sku, barcode,
      purchase_price, sale_price, retail_price, wholesale_price,
      min_price, stock, min_stock, tax_type, tax_rate, is_serialized,
      description, image_url, status, article_no, season, rack_location
    } = req.body;

    const sql = `
      UPDATE products SET
        name = COALESCE(?, name),
        brand_id = COALESCE(?, brand_id),
        category_id = COALESCE(?, category_id),
        type = COALESCE(?, type),
        unit = COALESCE(?, unit),
        sku = COALESCE(?, sku),
        barcode = COALESCE(?, barcode),
        purchase_price = COALESCE(?, purchase_price),
        sale_price = COALESCE(?, sale_price),
        retail_price = COALESCE(?, retail_price),
        wholesale_price = COALESCE(?, wholesale_price),
        min_price = COALESCE(?, min_price),
        stock = COALESCE(?, stock),
        min_stock = COALESCE(?, min_stock),
        tax_type = COALESCE(?, tax_type),
        tax_rate = COALESCE(?, tax_rate),
        is_serialized = COALESCE(?, is_serialized),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        status = COALESCE(?, status),
        article_no = COALESCE(?, article_no),
        season = COALESCE(?, season),
        rack_location = COALESCE(?, rack_location)
      WHERE tenant_id = ? AND id = ? AND is_deleted = 0
    `;

    await query(sql, [
      name, brand_id, category_id, type, unit, sku, barcode,
      purchase_price, sale_price, retail_price, wholesale_price,
      min_price, stock, min_stock, tax_type, tax_rate, is_serialized,
      description, image_url, status, article_no, season, rack_location,
      tenantId, id
    ]);

    const updated = await query('SELECT * FROM products WHERE tenant_id = ? AND id = ?', [tenantId, id]);

    // Audit log
    const uName = req.user?.username || req.user?.name || 'Admin';
    const uRole = req.user?.role || 'admin';
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, user_name, user_role, action, table_name, record_id, details)
       VALUES (?, ?, ?, ?, 'PRODUCT_EDITED', 'products', ?, ?)`,
      [tenantId, req.user?.id || null, uName, uRole, id, `Product #${id} (${name || updated[0]?.name || ''}) was modified by ${uName}`]
    ).catch(() => {});

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE products SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);

    // Audit log
    const uName = req.user?.username || req.user?.name || 'Admin';
    const uRole = req.user?.role || 'admin';
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, user_name, user_role, action, table_name, record_id, details)
       VALUES (?, ?, ?, ?, 'PRODUCT_DELETED', 'products', ?, ?)`,
      [tenantId, req.user?.id || null, uName, uRole, id, `Product #${id} was deleted by ${uName} (${uRole})`]
    ).catch(() => {});

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getLowStock = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const sql = `
      SELECT p.*, b.name AS brand_name, c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = ? AND p.is_deleted = 0 AND p.stock <= p.min_stock
      ORDER BY p.stock ASC
    `;
    const rows = await query(sql, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getAllVariants = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const sql = `
      SELECT 
        COALESCE(pv.id, p.id) AS id,
        p.id AS product_id,
        COALESCE(pv.variant_name, pv.name, 'Default') AS variant_name,
        COALESCE(pv.name, pv.variant_name, 'Default') AS name,
        p.name AS product_name,
        COALESCE(pv.sku, p.sku) AS sku,
        COALESCE(pv.barcode, p.barcode) AS barcode,
        COALESCE(pv.purchase_price, p.purchase_price, 0) AS purchase_price,
        COALESCE(pv.retail_price, pv.sale_price, p.sale_price, p.retail_price, 0) AS sale_price,
        COALESCE(pv.retail_price, pv.sale_price, p.retail_price, p.sale_price, 0) AS retail_price,
        COALESCE(pv.wholesale_price, p.wholesale_price, 0) AS wholesale_price,
        COALESCE(pv.minimum_retail_price, p.min_price, 0) AS min_price,
        COALESCE(pv.current_stock, pv.stock, p.stock, 0) AS stock,
        COALESCE(pv.current_stock, pv.stock, p.stock, 0) AS current_stock,
        COALESCE(pv.stock_alert_quantity, p.min_stock, 5) AS stock_alert_quantity,
        p.unit,
        p.type AS product_type,
        p.type,
        p.category_id,
        p.brand_id,
        b.name AS brand_name,
        c.name AS category_name,
        COALESCE(pv.image_url, p.image_url) AS image_url,
        p.description,
        pv.description AS variant_description,
        p.status,
        p.tax_type,
        p.tax_rate,
        p.is_serialized,
        COALESCE(pv.article_no, p.article_no) AS article_no,
        pv.color AS variant_color,
        pv.size AS variant_size,
        p.season,
        p.rack_location
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND COALESCE(pv.is_deleted, 0) = 0
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = ? AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.id DESC, pv.id ASC
    `;
    const rows = await query(sql, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createVariant = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      product_id, name = 'Default', variant_name, sku, barcode,
      purchase_price = 0, retail_price = 0, sale_price = 0,
      wholesale_price = 0, stock = 0, current_stock = 0
    } = req.body;

    const actualName = variant_name || name || 'Default';
    const actualCost = Number(purchase_price) || 0;
    const actualPrice = Number(sale_price || retail_price) || 0;
    const actualStock = Number(current_stock !== undefined ? current_stock : stock) || 0;

    let variantId = null;

    if (actualName === 'Default' && product_id) {
      const existing = await query(
        `SELECT id FROM product_variants WHERE tenant_id = ? AND product_id = ? AND name = 'Default' AND COALESCE(is_deleted, 0) = 0 ORDER BY id ASC`,
        [tenantId, product_id]
      );
      if (existing.length > 0) {
        variantId = existing[0].id;
        await query(
          `UPDATE product_variants SET
             variant_name = ?,
             name = ?,
             sku = COALESCE(?, sku),
             barcode = COALESCE(?, barcode),
             purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
             retail_price = CASE WHEN ? > 0 THEN ? ELSE retail_price END,
             sale_price = CASE WHEN ? > 0 THEN ? ELSE sale_price END,
             current_stock = CASE WHEN ? > 0 THEN ? ELSE current_stock END,
             stock = CASE WHEN ? > 0 THEN ? ELSE stock END
           WHERE tenant_id = ? AND id = ?`,
          [actualName, actualName, sku || null, barcode || null, actualCost, actualCost, actualPrice, actualPrice, actualPrice, actualPrice, actualStock, actualStock, actualStock, actualStock, tenantId, variantId]
        );
      }
    }

    if (!variantId) {
      const sql = `
        INSERT INTO product_variants (tenant_id, product_id, variant_name, name, sku, barcode, purchase_price, retail_price, sale_price, current_stock, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await query(sql, [
        tenantId, product_id, actualName, actualName, sku || null, barcode || null,
        actualCost, actualPrice, actualPrice, actualStock, actualStock
      ]);
      variantId = result.insertId;
    }

    if (product_id) {
      await query(
        `UPDATE products SET
          purchase_price = CASE WHEN purchase_price = 0 THEN ? ELSE purchase_price END,
          sale_price = CASE WHEN sale_price = 0 THEN ? ELSE sale_price END,
          retail_price = CASE WHEN retail_price = 0 THEN ? ELSE retail_price END,
          wholesale_price = CASE WHEN wholesale_price = 0 THEN ? ELSE wholesale_price END,
          stock = CASE WHEN stock = 0 THEN ? ELSE stock END,
          sku = COALESCE(sku, ?),
          barcode = COALESCE(barcode, ?)
         WHERE tenant_id = ? AND id = ?`,
        [actualCost, actualPrice, actualPrice, Number(wholesale_price) || 0, actualStock, sku || null, barcode || null, tenantId, product_id]
      );
    }

    const created = await query('SELECT * FROM product_variants WHERE tenant_id = ? AND id = ?', [tenantId, variantId]);
    res.status(201).json({
      success: true,
      data: {
        ...created[0],
        id: variantId,
        lastInsertRowid: variantId
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateVariant = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      name, variant_name, sku, barcode, purchase_price,
      sale_price, retail_price, stock, current_stock
    } = req.body;

    const actualName = variant_name || name;
    const actualPrice = sale_price !== undefined ? sale_price : retail_price;
    const actualStock = current_stock !== undefined ? current_stock : stock;

    const sql = `
      UPDATE product_variants SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        barcode = COALESCE(?, barcode),
        purchase_price = COALESCE(?, purchase_price),
        sale_price = COALESCE(?, sale_price),
        stock = COALESCE(?, stock)
      WHERE tenant_id = ? AND id = ? AND is_deleted = 0
    `;
    await query(sql, [actualName, sku, barcode, purchase_price, actualPrice, actualStock, tenantId, id]);
    const updated = await query('SELECT * FROM product_variants WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteVariant = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE product_variants SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Variant deleted successfully' });
  } catch (error) {
    next(error);
  }
};
