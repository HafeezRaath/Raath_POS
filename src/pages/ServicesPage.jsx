// src/pages/ServicesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import  db  from '../database/db';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '⏳' },
  'in-progress': { label: 'In Progress', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: '🔧' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '✅' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200', icon: '❌' }
};

const STATUS_FLOW = {
  pending: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState('workorders');
  const [workOrders, setWorkOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wo, sv, st, cu, pr] = await Promise.all([
        db.getWorkOrders(),
        db.getServices(),
        db.getStaff(),
        db.getCustomers(),
        db.getAllVariants()
      ]);
      setWorkOrders(wo || []);
      setServices(sv || []);
      setStaffList(st || []);
      setCustomers(cu || []);
      setProducts(pr || []);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkOrders = useMemo(() => {
    let result = [...workOrders];
    if (statusFilter) result = result.filter(w => w.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => 
        (w.machine_name || '').toLowerCase().includes(q) ||
        (w.service_name || '').toLowerCase().includes(q) ||
        (w.staff_name || '').toLowerCase().includes(q) ||
        (w.customer_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, statusFilter, searchQuery]);

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setModalType('');
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      if (type === 'service') await db.deleteService(id);
      else if (type === 'staff') await db.deleteStaff(id);
      else if (type === 'workorder') await db.deleteWorkOrder(id);
      loadAll();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const updateWorkOrderStatus = async (id, newStatus) => {
    try {
      const order = workOrders.find(w => String(w.id) === String(id));
      await db.updateWorkOrder(id, { status: newStatus });
      if (newStatus === 'completed' && order?.parts_used?.length > 0) {
        await db.deductWorkOrderParts(order.parts_used);
      }
      loadAll();
    } catch (e) {
      alert('Error updating status: ' + e.message);
    }
  };

  // ==================== FORMS ====================
  const WorkOrderForm = () => {
    const [form, setForm] = useState({
      service_id: editingItem?.service_id || '',
      staff_id: editingItem?.staff_id || '',
      customer_id: editingItem?.customer_id || '',
      machine_name: editingItem?.machine_name || '',
      status: editingItem?.status || 'pending',
      notes: editingItem?.notes || '',
      total_cost: editingItem?.total_cost || ''
    });
    const [selectedParts, setSelectedParts] = useState(editingItem?.parts_used || []);
    const [partSearch, setPartSearch] = useState('');

    const availableParts = useMemo(() => {
      if (!partSearch) return products.slice(0, 10);
      const q = partSearch.toLowerCase();
      return products.filter(p => 
        (p.sku || '').toLowerCase().includes(q) || 
        (p.variant_name || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q)
      );
    }, [partSearch, products]);

    const addPart = (product) => {
      const exists = selectedParts.find(p => p.part_id === product.sku);
      if (exists) {
        setSelectedParts(selectedParts.map(p => 
          p.part_id === product.sku ? { ...p, quantity: p.quantity + 1 } : p
        ));
      } else {
        setSelectedParts([...selectedParts, {
          part_id: product.sku,
          name: product.variant_name || product.product_name || 'Unknown',
          quantity: 1,
          cost_at_time: product.purchase_price || 0
        }]);
      }
    };

    const updatePartQty = (partId, qty) => {
      const num = parseInt(qty) || 0;
      if (num <= 0) {
        setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
      } else {
        setSelectedParts(selectedParts.map(p => p.part_id === partId ? { ...p, quantity: num } : p));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = {
          ...form,
          total_cost: Number(form.total_cost) || 0,
          parts_used: selectedParts
        };
        if (editingItem) {
          await db.updateWorkOrder(editingItem.id, payload);
        } else {
          await db.createWorkOrder(payload);
        }
        loadAll();
        closeModal();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">
          {editingItem ? 'Edit Work Order' : 'New Work Order'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} required>
            <option value="">Select Service *</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} required>
            <option value="">Assign Staff *</option>
            {staffList.filter(s => s.active !== false).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Machine / Item Name (e.g., Sewing Machine #3) *"
            value={form.machine_name} onChange={e => setForm({...form, machine_name: e.target.value})} required />

          <select className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
            <option value="">Select Customer (Optional)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
          </select>
        </div>

        {editingItem && (
          <select className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🔧 Parts from Inventory
          </h4>
          
          <div className="relative mb-3">
            <input className="w-full border border-gray-300 p-2.5 rounded-lg pl-9"
              placeholder="Search parts by name or SKU..."
              value={partSearch}
              onChange={e => setPartSearch(e.target.value)}
            />
            <span className="absolute left-3 top-3 text-gray-400">🔍</span>
          </div>

          {partSearch && availableParts.length > 0 && (
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white mb-3">
              {availableParts.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { addPart(p); setPartSearch(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex justify-between">
                  <span className="text-sm">{p.variant_name || p.product_name}</span>
                  <span className="text-xs text-gray-500">Stock: {p.current_stock || 0}</span>
                </button>
              ))}
            </div>
          )}

          {selectedParts.length > 0 && (
            <div className="space-y-2">
              {selectedParts.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                  <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                  <span className="text-xs text-gray-500">Rs. {p.cost_at_time}</span>
                  <input type="number" min="1" value={p.quantity}
                    onChange={e => updatePartQty(p.part_id, e.target.value)}
                    className="w-16 border border-gray-300 p-1 rounded text-center text-sm" />
                  <button type="button" onClick={() => updatePartQty(p.part_id, 0)}
                    className="text-red-500 hover:text-red-700 text-sm px-2">✕</button>
                </div>
              ))}
              <div className="text-right text-sm font-semibold text-gray-700 pt-1">
                Parts Cost: Rs. {selectedParts.reduce((sum, p) => sum + (p.cost_at_time * p.quantity), 0)}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="number" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Total Cost / Charges (Rs.)"
            value={form.total_cost} onChange={e => setForm({...form, total_cost: e.target.value})} />
        </div>

        <textarea className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Notes / Instructions..."
          rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />

        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition">
            {editingItem ? 'Update Work Order' : 'Create Work Order'}
          </button>
          <button type="button" onClick={closeModal}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 rounded-lg transition">
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const ServiceForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      description: editingItem?.description || '',
      base_price: editingItem?.base_price || '',
      estimated_time: editingItem?.estimated_time || '',
      status: editingItem?.status || 'active'
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = { ...form, base_price: Number(form.base_price) || 0 };
        if (editingItem) await db.updateService(editingItem.id, payload);
        else await db.createService(payload);
        loadAll(); closeModal();
      } catch (err) { alert('Error: ' + err.message); }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">
          {editingItem ? 'Edit Service' : 'Add Service'}
        </h3>
        <input className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Service Name *"
          value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <textarea className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Description"
          rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Base Price (Rs.)"
            value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} />
          <input className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Est. Time (e.g., 2 hrs)"
            value={form.estimated_time} onChange={e => setForm({...form, estimated_time: e.target.value})} />
        </div>
        <select className="w-full border border-gray-300 p-2.5 rounded-lg"
          value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="flex gap-3">
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium">
            {editingItem ? 'Update' : 'Add'} Service
          </button>
          <button type="button" onClick={closeModal} className="flex-1 bg-gray-200 hover:bg-gray-300 py-2.5 rounded-lg font-medium">
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const StaffForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      phone: editingItem?.phone || '',
      role: editingItem?.role || 'technician',
      active: editingItem?.active !== false
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (editingItem) await db.updateStaff(editingItem.id, form);
        else await db.createStaff(form);
        loadAll(); closeModal();
      } catch (err) { alert('Error: ' + err.message); }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">
          {editingItem ? 'Edit Staff' : 'Add Staff'}
        </h3>
        <input className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Name *"
          value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input className="w-full border border-gray-300 p-2.5 rounded-lg" placeholder="Phone"
          value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        <select className="w-full border border-gray-300 p-2.5 rounded-lg"
          value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
          <option value="technician">Technician</option>
          <option value="tailor">Tailor</option>
          <option value="manager">Manager</option>
          <option value="helper">Helper</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.active}
            onChange={e => setForm({...form, active: e.target.checked})}
            className="w-4 h-4 text-blue-600 rounded" />
          <span className="text-sm text-gray-700">Active</span>
        </label>
        <div className="flex gap-3">
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium">
            {editingItem ? 'Update' : 'Add'} Staff
          </button>
          <button type="button" onClick={closeModal} className="flex-1 bg-gray-200 hover:bg-gray-300 py-2.5 rounded-lg font-medium">
            Cancel
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🔧 Services & Work Orders</h1>
        <p className="text-gray-500 mt-1">Manage repairs, assignments, and parts consumption</p>
      </div>

      <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {[
          { key: 'workorders', label: 'Work Orders', icon: '📋' },
          { key: 'services', label: 'Service Catalog', icon: '📁' },
          { key: 'staff', label: 'Staff', icon: '👷' }
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2
              ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <button onClick={() => openModal(activeTab === 'workorders' ? 'workorder' : activeTab === 'services' ? 'service' : 'staff')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition flex items-center gap-2 justify-center">
          <span>+</span> 
          {activeTab === 'workorders' ? 'New Work Order' : activeTab === 'services' ? 'Add Service' : 'Add Staff'}
        </button>

        {activeTab === 'workorders' && (
          <>
            <div className="relative flex-1 max-w-md">
              <input className="w-full border border-gray-300 pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search by machine, service, staff..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
            </div>
            <select className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          Loading...
        </div>
      )}

      {/* WORK ORDERS TAB */}
      {!loading && activeTab === 'workorders' && (
        <div className="space-y-3">
          {filteredWorkOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-lg font-semibold text-gray-700">No work orders found</h3>
              <p className="text-gray-500">Create your first work order to get started</p>
            </div>
          ) : (
            filteredWorkOrders.map(wo => {
              const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
              const nextStatuses = STATUS_FLOW[wo.status] || [];
              return (
                <div key={wo.id} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                        <span className="text-xs text-gray-400">#{wo.id}</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">{wo.machine_name}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                        <p><span className="text-gray-400">Service:</span> {wo.service_name || '—'}</p>
                        <p><span className="text-gray-400">Staff:</span> {wo.staff_name || '—'}</p>
                        <p><span className="text-gray-400">Customer:</span> {wo.customer_name || '—'}</p>
                        <p><span className="text-gray-400">Date:</span> {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '—'}</p>
                      </div>
                      {wo.parts_used && wo.parts_used.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Parts Used</p>
                          <div className="flex flex-wrap gap-2">
                            {wo.parts_used.map((p, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium">
                                {p.name} ×{p.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {wo.notes && (
                        <p className="mt-2 text-sm text-gray-500 italic bg-yellow-50 p-2 rounded-lg">📝 {wo.notes}</p>
                      )}
                      {wo.total_cost > 0 && (
                        <p className="mt-2 text-sm font-semibold text-blue-600">Total Charges: Rs. {wo.total_cost}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {nextStatuses.length > 0 && (
                        <div className="space-y-1">
                          {nextStatuses.map(ns => (
                            <button key={ns} onClick={() => updateWorkOrderStatus(wo.id, ns)}
                              className={`w-full text-xs font-medium py-2 px-3 rounded-lg transition text-left
                                ${ns === 'completed' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' :
                                  ns === 'in-progress' ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200' :
                                  'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}>
                              {ns === 'completed' ? '✅ Mark Complete' : 
                               ns === 'in-progress' ? '🔧 Start Work' : '❌ Cancel'}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => openModal('workorder', wo)}
                          className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition">
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete('workorder', wo.id)}
                          className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg transition">
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SERVICES TAB */}
      {!loading && activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">📁</div>
              <h3 className="text-lg font-semibold text-gray-700">No services yet</h3>
              <p className="text-gray-500">Add services like "Sewing Machine Repair", "Alteration", etc.</p>
            </div>
          ) : (
            services.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-800">{s.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{s.description || 'No description'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600 font-bold text-lg">Rs. {s.base_price || 0}</span>
                  <span className="text-gray-400">{s.estimated_time || '—'}</span>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => openModal('service', s)}
                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition">
                    ✏️ Edit
                  </button>
                  <button onClick={() => handleDelete('service', s.id)}
                    className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg transition">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* STAFF TAB */}
      {!loading && activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">👷</div>
              <h3 className="text-lg font-semibold text-gray-700">No staff members</h3>
              <p className="text-gray-500">Add technicians, tailors, and other workers</p>
            </div>
          ) : (
            staffList.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                    ${s.active !== false ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    {s.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{s.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{s.role}</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium
                    ${s.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">📞 {s.phone || 'No phone'}</p>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => openModal('staff', s)}
                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition">
                    ✏️ Edit
                  </button>
                  <button onClick={() => handleDelete('staff', s.id)}
                    className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg transition">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {modalType === 'workorder' && <WorkOrderForm />}
            {modalType === 'service' && <ServiceForm />}
            {modalType === 'staff' && <StaffForm />}
          </div>
        </div>
      )}
    </div>
  );
}