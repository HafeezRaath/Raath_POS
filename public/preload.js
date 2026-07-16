const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== ELECTRON MODE FLAG (CRITICAL FIX) =====
  isElectron: true,

  // Generic query
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),

  // Brands
  getBrands: () => ipcRenderer.invoke('db:getBrands'),
  addBrand: (data) => ipcRenderer.invoke('db:addBrand', data),
  updateBrand: (id, data) => ipcRenderer.invoke('db:updateBrand', id, data),
  deleteBrand: (id) => ipcRenderer.invoke('db:deleteBrand', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addCategory: (data) => ipcRenderer.invoke('db:addCategory', data),
  updateCategory: (id, data) => ipcRenderer.invoke('db:updateCategory', id, data),
  deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

  // Products
  getProducts: () => ipcRenderer.invoke('db:getProducts'),
  getProductById: (id) => ipcRenderer.invoke('db:getProductById', id),
  getProductVariants: (productId) => ipcRenderer.invoke('db:getProductVariants', productId),
  getAllVariants: () => ipcRenderer.invoke('db:getAllVariants'),
  getVariantBySKU: (sku) => ipcRenderer.invoke('db:getVariantBySKU', sku),
  getVariantById: (id) => ipcRenderer.invoke('db:getVariantById', id),
  addProduct: (data) => ipcRenderer.invoke('db:addProduct', data),
  createVariant: (data) => ipcRenderer.invoke('db:createVariant', data),
  updateProduct: (id, data) => ipcRenderer.invoke('db:updateProduct', id, data),
  updateVariant: (id, data) => ipcRenderer.invoke('db:updateVariant', id, data),
  updateVariantStock: (id, qty) => ipcRenderer.invoke('db:updateVariantStock', id, qty),
  deleteVariant: (id) => ipcRenderer.invoke('db:deleteVariant', id),
  deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

  // Serialized Items (IMEI)
  addSerializedItem: (variantId, imei) => ipcRenderer.invoke('db:addSerializedItem', variantId, imei),
  addMultipleSerializedItems: (variantId, imeis) => ipcRenderer.invoke('db:addMultipleSerializedItems', variantId, imeis),
  getSerializedItems: (variantId) => ipcRenderer.invoke('db:getSerializedItems', variantId),
  updateSerializedItemStatus: (id, status, saleId) => ipcRenderer.invoke('db:updateSerializedItemStatus', id, status, saleId),

  // Price History
  getPriceHistory: (variantId, limit) => ipcRenderer.invoke('db:getPriceHistory', variantId, limit),

  // Customers
  getCustomers: () => ipcRenderer.invoke('db:getCustomers'),
  getCustomerById: (id) => ipcRenderer.invoke('db:getCustomerById', id),
  addCustomer: (data) => ipcRenderer.invoke('db:addCustomer', data),
  updateCustomer: (id, data) => ipcRenderer.invoke('db:updateCustomer', id, data),
  deleteCustomer: (id) => ipcRenderer.invoke('db:deleteCustomer', id),

  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('db:getSuppliers'),
  getSupplierById: (id) => ipcRenderer.invoke('db:getSupplierById', id),
  addSupplier: (data) => ipcRenderer.invoke('db:addSupplier', data),
  updateSupplier: (id, data) => ipcRenderer.invoke('db:updateSupplier', id, data),
  deleteSupplier: (id) => ipcRenderer.invoke('db:deleteSupplier', id),
  updateSupplierBalance: (supplierId, amount) => ipcRenderer.invoke('db:updateSupplierBalance', supplierId, amount),
  addLedgerEntry: (data) => ipcRenderer.invoke('db:addLedgerEntry', data),

  // Purchases
  getPurchases: () => ipcRenderer.invoke('db:getPurchases'),
  getPurchaseById: (id) => ipcRenderer.invoke('db:getPurchaseById', id),
  getPurchaseItems: (purchaseId) => ipcRenderer.invoke('db:getPurchaseItems', purchaseId),
  addPurchase: (data) => ipcRenderer.invoke('db:addPurchase', data),
  addPurchaseItem: (data) => ipcRenderer.invoke('db:addPurchaseItem', data),
  updatePurchase: (id, data) => ipcRenderer.invoke('db:updatePurchase', id, data),
  deletePurchase: (id) => ipcRenderer.invoke('db:deletePurchase', id),

  // Sales
  createSale: (data) => ipcRenderer.invoke('db:createSale', data),
  getSalesHistory: () => ipcRenderer.invoke('db:getSalesHistory'),
  getSaleById: (id) => ipcRenderer.invoke('db:getSaleById', id),
  getSaleItems: (saleId) => ipcRenderer.invoke('db:getSaleItems', saleId),
  deleteSale: (id) => ipcRenderer.invoke('db:deleteSale', id),

  // Deals
  getDeals: () => ipcRenderer.invoke('db:getDeals'),
  getDealById: (id) => ipcRenderer.invoke('db:getDealById', id),
  addDeal: (data) => ipcRenderer.invoke('db:addDeal', data),
  updateDeal: (id, data) => ipcRenderer.invoke('db:updateDeal', id, data),
  deleteDeal: (id) => ipcRenderer.invoke('db:deleteDeal', id),
  hardDeleteDeal: (id) => ipcRenderer.invoke('db:hardDeleteDeal', id),

  // Offers
  getOffers: () => ipcRenderer.invoke('db:getOffers'),
  getOfferById: (id) => ipcRenderer.invoke('db:getOfferById', id),
  addOffer: (data) => ipcRenderer.invoke('db:addOffer', data),
  updateOffer: (id, data) => ipcRenderer.invoke('db:updateOffer', id, data),
  deleteOffer: (id) => ipcRenderer.invoke('db:deleteOffer', id),
  getOfferItems: (offerId) => ipcRenderer.invoke('db:getOfferItems', offerId),
  addOfferItem: (data) => ipcRenderer.invoke('db:addOfferItem', data),
  deleteOfferItems: (offerId) => ipcRenderer.invoke('db:deleteOfferItems', offerId),

  // Expenses
  getExpenses: () => ipcRenderer.invoke('db:getExpenses'),
  addExpense: (data) => ipcRenderer.invoke('db:addExpense', data),

  // Payments
  getPayments: () => ipcRenderer.invoke('db:getPayments'),

  // Reports
  getSalesReport: (fromDate, toDate) => ipcRenderer.invoke('db:getSalesReport', fromDate, toDate),
  getTopSellingProducts: (fromDate, toDate, limit) => ipcRenderer.invoke('db:getTopSellingProducts', fromDate, toDate, limit),

  // General Ledger
  logToGeneralLedger: (type, referenceId, debit, credit, description) => 
    ipcRenderer.invoke('db:logToGeneralLedger', type, referenceId, debit, credit, description),

  // Users
  getUsers: () => ipcRenderer.invoke('db:getUsers'),
  getUserByEmail: (email) => ipcRenderer.invoke('db:getUserByEmail', email),
  verifyUser: (email, password) => ipcRenderer.invoke('db:verifyUser', email, password),

  // Backup
  getDbInfo: () => ipcRenderer.invoke('get-db-info'),
  createLocalBackup: () => ipcRenderer.invoke('create-local-backup'),
  sendBackupEmail: (config) => ipcRenderer.invoke('send-backup-email', config),
  restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
  updateBackupSettings: (settings) => ipcRenderer.invoke('update-backup-settings', settings),
  loadBackupSettings: () => ipcRenderer.invoke('load-backup-settings'),
  selectBackupFile: () => ipcRenderer.invoke('select-backup-file'),

  // Services
  getServices: () => ipcRenderer.invoke('db:getServices'),
  getServiceById: (id) => ipcRenderer.invoke('db:getServiceById', id),
  addService: (data) => ipcRenderer.invoke('db:addService', data),
  updateService: (id, data) => ipcRenderer.invoke('db:updateService', id, data),
  deleteService: (id) => ipcRenderer.invoke('db:deleteService', id),

  // Staff
  getStaff: () => ipcRenderer.invoke('db:getStaff'),
  getStaffById: (id) => ipcRenderer.invoke('db:getStaffById', id),
  addStaff: (data) => ipcRenderer.invoke('db:addStaff', data),
  updateStaff: (id, data) => ipcRenderer.invoke('db:updateStaff', id, data),
  deleteStaff: (id) => ipcRenderer.invoke('db:deleteStaff', id),

  // Work Orders
  getWorkOrders: (filters) => ipcRenderer.invoke('db:getWorkOrders', filters),
  getWorkOrderById: (id) => ipcRenderer.invoke('db:getWorkOrderById', id),
  addWorkOrder: (data) => ipcRenderer.invoke('db:addWorkOrder', data),
  updateWorkOrder: (id, data) => ipcRenderer.invoke('db:updateWorkOrder', id, data),
  deleteWorkOrder: (id) => ipcRenderer.invoke('db:deleteWorkOrder', id),
});