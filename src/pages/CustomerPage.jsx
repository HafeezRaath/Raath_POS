import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Card, CardContent, IconButton, InputAdornment,
  Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, useMediaQuery, useTheme, Collapse,
  Avatar, Divider, Stack, Tooltip, Tabs, Tab, Pagination,
  CircularProgress
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Close, Person, Phone,
  Email, Business, LocationOn, AttachMoney, CreditCard,
  People, Store, Save, Cancel, Refresh, CheckCircle,
  History, Payment, PictureAsPdf, FilterList, Visibility,
  Receipt, AccountBalanceWallet, TrendingUp, TrendingDown,
  ShoppingCart, ArrowBack
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
const formatPKR = (amount) => {
  const val = Number(amount || 0);
  return 'Rs. ' + val.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeJsonParse = (str, def = []) => {
  try { return JSON.parse(str); } catch { return def; }
};

const getBalanceColor = (bal) => {
  const val = Number(bal) || 0;
  if (val > 0) return 'error';
  if (val < 0) return 'success';
  return 'default';
};

const getLedgerTypeChip = (type) => {
  const map = {
    opening_balance: { label: 'Opening', color: 'info' },
    cash_sale: { label: 'Cash Sale', color: 'success' },
    credit_sale: { label: 'Credit Sale', color: 'warning' },
    payment: { label: 'Payment', color: 'success' },
    adjustment: { label: 'Adjustment', color: 'secondary' },
    sale_reversal: { label: 'Reversal', color: 'error' },
  };
  return map[type] || { label: type ? type.replace(/_/g, ' ') : 'Entry', color: 'default' };
};

const provinces = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Gilgit', 'Azad Kashmir', 'Islamabad'];
const paymentModes = ['cash', 'card', 'bank_transfer', 'cheque', 'jazzcash', 'easypaisa'];

// ==================== PERMISSIONS HOOK ====================
const usePermissions = () => {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('current_user') || '{}'); }
    catch { return {}; }
  }, []);
  const rolePermissions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('role_permissions') || '{}'); }
    catch { return {}; }
  }, []);
  const can = (page, action = 'view') => {
    const roleId = currentUser?.role;
    if (!roleId || !rolePermissions) return false;
    if (roleId === 'admin') return true;
    const pagePerms = rolePermissions[roleId]?.[page];
    return !!pagePerms?.[action];
  };
  return { can, currentUser };
};

// ==================== MOBILE CUSTOMER CARD ====================
const CustomerCard = ({ customer, onEdit, onDelete, onViewHistory, onAddPayment, canEdit, canDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const balance = Number(customer.current_balance) || 0;

  return (
    <Card sx={{ mb: 1.5, overflow: 'hidden', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: balance > 0 ? '#ef4444' : balance < 0 ? '#10b981' : '#3b82f6', width: 44, height: 44, fontWeight: 'bold' }}>
            {customer.name?.charAt(0)?.toUpperCase() || 'C'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ fontSize: '1rem' }}>
              {customer.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Phone sx={{ fontSize: 12 }} /> {customer.phone || 'N/A'}
              </Typography>
              <Chip
                label={customer.customer_type || 'retail'}
                size="small"
                color={
                  customer.customer_type === 'wholesale' ? 'secondary' :
                  customer.customer_type === 'kirana' ? 'warning' :
                  'primary'
                }
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle2" fontWeight="bold" color={getBalanceColor(balance)} sx={{ fontSize: '0.95rem' }}>
              {formatPKR(balance)}
            </Typography>
            {customer.last_transaction_date && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                Last: {new Date(customer.last_transaction_date).toLocaleDateString('en-PK')}
              </Typography>
            )}
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={1.5}>
            {customer.shop_name && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Shop</Typography>
                <Typography variant="body2" fontWeight={500}>{customer.shop_name}</Typography>
              </Grid>
            )}
            {customer.email && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2">{customer.email}</Typography>
              </Grid>
            )}
            {(customer.district || customer.province) && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Location</Typography>
                <Typography variant="body2">{customer.district}{customer.district && customer.province ? ', ' : ''}{customer.province}</Typography>
              </Grid>
            )}
            {Number(customer.credit_limit) > 0 && (
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                <Typography variant="body2">{formatPKR(customer.credit_limit)}</Typography>
              </Grid>
            )}
            {customer.total_transactions > 0 && (
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Transactions</Typography>
                <Typography variant="body2">{customer.total_transactions}</Typography>
              </Grid>
            )}
            {customer.notes && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2" color="text.secondary">{customer.notes}</Typography>
              </Grid>
            )}
          </Grid>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button size="small" variant="outlined" startIcon={<Payment />} onClick={() => onAddPayment(customer)} fullWidth>
              Payment
            </Button>
            <Button size="small" variant="outlined" startIcon={<History />} onClick={() => onViewHistory(customer)} fullWidth>
              History
            </Button>
          </Stack>
        </Collapse>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Button size="small" variant="text" onClick={() => setExpanded(!expanded)} sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {expanded ? 'Show Less' : 'Show More'}
          </Button>
          <Stack direction="row" spacing={0.5}>
            {canEdit && <Tooltip title="Edit"><IconButton size="small" onClick={() => onEdit(customer)} color="primary"><Edit fontSize="small" /></IconButton></Tooltip>}
            {canDelete && <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(customer.id)} color="error"><Delete fontSize="small" /></IconButton></Tooltip>}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function CustomerPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ---- STATE ----
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { can } = usePermissions();

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBalance, setFilterBalance] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const rowsPerPage = isMobile ? 5 : 10;

  // Dialogs
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState('all');

  // Form
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cnic: '', address: '', district: '',
    province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
    credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
    reference_name: '', reference_phone: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Payment form
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_mode: 'cash', note: '', date: '', reference_no: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState(null);

  // ---- LOAD ----
  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getAllCustomersWithBalance?.() || await db.getCustomers?.() || [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Failed to load customers: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- FILTER LOGIC ----
  const filtered = useMemo(() => {
    let result = customers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const shop = (c.shop_name || '').toLowerCase();
      const q = search.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || phone.includes(q) || shop.includes(q);
      const matchesType = filterType === 'all' || c.customer_type === filterType;
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;

      let matchesBalance = true;
      const bal = Number(c.current_balance) || 0;
      if (filterBalance === 'due') matchesBalance = bal > 0;
      else if (filterBalance === 'advance') matchesBalance = bal < 0;
      else if (filterBalance === 'settled') matchesBalance = bal === 0;

      return matchesSearch && matchesType && matchesStatus && matchesBalance;
    });

    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return result;
  }, [customers, search, filterType, filterStatus, filterBalance]);

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;

  useEffect(() => { setPage(1); }, [search, filterType, filterStatus, filterBalance]);

  // ---- STATS ----
  const stats = useMemo(() => {
    const total = customers.length;
    const totalBalance = customers.reduce((sum, c) => sum + Number(c.current_balance || 0), 0);
    const active = customers.filter(c => c.status === 'active').length;
    const withDue = customers.filter(c => Number(c.current_balance) > 0).length;
    return { total, totalBalance, active, withDue };
  }, [customers]);

  // ---- FORM HANDLERS ----
  const resetForm = useCallback(() => {
    setForm({
      name: '', phone: '', email: '', cnic: '', address: '', district: '',
      province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
      credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
      reference_name: '', reference_phone: ''
    });
    setFormErrors({});
    setEditingId(null);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'Name is required';
    if (!form.phone?.trim()) errs.phone = 'Phone is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (form.opening_balance && Number(form.opening_balance) < 0) errs.opening_balance = 'Cannot be negative';
    if (form.credit_limit && Number(form.credit_limit) < 0) errs.credit_limit = 'Cannot be negative';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId && !can('customers', 'edit')) {
      setSnackbar({ open: true, message: '🚫 Permission Denied: Cannot edit customers!', severity: 'error' });
      return;
    }
    if (!editingId && !can('customers', 'add')) {
      setSnackbar({ open: true, message: '🚫 Permission Denied: Cannot add customers!', severity: 'error' });
      return;
    }
    if (!validateForm()) {
      setSnackbar({ open: true, message: 'Please fix form errors', severity: 'warning' });
      return;
    }

    const openingBal = parseFloat(form.opening_balance) || 0;
    const credLimit = parseFloat(form.credit_limit) || 0;

    const data = { ...form, opening_balance: openingBal, credit_limit: credLimit };
    if (editingId) {
      const existing = customers.find(c => c.id === editingId);
      data.current_balance = existing ? existing.current_balance : 0;
    }

    try {
      if (editingId) {
        await db.updateCustomer(editingId, data);
        setSnackbar({ open: true, message: 'Customer updated successfully!', severity: 'success' });
      } else {
        await db.createCustomer(data);
        setSnackbar({ open: true, message: 'Customer added successfully!', severity: 'success' });
      }
      setShowForm(false);
      resetForm();
      loadCustomers();
    } catch (err) {
      console.error('Submit error:', err);
      setSnackbar({ open: true, message: err.message || 'Operation failed', severity: 'error' });
    }
  };

  const editCustomer = (c) => {
    setForm({
      name: c.name || '', phone: c.phone || '', email: c.email || '', cnic: c.cnic || '',
      address: c.address || '', district: c.district || '', province: c.province || '',
      shop_name: c.shop_name || '', customer_type: c.customer_type || 'retail',
      opening_balance: c.opening_balance !== undefined ? String(c.opening_balance) : '',
      credit_limit: c.credit_limit !== undefined ? String(c.credit_limit) : '',
      payment_terms: c.payment_terms || 'cash', status: c.status || 'active',
      notes: c.notes || '', reference_name: c.reference_name || '', reference_phone: c.reference_phone || ''
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const deleteCustomer = async (id) => {
    if (!can('customers', 'delete')) {
      setSnackbar({ open: true, message: '🚫 Permission Denied: Cannot delete customers!', severity: 'error' });
      return;
    }
    const c = customers.find(x => x.id === id);
    const name = c?.name || 'this customer';
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await db.deleteCustomer(id);
      setSnackbar({ open: true, message: 'Customer deleted successfully!', severity: 'success' });
      loadCustomers();
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Delete failed', severity: 'error' });
    }
  };

  // ---- LEDGER / HISTORY ----
  const openLedger = async (customer) => {
    setSelectedCustomer(customer);
    setShowLedger(true);
    setLedgerLoading(true);
    setLedgerData([]);
    setLedgerTab('all');
    try {
      const data = await db.getCustomerLedger(customer.id);
      setLedgerData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Ledger error:', err);
      setSnackbar({ open: true, message: 'Failed to load history: ' + err.message, severity: 'error' });
    } finally {
      setLedgerLoading(false);
    }
  };

  const filteredLedger = useMemo(() => {
    if (ledgerTab === 'all') return ledgerData;
    return ledgerData.filter(e => e.type === ledgerTab);
  }, [ledgerData, ledgerTab]);

  // ---- PAYMENT ----
  const openPayment = async (customer) => {
    setSelectedCustomer(customer);
    setPaymentForm({ amount: '', payment_mode: 'cash', note: '', date: new Date().toISOString().slice(0, 16), reference_no: '' });
    setSelectedPaymentAccount(null);
    setShowPayment(true);
    try {
      const accs = await db.getAccounts?.() || [];
      setPaymentAccounts(accs.filter(a => a.status === 'active' && !a.is_deleted));
    } catch (e) {
      console.error('Load accounts error:', e);
    }
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({ ...prev, [name]: value }));
  };

  // Auto-select account based on payment mode
  useEffect(() => {
    if (!paymentForm.payment_mode || !paymentAccounts.length) {
      setSelectedPaymentAccount(null);
      return;
    }
    const map = {
      cash: 'cash',
      card: 'bank',
      bank_transfer: 'bank',
      cheque: 'cheque',
      jazzcash: 'jazzcash',
      easypaisa: 'easypaisa'
    };
    const accType = map[paymentForm.payment_mode] || paymentForm.payment_mode;
    const found = paymentAccounts.find(a => a.type === accType);
    setSelectedPaymentAccount(found || null);
  }, [paymentForm.payment_mode, paymentAccounts]);

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      setSnackbar({ open: true, message: 'Enter valid amount', severity: 'warning' });
      return;
    }
    if (!selectedCustomer?.id) return;

    setPaymentLoading(true);
    try {
      await db.addCustomerPayment({
        customer_id: selectedCustomer.id,
        amount: amount,
        payment_mode: paymentForm.payment_mode,
        note: paymentForm.note || 'Payment received',
        date: paymentForm.date ? new Date(paymentForm.date).toISOString() : new Date().toISOString(),
        reference_no: paymentForm.reference_no || undefined,
        account_id: selectedPaymentAccount?.id || undefined
      });

      // ✅ Account mein payment add karo
      if (selectedPaymentAccount?.id) {
        await db.createTransaction({
          account_id: selectedPaymentAccount.id,
          transaction_type: 'credit',
          amount: amount,
          description: `Payment from ${selectedCustomer.name} — ${paymentForm.note || 'Payment received'}`,
          payment_mode: paymentForm.payment_mode,
          reference_no: paymentForm.reference_no || `CUST-PAY-${selectedCustomer.id}`,
          date: paymentForm.date ? new Date(paymentForm.date).toISOString() : new Date().toISOString(),
          reference_type: 'customer_payment'
        });
      }

      setSnackbar({ open: true, message: `Payment of ${formatPKR(amount)} recorded!`, severity: 'success' });
      setShowPayment(false);
      loadCustomers();
      if (showLedger && selectedCustomer) {
        const data = await db.getCustomerLedger(selectedCustomer.id);
        setLedgerData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Payment failed', severity: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  // ---- PDF EXPORT ----
  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setSnackbar({ open: true, message: 'Popup blocked! Allow popups to export PDF.', severity: 'warning' });
      return;
    }

    const dateStr = new Date().toLocaleString('en-PK');
    const rows = filtered.map(c => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c.name || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c.phone || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c.shop_name || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${c.customer_type || 'retail'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c.status || 'active'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${Number(c.current_balance)>0?'#dc2626':Number(c.current_balance)<0?'#059669':'#374151'}">Rs. ${Number(c.current_balance||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 4px 0; color: #666; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
          th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; }
          .summary { display: flex; gap: 24px; margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .summary-box { text-align: center; flex: 1; }
          .summary-box .num { font-size: 20px; font-weight: bold; color: #111; }
          .summary-box .lbl { font-size: 12px; color: #666; margin-top: 4px; }
          .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Customer Report</h1>
          <p>Generated on ${dateStr}</p>
          <p>Total Records: ${filtered.length} | Filter: ${filterType !== 'all' ? filterType : 'All Types'} | Status: ${filterStatus !== 'all' ? filterStatus : 'All'}</p>
        </div>
        <div class="summary">
          <div class="summary-box"><div class="num">${stats.total}</div><div class="lbl">Total Customers</div></div>
          <div class="summary-box"><div class="num">${stats.active}</div><div class="lbl">Active</div></div>
          <div class="summary-box"><div class="num" style="color:#dc2626">Rs. ${stats.totalBalance.toLocaleString('en-PK',{minimumFractionDigits:2})}</div><div class="lbl">Total Receivables</div></div>
          <div class="summary-box"><div class="num">${stats.withDue}</div><div class="lbl">With Due</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Shop</th><th>Type</th><th>Status</th><th style="text-align:right">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Raath Enterprise ERP &mdash; Confidential</div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const printLedgerStatement = () => {
    if (!selectedCustomer || !ledgerData.length) return;
    const w = window.open('', '_blank');
    if (!w) { setSnackbar({ open: true, message: 'Popup blocked!', severity: 'warning' }); return; }

    const rows = ledgerData.map(e => {
      const items = Array.isArray(e.items) ? e.items : safeJsonParse(e.items_json, []);
      const itemsHtml = items.length ? `<ul style="margin:4px 0;padding-left:16px;font-size:11px;color:#555">${items.map(i => `<li>${i.name || i.item_name || 'Item'} x${i.quantity || i.qty || 1} @ Rs. ${Number(i.price || i.sale_price || 0).toLocaleString('en-PK',{minimumFractionDigits:2})}${i.discount ? ` (Disc: Rs. ${Number(i.discount).toLocaleString('en-PK',{minimumFractionDigits:2})})` : ''} = Rs. ${Number(i.total || ((Number(i.price||i.sale_price||0)*Number(i.quantity||i.qty||1))-Number(i.discount||0))).toLocaleString('en-PK',{minimumFractionDigits:2})}</li>`).join('')}</ul>` : '';
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${e.date ? new Date(e.date).toLocaleDateString('en-PK') : '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${e.type ? e.type.replace(/_/g,' ') : ''}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${e.description || ''}${itemsHtml}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${e.amount ? 'Rs. ' + Number(e.amount).toLocaleString('en-PK',{minimumFractionDigits:2}) : '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">Rs. ${Number(e.balance_after||0).toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:uppercase;font-size:11px">${e.payment_mode || '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px">${e.reference_no || '-'}</td>
        </tr>
      `;
    }).join('');

    w.document.write(`
      <!DOCTYPE html><html><head><title>Customer Statement</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111}
        .h{text-align:center;margin-bottom:20px}
        .h h1{margin:0;font-size:22px}
        .h p{margin:4px 0;color:#666;font-size:13px}
        .info{display:flex;justify-content:space-between;margin:16px 0;padding:16px;background:#f9fafb;border-radius:8px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
        th{background:#f3f4f6;padding:10px 8px;text-align:left;font-weight:bold;border-bottom:2px solid #d1d5db}
        .bal{font-size:18px;font-weight:bold;color:${Number(selectedCustomer.current_balance)>0?'#dc2626':'#059669'}}
      </style></head>
      <body>
        <div class="h"><h1>Customer Statement</h1><p>${selectedCustomer.name}</p></div>
        <div class="info">
          <div><strong>Phone:</strong> ${selectedCustomer.phone || 'N/A'}<br><strong>Shop:</strong> ${selectedCustomer.shop_name || 'N/A'}<br><strong>Type:</strong> ${selectedCustomer.customer_type || 'retail'}</div>
          <div style="text-align:right"><div class="bal">Rs. ${Number(selectedCustomer.current_balance||0).toLocaleString('en-PK',{minimumFractionDigits:2})}</div><div style="font-size:12px;color:#666">Current Balance</div></div>
        </div>
        <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance</th><th>Mode</th><th>Ref#</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="margin-top:24px;font-size:11px;color:#999;text-align:center">Raath Enterprise ERP &mdash; Generated ${new Date().toLocaleString('en-PK')}</div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1.5 : 3, maxWidth: 1600, mx: 'auto', pb: isMobile ? 10 : 4 }}>

      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 3, gap: 1.5 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <People color="primary" sx={{ fontSize: isMobile ? 30 : 36 }} />
          Customer Management
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={exportPDF} size={isMobile ? 'small' : 'medium'}>
            Export PDF
          </Button>
          {can('customers', 'add') && (
            <Button variant="contained" startIcon={<Add />} onClick={() => { resetForm(); setShowForm(true); }} size={isMobile ? 'small' : 'medium'}>
              Add Customer
            </Button>
          )}
        </Stack>
      </Box>

      {/* STATS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #10b981', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Total Customers</Typography>
            <Typography variant="h5" fontWeight="bold">{stats.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, bgcolor: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Active</Typography>
            <Typography variant="h5" fontWeight="bold">{stats.active}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, bgcolor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Receivables</Typography>
            <Typography variant="h5" fontWeight="bold" color="error">{formatPKR(stats.totalBalance)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, bgcolor: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">With Due</Typography>
            <Typography variant="h5" fontWeight="bold" color="warning.main">{stats.withDue}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* FILTERS */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth size="small" placeholder="Search name, phone, shop..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Close fontSize="small" /></IconButton></InputAdornment> : null
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="retail">Retail</MenuItem>
                <MenuItem value="wholesale">Wholesale</MenuItem>
                <MenuItem value="kirana">Kirana</MenuItem>
                <MenuItem value="walk_in">Walk-in</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Balance</InputLabel>
              <Select value={filterBalance} onChange={(e) => setFilterBalance(e.target.value)} label="Balance">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="due">Due (Receivable)</MenuItem>
                <MenuItem value="advance">Advance (Paid Extra)</MenuItem>
                <MenuItem value="settled">Settled (Zero)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadCustomers} disabled={loading} size="small">
              {loading ? <CircularProgress size={16} /> : 'Refresh'}
            </Button>
          </Grid>
        </Grid>
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Paper>

      {/* LIST */}
      {isMobile ? (
        <Box>
          {paginated.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <People sx={{ fontSize: 60, color: '#d1d5db', mb: 1 }} />
              <Typography color="text.secondary">No customers found</Typography>
            </Paper>
          ) : (
            paginated.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                onEdit={editCustomer}
                onDelete={deleteCustomer}
                onViewHistory={openLedger}
                onAddPayment={openPayment}
                canEdit={can('customers', 'edit')}
                canDelete={can('customers', 'delete')}
              />
            ))
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Shop / Location</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }} align="right">Balance</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Search sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                    <Typography color="text.secondary">No customers match your filters</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => (
                  <TableRow key={c.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: Number(c.current_balance) > 0 ? '#ef4444' : Number(c.current_balance) < 0 ? '#10b981' : '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          {c.name?.charAt(0)?.toUpperCase() || 'C'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                          {c.cnic && <Typography variant="caption" color="text.secondary">CNIC: {c.cnic}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.phone}</Typography>
                      {c.email && <Typography variant="caption" color="text.secondary">{c.email}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.shop_name || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.district || ''}{c.district && c.province ? ', ' : ''}{c.province || ''}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={c.customer_type || 'retail'} size="small" color={c.customer_type === 'wholesale' ? 'secondary' : c.customer_type === 'kirana' ? 'warning' : 'primary'} variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color={getBalanceColor(c.current_balance)} sx={{ fontSize: '0.9rem' }}>
                        {formatPKR(c.current_balance)}
                      </Typography>
                      {c.total_transactions > 0 && (
                        <Typography variant="caption" color="text.secondary">{c.total_transactions} txns</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="View History"><IconButton size="small" onClick={() => openLedger(c)} color="info"><History fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Add Payment"><IconButton size="small" onClick={() => openPayment(c)} color="success"><Payment fontSize="small" /></IconButton></Tooltip>
                        {can('customers', 'edit') && <Tooltip title="Edit"><IconButton size="small" onClick={() => editCustomer(c)} color="primary"><Edit fontSize="small" /></IconButton></Tooltip>}
                        {can('customers', 'delete') && <Tooltip title="Delete"><IconButton size="small" onClick={() => deleteCustomer(c.id)} color="error"><Delete fontSize="small" /></IconButton></Tooltip>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* PAGINATION */}
      {filtered.length > rowsPerPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}

      {/* ==================== ADD/EDIT DIALOG ==================== */}
      <Dialog open={showForm} onClose={() => { setShowForm(false); resetForm(); }} maxWidth="md" fullWidth fullScreen={isMobile} scroll="paper">
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person /> {editingId ? 'Edit Customer' : 'Add New Customer'}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => { setShowForm(false); resetForm(); }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <form id="customer-form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="name" label="Customer Name *" value={form.name} onChange={handleChange} error={!!formErrors.name} helperText={formErrors.name} required
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="phone" label="Phone Number *" value={form.phone} onChange={handleChange} error={!!formErrors.phone} helperText={formErrors.phone} required
                  InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="email" label="Email" type="email" value={form.email} onChange={handleChange} error={!!formErrors.email} helperText={formErrors.email}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="cnic" label="CNIC" value={form.cnic} onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="shop_name" label="Shop Name" value={form.shop_name} onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Store fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Customer Type</InputLabel>
                  <Select name="customer_type" value={form.customer_type} onChange={handleChange} label="Customer Type">
                    <MenuItem value="retail">Retail</MenuItem>
                    <MenuItem value="wholesale">Wholesale</MenuItem>
                    <MenuItem value="kirana">Kirana</MenuItem>
                    <MenuItem value="walk_in">Walk-in</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="address" label="Address" value={form.address} onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" name="district" label="District" value={form.district} onChange={handleChange} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Province</InputLabel>
                  <Select name="province" value={form.province} onChange={handleChange} label="Province">
                    <MenuItem value="">Select</MenuItem>
                    {provinces.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" name="opening_balance" label="Opening Balance" type="number" value={form.opening_balance} onChange={handleChange} error={!!formErrors.opening_balance} helperText={formErrors.opening_balance || (!editingId ? 'Auto-added to ledger' : '')}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }} disabled={!!editingId} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" name="credit_limit" label="Credit Limit" type="number" value={form.credit_limit} onChange={handleChange} error={!!formErrors.credit_limit} helperText={formErrors.credit_limit}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AccountBalanceWallet fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Terms</InputLabel>
                  <Select name="payment_terms" value={form.payment_terms} onChange={handleChange} label="Payment Terms">
                    <MenuItem value="cash">Cash (Immediate)</MenuItem>
                    <MenuItem value="7_days">7 Days</MenuItem>
                    <MenuItem value="15_days">15 Days</MenuItem>
                    <MenuItem value="30_days">30 Days</MenuItem>
                    <MenuItem value="monthly">Monthly (Kirana)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="reference_name" label="Reference Name" value={form.reference_name} onChange={handleChange} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="reference_phone" label="Reference Phone" value={form.reference_phone} onChange={handleChange} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select name="status" value={form.status} onChange={handleChange} label="Status">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="notes" label="Notes" multiline rows={2} value={form.notes} onChange={handleChange} />
              </Grid>
            </Grid>
          </form>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: 1 }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
          <Button fullWidth={isMobile} type="submit" form="customer-form" variant="contained" startIcon={editingId ? <Save /> : <Add />} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
            {editingId ? 'Update Customer' : 'Save Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== LEDGER / HISTORY DIALOG ==================== */}
      <Dialog open={showLedger} onClose={() => setShowLedger(false)} maxWidth="lg" fullWidth fullScreen={isMobile} scroll="paper">
        <DialogTitle sx={{ bgcolor: '#3b82f6', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt /> {selectedCustomer?.name} &mdash; Transaction History
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" variant="contained" startIcon={<PictureAsPdf />} onClick={printLedgerStatement} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover':{bgcolor:'rgba(255,255,255,0.35)'} }}>
              Print Statement
            </Button>
            <IconButton size="small" sx={{ color: 'white' }} onClick={() => setShowLedger(false)}><Close /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1 : 3 }}>
          {selectedCustomer && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Current Balance</Typography>
                <Typography variant="h5" fontWeight="bold" color={getBalanceColor(selectedCustomer.current_balance)}>
                  {formatPKR(selectedCustomer.current_balance)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">{selectedCustomer.phone}</Typography>
                <Typography variant="body2">{selectedCustomer.shop_name || 'No Shop'}</Typography>
              </Box>
            </Paper>
          )}

          <Tabs value={ledgerTab} onChange={(e, v) => setLedgerTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
            <Tab label="All" value="all" />
            <Tab label="Sales" value="credit_sale" />
            <Tab label="Payments" value="payment" />
            <Tab label="Opening" value="opening_balance" />
            <Tab label="Adjustments" value="adjustment" />
          </Tabs>

          {ledgerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : filteredLedger.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <History sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
              <Typography color="text.secondary">No transactions found</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Description / Items</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Prev Balance</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Balance After</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Mode</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Ref#</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLedger.map((entry, idx) => {
                    const items = Array.isArray(entry.items) ? entry.items : safeJsonParse(entry.items_json, []);
                    const typeInfo = getLedgerTypeChip(entry.type);
                    return (
                      <TableRow key={entry.id || idx} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {entry.date ? new Date(entry.date).toLocaleDateString('en-PK') : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip label={typeInfo.label} size="small" color={typeInfo.color} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{entry.description || '-'}</Typography>
                          {entry.invoice_no && (
                            <Typography variant="caption" color="text.secondary">Invoice: {entry.invoice_no}</Typography>
                          )}
                          {items.length > 0 && (
                            <Box sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid #e2e8f0' }}>
                              {items.map((it, i) => (
                                <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                  &bull; {it.name || it.item_name || 'Item'} &times; {it.quantity || it.qty || 1} @ {formatPKR(it.price || it.sale_price || 0)}
                                  {(it.discount || 0) > 0 && <span style={{ color: '#ef4444' }}> (Disc: {formatPKR(it.discount)})</span>}
                                  {' = '}<strong>{formatPKR(it.total || ((Number(it.price || it.sale_price || 0) * Number(it.quantity || it.qty || 1)) - Number(it.discount || 0)))}</strong>
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color={Number(entry.amount) > 0 ? 'error' : Number(entry.amount) < 0 ? 'success' : 'text.primary'} sx={{ fontSize: '0.85rem' }}>
                            {typeof entry.amount === 'number' ? formatPKR(entry.amount) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: '#64748b' }}>{formatPKR(entry.previous_balance)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatPKR(entry.balance_after)}</TableCell>
                        <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{entry.payment_mode || '-'}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{entry.reference_no || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setShowLedger(false)} startIcon={<ArrowBack />}>Close</Button>
          <Button variant="contained" startIcon={<Payment />} onClick={() => { setShowLedger(false); openPayment(selectedCustomer); }} sx={{ bgcolor: '#10b981' }}>
            Add Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== PAYMENT DIALOG ==================== */}
      <Dialog open={showPayment} onClose={() => setShowPayment(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#059669', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment /> Record Payment &mdash; {selectedCustomer?.name}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => setShowPayment(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedCustomer && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#f0fdf4', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Current Balance</Typography>
                <Typography variant="h6" fontWeight="bold" color={getBalanceColor(selectedCustomer.current_balance)}>
                  {formatPKR(selectedCustomer.current_balance)}
                </Typography>
              </Box>
              <Chip label={Number(selectedCustomer.current_balance) > 0 ? 'Amount Due' : Number(selectedCustomer.current_balance) < 0 ? 'Advance' : 'Settled'} color={getBalanceColor(selectedCustomer.current_balance)} />
            </Paper>
          )}
          <form id="payment-form" onSubmit={submitPayment}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth size="small" name="amount" label="Payment Amount *" type="number" required autoFocus
                  value={paymentForm.amount} onChange={handlePaymentChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }}
                  helperText={Number(selectedCustomer?.current_balance) > 0 ? `Due: ${formatPKR(selectedCustomer.current_balance)}` : 'Enter amount received from customer'} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode *</InputLabel>
                  <Select name="payment_mode" value={paymentForm.payment_mode} onChange={handlePaymentChange} label="Payment Mode *" required>
                    {paymentModes.map(m => <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {selectedPaymentAccount && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Payment will go to</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.dark">
                        {selectedPaymentAccount.name} ({selectedPaymentAccount.type?.toUpperCase()})
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      Bal: {formatPKR(selectedPaymentAccount.current_balance)}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {!selectedPaymentAccount && paymentForm.payment_mode && paymentAccounts.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    No active account found for <strong>{paymentForm.payment_mode.replace(/_/g, ' ')}</strong>. Please create this account in Accounts page first.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" name="date" label="Date & Time" type="datetime-local"
                  value={paymentForm.date} onChange={handlePaymentChange}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" name="reference_no" label="Reference / Cheque #" value={paymentForm.reference_no} onChange={handlePaymentChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Receipt fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" name="note" label="Note / Remarks" multiline rows={2} value={paymentForm.note} onChange={handlePaymentChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }} />
              </Grid>
            </Grid>
          </form>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: 1 }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setShowPayment(false)}>Cancel</Button>
          <Button fullWidth={isMobile} type="submit" form="payment-form" variant="contained" disabled={paymentLoading}
            startIcon={paymentLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircle />}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
            {paymentLoading ? 'Processing...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 2 : 0 }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
