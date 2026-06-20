import React, { useState, useEffect } from 'react';
import db from '../database/db';

const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cnic: '', address: '', district: '',
    province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
    credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
    reference_name: '', reference_phone: ''
  });

  const provinces = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Gilgit', 'Azad Kashmir', 'Islamabad'];

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    const data = await db.getCustomers();
    setCustomers(Array.isArray(data) ? data : []);
  };

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Name required!');
    
    const openingBal = parseFloat(form.opening_balance) || 0;
    const credLimit = parseFloat(form.credit_limit) || 0;

    const data = {
      ...form,
      opening_balance: openingBal,
      credit_limit: credLimit,
      current_balance: editingId ? undefined : openingBal 
    };

    try {
      if (editingId) {
        const existing = customers.find(c => c.id === editingId);
        data.current_balance = existing ? existing.current_balance : 0;
        await db.updateCustomer(editingId, data);
      } else {
        const result = await db.createCustomer(data);
        
        // 📈 AUTOMATIC ACCOUNTING LEDGER LINK
        // If customer has an initial opening balance, log it right away
        if (openingBal > 0 && db.addCustomerLedgerEntry) {
          await db.addCustomerLedgerEntry({
            customer_id: result.lastInsertRowid,
            type: 'debit',
            amount: openingBal,
            description: 'Opening Balance Account Initialized',
            payment_mode: form.payment_terms
          });
        }
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm({
        name: '', phone: '', email: '', cnic: '', address: '', district: '',
        province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
        credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
        reference_name: '', reference_phone: ''
      });
      loadCustomers();
    } catch (err) {
      console.error("Customer registration transaction failed:", err);
      alert("Database error: " + err.message);
    }
  };

  const editCustomer = (c) => {
    setForm({
      ...c,
      opening_balance: c.opening_balance !== undefined ? String(c.opening_balance) : '',
      credit_limit: c.credit_limit !== undefined ? String(c.credit_limit) : '',
      province: c.province || '',
      district: c.district || '',
      cnic: c.cnic || '',
      shop_name: c.shop_name || '',
      email: c.email || '',
      notes: c.notes || '',
      reference_name: c.reference_name || '',
      reference_phone: c.reference_phone || ''
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    await db.deleteCustomer(id);
    loadCustomers();
  };

  const filtered = customers.filter(c => {
    const name = (c.name || '').toLowerCase();
    const phone = (c.phone || '');
    const shop = (c.shop_name || '').toLowerCase();
    const targetSearch = search.toLowerCase();

    const matchesSearch = name.includes(targetSearch) || 
                          phone.includes(targetSearch) ||
                          shop.includes(targetSearch);
    const matchesType = filter === 'all' ? true : c.customer_type === filter;
    return matchesSearch && matchesType;
  });

  const getBalanceColor = (bal) => {
    if (bal > 0) return 'text-red-600 font-bold';
    if (bal < 0) return 'text-green-600 font-bold';
    return 'text-gray-500';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        {/* 🛠️ FIXED: Removed the non-defined resetProductForm() from onClick */}
        <button onClick={() => {
          if (showForm) {
            setShowForm(false);
            setEditingId(null);
          } else {
            setShowForm(true);
          }
        }} className="bg-blue-600 text-white px-4 py-2 rounded">
          {showForm ? 'Close' : '+ Add Customer'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input 
          type="text" 
          placeholder="Search name, phone, shop..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border p-2 rounded">
          <option value="all">All Types</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
          <option value="kirana">Kirana</option>
          <option value="walk_in">Walk-in</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input name="name" placeholder="Customer Name *" value={form.name} onChange={handleChange} className="border p-2 rounded" required />
          <input name="phone" placeholder="Phone *" value={form.phone} onChange={handleChange} className="border p-2 rounded" required />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} className="border p-2 rounded" />
          <input name="cnic" placeholder="CNIC" value={form.cnic} onChange={handleChange} className="border p-2 rounded" />
          <input name="shop_name" placeholder="Shop Name" value={form.shop_name} onChange={handleChange} className="border p-2 rounded" />
          <select name="customer_type" value={form.customer_type} onChange={handleChange} className="border p-2 rounded">
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="kirana">Kirana</option>
            <option value="walk_in">Walk-in</option>
          </select>
          <input name="address" placeholder="Address" value={form.address} onChange={handleChange} className="border p-2 rounded" />
          <input name="district" placeholder="District" value={form.district} onChange={handleChange} className="border p-2 rounded" />
          <select name="province" value={form.province} onChange={handleChange} className="border p-2 rounded">
            <option value="">Select Province</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input name="opening_balance" type="number" placeholder="Opening Balance" value={form.opening_balance} onChange={handleChange} className="border p-2 rounded" />
          <input name="credit_limit" type="number" placeholder="Credit Limit" value={form.credit_limit} onChange={handleChange} className="border p-2 rounded" />
          <select name="payment_terms" value={form.payment_terms} onChange={handleChange} className="border p-2 rounded">
            <option value="cash">Cash (Immediate)</option>
            <option value="7_days">7 Days</option>
            <option value="15_days">15 Days</option>
            <option value="30_days">30 Days</option>
            <option value="monthly">Monthly (Kirana)</option>
          </select>
          <select name="status" value={form.status} onChange={handleChange} className="border p-2 rounded">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input name="reference_name" placeholder="Reference Name" value={form.reference_name} onChange={handleChange} className="border p-2 rounded" />
          <input name="reference_phone" placeholder="Reference Phone" value={form.reference_phone} onChange={handleChange} className="border p-2 rounded" />
          <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} className="border p-2 rounded md:col-span-2" rows="2" />
          
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={() => {setShowForm(false); setEditingId(null);}} className="bg-gray-400 text-white px-4 py-2 rounded">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Phone</th>
              <th className="border p-2 text-left">Shop/District</th>
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-right">Balance</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="border p-2">
                  <div className="font-medium">{c.name}</div>
                  {c.shop_name && <div className="text-xs text-gray-500">{c.shop_name}</div>}
                </td>
                <td className="border p-2">{c.phone}</td>
                <td className="border p-2">
                  <div>{c.district || '-'}</div>
                  <div className="text-xs text-gray-500">{c.province || ''}</div>
                </td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    c.customer_type === 'wholesale' ? 'bg-purple-100 text-purple-700' :
                    c.customer_type === 'kirana' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {c.customer_type}
                  </span>
                </td>
                <td className={`border p-2 text-right ${getBalanceColor(c.current_balance)}`}>
                  Rs. {Number(c.current_balance || 0).toLocaleString()}
                </td>
                <td className="border p-2 text-center">
                  <button onClick={() => editCustomer(c)} className="text-blue-600 mr-2">Edit</button>
                  <button onClick={() => deleteCustomer(c.id)} className="text-red-600">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center p-4 text-gray-500">No customers found</div>}
      </div>
    </div>
  );
};

export default CustomerPage;