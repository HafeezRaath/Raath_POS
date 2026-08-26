const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, validatePositiveNumber } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerProductHandlers() {
  ipcMain.handle('db:getProducts', createHandler(async () => {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_deleted = 0
      ORDER BY p.name
    `).all() || [];
  }));

  ipcMain.handle('db:getProductById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).get(id);
  }));

  ipcMain.handle('db:getProductVariants', createHandler(async (event, productId) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM product_variants
      WHERE product_id = ? AND is_deleted = 0
      ORDER BY variant_name
    `).all(productId) || [];
  }));

  ipcMain.handle('db:addProduct', createHandler(async (event, productData) => {
    const db = getDb();
    const sanitized = sanitizeObject(productData, ['name', 'brand_id', 'category_id', 'type', 'unit', 'tax_type', 'is_serialized', 'description', 'status', 'image_url']);

    const result = db.prepare(`
      INSERT INTO products (name, brand_id, category_id, type, unit, tax_type, is_serialized, description, status, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.brand_id || null,
      sanitized.category_id || null,
      sanitized.type || 'single',
      sanitized.unit || 'pc',
      sanitized.tax_type || 'inclusive',
      sanitized.is_serialized ? 1 : 0,
      sanitized.description || '',
      sanitized.status || 'active',
      sanitized.image_url || ''
    );

    logAudit(productData.created_by || 1, 'create', 'products', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateProduct', createHandler(async (event, id, productData) => {
    const db = getDb();
    const sanitized = sanitizeObject(productData, ['name', 'brand_id', 'category_id', 'type', 'unit', 'tax_type', 'is_serialized', 'description', 'status', 'image_url']);

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'brand_id', 'category_id', 'type', 'unit', 'tax_type', 'is_serialized', 'description', 'status', 'image_url'];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'is_serialized' ? (sanitized[key] ? 1 : 0) : sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(productData.updated_by || 1, 'update', 'products', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteProduct', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare(`
      UPDATE products SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    logAudit(event.sender?.userId || 1, 'delete', 'products', id);
    return { changes: result.changes };
  }));

  // Variants
  ipcMain.handle('db:addVariant', createHandler(async (event, variantData) => {
    const db = getDb();
    const sanitized = sanitizeObject(variantData, ['product_id', 'sku', 'barcode', 'variant_name', 'purchase_price', 'retail_price', 'wholesale_price', 'minimum_retail_price', 'stock_alert_quantity', 'current_stock', 'image_url']);

    const result = db.prepare(`
      INSERT INTO product_variants (
        product_id, sku, barcode, variant_name, purchase_price, retail_price,
        wholesale_price, minimum_retail_price, stock_alert_quantity, current_stock, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.product_id,
      sanitized.sku,
      sanitized.barcode || '',
      sanitized.variant_name || 'Default',
      validatePositiveNumber(sanitized.purchase_price, 0),
      validatePositiveNumber(sanitized.retail_price, 0),
      validatePositiveNumber(sanitized.wholesale_price, 0),
      validatePositiveNumber(sanitized.minimum_retail_price, 0),
      validatePositiveNumber(sanitized.stock_alert_quantity, 5),
      validatePositiveNumber(sanitized.current_stock, 0),
      sanitized.image_url || ''
    );

    logAudit(variantData.created_by || 1, 'create', 'product_variants', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateVariant', createHandler(async (event, id, variantData) => {
    const db = getDb();
    const sanitized = sanitizeObject(variantData, ['sku', 'barcode', 'variant_name', 'purchase_price', 'retail_price', 'wholesale_price', 'minimum_retail_price', 'stock_alert_quantity', 'current_stock', 'image_url']);

    const fields = [];
    const values = [];
    const allowedFields = ['sku', 'barcode', 'variant_name', 'purchase_price', 'retail_price',
      'wholesale_price', 'minimum_retail_price', 'stock_alert_quantity', 'current_stock', 'image_url'];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key.includes('price') || key.includes('quantity') || key.includes('stock')) {
          values.push(validatePositiveNumber(sanitized[key], 0));
        } else {
          values.push(sanitized[key]);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE product_variants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(variantData.updated_by || 1, 'update', 'product_variants', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteVariant', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare(`
      UPDATE product_variants SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    logAudit(event.sender?.userId || 1, 'delete', 'product_variants', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:updateVariantImage', createHandler(async (event, id, imageUrl) => {
    const db = getDb();
    const result = db.prepare(
      "UPDATE product_variants SET image_url = ? WHERE id = ?"
    ).run(sanitizeObject({ imageUrl }).imageUrl, id);
    return { changes: result.changes };
  }));

  // Categories
  ipcMain.handle('db:getCategories', createHandler(async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM categories WHERE is_deleted = 0 ORDER BY name`).all() || [];
  }));

  ipcMain.handle('db:addCategory', createHandler(async (event, categoryData) => {
    const db = getDb();
    const sanitized = sanitizeObject(categoryData, ['name', 'slug', 'parent_id', 'status']);

    const result = db.prepare(`
      INSERT INTO categories (name, slug, parent_id, status) VALUES (?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.slug || sanitized.name.toLowerCase().replace(/\s+/g, '-'),
      sanitized.parent_id || null,
      sanitized.status || 'active'
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateCategory', createHandler(async (event, id, categoryData) => {
    const db = getDb();
    const sanitized = sanitizeObject(categoryData, ['name', 'slug', 'parent_id', 'status']);

    const result = db.prepare(`
      UPDATE categories SET name = ?, slug = ?, parent_id = ?, status = ? WHERE id = ?
    `).run(
      sanitized.name,
      sanitized.slug || sanitized.name.toLowerCase().replace(/\s+/g, '-'),
      sanitized.parent_id || null,
      sanitized.status || 'active',
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteCategory', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare(`
      UPDATE categories SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    return { changes: result.changes };
  }));

  // Brands
  ipcMain.handle('db:getBrands', createHandler(async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM brands WHERE is_deleted = 0 ORDER BY name`).all() || [];
  }));

  ipcMain.handle('db:addBrand', createHandler(async (event, brandData) => {
    const db = getDb();
    const sanitized = sanitizeObject(brandData, ['name', 'status']);

    const result = db.prepare(`INSERT INTO brands (name, status) VALUES (?, ?)`).run(
      sanitized.name,
      sanitized.status || 'active'
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateBrand', createHandler(async (event, id, brandData) => {
    const db = getDb();
    const sanitized = sanitizeObject(brandData, ['name', 'status']);

    const result = db.prepare(`UPDATE brands SET name = ?, status = ? WHERE id = ?`).run(
      sanitized.name,
      sanitized.status || 'active',
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteBrand', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare(`
      UPDATE brands SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    return { changes: result.changes };
  }));

  // Products with Categories
  ipcMain.handle('db:getProductsWithCategories', createHandler(async () => {
    const db = getDb();
    const categories = db.prepare(`
      SELECT DISTINCT c.id as category_id, c.name as category_name
      FROM categories c
      WHERE c.is_deleted = 0
      ORDER BY c.name
    `).all();

    const result = [];

    const uncategorizedProducts = db.prepare(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.brand_id, p.type, p.unit, p.tax_type, p.is_serialized,
        p.description, p.status, p.image_url,
        (
          SELECT json_group_array(
            json_object(
              'variant_id', pv.id, 'variant_name', pv.variant_name, 'sku', pv.sku,
              'barcode', pv.barcode, 'retail_price', pv.retail_price,
              'wholesale_price', pv.wholesale_price, 'current_stock', pv.current_stock,
              'purchase_price', pv.purchase_price, 'image_url', pv.image_url
            )
          )
          FROM product_variants pv
          WHERE pv.product_id = p.id AND pv.is_deleted = 0
        ) as variants_json
      FROM products p
      WHERE p.category_id IS NULL AND p.is_deleted = 0
      ORDER BY p.name
    `).all();

    if (uncategorizedProducts.length > 0) {
      const safeJsonParse = require('../utils/validators').safeJsonParse;
      const parsedProducts = uncategorizedProducts.map(p => ({
        ...p,
        variants: safeJsonParse(p.variants_json, []).filter(v => v.variant_id !== null)
      }));
      result.push({
        category_id: null,
        category_name: 'Uncategorized',
        products: parsedProducts
      });
    }

    for (const category of categories) {
      const products = db.prepare(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.brand_id, p.type, p.unit, p.tax_type, p.is_serialized,
          p.description, p.status, p.image_url,
          (
            SELECT json_group_array(
              json_object(
                'variant_id', pv.id, 'variant_name', pv.variant_name, 'sku', pv.sku,
                'barcode', pv.barcode, 'retail_price', pv.retail_price,
                'wholesale_price', pv.wholesale_price, 'current_stock', pv.current_stock,
                'purchase_price', pv.purchase_price, 'image_url', pv.image_url
              )
            )
            FROM product_variants pv
            WHERE pv.product_id = p.id AND pv.is_deleted = 0
          ) as variants_json
        FROM products p
        WHERE p.category_id = ? AND p.is_deleted = 0
        ORDER BY p.name
      `).all(category.category_id);

      const safeJsonParse = require('../utils/validators').safeJsonParse;
      const parsedProducts = products.map(p => ({
        ...p,
        variants: safeJsonParse(p.variants_json, []).filter(v => v.variant_id !== null)
      }));

      result.push({
        category_id: category.category_id,
        category_name: category.category_name,
        products: parsedProducts
      });
    }

    return result;
  }));
}

module.exports = { registerProductHandlers };