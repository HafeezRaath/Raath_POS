// ============================================================
//  db-dashboard.js — Dashboard & Analytics Module (Mixin)
// ============================================================

import { idbGetAll } from './core/idb-core.js';

export function attachDashboardMethods(StorageClass) {

  // ==================== TOP SELLING PRODUCTS ====================
  StorageClass.prototype.getTopSellingProducts = async function(dateFrom, dateTo, limit = 5) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT si.product_id, p.name as product_name, pv.sku, 
                SUM(si.quantity) as total_sold, SUM(si.total) as total_revenue 
         FROM sale_items si 
         JOIN sales s ON si.sale_id = s.id 
         JOIN products p ON si.product_id = p.id 
         JOIN product_variants pv ON si.product_variant_id = pv.id 
         WHERE s.is_deleted = 0 AND date(s.date) BETWEEN date(?) AND date(?) 
         GROUP BY si.product_variant_id 
         ORDER BY total_sold DESC LIMIT ?`, 
        [dateFrom, dateTo, limit]
      );
    }
    
    const [items, sales, products, variants] = await Promise.all([
      idbGetAll('sale_items'),
      idbGetAll('sales'),
      idbGetAll('products'),
      idbGetAll('product_variants')
    ]);
    
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    
    const validSales = sales.filter(s => {
      if (s.is_deleted) return false;
      const saleDate = new Date(s.date);
      return saleDate >= from && saleDate <= to;
    });
    const validSaleIds = new Set(validSales.map(s => String(s.id)));

    const grouped = {};
    for (const item of items) {
      if (!validSaleIds.has(String(item.sale_id))) continue;
      const key = item.product_variant_id;
      if (!grouped[key]) {
        grouped[key] = { product_id: item.product_id, total_sold: 0, total_revenue: 0 };
      }
      grouped[key].total_sold += Number(item.quantity || 0);
      grouped[key].total_revenue += Number(item.total || 0);
    }

    return Object.entries(grouped)
      .map(([variantId, stats]) => {
        const v = variants.find(x => String(x.id) === String(variantId));
        const p = products.find(x => String(x.id) === String(stats.product_id));
        return {
          product_id: stats.product_id,
          product_name: p?.name || '',
          sku: v?.sku || '',
          total_sold: stats.total_sold,
          total_revenue: stats.total_revenue
        };
      })
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, limit);
  };

  // ==================== DASHBOARD STATS ====================
  StorageClass.prototype.getDashboardStats = async function() {
    if (this.mode === 'electron') {
      const p = await this.electronQuery(
        "SELECT COUNT(*) as count FROM products WHERE is_deleted = 0"
      );
      const c = await this.electronQuery(
        "SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0"
      );
      const s = await this.electronQuery(
        "SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE DATE(date) = DATE('now') AND is_deleted = 0"
      );
      return { 
        total_products: p[0].count || 0, 
        total_customers: c[0].count || 0, 
        today_sales: s[0].total || 0 
      };
    }
    
    const [products, customers, sales] = await Promise.all([
      idbGetAll('products'),
      idbGetAll('customers'),
      idbGetAll('sales')
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales
      .filter(s => !s.is_deleted && s.date?.startsWith(today))
      .reduce((sum, s) => sum + Number(s.grand_total || 0), 0);

    return {
      total_products: products.filter(p => !p.is_deleted).length || 0,
      total_customers: customers.filter(c => !c.is_deleted).length || 0,
      today_sales: isNaN(todaySales) ? 0 : todaySales
    };
  };

  // ==================== NEXT INVOICE NUMBER (Mutex Locked) ====================
  StorageClass.prototype.getNextInvoiceNumber = async function() {
    if (this.mode === 'electron') {
      return this._withMutex(async () => {
        const rows = await this.electronQuery(
          "SELECT invoice_no FROM sales WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1"
        );
        if (rows.length === 0) return 'INV-0001';
        const lastNum = parseInt(rows[0].invoice_no.split('-')[1]) || 0;
        return `INV-${String(lastNum + 1).padStart(4, '0')}`;
      }, 'getNextInvoiceNumber');
    }
    
    const counterKey = 'invoice_counter';
    let counter = localStorage.getItem(counterKey);
    if (!counter) counter = '0';
    
    const nextNum = parseInt(counter) + 1;
    localStorage.setItem(counterKey, String(nextNum));
    return `INV-${String(nextNum).padStart(4, '0')}`;
  };

}