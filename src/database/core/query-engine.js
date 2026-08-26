// ============================================================
//  query-engine.js - Browser SQL Query Engine for IndexedDB
// ============================================================

import { idbGetAll, idbAdd, idbPut, idbDelete } from './idb-core.js';

// ==================== MAIN ROUTER ====================
export async function browserQuery(sql, params = []) {
  const cleanSql = sql.trim().toLowerCase();

  if (cleanSql.startsWith('select')) {
    return handleSelect(sql, params);
  }
  if (cleanSql.startsWith('insert')) {
    return handleInsert(sql, params);
  }
  if (cleanSql.startsWith('update')) {
    return handleUpdate(sql, params);
  }
  if (cleanSql.startsWith('delete')) {
    return handleDelete(sql, params);
  }

  console.warn('[Storage] Unsupported query in browser mode:', sql);
  return [];
}

// ==================== SELECT ====================
async function handleSelect(sql, params) {
  const tableMatch = sql.match(/from\s+(\w+)/i);
  if (!tableMatch) {
    console.warn('[Storage] Could not parse table from SELECT:', sql);
    return [];
  }

  const tableName = tableMatch[1];
  let results = await idbGetAll(tableName);
  
  const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
  if (whereMatch) {
    results = applyWhereFilter(results, whereMatch[1], params);
  }

  const orderMatch = sql.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
  if (orderMatch) {
    results = applyOrderBy(results, orderMatch[1]);
  }

  const limitMatch = sql.match(/limit\s+(\d+)/i);
  if (limitMatch) {
    results = results.slice(0, parseInt(limitMatch[1]));
  }

  return results;
}

// ==================== WHERE FILTER ====================
function applyWhereFilter(data, whereClause, params) {
  return data.filter(item => {
    const conditions = whereClause.split(/\s+and\s+/i);
    
    for (const condition of conditions) {
      const trimmed = condition.trim();
      
      const eqMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (eqMatch) {
        const [, field, value] = eqMatch;
        const cleanValue = value.replace(/['"]/g, '').trim();
        const paramIndex = parseInt(cleanValue.replace('?', ''));
        const actualValue = !isNaN(paramIndex) ? params[paramIndex] : cleanValue;
        
        if (String(item[field]) !== String(actualValue)) {
          return false;
        }
        continue;
      }

      const likeMatch = trimmed.match(/^(\w+)\s+like\s+(.+)$/i);
      if (likeMatch) {
        const [, field, value] = likeMatch;
        const cleanValue = value.replace(/['"]/g, '').replace(/%/g, '').trim();
        const paramIndex = parseInt(cleanValue.replace('?', ''));
        const actualValue = !isNaN(paramIndex) ? params[paramIndex] : cleanValue;
        
        if (!String(item[field]).toLowerCase().includes(String(actualValue).toLowerCase())) {
          return false;
        }
        continue;
      }

      const compareMatch = trimmed.match(/^(\w+)\s*(>=|<=|>|<)\s*(.+)$/);
      if (compareMatch) {
        const [, field, operator, value] = compareMatch;
        const cleanValue = value.replace(/['"]/g, '').trim();
        const paramIndex = parseInt(cleanValue.replace('?', ''));
        const actualValue = !isNaN(paramIndex) ? params[paramIndex] : cleanValue;
        const itemValue = Number(item[field]);
        const compareValue = Number(actualValue);
        
        const comparisons = {
          '>': itemValue > compareValue,
          '<': itemValue < compareValue,
          '>=': itemValue >= compareValue,
          '<=': itemValue <= compareValue,
        };
        
        if (!comparisons[operator]) return false;
        continue;
      }
    }
    
    return true;
  });
}

// ==================== ORDER BY ====================
function applyOrderBy(data, orderClause) {
  const parts = orderClause.trim().split(/\s+/);
  const field = parts[0];
  const direction = parts[1]?.toLowerCase() === 'desc' ? -1 : 1;
  
  return [...data].sort((a, b) => {
    const aVal = a[field] || 0;
    const bVal = b[field] || 0;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction * aVal.localeCompare(bVal);
    }
    return direction * (aVal - bVal);
  });
}

// ==================== INSERT ====================
async function handleInsert(sql, params) {
  const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('[Storage] Could not parse INSERT table');
  }
  const tableName = tableMatch[1];

  const fieldsMatch = sql.match(/\(([^)]+)\)/);
  if (!fieldsMatch) {
    throw new Error('[Storage] Could not parse INSERT fields');
  }
  const fields = fieldsMatch[1].split(',').map(f => f.trim().replace(/['"]/g, ''));

  const data = {};
  fields.forEach((field, index) => {
    data[field] = params[index];
  });

  const result = await idbAdd(tableName, data);
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.changes
  };
}

// ==================== UPDATE ====================
async function handleUpdate(sql, params) {
  const tableMatch = sql.match(/update\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('[Storage] Could not parse UPDATE table');
  }
  const tableName = tableMatch[1];

  const setMatch = sql.match(/set\s+(.+?)(?:\s+where|$)/i);
  if (!setMatch) {
    throw new Error('[Storage] Could not parse UPDATE SET');
  }
  const setClause = setMatch[1];
  const setFields = setClause.split(',').map(f => {
    const [field, value] = f.split('=').map(s => s.trim());
    return { field, value };
  });

  const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
  if (!whereMatch) {
    throw new Error('[Storage] UPDATE without WHERE is not allowed');
  }

  let records = await idbGetAll(tableName);
  records = applyWhereFilter(records, whereMatch[1], params);

  let changes = 0;
  for (const record of records) {
    const updateData = {};
    setFields.forEach(({ field, value }) => {
      const cleanValue = value.replace(/['"]/g, '').trim();
      const paramIndex = parseInt(cleanValue.replace('?', ''));
      updateData[field] = !isNaN(paramIndex) ? params[paramIndex] : cleanValue;
    });
    
    await idbPut(tableName, { ...record, ...updateData });
    changes++;
  }

  return { changes };
}

// ==================== DELETE ====================
async function handleDelete(sql, params) {
  const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
  if (!tableMatch) {
    throw new Error('[Storage] Could not parse DELETE table');
  }
  const tableName = tableMatch[1];

  const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
  if (!whereMatch) {
    throw new Error('[Storage] DELETE without WHERE is not allowed');
  }

  let records = await idbGetAll(tableName);
  records = applyWhereFilter(records, whereMatch[1], params);

  let changes = 0;
  for (const record of records) {
    await idbDelete(tableName, record.id);
    changes++;
  }

  return { changes };
}