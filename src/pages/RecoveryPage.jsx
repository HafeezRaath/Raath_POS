import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Fade, Pagination, Alert, Snackbar,
  Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error as ErrorIcon, TrendingUp, AccountBalanceWallet, Visibility
} from '@mui/icons-material';
import db from '../database/db';

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

export default function RecoveryPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(15);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // ==================== LOAD EXACT DATA FROM DATABASE ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [customersData, salesData] = await Promise.all([
        db.getCustomers().catch(err => { console.error('Customers fetch error:', err); return []; }),
        db.getSalesHistory().catch(err => { console.error('Sales fetch error:', err); return []; })
      ]);

      setCustomers(Array.isArray(customersData) ? customersData : []);
      setSales(Array.isArray(salesData) ? salesData : []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== BUILD EXACT LEDGER FROM DATABASE ====================
  const buildLedger = useCallback(async (customer) => {
    if (!customer) return [];

    try {
      // 1. Get all sales for this customer from loaded sales state
      const customerSales = sales.filter(s => 
        s.customer_id === customer.id && 
        !s.is_deleted
      );

      // 2. Get ledger entries from database (works in Electron + Browser)
      let ledgerEntries = [];
      try {
        ledgerEntries = await db.getCustomerLedger(customer.id);
      } catch (e) {
        console.warn('Ledger fetch failed:', e);
      }

      const transactions = [];

      // 3. Add sales as debit entries (exact due amount from DB)
      customerSales.forEach(sale => {
        const dueAmount = parseFloat(sale.due_amount) || Math.max(0, (parseFloat(sale.grand_total) || 0) - (parseFloat(sale.paid_amount) || 0));
        if (dueAmount > 0) {
          transactions.push({
            id: `sale-${sale.id}`,
            date: sale.date,
            type: 'sale',
            description: `Invoice ${sale.invoice_no || sale.id} — ${sale.sale_type || 'retail'}`,
            payment_mode: sale.payment_mode || 'cash',
            amount: dueAmount,
            isDebit: true,
            source: sale
          });
        }
      });

      // 4. Add ledger entries (payments) from customer_ledger table
      (ledgerEntries || []).forEach(entry => {
        transactions.push({
          id: `ledger-${entry.id}`,
          date: entry.date,
          type: entry.type || 'payment',
          description: entry.description || `Payment via ${(entry.payment_mode || 'cash').toUpperCase()}`,
          payment_mode: entry.payment_mode || 'cash',
          amount: parseFloat(entry.amount) || 0,
          isDebit: entry.type === 'sale' || entry.type === 'debit',
          source: entry
        });
      });

      // 5. Sort by date ascending for correct balance calculation
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      // 6. Calculate running balance from opening_balance (exact DB value)
      let balance = parseFloat(customer.opening_balance || 0);
      const processed = transactions.map(t => {
        if (t.isDebit) {
          balance += t.amount;
        } else {
          balance -= t.amount;
        }
        return { ...t, balance_after: parseFloat(balance.toFixed(2)) };
      });

      // 7. Return newest first for display
      return processed.reverse();

    } catch (err) {
      console.error('Ledger build error:', err);
      return [];
    }
  }, [sales]);

  const viewLedger = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const ledgerData = await buildLedger(customer);
      setLedger(ledgerData);
    } catch (err) {
      console.error('View ledger error:', err);
      setLedger([]);
    }
    setPaymentDialog(false);
  };

  // ==================== POST PAYMENT (Electron + Browser Both) ====================
  const handlePayment = async () => {
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      setSnackbar({ open: true, message: 'Enter a valid payment amount!', severity: 'warning' });
      return;
    }

    const currentBalance = parseFloat(selectedCustomer.current_balance || 0);
    if (amount > currentBalance) {
      setSnackbar({ open: true, message: 'Payment amount cannot exceed outstanding balance!', severity: 'warning' });
      return;
    }

    try {
      const newBalance = currentBalance - amount;

      // 1. Add ledger entry (universal method — works in both modes)
      await db.addCustomerLedgerEntry({
        customer_id: selectedCustomer.id,
        type: 'payment',
        amount: amount,
        balance_after: newBalance,
        description: paymentForm.description || `Payment received via ${paymentForm.payment_mode.toUpperCase()}`,
        payment_mode: paymentForm.payment_mode,
        reference_no: paymentForm.reference_no,
        date: paymentForm.date
      });

      // 2. Update customer balance (universal method)
      await db.updateCustomer(selectedCustomer.id, {
        ...selectedCustomer,
        current_balance: newBalance
      });

      setPaymentDialog(false);
      setPaymentForm({
        amount: '',
        payment_mode: 'cash',
        reference_no: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });

      // 3. Refresh all data from database
      await loadData();

      // 4. Refresh ledger view with updated customer
      const updatedCustomer = { ...selectedCustomer, current_balance: newBalance };
      setSelectedCustomer(updatedCustomer);
      const ledgerData = await buildLedger(updatedCustomer);
      setLedger(ledgerData);

      setSnackbar({ open: true, message: `Payment of ${formatCurrency(amount)} posted successfully!`, severity: 'success' });
    } catch (err) {
      console.error('Payment error:', err);
      setSnackbar({ open: true, message: 'Payment failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== FILTERS & STATS ====================
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (c.phone || '').includes(searchQuery.trim()) ||
        (c.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim());

      const balance = parseFloat(c.current_balance || 0);

      let matchType = true;
      if (activeTab === 1) matchType = balance > 0;
      else if (activeTab === 2) matchType = balance <= 0;
      else if (activeTab === 3) matchType = c.customer_type === 'wholesale';
      else if (activeTab === 4) matchType = c.customer_type === 'retail';

      return matchSearch && matchType;
    });
  }, [customers, searchQuery, activeTab]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredCustomers.slice(start, start + rowsPerPage);
  }, [filteredCustomers, page, rowsPerPage]);

  const stats = useMemo(() => {
    const totalPending = customers.reduce((sum, c) => sum + (parseFloat(c.current_balance) > 0 ? parseFloat(c.current_balance) : 0), 0);
    const totalReceivable = customers.reduce((sum, c) => sum + (parseFloat(c.current_balance) || 0), 0);
    const defaulters = customers.filter(c => (parseFloat(c.current_balance) || 0) > 0).length;
    const wholesale = customers.filter(c => c.customer_type === 'wholesale').length;
    const retail = customers.filter(c => c.customer_type === 'retail').length;

    return { totalPending, totalReceivable, defaulters, wholesale, retail };
  }, [customers]);

  const getCustomerSalesSummary = useCallback((customerId) => {
    const customerSales = sales.filter(s => s.customer_id === customerId && !s.is_deleted);
    const totalSales = customerSales.reduce((sum, s) => sum + (parseFloat(s.grand_total) || 0), 0);
    const totalPaid = customerSales.reduce((sum, s) => sum + (parseFloat(s.paid_amount) || 0), 0);
    const totalDue = customerSales.reduce((sum, s) => sum + (parseFloat(s.due_amount) || Math.max(0, (parseFloat(s.grand_total) || 0) - (parseFloat(s.paid_amount) || 0))), 0);
    const invoiceCount = customerSales.length;

    return { totalSales, totalPaid, totalDue, invoiceCount };
  }, [sales]);

  const handleTabChange = (e, v) => {
    setActiveTab(v);
    setPage(1);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <AccountBalanceWallet sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Recovery Audit Desk & Ledger Statements
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>Toggle Search</Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync Ledgers'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Total Receivable', value: formatCurrency(stats.totalReceivable), color: 'error', icon: <TrendingUp /> },
          { title: 'Pending Outstanding', value: formatCurrency(stats.totalPending), color: 'warning', icon: <Warning /> },
          { title: 'Active Arrears', value: stats.defaulters, color: 'error', icon: <ErrorIcon /> },
          { title: 'Wholesale', value: stats.wholesale, color: 'info', icon: <Store /> },
          { title: 'Retail', value: stats.retail, color: 'success', icon: <Person /> },
          { title: 'Total Ledgers', value: customers.length, color: 'primary', icon: <AccountBalance /> },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`} noWrap>{stat.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* TABS */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<AccountBalance fontSize="small" />} iconPosition="start" label={`All Ledgers (${customers.length})`} />
          <Tab icon={<Warning fontSize="small" />} iconPosition="start" label={`Arrears (${stats.defaulters})`} />
          <Tab icon={<CheckCircle fontSize="small" />} iconPosition="start" label="Fully Settled" />
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label="Wholesale" />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Retail" />
        </Tabs>
      </Paper>

      {/* SEARCH */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb', boxShadow: 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8} lg={9}>
              <TextField
                fullWidth 
                size="small" 
                label="Search Customers"
                placeholder="Name, phone, or shop name..."
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }}
              />
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setPage(1); }}>Clear Filters</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      <Grid container spacing={2}>
        {/* CUSTOMER LIST */}
        <Grid item xs={12} md={selectedCustomer ? 4 : 12}>
          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer sx={{ maxHeight: selectedCustomer ? 'calc(100vh - 380px)' : 'calc(100vh - 320px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1 }}>Party Details</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1 }}>Type</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1 }}>Balance</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedCustomers.map((c) => {
                    const summary = getCustomerSalesSummary(c.id);
                    const isSelected = selectedCustomer?.id === c.id;
                    const balance = parseFloat(c.current_balance || 0);

                    return (
                      <TableRow 
                        key={c.id} 
                        hover 
                        onClick={() => viewLedger(c)}
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: isSelected ? '#f0fdf4' : balance > 0 ? '#fff5f5' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">{c.name}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">{c.phone || 'No phone'}</Typography>
                          {c.shop_name && <Typography variant="caption" color="primary.main" fontWeight={500} display="block">{c.shop_name}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={c.customer_type === 'wholesale' ? 'info' : 'default'} label={String(c.customer_type || 'retail').toUpperCase()} sx={{ height: 18, fontSize: '0.62rem', fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color={balance > 0 ? 'error.main' : 'green'}>{formatCurrency(balance)}</Typography>
                          <Typography variant="caption" color="text.secondary">{summary.invoiceCount} invoices</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); viewLedger(c); }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedCustomers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">No matching records found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={Math.ceil(filteredCustomers.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
            </Box>
          </Paper>
        </Grid>

        {/* LEDGER PANEL */}
        {selectedCustomer && (
          <Grid item xs={12} md={8}>
            <Fade in>
              <Box>
                {/* Customer Header Card */}
                <Card variant="outlined" sx={{ mb: 2, borderLeft: '5px solid #10b981', bgcolor: '#f9fafb' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={5}>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">{selectedCustomer.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedCustomer.shop_name || 'Individual Account'}</Typography>
                        <Typography variant="caption" color="text.secondary">{selectedCustomer.phone || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} md={4}>
                        <Typography variant="caption" color="text.secondary" display="block">Outstanding</Typography>
                        <Typography variant="h5" fontWeight="bold" color={(selectedCustomer.current_balance || 0) > 0 ? 'error.main' : 'green'}>
                          {formatCurrency(selectedCustomer.current_balance)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Button 
                          fullWidth 
                          variant="contained" 
                          color="success" 
                          size="small" 
                          startIcon={<Payment />} 
                          onClick={() => setPaymentDialog(true)} 
                          disabled={(selectedCustomer.current_balance || 0) <= 0}
                        >
                          Receive Payment
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Ledger Table */}
                <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
                  <Box sx={{ p: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      <History sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.1rem', color: '#10b981' }} /> 
                      Transaction Ledger
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 'calc(100vh - 460px)' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>Mode</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }} align="right">Debit</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }} align="right">Credit</TableCell>
                          <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }} align="right">Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ledger.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                              <Typography color="text.secondary">No transactions found.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledger.map((entry) => (
                            <TableRow key={entry.id} hover>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(entry.date)}</TableCell>
                              <TableCell>
                                <Chip 
                                  size="small" 
                                  label={entry.type} 
                                  color={entry.isDebit ? 'error' : 'success'} 
                                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 'bold' }} 
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{entry.description}</TableCell>
                              <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'gray' }}>
                                {entry.payment_mode || 'cash'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: 'red', fontWeight: 500 }}>
                                {entry.isDebit ? formatCurrency(entry.amount) : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: 'green', fontWeight: 500 }}>
                                {!entry.isDebit ? formatCurrency(entry.amount) : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {formatCurrency(entry.balance_after)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>
            </Fade>
          </Grid>
        )}
      </Grid>

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Receive Payment — {selectedCustomer?.name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedCustomer && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption">Outstanding:</Typography>
                  <Typography variant="body2" color="error" fontWeight="bold">{formatCurrency(selectedCustomer.current_balance)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption">After Payment:</Typography>
                  <Typography variant="body2" color="green" fontWeight="bold">
                    {formatCurrency((selectedCustomer.current_balance || 0) - (parseFloat(paymentForm.amount) || 0))}
                  </Typography>
                </Box>
              </Box>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Amount (PKR) *" 
                value={paymentForm.amount} 
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                autoFocus 
              />
              <TextField 
                fullWidth 
                size="small" 
                type="date" 
                label="Date *" 
                value={paymentForm.date} 
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} 
                InputLabelProps={{ shrink: true }} 
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Payment Mode</InputLabel>
                <Select 
                  value={paymentForm.payment_mode} 
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })} 
                  label="Payment Mode"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                </Select>
              </FormControl>
              <TextField 
                fullWidth 
                size="small" 
                label="Reference / Note" 
                value={paymentForm.description} 
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} 
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handlePayment} 
            disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
          >
            Post Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(p => ({ ...p, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}