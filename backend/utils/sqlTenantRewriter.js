// ============================================================
//  backend/utils/sqlTenantRewriter.js - Tenant Query Rewriter
// ============================================================

const TENANT_TABLES = new Set([
  'account_daily_balances', 'account_transactions', 'accounts', 'audit_logs',
  'brands', 'categories', 'customer_emi_summary', 'customer_ledger',
  'customer_sales_history', 'customers', 'deals', 'distributor_ledger',
  'distributor_order_items', 'distributor_orders', 'distributor_payments',
  'distributor_return_items', 'distributor_returns', 'distributors',
  'emi_documents', 'emi_guarantors', 'emi_payments', 'emi_penalty_rules',
  'emi_records', 'emi_reschedule_log', 'emi_schedule', 'emi_visit_log',
  'emis', 'expense_categories', 'expenses', 'fbr_invoices', 'general_ledger',
  'offer_items', 'offers', 'payments', 'product_serialized_items',
  'product_variants', 'products', 'purchase_items', 'purchase_return_items',
  'purchase_returns', 'purchases', 'sale_items', 'sale_return_items',
  'sale_returns', 'sales', 'salesman_advances', 'salesman_commission_payouts',
  'salesman_ledger', 'salesman_salary_payments', 'salesman_sale_items',
  'salesman_sale_return_items', 'salesman_sale_returns', 'salesman_sales',
  'salesmen', 'services', 'staff', 'supplier_ledger', 'suppliers',
  'system_settings', 'users', 'warehouse_stocks', 'warehouses', 'work_orders'
]);

/**
 * Rewrites dynamic SQL query to inject tenant_id condition safely
 */
function rewriteQueryForTenant(sql, params = [], tenantId = 'tenant_default') {
  if (!sql || typeof sql !== 'string') {
    return { sql, params };
  }

  let cleanSql = sql
    .replace(/date\('now',\s*'\+7 days'\)/gi, 'DATE_ADD(CURDATE(), INTERVAL 7 DAY)')
    .replace(/date\('now'\)/gi, 'CURDATE()')
    .trim();

  // If already contains tenant_id condition, don't modify
  if (/\btenant_id\b/i.test(cleanSql)) {
    return { sql: cleanSql, params: Array.isArray(params) ? params : [] };
  }

  // Detect which tables are in the query
  const fromRegex = /\b(?:FROM|JOIN|UPDATE)\s+`?([a-zA-Z0-9_]+)`?(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi;
  let match;
  const tableMatches = [];
  while ((match = fromRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    const alias = match[2] && !['where', 'on', 'join', 'left', 'inner', 'right', 'cross', 'order', 'group', 'limit', 'set'].includes(match[2].toLowerCase()) 
      ? match[2] 
      : null;
    if (TENANT_TABLES.has(tableName)) {
      tableMatches.push({ table: tableName, ref: alias || tableName });
    }
  }

  if (tableMatches.length === 0) {
    return { sql: cleanSql, params: Array.isArray(params) ? params : [] };
  }

  // Use the primary / first tenant table matched
  const primary = tableMatches[0];
  const tenantCondition = `\`${primary.ref}\`.\`tenant_id\` = ?`;

  let newParams = [...(Array.isArray(params) ? params : [])];

  // If query is an UPDATE query
  if (/^\s*UPDATE\b/i.test(cleanSql)) {
    if (/\bWHERE\b/i.test(cleanSql)) {
      cleanSql = cleanSql.replace(/\bWHERE\b/i, `WHERE ${tenantCondition} AND `);
    } else {
      cleanSql += ` WHERE ${tenantCondition}`;
    }
    const whereIdx = cleanSql.indexOf('WHERE');
    const beforeWhere = cleanSql.substring(0, whereIdx);
    const countBefore = (beforeWhere.match(/\?/g) || []).length;
    newParams.splice(countBefore, 0, tenantId);
    return { sql: cleanSql, params: newParams };
  }

  // If query has WHERE:
  if (/\bWHERE\b/i.test(cleanSql)) {
    cleanSql = cleanSql.replace(/\bWHERE\b/i, `WHERE ${tenantCondition} AND `);
    newParams.unshift(tenantId);
  } else if (/\b(GROUP\s+BY|ORDER\s+BY|LIMIT)\b/i.test(cleanSql)) {
    cleanSql = cleanSql.replace(/\b(GROUP\s+BY|ORDER\s+BY|LIMIT)\b/i, `WHERE ${tenantCondition} $1`);
    newParams.push(tenantId);
  } else {
    cleanSql += ` WHERE ${tenantCondition}`;
    newParams.push(tenantId);
  }

  return { sql: cleanSql, params: newParams };
}

module.exports = {
  rewriteQueryForTenant,
  TENANT_TABLES
};
