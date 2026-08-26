import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Fade, Alert, Snackbar,
  Stack, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme,
  Drawer, Divider, List, ListItem, ListItemText, ListItemIcon,
  InputAdornment, Tooltip, LinearProgress, Switch, Avatar,
  Autocomplete, CardActions, FormControlLabel, Collapse,
  Badge, ButtonGroup
} from '@mui/material';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error as ErrorIcon, TrendingUp,
  AccountBalanceWallet, Visibility, Menu as MenuIcon, Close,
  ArrowUpward, ArrowDownward, Receipt, AttachMoney, MonetizationOn,
  CreditCard, LocalAtm, Print, CalendarToday, Delete, Edit,
  ReceiptLong, QrCode, VerifiedUser, DoneAll, PowerSettingsNew,
  VisibilityOff, ShoppingCart, Inventory, Restore, AssignmentInd,
  BarChart, AttachFile, Save, Add, AdminPanelSettings, Group, Remove,
  ExpandMore, ExpandLess, Category, PersonAdd, Description
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

// ==================== MAIN COMPONENT ====================
export default function SalesmanPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // ---- Data States ----
  const [salesmen, setSalesmen] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Use ref to prevent multiple loads
  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  // ---- Form States (Add Salesman) ----
  const [salesmanDialog, setSalesmanDialog] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState(null);
  const [salesmanForm, setSalesmanForm] = useState({
    name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0],
    target_amount: 0, commission_percent: 0, status: 'active'
  });

  // ---- Form States (Add Sale) ----
  const [saleForm, setSaleForm] = useState({
    salesman_id: '',
    customer_id: '',
    customer_name: '',
    location: 'Main Branch',
    sale_date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    payment_term: 0,
    payment_term_type: 'Days',
    discount_type: 'Fixed Amount',
    discount_value: 0,
    order_tax: 0,
    shipping_charges: 0,
    note: '',
    payment_mode: 'Cash'
  });

  const [cartItems, setCartItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  
  // ---- Customer Dialog ----
  const [customerDialog, setCustomerDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);
  
  // ---- Salesman Stats Dialog ----
  const [statsDialog, setStatsDialog] = useState(false);
  const [selectedSalesmanStats, setSelectedSalesmanStats] = useState(null);
  const [salesmanDetail, setSalesmanDetail] = useState(null);

  // ---- Filters for Report ----
  const [reportFilter, setReportFilter] = useState({ salesman_id: '', start_date: '', end_date: '' });

  // ==================== LOAD DATA ====================
  // FIX 1: Remove useCallback and use a stable reference with useRef to prevent infinite loops
  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    setLoading(true);
    try {
      // Fetch all relevant data
      const [salesmenData, salesData, productsWithCat, customersData] = await Promise.all([
        db.getAllSalesmen ? db.getAllSalesmen() : [],
        db.getSalesmanSales ? db.getSalesmanSales() : [],
        db.getProductsWithCategories ? db.getProductsWithCategories() : [],
        db.getCustomers ? db.getCustomers() : []
      ]);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setSalesmen(salesmenData || []);
        setSalesList(salesData || []);
        
        // Process products with categories
        if (productsWithCat && productsWithCat.length > 0) {
          setProductsData(productsWithCat);
          // Initialize expanded state for all categories
          const expanded = {};
          productsWithCat.forEach(cat => {
            expanded[cat.category_id || 'uncategorized'] = true;
          });
          setExpandedCategories(expanded);
        }
        
        setCustomers(customersData || []);
      }
    } catch (err) {
      console.error('Load error:', err);
      if (isMounted.current) {
        setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, []); // Empty dependency array - only created once

  // FIX 2: Use a stable effect with cleanup
  useEffect(() => {
    isMounted.current = true;
    loadData();
    
    // Cleanup
    return () => {
      isMounted.current = false;
    };
  }, [loadData]); // Only depends on stable loadData

  // ==================== SALESMAN CRUD OPERATIONS ====================
  const handleSaveSalesman = async () => {
    if (!salesmanForm.name.trim()) {
      setSnackbar({ open: true, message: 'Salesman Name is required!', severity: 'warning' });
      return;
    }

    setLoading(true);
    try {
      if (editingSalesman) {
        await db.updateSalesman(editingSalesman.id, salesmanForm);
        setSnackbar({ open: true, message: '✅ Salesman Updated!', severity: 'success' });
      } else {
        await db.addSalesman(salesmanForm);
        setSnackbar({ open: true, message: '✅ New Salesman Added!', severity: 'success' });
      }
      setSalesmanDialog(false);
      setEditingSalesman(null);
      setSalesmanForm({ name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0], target_amount: 0, commission_percent: 0, status: 'active' });
      await loadData(); // Reload data
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSalesman = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salesman?')) return;
    try {
      await db.deleteSalesman(id);
      setSnackbar({ open: true, message: '🗑️ Salesman deleted.', severity: 'info' });
      await loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== SALE OPERATIONS ====================
  const handleAddToCart = useCallback((product) => {
    const price = product.retail_price || product.price || 0;
    const productName = product.product_name || product.name || 'Product';
    
    setCartItems(prev => {
      const existing = prev.find(p => p.variant_id === product.variant_id);
      if (existing) {
        return prev.map(p => 
          p.variant_id === product.variant_id 
            ? { ...p, qty: p.qty + 1, total: (p.qty + 1) * p.price } 
            : p
        );
      }
      return [...prev, {
        variant_id: product.variant_id,
        product_id: product.id,
        product_name: productName,
        sku: product.sku || '',
        qty: 1,
        price: price,
        total: price
      }];
    });
  }, []);

  const updateCartQty = useCallback((variantId, newQty) => {
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(p => p.variant_id !== variantId));
      return;
    }
    setCartItems(prev => prev.map(p => 
      p.variant_id === variantId ? { ...p, qty: newQty, total: newQty * p.price } : p
    ));
  }, []);

  const resetSaleForm = useCallback(() => {
    setCartItems([]);
    setSaleForm({
      salesman_id: '', customer_id: '', customer_name: '', location: 'Main Branch', 
      sale_date: new Date().toISOString().split('T')[0],
      status: 'Pending', payment_term: 0, payment_term_type: 'Days',
      discount_type: 'Fixed Amount', discount_value: 0, order_tax: 0, 
      shipping_charges: 0, note: '', payment_mode: 'Cash'
    });
  }, []);

  const handleSaveSale = async () => {
    if (cartItems.length === 0) {
      setSnackbar({ open: true, message: 'Please add at least one product!', severity: 'warning' });
      return;
    }
    if (!saleForm.salesman_id) {
      setSnackbar({ open: true, message: 'Please assign a Salesman!', severity: 'warning' });
      return;
    }

    setLoading(true);
    try {
      // Calculate totals
      const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
      const discount = saleForm.discount_type === 'Fixed Amount' 
        ? parseFloat(saleForm.discount_value || 0) 
        : (subtotal * (parseFloat(saleForm.discount_value || 0) / 100));
      const afterDisc = Math.max(0, subtotal - discount);
      const tax = afterDisc * (parseFloat(saleForm.order_tax || 0) / 100);
      const shipping = parseFloat(saleForm.shipping_charges || 0);
      const grandTotal = afterDisc + tax + shipping;
      
      // Calculate commission
      const salesman = salesmen.find(s => s.id === saleForm.salesman_id);
      const commissionRate = salesman?.commission_percent || 0;
      const commissionAmount = grandTotal * (commissionRate / 100);

      const saleData = {
        salesman_id: saleForm.salesman_id,
        customer_id: saleForm.customer_id || null,
        customer_name: saleForm.customer_name || '',
        location: saleForm.location,
        sale_date: saleForm.sale_date,
        status: saleForm.status,
        subtotal, 
        discount, 
        tax, 
        shipping, 
        grand_total: grandTotal,
        payment_mode: saleForm.payment_mode,
        payment_term: saleForm.payment_term,
        payment_term_type: saleForm.payment_term_type,
        paid_amount: 0,
        due_amount: grandTotal,
        note: saleForm.note,
        commission_amount: commissionAmount,
        items: cartItems.map(item => ({
          product_variant_id: item.variant_id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          quantity: item.qty,
          price: item.price,
          total: item.total
        }))
      };

      await db.addSalesmanSale(saleData);
      
      setSnackbar({ 
        open: true, 
        message: `✅ Sale Saved! Total: ${formatCurrency(grandTotal)} | Commission: ${formatCurrency(commissionAmount)}`, 
        severity: 'success' 
      });
      resetSaleForm();
      await loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving sale: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ==================== CUSTOMER DETAILS ====================
  const handleViewCustomer = async (customerId) => {
    setLoading(true);
    try {
      const [history, stats] = await Promise.all([
        db.getCustomerSalesHistory(customerId),
        db.getCustomerTotalStats(customerId)
      ]);
      if (isMounted.current) {
        setCustomerHistory(history || []);
        setCustomerStats(stats || null);
        const customer = customers.find(c => c.id === customerId);
        setSelectedCustomer(customer || null);
        setCustomerDialog(true);
      }
    } catch (err) {
      if (isMounted.current) {
        setSnackbar({ open: true, message: 'Error loading customer data: ' + err.message, severity: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // ==================== SALESMAN STATS ====================
  const handleViewSalesmanStats = async (salesmanId) => {
    setLoading(true);
    try {
      const [stats, sales] = await Promise.all([
        db.getSalesmanStats(salesmanId),
        db.getSalesmanSales({ salesman_id: salesmanId })
      ]);
      if (isMounted.current) {
        setSelectedSalesmanStats(stats || { stats: {}, monthly: [] });
        const salesman = salesmen.find(s => s.id === salesmanId);
        setSalesmanDetail(salesman || null);
        setSalesList(sales || []);
        setStatsDialog(true);
      }
    } catch (err) {
      if (isMounted.current) {
        setSnackbar({ open: true, message: 'Error loading stats: ' + err.message, severity: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // ==================== CALCULATIONS (Sale Form) ====================
  // FIX 3: Memoize with proper dependencies
  const saleCalculations = useMemo(() => {
    const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
    const discount = saleForm.discount_type === 'Fixed Amount' 
      ? parseFloat(saleForm.discount_value || 0) 
      : (subtotal * (parseFloat(saleForm.discount_value || 0) / 100));
    const afterDisc = Math.max(0, subtotal - discount);
    const tax = afterDisc * (parseFloat(saleForm.order_tax || 0) / 100);
    const shipping = parseFloat(saleForm.shipping_charges || 0);
    const grandTotal = afterDisc + tax + shipping;
    
    const salesman = salesmen.find(s => s.id === saleForm.salesman_id);
    const commissionRate = salesman?.commission_percent || 0;
    const commissionAmount = grandTotal * (commissionRate / 100);
    
    return { subtotal, discount, tax, shipping, grandTotal, commissionRate, commissionAmount };
  }, [cartItems, saleForm.discount_type, saleForm.discount_value, saleForm.order_tax, saleForm.shipping_charges, saleForm.salesman_id, salesmen]);

  // ==================== FILTERED SALES ====================
  const filteredSales = useMemo(() => {
    let data = salesList;
    if (reportFilter.salesman_id) data = data.filter(s => String(s.salesman_id) === String(reportFilter.salesman_id));
    if (reportFilter.start_date) data = data.filter(s => new Date(s.sale_date) >= new Date(reportFilter.start_date));
    if (reportFilter.end_date) data = data.filter(s => new Date(s.sale_date) <= new Date(reportFilter.end_date));
    return data;
  }, [salesList, reportFilter.salesman_id, reportFilter.start_date, reportFilter.end_date]);

  // ==================== TOGGLE CATEGORY ====================
  const toggleCategory = useCallback((catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  }, []);

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3, bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: '#6C63FF', width: 40, height: 40 }}><AssignmentInd /></Avatar>
            <Box>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="#1a1a1a">
                Salesman & Distributor Module
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Manage your field team, track sales, and generate payroll insights.
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingSalesman(null); setSalesmanForm({ name: '', phone: '', cnic: '', address: '', joining_date: new Date().toISOString().split('T')[0], target_amount: 0, commission_percent: 0, status: 'active' }); setSalesmanDialog(true); }} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }}>
            Add Salesman
          </Button>
        </Box>
      </Paper>

      {/* TABS */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'standard'}
          centered={!isMobile}
          sx={{ 
            bgcolor: 'white',
            '& .MuiTab-root': { fontWeight: 600, fontSize: isMobile ? '0.7rem' : '0.9rem', py: 1.5 },
            '& .Mui-selected': { color: '#6C63FF' },
            '& .MuiTabs-indicator': { bgcolor: '#6C63FF' }
          }}
        >
          <Tab icon={<Group />} iconPosition="start" label={isMobile ? 'Team' : 'Manage Salesmen'} />
          <Tab icon={<ShoppingCart />} iconPosition="start" label={isMobile ? 'Sale' : 'Add New Sale'} />
          <Tab icon={<BarChart />} iconPosition="start" label={isMobile ? 'Report' : 'Sales Report'} />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: SALESMEN LIST ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Grid container spacing={2}>
              {salesmen.map((sm) => (
                <Grid item xs={12} sm={6} md={4} key={sm.id}>
                  <Card sx={{ height: '100%', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', position: 'relative' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: sm.status === 'active' ? '#10b981' : '#9ca3af', width: 45, height: 45 }}>
                            {sm.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">{sm.name}</Typography>
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                              <Phone sx={{ fontSize: 14 }} /> {sm.phone || 'N/A'}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={sm.status === 'active' ? 'Active' : 'Inactive'} 
                              color={sm.status === 'active' ? 'success' : 'default'} 
                              sx={{ height: 18, fontSize: '0.5rem', mt: 0.5 }} 
                            />
                          </Box>
                        </Box>
                        <Tooltip title="View Stats">
                          <IconButton size="small" color="primary" onClick={() => handleViewSalesmanStats(sm.id)}>
                            <BarChart fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">CNIC</Typography>
                        <Typography variant="caption" fontWeight={500}>{sm.cnic || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Joining Date</Typography>
                        <Typography variant="caption" fontWeight={500}>{formatDate(sm.joining_date)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Target</Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary">{formatCurrency(sm.target_amount)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Commission</Typography>
                        <Typography variant="caption" fontWeight="bold" color="success.main">{sm.commission_percent || 0}%</Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => { setEditingSalesman(sm); setSalesmanForm(sm); setSalesmanDialog(true); }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteSalesman(sm.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              {salesmen.length === 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '2px dashed #e5e7eb' }}>
                    <Group sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>No salesmen added yet. Click "Add Salesman" to get started.</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: ADD NEW SALE ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Paper sx={{ p: isMobile ? 2 : 4, borderRadius: 2, bgcolor: 'white' }}>
            <Typography variant="h6" fontWeight="bold" color="#1a1a1a" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt sx={{ color: '#6C63FF' }} /> Add New Sale
            </Typography>
            
            <Grid container spacing={3}>
              {/* ---- Sale Info ---- */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Salesman *</InputLabel>
                  <Select value={saleForm.salesman_id} onChange={(e) => setSaleForm({...saleForm, salesman_id: e.target.value})} label="Select Salesman *">
                    <MenuItem value="">Select...</MenuItem>
                    {salesmen.filter(s => s.status === 'active').map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Customer</InputLabel>
                  <Select 
                    value={saleForm.customer_id} 
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      setSaleForm({
                        ...saleForm, 
                        customer_id: e.target.value,
                        customer_name: customer?.name || ''
                      });
                    }} 
                    label="Customer"
                  >
                    <MenuItem value="">Walk-in Customer</MenuItem>
                    {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Customer Name" value={saleForm.customer_name} onChange={(e) => setSaleForm({...saleForm, customer_name: e.target.value})} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Location" value={saleForm.location} onChange={(e) => setSaleForm({...saleForm, location: e.target.value})} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" type="date" label="Sale Date" value={saleForm.sale_date} onChange={(e) => setSaleForm({...saleForm, sale_date: e.target.value})} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sale Status</InputLabel>
                  <Select value={saleForm.status} onChange={(e) => setSaleForm({...saleForm, status: e.target.value})} label="Sale Status">
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select value={saleForm.payment_mode} onChange={(e) => setSaleForm({...saleForm, payment_mode: e.target.value})} label="Payment Mode">
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Bank">Bank Transfer</MenuItem>
                    <MenuItem value="Credit">Credit</MenuItem>
                    <MenuItem value="Cheque">Cheque</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" type="number" label="Payment Term (Days)" value={saleForm.payment_term} onChange={(e) => setSaleForm({...saleForm, payment_term: e.target.value})} />
              </Grid>

              {/* ---- Product Categories ---- */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Category sx={{ color: '#6C63FF' }} /> Select Products by Category
                </Typography>
                
                {productsData.map((category) => (
                  <Card key={category.category_id || 'uncategorized'} variant="outlined" sx={{ mb: 1, borderColor: '#e5e7eb' }}>
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        bgcolor: expandedCategories[category.category_id || 'uncategorized'] ? '#f0f0ff' : 'white',
                        '&:hover': { bgcolor: '#f5f5ff' }
                      }}
                      onClick={() => toggleCategory(category.category_id || 'uncategorized')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Category sx={{ color: '#6C63FF' }} />
                        <Typography variant="subtitle2" fontWeight="bold">
                          {category.category_name}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={`${category.products?.length || 0} products`} 
                          color="primary" 
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.6rem' }}
                        />
                      </Box>
                      {expandedCategories[category.category_id || 'uncategorized'] ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                    <Collapse in={expandedCategories[category.category_id || 'uncategorized']}>
                      <Divider />
                      <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {category.products?.map((product) => (
                          <Chip
                            key={product.variant_id || product.id}
                            label={`${product.product_name || product.name} ${product.sku ? `(${product.sku})` : ''} - ${formatCurrency(product.retail_price || product.price || 0)}`}
                            onClick={() => handleAddToCart(product)}
                            icon={<Add fontSize="small" />}
                            color="primary"
                            variant="outlined"
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#6C63FF', color: 'white' },
                              transition: 'all 0.2s'
                            }}
                          />
                        ))}
                        {(!category.products || category.products.length === 0) && (
                          <Typography variant="caption" color="text.secondary">No products in this category</Typography>
                        )}
                      </Box>
                    </Collapse>
                  </Card>
                ))}
                
                {productsData.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No products found. Please add products first.
                  </Typography>
                )}
              </Grid>

              {/* ---- Cart Table ---- */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingCart sx={{ color: '#6C63FF' }} /> Cart ({cartItems.length} items)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #e5e7eb' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#6C63FF' }}>
                      <TableRow>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Qty</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Price</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cartItems.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{item.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => updateCartQty(item.variant_id, item.qty - 1)}><Remove fontSize="small" /></IconButton>
                            <Typography component="span" sx={{ mx: 1, fontWeight: 'bold', minWidth: 20, display: 'inline-block', textAlign: 'center' }}>{item.qty}</Typography>
                            <IconButton size="small" onClick={() => updateCartQty(item.variant_id, item.qty + 1)}><Add fontSize="small" /></IconButton>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                          <TableCell align="right" fontWeight="bold">{formatCurrency(item.total)}</TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => updateCartQty(item.variant_id, 0)}><Delete fontSize="small" /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cartItems.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>Click on products above to add to cart.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* ---- Discounts & Charges ---- */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Discount Type</InputLabel>
                  <Select value={saleForm.discount_type} onChange={(e) => setSaleForm({...saleForm, discount_type: e.target.value})} label="Discount Type">
                    <MenuItem value="Fixed Amount">Fixed Amount</MenuItem>
                    <MenuItem value="Percentage">Percentage</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" type="number" label="Discount Value" value={saleForm.discount_value} onChange={(e) => setSaleForm({...saleForm, discount_value: e.target.value})} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" type="number" label="Tax (%)" value={saleForm.order_tax} onChange={(e) => setSaleForm({...saleForm, order_tax: e.target.value})} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="number" label="Shipping Charges" value={saleForm.shipping_charges} onChange={(e) => setSaleForm({...saleForm, shipping_charges: e.target.value})} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" multiline rows={2} label="Additional Notes" value={saleForm.note} onChange={(e) => setSaleForm({...saleForm, note: e.target.value})} />
              </Grid>

              {/* ---- Order Summary ---- */}
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ bgcolor: '#f8f9fa', borderColor: '#e5e7eb' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BarChart sx={{ color: '#6C63FF' }} /> Order Summary
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                        <Typography variant="h6" fontWeight="bold">{formatCurrency(saleCalculations.subtotal)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Discount</Typography>
                        <Typography variant="h6" fontWeight="bold" color="error.main">- {formatCurrency(saleCalculations.discount)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Tax</Typography>
                        <Typography variant="h6" fontWeight="bold">+ {formatCurrency(saleCalculations.tax)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">Shipping</Typography>
                        <Typography variant="h6" fontWeight="bold">+ {formatCurrency(saleCalculations.shipping)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120, borderTop: '2px solid #6C63FF', pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">Commission ({saleCalculations.commissionRate}%)</Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(saleCalculations.commissionAmount)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 150, borderTop: '2px solid #6C63FF', pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">Total Payable</Typography>
                        <Typography variant="h5" fontWeight="bold" color="#6C63FF">{formatCurrency(saleCalculations.grandTotal)}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                  <Button variant="outlined" color="error" onClick={resetSaleForm}>Cancel</Button>
                  <Button variant="contained" onClick={handleSaveSale} disabled={loading || cartItems.length === 0} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }}>
                    {loading ? 'Saving...' : 'Save Sale'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Fade>
      )}

      {/* ==================== TAB 2: SALES REPORT ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Salesman</InputLabel>
                    <Select value={reportFilter.salesman_id} onChange={(e) => setReportFilter({...reportFilter, salesman_id: e.target.value})} label="Filter by Salesman">
                      <MenuItem value="">All Salesmen</MenuItem>
                      {salesmen.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="From Date" value={reportFilter.start_date} onChange={(e) => setReportFilter({...reportFilter, start_date: e.target.value})} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="To Date" value={reportFilter.end_date} onChange={(e) => setReportFilter({...reportFilter, end_date: e.target.value})} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button fullWidth variant="outlined" size="small" onClick={() => setReportFilter({ salesman_id: '', start_date: '', end_date: '' })}>Clear Filters</Button>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#6C63FF' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Salesman</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Subtotal</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Commission</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales found for the selected filters.</TableCell></TableRow>
                    ) : (
                      filteredSales.map((sale) => {
                        const salesman = salesmen.find(s => s.id === sale.salesman_id);
                        return (
                          <TableRow key={sale.id} hover>
                            <TableCell>{formatDate(sale.sale_date)}</TableCell>
                            <TableCell fontWeight="bold">{salesman?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {sale.customer_name || sale.customer_name_full || 'Walk-in'}
                                {sale.customer_id && (
                                  <IconButton size="small" onClick={() => handleViewCustomer(sale.customer_id)}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                label={sale.status} 
                                color={sale.status === 'Completed' ? 'success' : sale.status === 'Pending' ? 'warning' : 'error'} 
                                sx={{ height: 18, fontSize: '0.5rem' }} 
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                label={sale.payment_mode || 'Cash'} 
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.5rem' }} 
                              />
                            </TableCell>
                            <TableCell align="right">{formatCurrency(sale.subtotal)}</TableCell>
                            <TableCell align="right" fontWeight="bold">{formatCurrency(sale.grand_total)}</TableCell>
                            <TableCell align="right" color="success.main">{formatCurrency(sale.commission_amount)}</TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Details">
                                <IconButton size="small" color="primary" onClick={() => {
                                  // Show sale details
                                  setSnackbar({ open: true, message: `Sale #${sale.id} - ${formatCurrency(sale.grand_total)}`, severity: 'info' });
                                }}>
                                  <Receipt fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Total Sales: {formatCurrency(filteredSales.reduce((s, i) => s + (i.grand_total || 0), 0))} 
                  ({filteredSales.length} Invoices)
                </Typography>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main">
                  Total Commission: {formatCurrency(filteredSales.reduce((s, i) => s + (i.commission_amount || 0), 0))}
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* ==================== SALESMAN DIALOG ==================== */}
      <Dialog open={salesmanDialog} onClose={() => setSalesmanDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>
          {editingSalesman ? 'Edit Salesman' : 'Add New Salesman'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="Full Name *" value={salesmanForm.name} onChange={(e) => setSalesmanForm({...salesmanForm, name: e.target.value})} />
            <TextField fullWidth size="small" label="Phone Number" value={salesmanForm.phone} onChange={(e) => setSalesmanForm({...salesmanForm, phone: e.target.value})} />
            <TextField fullWidth size="small" label="CNIC Number" value={salesmanForm.cnic} onChange={(e) => setSalesmanForm({...salesmanForm, cnic: e.target.value})} />
            <TextField fullWidth size="small" label="Address" multiline rows={2} value={salesmanForm.address} onChange={(e) => setSalesmanForm({...salesmanForm, address: e.target.value})} />
            <TextField fullWidth size="small" type="date" label="Joining Date" value={salesmanForm.joining_date} onChange={(e) => setSalesmanForm({...salesmanForm, joining_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth size="small" type="number" label="Monthly Target (PKR)" value={salesmanForm.target_amount} onChange={(e) => setSalesmanForm({...salesmanForm, target_amount: e.target.value})} />
            <TextField fullWidth size="small" type="number" label="Commission %" value={salesmanForm.commission_percent} onChange={(e) => setSalesmanForm({...salesmanForm, commission_percent: e.target.value})} />
            <FormControlLabel 
              control={<Switch checked={salesmanForm.status === 'active'} onChange={(e) => setSalesmanForm({...salesmanForm, status: e.target.checked ? 'active' : 'inactive'})} color="success" />} 
              label={salesmanForm.status === 'active' ? 'Active' : 'Inactive'} 
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setSalesmanDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" onClick={handleSaveSalesman} sx={{ bgcolor: '#6C63FF', '&:hover': { bgcolor: '#5a52d5' } }} disabled={loading}>
            {loading ? 'Saving...' : (editingSalesman ? 'Update Salesman' : 'Add Salesman')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== CUSTOMER HISTORY DIALOG ==================== */}
      <Dialog open={customerDialog} onClose={() => setCustomerDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person /> {selectedCustomer?.name || 'Customer'} - Purchase History
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {customerStats && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Chip label={`Total Purchases: ${customerStats.total_purchases || 0}`} color="primary" />
              <Chip label={`Total Spent: ${formatCurrency(customerStats.total_spent)}`} color="success" />
              <Chip label={`Total Paid: ${formatCurrency(customerStats.total_paid)}`} color="info" />
              <Chip label={`Total Due: ${formatCurrency(customerStats.total_due)}`} color="error" />
              <Chip label={`Salesmen: ${customerStats.salesmen_count || 0}`} variant="outlined" />
            </Box>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f0f0ff' }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Salesman</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Due</TableCell>
                  <TableCell>Payment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customerHistory.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 2 }}>No purchase history found.</TableCell></TableRow>
                ) : (
                  customerHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.sale_date)}</TableCell>
                      <TableCell>{h.salesman_name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(h.total_amount)}</TableCell>
                      <TableCell align="right">{formatCurrency(h.paid_amount)}</TableCell>
                      <TableCell align="right" color="error">{formatCurrency(h.due_amount)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={h.payment_mode || 'Cash'} variant="outlined" sx={{ height: 18, fontSize: '0.5rem' }} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== SALESMAN STATS DIALOG ==================== */}
      <Dialog open={statsDialog} onClose={() => setStatsDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#6C63FF', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart /> {salesmanDetail?.name || 'Salesman'} - Performance Stats
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSalesmanStats && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Chip label={`Total Sales: ${selectedSalesmanStats.stats?.total_sales || 0}`} color="primary" />
                <Chip label={`Total Amount: ${formatCurrency(selectedSalesmanStats.stats?.total_amount || 0)}`} color="success" />
                <Chip label={`Avg Sale: ${formatCurrency(selectedSalesmanStats.stats?.avg_amount || 0)}`} color="info" />
                <Chip label={`Total Commission: ${formatCurrency(selectedSalesmanStats.stats?.total_commission || 0)}`} color="warning" />
                <Chip label={`Unique Customers: ${selectedSalesmanStats.stats?.unique_customers || 0}`} variant="outlined" />
                <Chip label={`Completed: ${formatCurrency(selectedSalesmanStats.stats?.completed_amount || 0)}`} color="success" variant="outlined" />
                <Chip label={`Pending: ${formatCurrency(selectedSalesmanStats.stats?.pending_amount || 0)}`} color="warning" variant="outlined" />
              </Box>
              
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Monthly Breakdown</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f0f0ff' }}>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Sales Count</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSalesmanStats.monthly?.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 2 }}>No monthly data available.</TableCell></TableRow>
                    ) : (
                      selectedSalesmanStats.monthly.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell>{m.month}</TableCell>
                          <TableCell align="right">{m.sales_count}</TableCell>
                          <TableCell align="right">{formatCurrency(m.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ===== SNACKBAR ===== */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}