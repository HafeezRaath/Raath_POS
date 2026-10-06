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
        todayExpenses: expStats?.total_expenses_today || 0
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

    const totalSales = parseFloat(salesRow?.total_sales || 0);
    const cogs = parseFloat(salesRow?.cogs || 0);
    const grossProfit = totalSales - cogs;
    const totalExpenses = parseFloat(expRow?.total_expenses || 0);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        totalRevenue: totalSales,
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
