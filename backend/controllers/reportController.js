// ============================================================
//  backend/controllers/reportController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

// --- Dashboard Summary Stats ---
exports.getDashboardStats = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const today = new Date().toISOString().slice(0, 10);

    const [todaySales] = await query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total, COUNT(id) AS count
       FROM sales WHERE tenant_id = ? AND DATE(sale_date) = ? AND is_deleted = 0`,
      [tenantId, today]
    );

    const [allSales] = await query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total, COALESCE(SUM(due_amount), 0) AS dues
       FROM sales WHERE tenant_id = ? AND is_deleted = 0`,
      [tenantId]
    );

    const [prodStats] = await query(
      `SELECT COUNT(id) AS total_products, 
              COALESCE(SUM(stock * purchase_price), 0) AS inventory_value,
              COUNT(CASE WHEN stock <= min_stock THEN 1 END) AS low_stock_count
       FROM products WHERE tenant_id = ? AND is_deleted = 0`,
      [tenantId]
    );

    const [custStats] = await query(
      `SELECT COUNT(id) AS total_customers, COALESCE(SUM(current_balance), 0) AS total_customer_dues
       FROM customers WHERE tenant_id = ? AND is_deleted = 0`,
      [tenantId]
    );

    const [supStats] = await query(
      `SELECT COUNT(id) AS total_suppliers, COALESCE(SUM(current_balance), 0) AS total_supplier_dues
       FROM suppliers WHERE tenant_id = ? AND is_deleted = 0`,
      [tenantId]
    );

    const [expStats] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses_today
       FROM expenses WHERE tenant_id = ? AND date = ? AND is_deleted = 0`,
      [tenantId, today]
    );

    const [expiryStats] = await query(
      `SELECT 
         COUNT(DISTINCT CASE WHEN (p.expiry_date < CURDATE() OR pi.expiry_date < CURDATE()) THEN p.id END) AS expired_count,
         COUNT(DISTINCT CASE WHEN (DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) BETWEEN 0 AND 30) THEN p.id END) AS expiring_soon_count
       FROM products p
       LEFT JOIN purchase_items pi ON pi.product_id = p.id AND pi.tenant_id = p.tenant_id AND pi.expiry_date IS NOT NULL
       WHERE p.tenant_id = ? AND p.is_deleted = 0 AND (p.expiry_date IS NOT NULL OR pi.expiry_date IS NOT NULL)`,
      [tenantId]
    ).catch(() => [{ expired_count: 0, expiring_soon_count: 0 }]);

    res.json({
      success: true,
      data: {
        todaySales: todaySales?.total || 0,
        todaySalesCount: todaySales?.count || 0,
        totalSales: allSales?.total || 0,
        totalSalesDues: allSales?.dues || 0,
        totalProducts: prodStats?.total_products || 0,
        inventoryValue: prodStats?.inventory_value || 0,
        lowStockCount: prodStats?.low_stock_count || 0,
        totalCustomers: custStats?.total_customers || 0,
        customerDues: custStats?.total_customer_dues || 0,
        totalSuppliers: supStats?.total_suppliers || 0,
        supplierDues: supStats?.total_supplier_dues || 0,
        todayExpenses: expStats?.total_expenses_today || 0,
        expiredCount: expiryStats?.expired_count || 0,
        expiringSoonCount: expiryStats?.expiring_soon_count || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Sales Report ---
exports.getSalesReport = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { from_date, to_date, payment_method, customer_id } = req.query;
    let sql = `
      SELECT s.*, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ? AND s.is_deleted = 0
    `;
    const params = [tenantId];

    if (from_date) { sql += ` AND DATE(s.sale_date) >= ?`; params.push(from_date); }
    if (to_date) { sql += ` AND DATE(s.sale_date) <= ?`; params.push(to_date); }
    if (payment_method) { sql += ` AND s.payment_method = ?`; params.push(payment_method); }
    if (customer_id) { sql += ` AND s.customer_id = ?`; params.push(customer_id); }

    sql += ` ORDER BY s.sale_date DESC`;
    const rows = await query(sql, params);

    const totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
    const totalCollected = rows.reduce((sum, r) => sum + parseFloat(r.paid_amount || 0), 0);
    const totalDue = rows.reduce((sum, r) => sum + parseFloat(r.due_amount || 0), 0);

    res.json({
      success: true,
      data: {
        records: rows,
        summary: { totalRevenue, totalCollected, totalDue, count: rows.length }
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Profit and Loss ---
exports.getProfitLoss = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { from_date, to_date } = req.query;
    let salesSql = `
      SELECT COALESCE(SUM(si.total), 0) AS total_sales,
             COALESCE(SUM(si.quantity * si.purchase_price), 0) AS cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.tenant_id = ? AND s.is_deleted = 0
    `;
    let expSql = `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE tenant_id = ? AND is_deleted = 0`;
    const salesParams = [tenantId];
    const expParams = [tenantId];

    if (from_date) {
      salesSql += ` AND DATE(s.sale_date) >= ?`;
      expSql += ` AND date >= ?`;
      salesParams.push(from_date);
      expParams.push(from_date);
    }
    if (to_date) {
      salesSql += ` AND DATE(s.sale_date) <= ?`;
      expSql += ` AND date <= ?`;
      salesParams.push(to_date);
      expParams.push(to_date);
    }

    const [salesRow] = await query(salesSql, salesParams);
    const [expRow] = await query(expSql, expParams);

    // QA-016: completed repair/work-order revenue counts as revenue too
    let svcSql = `SELECT COALESCE(SUM(total_amount), 0) AS svc_revenue FROM work_orders WHERE tenant_id = ? AND status = 'completed' AND is_deleted = 0`;
    const svcParams = [tenantId];
    if (from_date) { svcSql += ` AND DATE(COALESCE(completed_at, created_at)) >= ?`; svcParams.push(from_date); }
    if (to_date) { svcSql += ` AND DATE(COALESCE(completed_at, created_at)) <= ?`; svcParams.push(to_date); }
    const svcRows = await query(svcSql, svcParams);
    const serviceRevenue = parseFloat(svcRows[0]?.svc_revenue || 0);

    const totalSales = parseFloat(salesRow?.total_sales || 0) + serviceRevenue;
    const cogs = parseFloat(salesRow?.cogs || 0);
    const grossProfit = totalSales - cogs;
    const totalExpenses = parseFloat(expRow?.total_expenses || 0);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        totalRevenue: totalSales,
        serviceRevenue,
        costOfGoodsSold: cogs,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin: totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Stock / Inventory Valuation Report ---
exports.getStockReport = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`
      SELECT p.id, p.name, p.sku, p.barcode, p.stock, p.min_stock,
             p.purchase_price, p.sale_price,
             (p.stock * p.purchase_price) AS valuation_cost,
             (p.stock * p.sale_price) AS valuation_retail,
             c.name AS category_name, b.name AS brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.tenant_id = ? AND p.is_deleted = 0
      ORDER BY p.name ASC
    `, [tenantId]);

    const totalCostValuation = rows.reduce((s, r) => s + parseFloat(r.valuation_cost || 0), 0);
    const totalRetailValuation = rows.reduce((s, r) => s + parseFloat(r.valuation_retail || 0), 0);

    res.json({
      success: true,
      data: {
        products: rows,
        summary: {
          totalProducts: rows.length,
          totalCostValuation,
          totalRetailValuation
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Customer Dues Report ---
exports.getCustomerDues = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`
      SELECT id, name, phone, email, current_balance, credit_limit, city
      FROM customers
      WHERE tenant_id = ? AND is_deleted = 0 AND current_balance > 0
      ORDER BY current_balance DESC
    `, [tenantId]);
    const totalDues = rows.reduce((s, r) => s + parseFloat(r.current_balance || 0), 0);
    res.json({ success: true, data: { customers: rows, totalDues } });
  } catch (error) {
    next(error);
  }
};

// --- Supplier Dues Report ---
exports.getSupplierDues = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`
      SELECT id, name, company_name, phone, current_balance
      FROM suppliers
      WHERE tenant_id = ? AND is_deleted = 0 AND current_balance > 0
      ORDER BY current_balance DESC
    `, [tenantId]);
    const totalDues = rows.reduce((s, r) => s + parseFloat(r.current_balance || 0), 0);
    res.json({ success: true, data: { suppliers: rows, totalDues } });
  } catch (error) {
    next(error);
  }
};

// --- Expiry and Shelf-Life Report ---
exports.getExpiryReport = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { filter = 'all' } = req.query; // all, expired, 30days, 60days, 90days

    let sql = `
      SELECT 
        COALESCE(pi.id, p.id) AS unique_row_id,
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.barcode,
        p.stock AS current_stock,
        p.purchase_price,
        p.retail_price,
        c.name AS category_name,
        COALESCE(pi.expiry_date, p.expiry_date) AS expiry_date,
        DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) AS days_left,
        pur.purchase_number,
        pur.supplier_name,
        CASE
          WHEN COALESCE(pi.expiry_date, p.expiry_date) < CURDATE() THEN 'EXPIRED'
          WHEN DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) <= 30 THEN 'CRITICAL'
          WHEN DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) <= 60 THEN 'WARNING'
          ELSE 'GOOD'
        END AS expiry_status
      FROM products p
      LEFT JOIN purchase_items pi ON pi.product_id = p.id AND pi.tenant_id = p.tenant_id AND pi.expiry_date IS NOT NULL
      LEFT JOIN purchases pur ON pi.purchase_id = pur.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = ? 
        AND p.is_deleted = 0 
        AND (pi.expiry_date IS NOT NULL OR p.expiry_date IS NOT NULL)
    `;
    const params = [tenantId];

    if (filter === 'expired') {
      sql += ` AND COALESCE(pi.expiry_date, p.expiry_date) < CURDATE()`;
    } else if (filter === '30days') {
      sql += ` AND DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) BETWEEN 0 AND 30`;
    } else if (filter === '60days') {
      sql += ` AND DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) BETWEEN 0 AND 60`;
    } else if (filter === '90days') {
      sql += ` AND DATEDIFF(COALESCE(pi.expiry_date, p.expiry_date), CURDATE()) BETWEEN 0 AND 90`;
    }

    sql += ` ORDER BY expiry_date ASC`;

    const rows = await query(sql, params).catch(() => []);

    const expiredCount = rows.filter(r => r.expiry_status === 'EXPIRED').length;
    const criticalCount = rows.filter(r => r.expiry_status === 'CRITICAL').length;
    const atRiskValue = rows
      .filter(r => r.expiry_status === 'EXPIRED' || r.expiry_status === 'CRITICAL')
      .reduce((sum, r) => sum + (parseFloat(r.current_stock || 0) * parseFloat(r.purchase_price || 0)), 0);

    res.json({
      success: true,
      data: {
        records: rows,
        summary: {
          totalTracked: rows.length,
          expiredCount,
          criticalCount,
          atRiskValue
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


// --- QA-044: Top selling products (frontend /reports/top-selling call karta tha jo maujood nahi tha) ---
exports.getTopSelling = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { from_date, to_date, limit = 20 } = req.query;
    let sql = `
      SELECT si.product_variant_id, si.product_id,
             COALESCE(pv.variant_name, p.name, si.product_name, 'Item') AS product_name,
             COALESCE(pv.sku, p.sku, '') AS sku,
             SUM(si.quantity) AS total_sold,
             SUM(si.quantity * COALESCE(si.unit_price, si.price, 0)) AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN product_variants pv ON pv.id = si.product_variant_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = ? AND s.is_deleted = 0
    `;
    const params = [tenantId];
    if (from_date) { sql += ` AND DATE(s.sale_date) >= ?`; params.push(from_date); }
    if (to_date) { sql += ` AND DATE(s.sale_date) <= ?`; params.push(to_date); }
    sql += ` GROUP BY si.product_variant_id, si.product_id, product_name, sku ORDER BY total_sold DESC LIMIT ${Math.min(parseInt(limit, 10) || 20, 100)}`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
