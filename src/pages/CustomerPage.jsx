import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Card, CardContent, IconButton, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
  Snackbar, Alert, useMediaQuery, useTheme, Collapse,
  Fab, Badge, Avatar, Divider, Stack, Tooltip
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Close, Person, Phone,
  Email, Business, LocationOn, AttachMoney, CreditCard,
  People, Store, Discount, Notes, Save, Cancel,
  FilterList, Refresh, CheckCircle, Error, Warning
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
const formatPKR = (amount) => {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
};

const getBalanceColor = (bal) => {
  if (bal > 0) return 'error';
  if (bal < 0) return 'success';
  return 'default';
};

const provinces = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Gilgit', 'Azad Kashmir', 'Islamabad'];

// ==================== CUSTOMER CARD (Mobile) ====================
const CustomerCard = ({ customer, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, overflow: 'hidden' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#10b981', width: 40, height: 40 }}>
            {customer.name?.charAt(0) || 'C'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap>
              {customer.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                📱 {customer.phone || 'N/A'}
              </Typography>
              <Chip 
                label={customer.customer_type || 'retail'} 
                size="small" 
                color={
                  customer.customer_type === 'wholesale' ? 'secondary' :
                  customer.customer_type === 'kirana' ? 'warning' :
                  'primary'
                }
                sx={{ height: 20, fontSize: '0.6rem' }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography 
              variant="subtitle2" 
              fontWeight="bold"
              color={getBalanceColor(customer.current_balance)}
            >
              {formatPKR(customer.current_balance)}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={() => onEdit(customer)} color="primary">
                <Edit fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(customer.id)} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            {customer.shop_name && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Shop</Typography>
                <Typography variant="body2">{customer.shop_name}</Typography>
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
                <Typography variant="body2">{customer.district}, {customer.province}</Typography>
              </Grid>
            )}
            {customer.credit_limit > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                <Typography variant="body2">{formatPKR(customer.credit_limit)}</Typography>
              </Grid>
            )}
            {customer.notes && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2" color="text.secondary">{customer.notes}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Button
          fullWidth
          size="small"
          variant="text"
          onClick={() => setExpanded(!expanded)}
          sx={{ mt: 1, color: 'text.secondary' }}
        >
          {expanded ? 'Show Less' : 'Show More'}
        </Button>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function CustomerPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // ---- STATE ----
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cnic: '', address: '', district: '',
    province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
    credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
    reference_name: '', reference_phone: ''
  });

  // ---- LOAD ----
  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await db.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Failed to load customers', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ---- HANDLERS ----
  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setSnackbar({ open: true, message: 'Customer Name is required!', severity: 'warning' });
      return;
    }
    
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
        setSnackbar({ open: true, message: 'Customer updated successfully!', severity: 'success' });
      } else {
        const result = await db.createCustomer(data);
        
        if (openingBal > 0 && db.addCustomerLedgerEntry) {
          await db.addCustomerLedgerEntry({
            customer_id: result.lastInsertRowid,
            type: 'debit',
            amount: openingBal,
            description: 'Opening Balance Account Initialized',
            payment_mode: form.payment_terms
          });
        }
        setSnackbar({ open: true, message: 'Customer added successfully!', severity: 'success' });
      }
      
      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadCustomers();
    } catch (err) {
      console.error("Error:", err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const resetForm = () => {
    setForm({
      name: '', phone: '', email: '', cnic: '', address: '', district: '',
      province: '', shop_name: '', customer_type: 'retail', opening_balance: '',
      credit_limit: '', payment_terms: 'cash', status: 'active', notes: '',
      reference_name: '', reference_phone: ''
    });
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
    if (!window.confirm('Delete this customer? This action cannot be undone.')) return;
    try {
      await db.deleteCustomer(id);
      setSnackbar({ open: true, message: 'Customer deleted successfully!', severity: 'success' });
      loadCustomers();
    } catch (err) {
      setSnackbar({ open: true, message: 'Error deleting customer: ' + err.message, severity: 'error' });
    }
  };

  // ---- FILTER ----
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

  // ---- STATS ----
  const totalCustomers = customers.length;
  const totalBalance = customers.reduce((sum, c) => sum + Number(c.current_balance || 0), 0);
  const activeCustomers = customers.filter(c => c.status !== 'inactive').length;

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 3, maxWidth: 1400, mx: 'auto', pb: isMobile ? 8 : 3 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: isMobile ? 1 : 0 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
          <People sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'Customers' : 'Customer Management'}
        </Typography>
        
        <Button 
          variant="contained" 
          startIcon={showForm ? <Close /> : <Add />}
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          sx={{ 
            bgcolor: showForm ? '#ef4444' : '#10b981',
            '&:hover': { bgcolor: showForm ? '#dc2626' : '#059669' },
            width: isMobile ? '100%' : 'auto'
          }}
        >
          {showForm ? 'Close Form' : '+ Add Customer'}
        </Button>
      </Box>

      {/* STATS CARDS */}
      {!isMobile && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, bgcolor: '#f0fdf4', borderLeft: '4px solid #10b981' }}>
              <Typography variant="caption" color="text.secondary">Total Customers</Typography>
              <Typography variant="h5" fontWeight="bold">{totalCustomers}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, bgcolor: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
              <Typography variant="caption" color="text.secondary">Active Customers</Typography>
              <Typography variant="h5" fontWeight="bold">{activeCustomers}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, bgcolor: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
              <Typography variant="caption" color="text.secondary">Total Receivables</Typography>
              <Typography variant="h5" fontWeight="bold" color="error">{formatPKR(totalBalance)}</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* FILTERS */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={12} sm={6} md={7}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name, phone, shop..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="retail">Retail</MenuItem>
                <MenuItem value="wholesale">Wholesale</MenuItem>
                <MenuItem value="kirana">Kirana</MenuItem>
                <MenuItem value="walk_in">Walk-in</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <Button 
              fullWidth 
              variant="outlined" 
              startIcon={<Refresh />}
              onClick={loadCustomers}
              disabled={loading}
              size="small"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* FORM DIALOG - Mobile Swipeable / Desktop Dialog */}
      <Dialog 
        open={showForm} 
        onClose={() => { setShowForm(false); setEditingId(null); resetForm(); }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        scroll="paper"
      >
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Person sx={{ verticalAlign: 'middle', mr: 1 }} />
            {editingId ? 'Edit Customer' : 'Add New Customer'}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          <form id="customer-form" onSubmit={handleSubmit}>
            <Grid container spacing={isMobile ? 1.5 : 2}>
              {/* Basic Info */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="name"
                  label="Customer Name *"
                  value={form.name}
                  onChange={handleChange}
                  required
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="phone"
                  label="Phone Number *"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="cnic"
                  label="CNIC"
                  value={form.cnic}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" /></InputAdornment> }}
                />
              </Grid>

              {/* Shop & Type */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="shop_name"
                  label="Shop Name"
                  value={form.shop_name}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Store fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Customer Type</InputLabel>
                  <Select
                    name="customer_type"
                    value={form.customer_type}
                    onChange={handleChange}
                    label="Customer Type"
                  >
                    <MenuItem value="retail">Retail</MenuItem>
                    <MenuItem value="wholesale">Wholesale</MenuItem>
                    <MenuItem value="kirana">Kirana</MenuItem>
                    <MenuItem value="walk_in">Walk-in</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Address */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="address"
                  label="Address"
                  value={form.address}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  name="district"
                  label="District"
                  value={form.district}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Province</InputLabel>
                  <Select
                    name="province"
                    value={form.province}
                    onChange={handleChange}
                    label="Province"
                  >
                    <MenuItem value="">Select</MenuItem>
                    {provinces.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Financial */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  name="opening_balance"
                  label="Opening Balance"
                  type="number"
                  value={form.opening_balance}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }}
                  helperText={!editingId ? 'Initial balance will be added to ledger' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  name="credit_limit"
                  label="Credit Limit"
                  type="number"
                  value={form.credit_limit}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Discount fontSize="small" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Terms</InputLabel>
                  <Select
                    name="payment_terms"
                    value={form.payment_terms}
                    onChange={handleChange}
                    label="Payment Terms"
                  >
                    <MenuItem value="cash">Cash (Immediate)</MenuItem>
                    <MenuItem value="7_days">7 Days</MenuItem>
                    <MenuItem value="15_days">15 Days</MenuItem>
                    <MenuItem value="30_days">30 Days</MenuItem>
                    <MenuItem value="monthly">Monthly (Kirana)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Reference & Status */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="reference_name"
                  label="Reference Name"
                  value={form.reference_name}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="reference_phone"
                  label="Reference Phone"
                  value={form.reference_phone}
                  onChange={handleChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    label="Status"
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="notes"
                  label="Notes"
                  multiline
                  rows={2}
                  value={form.notes}
                  onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Notes fontSize="small" /></InputAdornment> }}
                />
              </Grid>
            </Grid>
          </form>
        </DialogContent>
        
        <DialogActions sx={{ p: isMobile ? 2 : 3, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button 
            fullWidth={isMobile}
            variant="outlined" 
            onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
          >
            Cancel
          </Button>
          <Button 
            fullWidth={isMobile}
            type="submit"
            form="customer-form"
            variant="contained"
            startIcon={editingId ? <Save /> : <Add />}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {editingId ? 'Update Customer' : 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CUSTOMER LIST */}
      {isMobile ? (
        // Mobile Cards View
        <Box>
          {filtered.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <People sx={{ fontSize: 60, color: '#d1d5db', mb: 1 }} />
              <Typography color="text.secondary">No customers found</Typography>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Add />}
                onClick={() => setShowForm(true)}
                sx={{ mt: 2, bgcolor: '#10b981' }}
              >
                Add New Customer
              </Button>
            </Paper>
          ) : (
            filtered.map(customer => (
              <CustomerCard 
                key={customer.id}
                customer={customer}
                onEdit={editCustomer}
                onDelete={deleteCustomer}
              />
            ))
          )}
        </Box>
      ) : (
        // Desktop Table View
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Shop / Location</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Balance</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Search sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                    <Typography color="text.secondary">No customers found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#10b981' }}>
                          {c.name?.charAt(0) || 'C'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">{c.name}</Typography>
                          {c.cnic && <Typography variant="caption" color="text.secondary">CNIC: {c.cnic}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>
                      <Box>
                        {c.shop_name && <Typography variant="body2">{c.shop_name}</Typography>}
                        <Typography variant="caption" color="text.secondary">
                          {c.district || ''} {c.province ? `(${c.province})` : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={c.customer_type || 'retail'} 
                        size="small"
                        color={
                          c.customer_type === 'wholesale' ? 'secondary' :
                          c.customer_type === 'kirana' ? 'warning' :
                          'primary'
                        }
                        variant="outlined"
                        sx={{ height: 24, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        fontWeight="bold"
                        color={getBalanceColor(c.current_balance)}
                      >
                        {formatPKR(c.current_balance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => editCustomer(c)} color="primary">
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => deleteCustomer(c.id)} color="error">
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* MOBILE FAB */}
      {isMobile && !showForm && (
        <Fab 
          color="primary" 
          sx={{ 
            position: 'fixed', 
            bottom: 80, 
            right: 16,
            bgcolor: '#10b981',
            '&:hover': { bgcolor: '#059669' }
          }}
          onClick={() => setShowForm(true)}
        >
          <Add />
        </Fab>
      )}

      {/* SNACKBAR */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 0 }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled"
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}