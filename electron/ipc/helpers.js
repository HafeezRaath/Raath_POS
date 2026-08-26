const { log, LOG_LEVELS } = require('../utils/logger');

/**
 * IPC handler wrapper — catches errors and returns standardized response
 */
function createHandler(handler) {
  return async (event, ...args) => {
    try {
      const result = await handler(event, ...args);
      return { success: true, data: result };
    } catch (error) {
      log(LOG_LEVELS.ERROR, `Handler error: ${handler.name || 'anonymous'}`, error);
      return {
        success: false,
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR'
      };
    }
  };
}

// ==================== SQL QUERY SECURITY ====================
const ALLOWED_SELECT_PATTERNS = [
  /^SELECT\s+.*?\s+FROM\s+(brands|categories|products|product_variants|product_serialized_items|suppliers|purchases|purchase_items|purchase_returns|purchase_return_items|warehouses|warehouse_stocks|customers|sales|sale_items|sale_returns|sale_return_items|general_ledger|emi_records|emi_payments|emi_guarantors|emi_visit_log|emi_documents|expense_categories|expenses|payments|users|roles|deals|offers|offer_items|services|staff|work_orders|salesmen|salesman_sales|salesman_sale_items|customer_sales_history|customer_ledger|fbr_invoices|audit_logs|system_settings)\s+(WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|HAVING|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|CROSS JOIN)/i,
  /^SELECT\s+(DISTINCT\s+)?(COUNT|SUM|AVG|MAX|MIN|GROUP_CONCAT)\(.*?\)\s+FROM\s+(brands|categories|products|product_variants|product_serialized_items|suppliers|purchases|purchase_items|purchase_returns|purchase_return_items|warehouses|warehouse_stocks|customers|sales|sale_items|sale_returns|sale_return_items|general_ledger|emi_records|emi_payments|emi_guarantors|emi_visit_log|emi_documents|expense_categories|expenses|payments|users|roles|deals|offers|offer_items|services|staff|work_orders|salesmen|salesman_sales|salesman_sale_items|customer_sales_history|customer_ledger|fbr_invoices|audit_logs|system_settings)\s+(WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|HAVING|JOIN)/i,
  /^SELECT\s+sqlite_master\b/i,
  /^PRAGMA\s+(table_info|index_info|foreign_key_list|database_list|table_list|function_list|collation_list)/i,
  /^WITH\s+.*?\s+SELECT\s+.*?\s+FROM\s+(brands|categories|products|product_variants|product_serialized_items|suppliers|purchases|purchase_items|purchase_returns|purchase_return_items|warehouses|warehouse_stocks|customers|sales|sale_items|sale_returns|sale_return_items|general_ledger|emi_records|emi_payments|emi_guarantors|emi_visit_log|emi_documents|expense_categories|expenses|payments|users|roles|deals|offers|offer_items|services|staff|work_orders|salesmen|salesman_sales|salesman_sale_items|customer_sales_history|customer_ledger|fbr_invoices|audit_logs|system_settings)\b/i
];

function isAllowedQuery(sql) {
  const clean = sql.trim();
  return ALLOWED_SELECT_PATTERNS.some(p => p.test(clean));
}

function sanitizeQueryParam(param) {
  if (typeof param === 'string') {
    return param.replace(/['";()]/g, '');
  }
  if (typeof param === 'number' && !isFinite(param)) {
    return 0;
  }
  return param;
}

// ==================== COMMON VALIDATION HELPERS ====================
function requiredId(val, fieldName = 'id') {
  const id = Number(val);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return id;
}

function positiveQty(val, fieldName = 'quantity') {
  const qty = Number(val);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return qty;
}

function finiteMoney(val, fieldName = 'amount') {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a valid number`);
  return n;
}

function normalizeOptional(val) {
  return val === undefined || val === null ? null : val;
}

function safeJsonParse(json, fallback = []) {
  try { return JSON.parse(json); } catch { return fallback; }
}

module.exports = {
  createHandler,
  isAllowedQuery,
  sanitizeQueryParam,
  requiredId,
  positiveQty,
  finiteMoney,
  normalizeOptional,
  safeJsonParse
};