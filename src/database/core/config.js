// ============================================================
//  config.js - Environment & Database Configuration
// ============================================================

// ==================== ENVIRONMENT DETECTION ====================
export const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// ==================== SYNC CONTROLLER ====================
export const SYNC_ENABLED = !isElectron;

console.log(`[Storage] Mode: ${isElectron ? 'ELECTRON' : 'BROWSER'}`);
console.log(`[Storage] Cloud Sync: ${SYNC_ENABLED ? 'ENABLED ✅' : 'DISABLED ❌'}`);

// ==================== INDEXEDDB CONFIG ====================
export const DB_NAME = 'RAATH_POS_DEMO';
export const DB_VERSION = 21;

export const STORES = [
  'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
  'suppliers', 'purchases', 'purchase_items', 
  'purchase_returns', 'purchase_return_items',
  'customers', 'sales', 'sale_items',
  'sale_returns', 'sale_return_items', 'expense_categories', 'expenses',
  'customer_ledger', 'supplier_ledger', 'payments', 'general_ledger', 
  'emis', 'emi_payments',
  'users', 'roles', 'warehouses', 'warehouse_stocks', 'offers', 'offer_items',
  'services', 'staff', 'work_orders', 'ledger', 'fbr_invoices',
  'salesmen', 'salesman_sales', 'salesman_sale_items', 'customer_sales_history',
  'accounts',
  'account_transactions',
  'account_daily_balances'
];