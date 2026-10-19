// ============================================================
//  frontend/src/database/db.js - Pure REST API Data Bridge
//  Zero IndexedDB, Zero Firebase - 100% MySQL via Node.js Server
// ============================================================

import api from '../api/apiClient';

class DatabaseClient {
  constructor() {
    this.mode = 'server';
  }

  // ==================== PRODUCTS ====================
  async getProducts(params = {}) {
    const res = await api.get('/products', params);
    return res.data || [];
  }

  async getProductById(id) {
    const res = await api.get(`/products/${id}`);
    return res.data;
  }

  async createProduct(data) {
    const res = await api.post('/products', data);
    return res.data;
  }

  async addProduct(data) {
    return this.createProduct(data);
  }

  async updateProduct(id, data) {
    const res = await api.put(`/products/${id}`, data);
    return res.data;
  }

  async deleteProduct(id) {
    const res = await api.delete(`/products/${id}`);
    return res.success;
  }

  async getAllVariants() {
    const res = await api.get('/products/variants');
    return res.data || [];
  }

  async updateVariant(id, data) {
    const res = await api.put(`/products/variants/${id}`, data);
    return res.data;
  }

  async updateVariantStock(id, current_stock) {
    const res = await api.put(`/products/variants/${id}`, { current_stock: Number(current_stock) });
    return res.data;
  }

  async getLowStock() {
    const res = await api.get('/products/low-stock');
    return res.data || [];
  }

  // ==================== CATEGORIES & BRANDS ====================
  async getCategories() {
    const res = await api.get('/categories');
    return res.data || [];
  }

  async createCategory(data) {
    const res = await api.post('/categories', data);
    return res.data;
  }

  async addCategory(data) {
    return this.createCategory(data);
  }

  async updateCategory(id, data) {
    const res = await api.put(`/categories/${id}`, data);
    return res.data;
  }

  async deleteCategory(id) {
    const res = await api.delete(`/categories/${id}`);
    return res.success;
  }

  async getBrands() {
    const res = await api.get('/brands');
    return res.data || [];
  }

  async createBrand(data) {
    const res = await api.post('/brands', data);
    return res.data;
  }

  async addBrand(data) {
    return this.createBrand(data);
  }

  async updateBrand(id, data) {
    const res = await api.put(`/brands/${id}`, data);
    return res.data;
  }

  async deleteBrand(id) {
    const res = await api.delete(`/brands/${id}`);
    return res.success;
  }

  // ==================== SALES ====================
  async getSales(filters = {}) {
    const res = await api.get('/sales', filters);
    return res.data || [];
  }

  async getSalesHistory(filters = {}) {
    return this.getSales(filters);
  }

  async getSaleById(id) {
    const res = await api.get(`/sales/${id}`);
    return res.data;
  }

  async createSale(data) {
    const res = await api.post('/sales', data);
    return res.data;
  }

  async addSale(data) {
    return this.createSale(data);
  }

  async getAllSaleItems(saleId) {
    const res = await api.get('/sales/items', saleId ? { saleId } : {});
    return res.data || [];
  }

  async getSaleItems(saleId) {
    return this.getAllSaleItems(saleId);
  }

  async addSaleItem(item) {
    return item;
  }

  async updateSale(id, data) {
    const res = await api.put(`/sales/${id}`, data);
    return res.data;
  }

  async deleteSale(id) {
    const res = await api.delete(`/sales/${id}`);
    return res.success;
  }

  async returnSale(data) {
    const res = await api.post('/returns/sales', data);
    return res.data;
  }

  // ==================== SALE & PURCHASE RETURNS ====================
  async getSaleReturns(filters = {}) {
    const res = await api.get('/returns/sales', filters);
    return res.data || [];
  }

  async createSaleReturn(data) {
    const res = await api.post('/returns/sales', data);
    return res.data;
  }

  async addSaleReturn(data) {
    return this.createSaleReturn(data);
  }

  async getPurchaseReturns(filters = {}) {
    const res = await api.get('/returns/purchases', filters);
    return res.data || [];
  }

  async createPurchaseReturn(data) {
    const res = await api.post('/returns/purchases', data);
    return res;
  }

  // ==================== PURCHASES ====================
  async getPurchases(filters = {}) {
    const res = await api.get('/purchases', filters);
    return res.data || [];
  }

  async getPurchaseById(id) {
    const res = await api.get(`/purchases/${id}`);
    return res.data;
  }

  async createPurchase(data) {
    const res = await api.post('/purchases', data);
    return res.data;
  }

  async addPurchase(data) {
    return this.createPurchase(data);
  }

  async getAllPurchaseItems(purchaseId) {
    const res = await api.get('/purchases/items', purchaseId ? { purchaseId } : {});
    return res.data || [];
  }

  async getPurchaseItems(purchaseId) {
    return this.getAllPurchaseItems(purchaseId);
  }

  async getPurchaseItemsForReturn(purchaseId) {
    return this.getAllPurchaseItems(purchaseId);
  }

  async updatePurchase(id, data) {
    const res = await api.put(`/purchases/${id}`, data);
    return res.data;
  }

  async deletePurchase(id) {
    const res = await api.delete(`/purchases/${id}`);
    return res.success;
  }

  // ==================== PURCHASE ORDERS (PO) ====================
  async getPurchaseOrders(filters = {}) {
    const res = await api.get('/purchases/orders', filters).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async getPurchaseOrderById(id) {
    const res = await api.get(`/purchases/orders/${id}`).catch(() => ({ data: null }));
    return res.data;
  }

  async createPurchaseOrder(data) {
    const res = await api.post('/purchases/orders', data);
    return res.data;
  }

  async addPurchaseOrder(data) {
    return this.createPurchaseOrder(data);
  }

  async updatePurchaseOrder(id, data) {
    const res = await api.put(`/purchases/orders/${id}`, data);
    return res.data;
  }

  async deletePurchaseOrder(id) {
    const res = await api.delete(`/purchases/orders/${id}`);
    return res.success;
  }

  async convertPOToPurchase(id, data = {}) {
    const res = await api.post(`/purchases/orders/${id}/convert`, data);
    return res.data;
  }

  // ==================== AUDIT LOGS ====================
  async getAuditLogs(params = {}) {
    const res = await api.get('/audit-logs', params).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async createAuditLog(data) {
    const res = await api.post('/audit-logs', data).catch(() => ({ success: false }));
    return res.data || res;
  }

  async logAudit(data) {
    return this.createAuditLog(data);
  }

  // ==================== EXPIRY REPORTS ====================
  async getExpiryReport(params = {}) {
    const res = await api.get('/reports/expiry', params).catch(() => ({ data: { records: [], summary: {} } }));
    return res.data || { records: [], summary: {} };
  }

  // ==================== CUSTOMERS ====================
  async getCustomers(filters = {}) {
    const res = await api.get('/customers', filters);
    return res.data || [];
  }

  async getCustomerById(id) {
    const res = await api.get(`/customers/${id}`);
    return res.data;
  }

  async createCustomer(data) {
    const res = await api.post('/customers', data);
    return res.data;
  }

  async addCustomer(data) {
    return this.createCustomer(data);
  }

  async updateCustomer(id, data) {
    const res = await api.put(`/customers/${id}`, data);
    return res.data;
  }

  async deleteCustomer(id) {
    const res = await api.delete(`/customers/${id}`);
    return res.success;
  }

  async getCustomerLedger(customerId) {
    const res = await api.get(`/customers/${customerId}/ledger`);
    return res.data || [];
  }

  async addCustomerPayment(customerIdOrData, maybeData) {
    let id, data;
    if (typeof customerIdOrData === 'object' && customerIdOrData !== null) {
      id = customerIdOrData.customer_id || customerIdOrData.id;
      data = customerIdOrData;
    } else {
      id = customerIdOrData;
      data = maybeData || {};
    }
    const res = await api.post(`/customers/${id}/payment`, data);
    return res.data;
  }

  // ==================== SUPPLIERS ====================
  async getSuppliers(filters = {}) {
    const res = await api.get('/suppliers', filters);
    return res.data || [];
  }

  async getSupplierById(id) {
    const res = await api.get(`/suppliers/${id}`);
    return res.data;
  }

  async createSupplier(data) {
    const res = await api.post('/suppliers', data);
    return res.data;
  }

  async addSupplier(data) {
    return this.createSupplier(data);
  }

  async updateSupplier(id, data) {
    const res = await api.put(`/suppliers/${id}`, data);
    return res.data;
  }

  async deleteSupplier(id) {
    const res = await api.delete(`/suppliers/${id}`);
    return res.success;
  }

  async getSupplierLedger(supplierId) {
    const res = await api.get(`/suppliers/${supplierId}/ledger`);
    return res.data || [];
  }

  async addSupplierPayment(supplierIdOrData, maybeData) {
    let id, data;
    if (typeof supplierIdOrData === 'object' && supplierIdOrData !== null) {
      id = supplierIdOrData.supplier_id || supplierIdOrData.id;
      data = supplierIdOrData;
    } else {
      id = supplierIdOrData;
      data = maybeData || {};
    }
    const res = await api.post(`/suppliers/${id}/payment`, data);
    return res.data;
  }

  // ==================== EXPENSES ====================
  async getExpenses(filters = {}) {
    const res = await api.get('/expenses', filters);
    return res.data || [];
  }

  async createExpense(data) {
    const res = await api.post('/expenses', data);
    return res.data;
  }

  async addExpense(data) {
    return this.createExpense(data);
  }

  async deleteExpense(id) {
    const res = await api.delete(`/expenses/${id}`);
    return res.success;
  }

  async updateExpense(id, data) {
    const res = await api.put(`/expenses/${id}`, data);
    return res.data;
  }

  async getExpenseCategories() {
    const res = await api.get('/expenses/categories');
    return res.data || [];
  }

  async createExpenseCategory(data) {
    const res = await api.post('/expenses/categories', data);
    return res.data;
  }

  async addExpenseCategory(data) {
    return this.createExpenseCategory(data);
  }

  // ==================== ACCOUNTS ====================
  async getAccounts() {
    const res = await api.get('/accounts');
    return res.data || [];
  }

  async getAllAccounts() {
    return this.getAccounts();
  }

  async getAccountById(id) {
    const res = await api.get(`/accounts/${id}`);
    return res.data;
  }

  async createAccount(data) {
    const res = await api.post('/accounts', data);
    return res.data;
  }

  async addAccount(data) {
    return this.createAccount(data);
  }

  async updateAccount(id, data) {
    const res = await api.put(`/accounts/${id}`, data);
    return res.data;
  }

  async deleteAccount(id) {
    const res = await api.delete(`/accounts/${id}`);
    return res.success;
  }

  async getAccountTransactions(accountId, params = {}) {
    const url = (accountId && accountId !== 'all' && accountId !== 'undefined') ? `/accounts/${accountId}/transactions` : '/accounts/transactions';
    const res = await api.get(url, params);
    return res.data || [];
  }

  async createAccountTransaction(data) {
    const res = await api.post('/accounts/transactions', data);
    return res.data;
  }

  async createTransaction(data) {
    return this.createAccountTransaction(data);
  }

  async transferFunds(data) {
    const res = await api.post('/accounts/transfer', data);
    return res.data;
  }

  // ==================== EMI / INSTALLMENTS ====================
  async getEMIs(filters = {}) {
    const res = await api.get('/emi', filters);
    return res.data || [];
  }

  async getEMIById(id) {
    const res = await api.get(`/emi/${id}`);
    return res.data;
  }

  async createEMI(data) {
    const res = await api.post('/emi', data);
    return res.data;
  }

  async addEMI(data) {
    return this.createEMI(data);
  }

  async payEMI(id, data) {
    const res = await api.post(`/emi/${id}/pay`, data);
    return res.data;
  }

  async getOverdueEMIs() {
    const res = await api.get('/emi/overdue');
    return res.data || [];
  }

  async deleteEMI(id) {
    const res = await api.delete(`/emi/${id}`);
    return res.success;
  }

  // ==================== SALESMEN ====================
  async getSalesmen(filters = {}) {
    const res = await api.get('/salesmen', filters);
    return res.data || [];
  }

  async getSalesmanById(id) {
    const res = await api.get(`/salesmen/${id}`);
    return res.data;
  }

  async createSalesman(data) {
    const res = await api.post('/salesmen', data);
    return res.data;
  }

  async addSalesman(data) {
    return this.createSalesman(data);
  }

  async updateSalesman(id, data) {
    const res = await api.put(`/salesmen/${id}`, data);
    return res.data;
  }

  async deleteSalesman(id) {
    const res = await api.delete(`/salesmen/${id}`);
    return res.success;
  }

  async getSalesmanSales(filters = {}) {
    const res = await api.get('/salesmen/sales/list', filters);
    return res.data || [];
  }

  async createSalesmanSale(data) {
    const res = await api.post('/salesmen/sales/create', data);
    return res.data;
  }

  async getSalesmanSalaries(salesmanId) {
    const res = await api.get('/salesmen/salaries/list', { salesman_id: salesmanId });
    return res.data || [];
  }

  async paySalesmanSalary(data) {
    const res = await api.post('/salesmen/salaries/pay', data);
    return res.data;
  }

  async getSalesmanAdvances(salesmanId) {
    const res = await api.get('/salesmen/advances/list', { salesman_id: salesmanId });
    return res.data || [];
  }

  async giveSalesmanAdvance(data) {
    const res = await api.post('/salesmen/advances/give', data);
    return res.data;
  }

  async getSalesmanLedger(id) {
    const res = await api.get(`/salesmen/${id}/ledger`);
    return res.data || [];
  }

  async getSalesmanPerformance() {
    const res = await api.get('/salesmen/performance');
    return res.data || [];
  }

  // ==================== DISTRIBUTORS ====================
  async getDistributors(filters = {}) {
    const res = await api.get('/distributors', filters);
    return res.data || [];
  }

  async getDistributorById(id) {
    const res = await api.get(`/distributors/${id}`);
    return res.data;
  }

  async createDistributor(data) {
    const res = await api.post('/distributors', data);
    return res.data;
  }

  async updateDistributor(id, data) {
    const res = await api.put(`/distributors/${id}`, data);
    return res.data;
  }

  async deleteDistributor(id) {
    const res = await api.delete(`/distributors/${id}`);
    return res.success;
  }

  async getDistributorOrders(filters = {}) {
    const res = await api.get('/distributors/orders/list', filters);
    return res.data || [];
  }

  async createDistributorOrder(data) {
    const res = await api.post('/distributors/orders/create', data);
    return res.data;
  }

  async getDistributorPayments(distributorId) {
    const res = await api.get('/distributors/payments/list', { distributor_id: distributorId });
    return res.data || [];
  }

  async createDistributorPayment(data) {
    const res = await api.post('/distributors/payments/create', data);
    return res.data;
  }

  async getDistributorLedger(id) {
    const res = await api.get(`/distributors/${id}/ledger`);
    return res.data || [];
  }

  async getDistributorSummary() {
    const res = await api.get('/distributors/summary');
    return res.data || [];
  }

  // ==================== SERVICES & STAFF ====================
  async getServices() {
    const res = await api.get('/services');
    return res.data || [];
  }

  async createService(data) {
    const res = await api.post('/services', data);
    return res.data;
  }

  async addService(data) {
    return this.createService(data);
  }

  async updateService(id, data) {
    const res = await api.put(`/services/${id}`, data);
    return res.data;
  }

  async deleteService(id) {
    const res = await api.delete(`/services/${id}`);
    return res.success;
  }

  async getStaff() {
    const res = await api.get('/services/staff/list');
    return res.data || [];
  }

  async createStaff(data) {
    const res = await api.post('/services/staff', data);
    return res.data;
  }

  async addStaff(data) {
    return this.createStaff(data);
  }

  async updateStaff(id, data) {
    const res = await api.put(`/services/staff/${id}`, data);
    return res.data;
  }

  async deleteStaff(id) {
    const res = await api.delete(`/services/staff/${id}`);
    return res.success;
  }

  async getWorkOrders(filters = {}) {
    const res = await api.get('/services/orders/list', filters);
    return res.data || [];
  }

  async createWorkOrder(data) {
    const res = await api.post('/services/orders', data);
    return res.data;
  }

  async addWorkOrder(data) {
    return this.createWorkOrder(data);
  }

  async updateWorkOrder(id, data) {
    const res = await api.put(`/services/orders/${id}`, data);
    return res.data;
  }

  async deleteWorkOrder(id) {
    const res = await api.delete(`/services/orders/${id}`);
    return res.success;
  }

  // ==================== DASHBOARD & REPORTS ====================
  async getDashboardStats() {
    const res = await api.get('/reports/dashboard');
    return res.data;
  }

  async getSalesReport(params = {}) {
    const res = await api.get('/reports/sales', params);
    return res.data;
  }

  async getProfitLoss(params = {}) {
    const res = await api.get('/reports/profit-loss', params);
    return res.data;
  }

  async getStockReport() {
    const res = await api.get('/reports/stock');
    return res.data;
  }

  async getCustomerDues() {
    const res = await api.get('/reports/customer-dues');
    return res.data;
  }

  async getSupplierDues() {
    const res = await api.get('/reports/supplier-dues');
    return res.data;
  }

  // ==================== SETTINGS & BACKUP ====================
  async getSettings() {
    const res = await api.get('/settings');
    return res.data || {};
  }

  async updateSettings(data) {
    const res = await api.post('/settings', data);
    return res.success;
  }

  async exportBackup() {
    const res = await api.get('/settings/backup/export');
    return res.backup;
  }

  // ==================== USERS & ROLES ====================
  async getUsers() {
    const res = await api.get('/users');
    return res.data || [];
  }

  async createUser(data) {
    const res = await api.post('/users', data);
    return res.data;
  }

  async updateUser(id, data) {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  }

  async deleteUser(id) {
    const res = await api.delete(`/users/${id}`);
    return res.success;
  }

  async getRoles() {
    const res = await api.get('/auth/roles');
    return res.data || [];
  }

  async createRole(data) {
    const res = await api.post('/auth/roles', data);
    return res.data;
  }

  async updateRole(id, data) {
    const res = await api.put(`/auth/roles/${id}`, data);
    return res.data;
  }

  async deleteRole(id) {
    const res = await api.delete(`/auth/roles/${id}`);
    return res.success;
  }

  // ==================== OFFERS & DEALS ====================
  async getOffers() {
    const res = await api.get('/offers');
    return res.data || [];
  }

  async createOffer(data) {
    const res = await api.post('/offers', data);
    return res.data;
  }

  async deleteOffer(id) {
    const res = await api.delete(`/offers/${id}`);
    return res.success;
  }

  async getDeals() {
    const res = await api.get('/offers/deals/list');
    return res.data || [];
  }

  async createDeal(data) {
    const res = await api.post('/offers/deals', data);
    return res.data;
  }

  // ==================== WAREHOUSES ====================
  async getWarehouses() {
    const res = await api.get('/warehouses');
    return res.data || [];
  }

  async createWarehouse(data) {
    const res = await api.post('/warehouses', data);
    return res.data;
  }

  async addWarehouse(data) {
    return this.createWarehouse(data);
  }

  async updateWarehouse(id, data) {
    const res = await api.put(`/warehouses/${id}`, data);
    return res.data;
  }

  async deleteWarehouse(id) {
    const res = await api.delete(`/warehouses/${id}`);
    return res.success;
  }

  async getWarehouseStocks(id) {
    const res = await api.get(`/warehouses/${id}/stocks`);
    return res.data || [];
  }

  // ==================== FBR ====================
  async getFBRInvoices(params = {}) {
    const res = await api.get('/fbr/invoices', params);
    return res.data || [];
  }

  async submitToFBR(saleId) {
    const res = await api.post(`/fbr/submit/${saleId}`);
    return res.data;
  }

  // ==================== RAW & DYNAMIC SQL QUERY ====================
  async query(sql, params = []) {
    try {
      const res = await api.post('/query', { sql, params });
      return res.data || [];
    } catch (err) {
      console.warn('[db.query error]:', err.message);
      return [];
    }
  }

  async electronQuery(sql, params = []) {
    return this.query(sql, params);
  }

  async transaction(callback) {
    if (typeof callback === 'function') {
      return await callback(this);
    }
    return true;
  }

  async close() {
    return true;
  }

  // ==================== SALE RETURN ITEMS ====================
  async getAllSaleReturnItems(returnId) {
    const res = await this.query(
      'SELECT * FROM sale_return_items' + (returnId ? ' WHERE sale_return_id = ?' : '') + ' ORDER BY id DESC',
      returnId ? [returnId] : []
    );
    return res || [];
  }

  async getSaleReturnItems(returnId) {
    return this.getAllSaleReturnItems(returnId);
  }

  async createSaleReturnItem(data) {
    return data;
  }

  async updateSaleReturn(id, data) {
    return data;
  }

  async deleteSaleReturn(id) {
    return this.query('UPDATE sale_returns SET is_deleted = 1 WHERE id = ?', [id]);
  }

  // ==================== VARIANTS & PRODUCTS EXTRAS ====================
  async getProductVariants(productId) {
    const variants = await this.getAllVariants();
    return productId ? variants.filter(v => String(v.product_id) === String(productId)) : variants;
  }

  async getVariantBySKU(sku) {
    const variants = await this.getAllVariants();
    return variants.find(v => v.sku === sku) || null;
  }

  async addVariant(data) {
    return this.createVariant(data);
  }

  async createVariant(data) {
    const res = await api.post('/products/variants', data).catch(() => ({ data }));
    return res.data || data;
  }

  async updateVariant(id, data) {
    const res = await api.put(`/products/variants/${id}`, data).catch(() => ({ data }));
    return res.data || data;
  }

  async deleteVariant(id) {
    const res = await api.delete(`/products/variants/${id}`).catch(() => ({ success: true }));
    return res.success;
  }

  async updateVariantStock(id, stock) {
    return this.updateVariant(id, { current_stock: stock });
  }

  async updateVariantImage(id, image) {
    return this.updateVariant(id, { image });
  }

  async getProductsWithCategories() {
    return this.getProducts();
  }

  async getTopSellingProducts(limit = 5) {
    const res = await api.get('/reports/top-selling', { limit }).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async getPriceHistory(productId) {
    return [];
  }

  async addMultipleSerializedItems(items) {
    return { success: true, count: items?.length || 0 };
  }

  // ==================== USER LOOKUPS & ROLES ====================
  async getUserByEmail(email) {
    const res = await this.query(
      'SELECT * FROM users WHERE LOWER(email) = ? AND is_deleted = 0 LIMIT 1',
      [String(email).trim().toLowerCase()]
    );
    return res[0] || null;
  }

  async getUserByUsername(username) {
    const res = await this.query(
      'SELECT * FROM users WHERE LOWER(username) = ? AND is_deleted = 0 LIMIT 1',
      [String(username).trim().toLowerCase()]
    );
    return res[0] || null;
  }

  async getUserById(id) {
    const res = await api.get(`/users/${id}`).catch(() => ({}));
    return res.data || null;
  }

  async seedDefaultRoles(roles) {
    return true;
  }

  async updateRole(id, role) {
    const res = await api.put(`/auth/roles/${id}`, role).catch(() => ({ data: role }));
    return res.data || role;
  }

  async deleteRole(id) {
    const res = await api.delete(`/auth/roles/${id}`).catch(() => ({ success: true }));
    return res.success;
  }

  // ==================== SETTINGS SHORTCUTS ====================
  async getShopProfile() {
    const settings = await this.getSettings();
    let currentUser = null;
    try {
      const raw = localStorage.getItem('current_user');
      if (raw) currentUser = JSON.parse(raw);
    } catch (_) {}

    const shopName = settings.shop_name || currentUser?.shop_name || 'RAATH POS Store';
    const address = settings.shop_address || currentUser?.shop_address || '';
    const phone = settings.phone || currentUser?.phone || '';
    const email = settings.email || currentUser?.email || '';
    const city = settings.city || settings.shop_address || currentUser?.shop_address || '';

    return {
      name: shopName,
      shopName: shopName,
      tagline: settings.tagline || 'Quality Products, Best Prices',
      address,
      city,
      phone,
      email,
      website: settings.website || '',
      taxNumber: settings.taxNumber || settings.tax_number || '',
      registrationNumber: settings.registrationNumber || settings.registration_number || '',
      receiptFooter: settings.receiptFooter || settings.receipt_footer || 'Thank you for shopping with us!\nReturns accepted within 7 days with receipt.',
      ...(settings.shop || {})
    };
  }

  async saveShopProfile(data) {
    if (typeof data === 'object') {
      const payload = {
        shop_name: data.name || data.shopName,
        shop_address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        website: data.website,
        tagline: data.tagline,
        ...data
      };
      localStorage.setItem('shop_profile', JSON.stringify(payload));
      if (payload.shop_name) {
        localStorage.setItem('raath_shop_name', payload.shop_name);
      }
      return this.updateSettings(payload);
    }
    return true;
  }

  async getReceiptSettings() {
    const settings = await this.getSettings();
    return settings.receipt || {};
  }

  async saveReceiptSettings(data) {
    return this.updateSettings({ receipt: data });
  }

  async getTaxSettings() {
    const settings = await this.getSettings();
    return settings.tax || {};
  }

  async saveTaxSettings(data) {
    return this.updateSettings({ tax: data });
  }

  async getNotificationSettings() {
    const settings = await this.getSettings();
    return settings.notification || {};
  }

  async saveNotificationSettings(data) {
    return this.updateSettings({ notification: data });
  }

  async getPageVisibility() {
    const settings = await this.getSettings();
    return settings.page_visibility || {};
  }

  async savePageVisibility(data) {
    return this.updateSettings({ page_visibility: data });
  }

  async getBarcodeSettings() {
    const settings = await this.getSettings();
    return settings.barcode || {};
  }

  async saveBarcodeSettings(data) {
    return this.updateSettings({ barcode: data });
  }

  async syncSettingsToCloud() { return true; }
  async syncSettingToFirebase() { return true; }
  async pullSettingsFromCloud() { return this.getSettings(); }

  // ==================== EMI & GUARANTORS ====================
  async getAllEMIPayments() {
    const res = await api.get('/emi/payments/all').catch(() => ({ data: [] }));
    return res.data || [];
  }

  async getEMIPayments(emiId) {
    if (!emiId) return this.getAllEMIPayments();
    const res = await api.get(`/emi/${emiId}/payments`).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async addEMIPayment(data) {
    const emiId = data.emi_id || data.emi_plan_id || data.emiId;
    const res = await api.post(`/emi/${emiId}/pay`, data);
    return res.data;
  }

  async deleteEMIPayment(id) {
    return true;
  }

  async updateEMI(id, data) {
    const res = await api.put(`/emi/${id}`, data).catch(() => ({ data }));
    return res.data;
  }

  async getCustomerEMISummary(customerId) {
    return this.getEMIs({ customerId });
  }

  generateEMISchedule(emiData) {
    return [];
  }

  async getSchedule(emiId) {
    return [];
  }

  async _syncElectronEMIAfterPayment() { return true; }
  async _syncIDBEMIAfterPayment() { return true; }

  async getAllGuarantors() {
    return this.query('SELECT * FROM emi_guarantors WHERE is_deleted = 0');
  }

  async getGuarantors(id) {
    if (!id) return this.getAllGuarantors();
    return this.query('SELECT * FROM emi_guarantors WHERE (customer_id = ? OR emi_id = ?) AND is_deleted = 0', [id, id]);
  }

  async createGuarantor(data) {
    const res = await api.post('/emi/guarantors', data);
    return res.data;
  }

  async updateGuarantor(id, data) {
    const res = await api.put(`/customers/guarantors/${id}`, data).catch(() => ({ data }));
    return res.data;
  }

  async deleteGuarantor(id) {
    return this.query('UPDATE emi_guarantors SET is_deleted = 1 WHERE id = ?', [id]);
  }

  // ==================== PAYMENTS, LEDGER & ACCOUNTS ====================
  async getPayments(filters = {}) {
    return this.query('SELECT * FROM payments WHERE is_deleted = 0 ORDER BY id DESC');
  }

  async addPayment(data) {
    if (data?.supplier_id) {
      return this.addSupplierPayment(data);
    }
    return this.addCustomerPayment(data);
  }

  async updatePayment(id, data) {
    return data;
  }

  async deletePayment(id) {
    return this.query('UPDATE payments SET is_deleted = 1 WHERE id = ?', [id]);
  }

  async getLedger(filters = {}) {
    return this.query(`
      SELECT 
        at.*,
        a.name AS account_name,
        a.type AS account_type,
        CASE WHEN (at.type = 'debit' OR at.transaction_type = 'debit') THEN at.amount ELSE 0 END AS debit,
        CASE WHEN (at.type = 'credit' OR at.transaction_type = 'credit') THEN at.amount ELSE 0 END AS credit
      FROM account_transactions at
      LEFT JOIN accounts a ON at.account_id = a.id
      WHERE at.reference_type = 'manual_entry'
      ORDER BY at.id DESC
    `);
  }

  async getGeneralLedger(filters = {}) {
    return this.getLedger(filters);
  }

  async getAllGeneralLedger(filters = {}) {
    return this.getLedger(filters);
  }

  async logToGeneralLedger(data) {
    return true;
  }

  async getAllAccountTransactions(accountIdOrParams = {}, maybeParams = {}) {
    let accountId = null;
    let params = {};
    if (typeof accountIdOrParams === 'object' && accountIdOrParams !== null) {
      params = accountIdOrParams;
      accountId = params.accountId || null;
    } else {
      accountId = accountIdOrParams;
      params = maybeParams || {};
    }
    const url = (accountId && accountId !== 'all' && accountId !== 'undefined') ? `/accounts/${accountId}/transactions` : '/accounts/transactions';
    const res = await api.get(url, params).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async getAccountStatement(accountId, from, to) {
    // 1. Try backend statement endpoint
    try {
      const res = await api.get(`/accounts/${accountId}/statement`, {
        params: { startDate: from, endDate: to }
      });
      if (res && res.data) {
        return res.data;
      }
    } catch (e) {
      // Fallback to client-side computation
    }

    // Fallback:
    const txs = await this.getAllAccountTransactions(accountId);
    const account = await this.getAccountById(accountId).catch(() => null);
    const initialOp = Number(account?.opening_balance || 0);

    const f = from ? new Date(from) : new Date('2000-01-01');
    const tDate = to ? new Date(to) : new Date('2099-12-31');
    tDate.setHours(23, 59, 59, 999);

    // Compute opening balance before 'from'
    const priorTxs = (txs || []).filter(t => {
      const d = new Date(t.date || 0);
      return d < f;
    });
    const priorCredits = priorTxs.filter(t => t.type === 'credit' || t.transaction_type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
    const priorDebits = priorTxs.filter(t => t.type === 'debit' || t.transaction_type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
    const opening = Number((initialOp + priorCredits - priorDebits).toFixed(2));

    const inRange = (txs || []).filter(t => {
      const d = new Date(t.date || 0);
      return d >= f && d <= tDate;
    }).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0) || (Number(a.id || 0) - Number(b.id || 0)));

    let running = opening;
    let totalCredits = 0;
    let totalDebits = 0;
    const items = inRange.map((tx, idx) => {
      const isCredit = (tx.type === 'credit' || tx.transaction_type === 'credit');
      const amt = Number(tx.amount || 0);
      if (isCredit) {
        totalCredits += amt;
        running += amt;
      } else {
        totalDebits += amt;
        running -= amt;
      }
      return {
        ...tx,
        index: idx + 1,
        id: tx.id,
        amount: amt,
        transaction_type: isCredit ? 'credit' : 'debit',
        running_balance: Number(running.toFixed(2)),
        balance_after: Number(running.toFixed(2))
      };
    });

    const closing = Number(running.toFixed(2));

    return {
      account,
      opening_balance: opening,
      closing_balance: closing,
      total_credits: Number(totalCredits.toFixed(2)),
      total_debits: Number(totalDebits.toFixed(2)),
      net_change: Number((closing - opening).toFixed(2)),
      transactions: items
    };
  }

  async getDailyAccountsSummary(date) {
    try {
      const res = await api.get('/accounts/daily-summary', { params: { date } });
      if (res && res.data) return res.data;
    } catch (e) {
      console.warn('Failed to fetch daily summary from API:', e.message);
    }
    return { date, accounts: [], totals: { total_opening: 0, total_credits: 0, total_debits: 0, total_closing: 0, net_change: 0 } };
  }

  async adjustAccountBalance(data) {
    // data: { account_id, new_balance, reason, date }
    // Web mode: use backend API. Electron/IDB fallback: direct SQL.
    if (!window?.electronAPI) {
      const res = await api.post('/accounts/adjust', data);
      return res.data;
    }
    const { account_id, new_balance } = data;
    const rows = await this.query('SELECT current_balance FROM accounts WHERE id = ?', [account_id]);
    const current = Number(rows?.[0]?.current_balance) || 0;
    const delta = Number(new_balance) - current;
    return this.query('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?', [delta, account_id]);
  }

  async deductFromAccount(id, amount) {
    return this.query('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?', [amount, id]);
  }

  async transferBetweenAccounts(data) {
    return this.transferFunds(data);
  }

  async createTransaction(data) {
    const res = await api.post('/accounts/transactions', data).catch(() => ({ data }));
    return res.data || data;
  }

  async setDailyOpeningBalance(data) {
    try {
      const res = await api.post('/accounts/daily-opening', data);
      return res.data;
    } catch (e) {
      console.warn('Failed to set daily opening balance:', e.message);
      return false;
    }
  }

  async clearCheque(id) {
    return true;
  }

  async deleteExpenseCategory(id) {
    const res = await api.delete(`/expenses/categories/${id}`).catch(() => ({ success: true }));
    return res.success;
  }

  // ==================== CUSTOMER & SUPPLIER EXTRAS ====================
  async addCustomerLedgerEntry(entry) {
    if (!entry) return entry;
    if (entry.type === 'payment' || entry.amount < 0 || !entry.isDebit) {
      return this.addCustomerPayment(entry.customer_id, {
        amount: Math.abs(entry.amount),
        payment_mode: entry.payment_mode || 'cash',
        reference_no: entry.reference_no,
        description: entry.description,
        date: entry.date
      });
    }
    return entry;
  }

  async deleteCustomerLedgerEntry(id) {
    return this.query('DELETE FROM customer_ledger WHERE id = ?', [id]);
  }

  async getCustomerSalesHistory(customerId) {
    return this.getSales({ customerId });
  }

  async getCustomerTotalStats(customerId) {
    const res = await this.query(
      'SELECT COUNT(*) as total_orders, COALESCE(SUM(grand_total), 0) as total_spent FROM sales WHERE customer_id = ? AND is_deleted = 0',
      [customerId]
    );
    return res[0] || { total_orders: 0, total_spent: 0 };
  }

  async getSupplierPurchaseLedger(supplierId) {
    return this.getSupplierLedger(supplierId);
  }

  // ==================== DISTRIBUTORS ====================
  async getAllDistributors() {
    return this.getDistributors();
  }

  async addDistributor(data) {
    return this.createDistributor(data);
  }

  async addDistributorOrder(data) {
    return this.createDistributorOrder(data);
  }

  async getDistributorOrderById(id) {
    const res = await api.get(`/distributors/orders/${id}`).catch(() => ({ data: null }));
    return res.data;
  }

  async updateDistributorOrderStatus(id, status) {
    return this.updateDistributorOrder(id, { status });
  }

  async addDistributorPayment(data) {
    const res = await api.post(`/distributors/${data.distributor_id || data.distributorId}/payments`, data).catch(() => ({ data }));
    return res.data;
  }

  async addDistributorReturn(data) {
    const res = await api.post('/distributors/returns', data).catch(() => ({ data }));
    return res.data;
  }

  async getDistributorReturns(distributorId) {
    const res = await api.get('/distributors/returns', distributorId ? { distributorId } : {}).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async getDistributorBalance(id) {
    const dist = await this.getDistributorById(id);
    return dist?.balance || 0;
  }

  async getDistributorStats(id) {
    return {};
  }

  // ==================== SALESMEN ====================
  async getAllSalesmen() {
    return this.getSalesmen();
  }

  async addSalesmanSale(data) {
    return this.createSale(data);
  }

  async getSalesmanSaleById(id) {
    return this.getSaleById(id);
  }

  async addSalesmanSaleReturn(data) {
    return this.createSaleReturn(data);
  }

  async addSalesmanSalaryPayment(data) {
    const res = await api.post(`/salesmen/${data.salesman_id || data.salesmanId}/salaries`, data).catch(() => ({ data }));
    return res.data;
  }

  async getSalesmanSalaryPayments(salesmanId) {
    const res = await api.get(`/salesmen/${salesmanId}/salaries`).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async addSalesmanAdvance(data) {
    const res = await api.post(`/salesmen/${data.salesman_id || data.salesmanId}/advances`, data).catch(() => ({ data }));
    return res.data;
  }

  async repayAdvance(id, amount) {
    return true;
  }

  async getCommissionPayouts(salesmanId) {
    const res = await api.get(`/salesmen/${salesmanId}/commissions`).catch(() => ({ data: [] }));
    return res.data || [];
  }

  async addCommissionPayout(data) {
    const res = await api.post(`/salesmen/${data.salesman_id || data.salesmanId}/commissions`, data).catch(() => ({ data }));
    return res.data;
  }

  async getPendingCommissions(salesmanId) {
    return [];
  }

  async getSalesmanBalance(salesmanId) {
    const s = await this.getSalesmanById(salesmanId);
    return s?.commission_balance || 0;
  }

  async getSalesmanStats(salesmanId) {
    return {};
  }

  // ==================== SERVICES ====================
  async updateWorkOrderStatus(id, status) {
    const res = await api.put(`/services/orders/${id}/status`, { status }).catch(() => ({}));
    return res.data;
  }

  async getStaffById(id) {
    return this.getUserById(id);
  }

  async getVisitLogs(orderId) {
    return [];
  }

  // ==================== OFFERS & DEALS ====================
  async addOffer(data) {
    return this.createOffer(data);
  }

  async updateOffer(id, data) {
    const res = await api.put(`/offers/${id}`, data).catch(() => ({ data }));
    return res.data;
  }

  async addOfferItem(data) {
    return data;
  }

  async getOfferItems(offerId) {
    return [];
  }

  async deleteOfferItems(offerId) {
    return true;
  }

  // ==================== MISC ====================
  async getTaxSummary() {
    return {};
  }

  async updateFBRStatus(id, status) {
    return true;
  }

  async getNextInvoiceNumber() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomNum}`;
  }

  async getDatabaseStats() {
    return { version: 'MySQL 8.0' };
  }

  getActiveShopId() {
    return localStorage.getItem('raath_shop_id') || 'shop_1';
  }

  // ==================== NO-OP STUBS FOR RETIRED SYNC ====================
  async syncFromCloud() {
    return { success: true, message: 'Direct MySQL connected' };
  }

  async clearAllData() {
    return true;
  }
}

export const db = new DatabaseClient();
if (typeof window !== 'undefined') {
  window.db = db;
}
export default db;
