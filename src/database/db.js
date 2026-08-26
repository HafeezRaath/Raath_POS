// ============================================================
//  db.js — Main Export (Aggregator + Aliases)
// ============================================================

import { Storage } from './db-core.js';

// --- Feature Modules ---
import { attachBrandMethods } from './db-brands.js';
import { attachCategoryMethods } from './db-categories.js';
import { attachProductMethods } from './db-products.js';
import { attachCustomerMethods } from './db-customers.js';
import { attachSupplierMethods } from './db-suppliers.js';
import { attachPurchaseMethods } from './db-purchases.js';
import { attachSalesMethods } from './db-sales.js';
import { attachPaymentMethods } from './db-payments.js';
import { attachWarehouseMethods } from './db-warehouses.js';
import { attachSerializedMethods } from './db-serialized.js';
import { attachExpenseMethods } from './db-expenses.js';
import { attachAccountingMethods } from './db-accounting.js';
import { attachDashboardMethods } from './db-dashboard.js';
import { attachEMIMethods } from './db-emi.js';
import { attachUserMethods } from './db-users.js';
import { attachRoleMethods } from './db-roles.js';
import { attachOfferMethods } from './db-offers.js';
import { attachServiceMethods } from './db-services.js';
import { attachSalesmanMethods } from './db-salesman.js';
import { attachFBRMethods } from './db-fbr.js';
import { attachCloudSyncMethods } from './db-cloud-sync.js';
import { attachAccountMethods } from './db-accounts.js';

// --- Attach all methods to Storage prototype ---
attachBrandMethods(Storage);
attachCategoryMethods(Storage);
attachProductMethods(Storage);
attachCustomerMethods(Storage);
attachSupplierMethods(Storage);
attachPurchaseMethods(Storage);
attachSalesMethods(Storage);
attachPaymentMethods(Storage);
attachWarehouseMethods(Storage);
attachSerializedMethods(Storage);
attachExpenseMethods(Storage);
attachAccountingMethods(Storage);
attachDashboardMethods(Storage);
attachEMIMethods(Storage);
attachUserMethods(Storage);
attachRoleMethods(Storage);
attachOfferMethods(Storage);
attachServiceMethods(Storage);
attachSalesmanMethods(Storage);
attachFBRMethods(Storage);
attachCloudSyncMethods(Storage);
attachAccountMethods(Storage); 

// ==================== BACKWARD COMPATIBILITY ALIASES ====================
Storage.prototype.addCategory       = function(data) { return this.createCategory(data); };
Storage.prototype.addBrand          = function(data) { return this.createBrand(data); };
Storage.prototype.addCustomer       = function(data) { return this.createCustomer(data); };
Storage.prototype.addSupplier       = function(data) { return this.createSupplier(data); };
Storage.prototype.addWarehouse      = function(data) { return this.createWarehouse(data); };
Storage.prototype.addExpenseCategory= function(data) { return this.createExpenseCategory(data); };
Storage.prototype.addExpense        = function(data) { return this.createExpense(data); };
Storage.prototype.addService        = function(data) { return this.createService(data); };
Storage.prototype.addStaff          = function(data) { return this.createStaff(data); };
Storage.prototype.addWorkOrder      = function(data) { return this.createWorkOrder(data); };
Storage.prototype.addEMI            = function(data) { return this.createEMI(data); };
Storage.prototype.addRole           = function(data) { return this.createRole(data); };
Storage.prototype.addSale           = function(data) { return this.createSale(data); };
Storage.prototype.addSaleReturn     = function(data) { return this.createSaleReturn(data); };
Storage.prototype.addSaleReturnItem = function(data) { return this.createSaleReturnItem(data); };
Storage.prototype.addPurchase       = function(data) { return this.createPurchase(data); };
Storage.prototype.addPurchaseItem   = function(data) { return this.createPurchaseItem(data); };
Storage.prototype.createSalesman    = function(data) { return this.addSalesman(data); };
Storage.prototype.addSalesmanSale   = function(data) { return this.addSalesmanSale(data); };

// ==================== EXPORT ====================
const db = new Storage();
export default db;