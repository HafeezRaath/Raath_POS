// ============================================================
//  db-services.js — Services, Staff & Work Orders Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachServiceMethods(StorageClass) {

  // ============================================================
  // ==================== SERVICES ====================
  // ============================================================

  StorageClass.prototype.getServices = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        "SELECT * FROM services WHERE is_deleted = 0 ORDER BY name"
      );
    }
    return idbGetAll('services').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getServiceById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        "SELECT * FROM services WHERE id = ? AND is_deleted = 0", 
        [id]
      );
      return r[0] || null;
    }
    const result = await idbGetById('services', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createService = async function(data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "INSERT INTO services (name, description, base_price, estimated_time, status) VALUES (?, ?, ?, ?, ?)", 
        [
          data.name, 
          data.description || '', 
          data.base_price || 0, 
          data.estimated_time || '', 
          data.status || 'active'
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('services', { 
          ...data, 
          id: _res.lastInsertRowid, 
          is_deleted: 0 
        });
      }
      return _res;
    }
    return idbAdd('services', { ...data, is_deleted: 0 });
  };

  StorageClass.prototype.updateService = async function(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE services SET name = ?, description = ?, base_price = ?, estimated_time = ?, status = ? WHERE id = ?", 
        [
          data.name, data.description, data.base_price, 
          data.estimated_time, data.status, id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('services', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('services', id);
    if (!e) return { changes: 0 };
    return idbPut('services', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteService = async function(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE services SET is_deleted = 1 WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('services', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('services', id);
    if (!e) return { changes: 0 };
    return idbPut('services', { ...e, is_deleted: 1, id: e.id });
  };

  // ============================================================
  // ==================== STAFF ====================
  // ============================================================

  StorageClass.prototype.getStaff = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        "SELECT * FROM staff WHERE is_deleted = 0 ORDER BY name"
      );
    }
    return idbGetAll('staff').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getStaffById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        "SELECT * FROM staff WHERE id = ? AND is_deleted = 0", 
        [id]
      );
      return r[0] || null;
    }
    const result = await idbGetById('staff', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createStaff = async function(data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "INSERT INTO staff (name, phone, role, commission_rate, base_salary, active) VALUES (?, ?, ?, ?, ?, ?)", 
        [
          data.name, 
          data.phone || '', 
          data.role || 'technician', 
          data.commission_rate || 0, 
          data.base_salary || 0, 
          data.active !== false ? 1 : 0
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('staff', { 
          ...data, 
          id: _res.lastInsertRowid, 
          active: data.active !== false, 
          is_deleted: 0,
          commission_rate: data.commission_rate || 0,
          base_salary: data.base_salary || 0
        });
      }
      return _res;
    }
    return idbAdd('staff', { 
      ...data, 
      active: data.active !== false, 
      is_deleted: 0,
      commission_rate: data.commission_rate || 0,
      base_salary: data.base_salary || 0
    });
  };

  StorageClass.prototype.updateStaff = async function(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE staff SET name = ?, phone = ?, role = ?, commission_rate = ?, base_salary = ?, active = ? WHERE id = ?", 
        [
          data.name, data.phone, data.role, 
          data.commission_rate || 0, data.base_salary || 0, 
          data.active !== false ? 1 : 0, id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('staff', { 
          ...data, 
          id, 
          active: data.active !== false,
          commission_rate: data.commission_rate || 0,
          base_salary: data.base_salary || 0
        });
      }
      return _res;
    }
    const e = await idbGetById('staff', id);
    if (!e) return { changes: 0 };
    return idbPut('staff', { 
      ...e, 
      ...data, 
      active: data.active !== false,
      commission_rate: data.commission_rate || 0,
      base_salary: data.base_salary || 0,
      id: e.id 
    });
  };

  StorageClass.prototype.deleteStaff = async function(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE staff SET is_deleted = 1 WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('staff', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('staff', id);
    if (!e) return { changes: 0 };
    return idbPut('staff', { ...e, is_deleted: 1, id: e.id });
  };

  // ============================================================
  // ==================== WORK ORDERS ====================
  // ============================================================

  StorageClass.prototype.getWorkOrders = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `SELECT wo.*, s.name as service_name, st.name as staff_name, 
                        c.name as customer_name, st.commission_rate as staff_commission_rate 
                 FROM work_orders wo 
                 LEFT JOIN services s ON wo.service_id = s.id 
                 LEFT JOIN staff st ON wo.staff_id = st.id 
                 LEFT JOIN customers c ON wo.customer_id = c.id 
                 WHERE wo.is_deleted = 0`;
      const params = [];
      
      if (filters.status) { 
        sql += " AND wo.status = ?"; 
        params.push(filters.status); 
      }
      if (filters.staffId) { 
        sql += " AND wo.staff_id = ?"; 
        params.push(filters.staffId); 
      }
      if (filters.startDate) { 
        sql += " AND DATE(wo.created_at) >= DATE(?)";
        params.push(filters.startDate); 
      }
      if (filters.endDate) {
        sql += " AND DATE(wo.created_at) <= DATE(?)";
        params.push(filters.endDate);
      }
      sql += " ORDER BY wo.id DESC";
      
      const rows = await this.electronQuery(sql, params);
      return rows.map(row => ({
        ...row,
        parts_used: typeof row.parts_used === 'string' 
          ? JSON.parse(row.parts_used || '[]') 
          : row.parts_used
      }));
    }
    
    const [wo, services, staff, customers] = await Promise.all([
      idbGetAll('work_orders'), 
      idbGetAll('services'), 
      idbGetAll('staff'), 
      idbGetAll('customers')
    ]);
    
    let result = wo.filter(x => !x.is_deleted);
    if (filters.status) result = result.filter(x => x.status === filters.status);
    if (filters.staffId) result = result.filter(x => String(x.staff_id) === String(filters.staffId));
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      result = result.filter(x => {
        const created = new Date(x.created_at);
        return created >= start;
      });
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      result = result.filter(x => {
        const created = new Date(x.created_at);
        return created <= end;
      });
    }
    
    return result.map(item => ({
      ...item,
      parts_used: Array.isArray(item.parts_used) ? item.parts_used : [],
      service_name: services.find(s => String(s.id) === String(item.service_id))?.name || '',
      staff_name: staff.find(s => String(s.id) === String(item.staff_id))?.name || '',
      customer_name: customers.find(c => String(c.id) === String(item.customer_id))?.name || '',
      staff_commission_rate: staff.find(s => String(s.id) === String(item.staff_id))?.commission_rate || 0
    }));
  };

  StorageClass.prototype.getWorkOrderById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        `SELECT wo.*, s.name as service_name, st.name as staff_name, 
                st.commission_rate as staff_commission_rate 
         FROM work_orders wo 
         LEFT JOIN services s ON wo.service_id = s.id 
         LEFT JOIN staff st ON wo.staff_id = st.id 
         WHERE wo.id = ? AND wo.is_deleted = 0`, 
        [id]
      );
      if (!r[0]) return null;
      return {
        ...r[0],
        parts_used: typeof r[0].parts_used === 'string' 
          ? JSON.parse(r[0].parts_used || '[]') 
          : r[0].parts_used
      };
    }
    
    const item = await idbGetById('work_orders', id);
    if (!item || item.is_deleted) return null;
    const staff = await idbGetAll('staff');
    return {
      ...item,
      parts_used: Array.isArray(item.parts_used) ? item.parts_used : [],
      staff_commission_rate: staff.find(s => String(s.id) === String(item.staff_id))?.commission_rate || 0
    };
  };

  StorageClass.prototype.createWorkOrder = async function(data) {
    const payload = {
      ...data,
      status: data.status || 'pending',
      parts_used: data.parts_used || [],
      total_cost: data.total_cost || 0,
      payment_status: data.payment_status || 'unpaid',
      payment_mode: data.payment_mode || 'pending',
      commission_amount: data.commission_amount || 0,
      created_at: data.created_at || new Date().toISOString(),
      completed_at: data.completed_at || null,
      is_deleted: 0
    };
    
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO work_orders (
          service_id, staff_id, customer_id, machine_name, device_model, 
          imei, problem_description, status, parts_used, notes, total_cost, 
          payment_status, payment_mode, commission_amount, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          payload.service_id || null,
          payload.staff_id || null,
          payload.customer_id || null,
          payload.machine_name || payload.device_model || '',
          payload.device_model || '',
          payload.imei || '',
          payload.problem_description || '',
          payload.status,
          JSON.stringify(payload.parts_used),
          payload.notes || '',
          payload.total_cost,
          payload.payment_status,
          payload.payment_mode,
          payload.commission_amount,
          payload.created_at,
          payload.completed_at
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('work_orders', { ...payload, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('work_orders', payload);
  };

  StorageClass.prototype.updateWorkOrder = async function(id, data) {
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      
      const allowedFields = [
        'service_id', 'staff_id', 'customer_id', 'machine_name', 'device_model', 
        'imei', 'problem_description', 'status', 'parts_used', 'notes', 
        'total_cost', 'payment_status', 'payment_mode', 'commission_amount', 'completed_at'
      ];
      
      Object.keys(data).forEach(key => {
        if (allowedFields.includes(key) && data[key] !== undefined) {
          fields.push(key + ' = ?');
          if (key === 'parts_used') {
            values.push(JSON.stringify(data[key] || []));
          } else {
            values.push(data[key]);
          }
        }
      });
      
      if (fields.length === 0) return { changes: 0 };
      values.push(id);
      
      const _res = await this.electronQuery(
        `UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`, 
        values
      );
      if (SYNC_ENABLED) {
        await syncToCloud('work_orders', { ...data, id });
      }
      return _res;
    }
    
    const e = await idbGetById('work_orders', id);
    if (!e) return { changes: 0 };
    return idbPut('work_orders', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteWorkOrder = async function(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE work_orders SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('work_orders', { 
          id, 
          is_deleted: 1, 
          deleted_at: new Date().toISOString() 
        });
      }
      return _res;
    }
    const e = await idbGetById('work_orders', id);
    if (!e) return { changes: 0 };
    return idbPut('work_orders', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.completeWorkOrder = async function(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE work_orders SET 
          status = 'completed', 
          completed_at = COALESCE(?, completed_at), 
          notes = COALESCE(?, notes), 
          total_cost = COALESCE(?, total_cost), 
          commission_amount = COALESCE(?, commission_amount) 
         WHERE id = ?`, 
        [
          data.completed_at || new Date().toISOString(),
          data.notes || null,
          data.total_cost || 0,
          data.commission_amount || 0,
          id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('work_orders', { id, status: 'completed', ...data });
      }
      return _res;
    }
    
    const e = await idbGetById('work_orders', id);
    if (!e) return { changes: 0 };
    return idbPut('work_orders', { 
      ...e, 
      status: 'completed',
      completed_at: data.completed_at || new Date().toISOString(),
      notes: data.notes || e.notes,
      total_cost: data.total_cost || e.total_cost,
      commission_amount: data.commission_amount || e.commission_amount,
      id: e.id 
    });
  };

  // ==================== DEDUCT WORK ORDER PARTS FROM STOCK ====================
  StorageClass.prototype.deductWorkOrderParts = async function(partsUsed) {
    if (!Array.isArray(partsUsed) || partsUsed.length === 0) return;
    for (const part of partsUsed) {
      if (!part.part_id || !part.quantity) continue;
      const variant = await this.getVariantBySKU(part.part_id);
      if (variant && variant.id) {
        await this.updateVariantStock(variant.id, -Number(part.quantity));
      }
    }
  };

}