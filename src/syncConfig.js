// ============================================================
//  syncConfig.js — Route-Based Lazy Sync Configuration
//  Kisi bhi page pe sirf usi ka data sync ho, baqi background mein
// ============================================================

// ==================== ROUTE → COLLECTIONS MAP ====================
// Har route ke liye sirf zaroori collections define karo
export const ROUTE_COLLECTIONS = {
  // Dashboard: Sirf summary chahiye
  '/dashboard': [
    'products',
    'sales',
    'customers',
    'suppliers',
    'expenses',
    'payments'
  ],

  // POS: Products, customers, offers chahiye immediately
  '/pos': [
    'products',
    'product_variants',
    'customers',
    'offers',
    'offer_items',
    'categories',
    'brands'
  ],

  // Products page
  '/products': [
    'products',
    'product_variants',
    'product_serialized_items',
    'categories',
    'brands',
    'suppliers',
    'warehouses',
    'warehouse_stocks'
  ],

  // Sales page
  '/sales': [
    'sales',
    'sale_items',
    'customers',
    'salesmen',
    'payments'
  ],

  // Sale Returns
  '/sale-returns': [
    'sale_returns',
    'sale_return_items',
    'sales',
    'sale_items',
    'customers',
    'products',
    'product_variants'
  ],

  // Purchases page
  '/purchases': [
    'purchases',
    'purchase_items',
    'suppliers',
    'products',
    'product_variants'
  ],

  // Purchase Returns
  '/purchase-returns': [
    'purchase_returns',
    'purchase_return_items',
    'purchases',
    'purchase_items',
    'suppliers',
    'products',
    'product_variants'
  ],

  // Inventory / Stock
  '/inventory': [
    'products',
    'product_variants',
    'warehouse_stocks',
    'warehouses',
    'categories',
    'brands'
  ],

  // Customers page
  '/customers': [
    'customers',
    'customer_ledger',
    'sales',
    'payments',
    'emis',
    'emi_payments'
  ],

  // Suppliers page
  '/suppliers': [
    'suppliers',
    'supplier_ledger',
    'purchases',
    'payments'
  ],

  // Expenses page
  '/expenses': [
    'expenses',
    'expense_categories',
    'payments'
  ],

  // Reports / Ledger
  '/ledger': [
    'ledger',
    'general_ledger',
    'customer_ledger',
    'supplier_ledger',
    'sales',
    'purchases',
    'payments',
    'expenses'
  ],

  // Settings
  '/settings': [
    'users',
    'roles',
    'warehouses'
  ],

  // Staff / Services
  '/staff': [
    'staff',
    'services',
    'work_orders'
  ],

  // Services
  '/services': [
    'services',
    'staff',
    'work_orders',
    'products',
    'product_variants'
  ],

  // Work Orders
  '/work-orders': [
    'work_orders',
    'services',
    'staff',
    'customers',
    'products',
    'product_variants'
  ],

  // Offers
  '/offers': [
    'offers',
    'offer_items',
    'products',
    'product_variants',
    'categories'
  ],

  // EMI
  '/emi': [
    'emis',
    'emi_payments',
    'customers',
    'sales'
  ],

  // FBR
  '/fbr': [
    'fbr_invoices',
    'sales',
    'sale_items'
  ],

  // Salesman
  '/salesman': [
    'salesmen',
    'salesman_sales',
    'salesman_sale_items',
    'customer_sales_history',
    'sales',
    'customers'
  ],

  // Users
  '/users': [
    'users',
    'roles'
  ]
};

// ==================== PRIORITY LEVELS ====================
// Kaunse collections sabse pehle sync hone chahiye
export const COLLECTION_PRIORITY = {
  CRITICAL: ['users', 'roles'],                          // Login ke baad immediately
  HIGH: ['products', 'product_variants', 'customers'],     // POS/Dashboard ke liye
  MEDIUM: ['sales', 'purchases', 'categories', 'brands'],   // Reports ke liye
  LOW: [
    'ledger', 'general_ledger', 'customer_ledger', 'supplier_ledger',
    'customer_sales_history', 'fbr_invoices', 'emi_payments'
  ] // Baad mein chalega
};

// ==================== COLLECTION PRIORITY MAP ====================
export const getCollectionPriority = (collectionName) => {
  if (COLLECTION_PRIORITY.CRITICAL.includes(collectionName)) return 1;
  if (COLLECTION_PRIORITY.HIGH.includes(collectionName)) return 2;
  if (COLLECTION_PRIORITY.MEDIUM.includes(collectionName)) return 3;
  return 4; // LOW
};

// ==================== ROUTE MATCHER ====================
// Exact match na mile to closest match karega
export const getCollectionsForRoute = (pathname) => {
  // Exact match
  if (ROUTE_COLLECTIONS[pathname]) {
    return ROUTE_COLLECTIONS[pathname];
  }

  // Partial match — longest match wins
  const matchingRoutes = Object.keys(ROUTE_COLLECTIONS)
    .filter(route => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length);

  if (matchingRoutes.length > 0) {
    return ROUTE_COLLECTIONS[matchingRoutes[0]];
  }

  // Fallback: sirf critical + high priority
  return [...COLLECTION_PRIORITY.CRITICAL, ...COLLECTION_PRIORITY.HIGH];
};

// ==================== ALL COLLECTIONS (for full sync) ====================
export const ALL_COLLECTIONS = [
  'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
  'customers', 'suppliers', 'purchases', 'purchase_items',
  'purchase_returns', 'purchase_return_items',
  'sales', 'sale_items', 'sale_returns', 'sale_return_items',
  'expense_categories', 'expenses', 'payments',
  'customer_ledger', 'supplier_ledger', 'general_ledger', 'ledger',
  'users', 'roles', 'warehouses', 'warehouse_stocks',
  'offers', 'offer_items',
  'services', 'staff', 'work_orders',
  'emis', 'emi_payments',
  'fbr_invoices',
  'salesmen', 'salesman_sales', 'salesman_sale_items', 'customer_sales_history'
];

export default {
  ROUTE_COLLECTIONS,
  COLLECTION_PRIORITY,
  getCollectionsForRoute,
  getCollectionPriority,
  ALL_COLLECTIONS
};