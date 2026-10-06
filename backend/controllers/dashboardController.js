// ============================================================
//  server/controllers/dashboardController.js
// ============================================================

const { query } = require('../config/db');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';

    // 1. Today sales
    const todayRows = await query(`
      SELECT COUNT(*) AS today_count, COALESCE(SUM(grand_total), 0) AS today_sales
      FROM sales
      WHERE tenant_id = ? AND DATE(sale_date) = CURDATE() AND is_deleted = 0
    `, [tenantId]);

    // 2. Total Revenue & Count
    const totalSalesRows = await query(`
      SELECT COUNT(*) AS total_sales_count, COALESCE(SUM(grand_total), 0) AS total_revenue
      FROM sales
      WHERE tenant_id = ? AND is_deleted = 0
    `, [tenantId]);

    // 3. Customers count & total credit balance
    const custRows = await query(`
      SELECT COUNT(*) AS total_customers, COALESCE(SUM(current_balance), 0) AS total_customer_credit
      FROM customers
      WHERE tenant_id = ? AND is_deleted = 0
    `, [tenantId]);

    // 4. Products count & low stock count
    const prodRows = await query(`
      SELECT 
        COUNT(*) AS total_products,
        SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) AS low_stock_count,
        COALESCE(SUM(stock * purchase_price), 0) AS inventory_value
      FROM products
      WHERE tenant_id = ? AND is_deleted = 0
    `, [tenantId]);

    // 5. Total Expenses this month
    const expenseRows = await query(`
      SELECT COALESCE(SUM(amount), 0) AS monthly_expenses
      FROM expenses
      WHERE tenant_id = ? AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE()) AND is_deleted = 0
    `, [tenantId]);

    // 6. Recent 10 sales
    const recentSales = await query(`
      SELECT s.*, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ? AND s.is_deleted = 0
      ORDER BY s.id DESC
      LIMIT 10
    `, [tenantId]);

    // 7. Last 7 days sales for chart
    const chartRows = await query(`
      SELECT DATE(sale_date) AS date, COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE tenant_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND is_deleted = 0
      GROUP BY DATE(sale_date)
      ORDER BY DATE(sale_date) ASC
    `, [tenantId]);

    // 8. Top 5 selling products
    const topProducts = await query(`
      SELECT p.id, p.name, SUM(si.quantity) AS total_sold, SUM(si.total) AS total_amount
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.tenant_id = ?
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 5
    `, [tenantId]);

    // 9. Accounts breakdown & balances
    const accountRows = await query(`
      SELECT 
        a.id, a.name, a.type, a.bank_name, a.current_balance,
        COALESCE(SUM(CASE WHEN DATE(at.date) = CURDATE() AND at.type = 'credit' THEN at.amount ELSE 0 END), 0) AS today_received,
        COALESCE(SUM(CASE WHEN at.type = 'credit' THEN at.amount ELSE 0 END), 0) AS total_received
      FROM accounts a
      LEFT JOIN account_transactions at ON a.id = at.account_id AND at.tenant_id = a.tenant_id AND at.reference_type = 'sale'
      WHERE a.tenant_id = ? AND a.is_deleted = 0
      GROUP BY a.id, a.name, a.type, a.bank_name, a.current_balance
      ORDER BY a.id ASC
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        todaySales: todayRows[0]?.today_sales || 0,
        todayCount: todayRows[0]?.today_count || 0,
        totalRevenue: totalSalesRows[0]?.total_revenue || 0,
        totalSalesCount: totalSalesRows[0]?.total_sales_count || 0,
        totalCustomers: custRows[0]?.total_customers || 0,
        totalCustomerCredit: custRows[0]?.total_customer_credit || 0,
        totalProducts: prodRows[0]?.total_products || 0,
        lowStockCount: prodRows[0]?.low_stock_count || 0,
        inventoryValue: prodRows[0]?.inventory_value || 0,
        monthlyExpenses: expenseRows[0]?.monthly_expenses || 0,
        recentSales,
        salesChart: chartRows,
        topProducts,
        accountBalances: accountRows
      }
    });
  } catch (error) {
    next(error);
  }
};
