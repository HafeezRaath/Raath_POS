import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Tooltip, Divider,
  Avatar, Stack, InputAdornment, FormControl, InputLabel, Select, MenuItem, Fade, Pagination, Alert, Snackbar
} from '@mui/material';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error, TrendingUp, AccountBalanceWallet, Visibility
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

  // Filters Framework Matrix (Search handles name, phone, shop)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); 
  const [showFilters, setShowFilters] = useState(true); // Default open for faster workflow

  // Pagination Matrix
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(15);

  // Dialogs Controls Node
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Payment Setup Initial Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // ==================== DATABASE LOAD MATRIX ====================
  const loadData = async () => {
    setLoading(true);
    try {
      const [customersData, salesData] = await Promise.all([
        db.getCustomers().catch(() => []),
        db.electronQuery ? db.electronQuery("SELECT * FROM sales WHERE is_deleted = 0") : Promise.resolve([])
      ]);

      setCustomers(Array.isArray(customersData) ? customersData : []);
      setSales(Array.isArray(salesData) ? salesData : []);
    } catch (err) {
      console.error('Load error thread pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Build customer ledger dynamically from sales and payments natively
  const buildLedger = async (customer) => {
    if (!customer) return [];
    const entries = [];

    // Get customer credit sales profile entries matches
    const customerSales = sales.filter(s => 
      s.customer_id === customer.id && 
      (s.payment_status === 'due' || s.payment_status === 'partial')
    );

    customerSales.forEach(sale => {
      entries.push({
        id: `sale-${sale.id}`,
        date: sale.date,
        type: 'sale',
        description: `Invoice ${sale.invoice_no} — ${sale.sale_type || 'retail'}`,
        payment_mode: sale.payment_mode,
        amount: sale.due_amount || (sale.grand_total - sale.paid_amount),
        isDebit: true
      });
    });

    try {
      // Direct raw customer ledger reading loop mappings 
      const ledgerData = await db.electronQuery("SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC", [customer.id]);
      if (Array.isArray(ledgerData)) {
        ledgerData.forEach(entry => {
          entries.push({
            id: `ledger-${entry.id}`,
            date: entry.date,
            type: entry.type || 'payment',
            description: entry.description,
            payment_mode: entry.payment_mode,
            amount: entry.amount,
            isDebit: entry.type === 'sale' || entry.type === 'debit'
          });
        });
      }
    } catch (err) {
      console.log('Using standard baseline layout fallbacks.');
    }

    // Sort by chronological order descending loops
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    let runningBalance = customer.current_balance || 0;
    return entries.map(entry => {
      const rowResult = { ...entry, balance_after: runningBalance };
      if (entry.isDebit) {
        runningBalance -= entry.amount;
      } else {
        runningBalance += entry.amount;
      }
      return rowResult;
    });
  };

  const viewLedger = async (customer) => {
    setSelectedCustomer(customer);
    const ledgerData = await buildLedger(customer);
    setLedger(ledgerData);
    setPaymentDialog(false);
  };

  const handlePayment = async () => {
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      setSnackbar({ open: true, message: 'Enter a valid payment amount!', severity: 'warning' });
      return;
    }

    try {
      // 1. Post entry into child row database customer_ledger table
      await db.electronQuery(`
        INSERT INTO customer_ledger (customer_id, type, amount, description, payment_mode, date)
        VALUES (?, 'payment', ?, ?, ?, ?)
      `, [selectedCustomer.id, amount, paymentForm.description || `Payment via ${paymentForm.payment_mode.toUpperCase()}`, paymentForm.payment_mode, paymentForm.date]);

      // 2. Atomically balance main customers table ledger outstand balances
      await db.electronQuery(`
        UPDATE customers SET current_balance = current_balance - ? WHERE id = ?
      `, [amount, selectedCustomer.id]);

      setPaymentDialog(false);
      setPaymentForm({
        amount: '',
        payment_mode: 'cash',
        reference_no: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });

      await loadData();
      
      // Update local context matrix pointers state instantly
      const revisedBalance = (selectedCustomer.current_balance || 0) - amount;
      viewLedger({ ...selectedCustomer, current_balance: revisedBalance });

      setSnackbar({ open: true, message: `Payment receipt of ${formatCurrency(amount)} logged successfully!`, severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Reconcile balance failure: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DYNAMIC LIVE SEARCH MACHINE FUZZING MATCHES ====================
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (c.phone || '').includes(searchQuery.trim()) ||
        (c.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim());

      const balance = c.current_balance || 0;
      
      let matchType = true;
      if (activeTab === 1) matchType = balance > 0;
      else if (activeTab === 2) matchType = balance <= 0;
      else if (activeTab === 3) matchType = c.customer_type === 'wholesale';
      else if (activeTab === 4) matchType = c.customer_type === 'retail';
      else if (filterType !== 'all') {
        matchType = filterType === 'all' || 
          (filterType === 'pending' && balance > 0) ||
          (filterType === 'paid' && balance <= 0) ||
          (filterType === 'wholesale' && c.customer_type === 'wholesale') ||
          (filterType === 'retail' && c.customer_type === 'retail');
      }

      return matchSearch && matchType;
    });
  }, [customers, searchQuery, filterType, activeTab]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredCustomers.slice(start, start + rowsPerPage);
  }, [filteredCustomers, page, rowsPerPage]);

  const stats = useMemo(() => {
    const totalPending = customers.reduce((sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0), 0);
    const totalReceivable = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);
    const defaulters = customers.filter(c => (c.current_balance || 0) > 0).length;
    const wholesale = customers.filter(c => c.customer_type === 'wholesale').length;
    const retail = customers.filter(c => c.customer_type === 'retail').length;

    return { totalPending, totalReceivable, defaulters, wholesale, retail };
  }, [customers]);

  const getCustomerSalesSummary = (customerId) => {
    const customerSales = sales.filter(s => s.customer_id === customerId && !s.is_deleted);
    const totalSales = customerSales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
    const totalPaid = customerSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const totalDue = customerSales.reduce((sum, s) => sum + (s.due_amount || 0), 0);
    const invoiceCount = customerSales.length;

    return { totalSales, totalPaid, totalDue, invoiceCount };
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER CONTROLS */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <AccountBalanceWallet sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Recovery Audit Desk & Ledger Statements (Lena-Dena)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>Toggle Search</Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData}>Sync Ledgers</Button>
        </Stack>
      </Box>

      {/* STATS SYSTEM DISPLAY */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Total Book Receivable', value: formatCurrency(stats.totalReceivable), color: 'error', icon: <TrendingUp /> },
          { title: 'Pending Outstanding Debt', value: formatCurrency(stats.totalPending), color: 'warning', icon: <Warning /> },
          { title: 'Active Arrears Accounts', value: stats.defaulters, color: 'error', icon: <Error /> },
          { title: 'Wholesale Portfolios', value: stats.wholesale, color: 'info', icon: <Store /> },
          { title: 'Retail Accounts Pool', value: stats.retail, color: 'success', icon: <Person /> },
          { title: 'Total Registered Ledgers', value: customers.length, color: 'primary', icon: <AccountBalance /> },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>{stat.title}</Typography>
                    <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`} noWrap>{stat.value}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* SUB NAVIGATION DESK TABS WRAPPERS */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => { setActiveTab(v); setPage(1); }} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<AccountBalance fontSize="small" />} iconPosition="start" label={`All Ledgers Open Book (${customers.length})`} />
          <Tab icon={<Warning fontSize="small" />} iconPosition="start" label={`Arrears Pending Outstands (${stats.defaulters})`} />
          <Tab icon={<CheckCircle fontSize="small" />} iconPosition="start" label="Fully Settled Accounts" />
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label="Wholesale Agencies Matrix" />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Retail Counter Accounts" />
        </Tabs>
      </Paper>

      {/* ==================== INJECTED LIVE REAL-TIME FUZZY SEARCH CONSOLE ==================== */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb', boxShadow: 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8} lg={9}>
              <TextField
                fullWidth 
                size="small" 
                label="Fuzzy Search Sourced Ledgers"
                placeholder="Type Customer profile name, contact parameters phone link or business shop name nomenclature..."
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }}
              />
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setFilterType('all'); setPage(1); }}>Clear Filter Parameters</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* MAIN SCREEN CONTROL SYSTEM SPLITTER PANELS */}
      <Grid container spacing={2}>
        
        {/* CUSTOMER PORTFOLIOS TRACK ELEMENT */}
        <Grid item xs={12} md={selectedCustomer ? 4 : 12}>
          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer sx={{ maxHeight: selectedCustomer ? 'calc(100vh - 380px)' : 'calc(100vh - 320px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Party Account Details', 'Classification Type', 'Outstanding Balance', 'Action'].map((h) => (
                      <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedCustomers.map((c) => {
                    const summary = getCustomerSalesSummary(c.id);
                    const isSelected = selectedCustomer?.id === c.id;

                    return (
                      <TableRow 
                        key={c.id} 
                        hover 
                        onClick={() => viewLedger(c)}
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: isSelected ? '#f0fdf4' : (c.current_balance || 0) > 0 ? '#fff5f5' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">{c.name}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">{c.phone || 'No phone parameter linked'}</Typography>
                          {c.shop_name && <Typography variant="caption" color="primary.main" fontWeight={500} display="block">{c.shop_name}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={c.customer_type === 'wholesale' ? 'info' : 'default'} label={String(c.customer_type || 'retail').toUpperCase()} sx={{ height: 18, fontSize: '0.62rem', fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color={(c.current_balance || 0) > 0 ? 'error.main' : 'green'}>{formatCurrency(c.current_balance)}</Typography>
                          <Typography variant="caption" color="text.secondary">{summary.invoiceCount} invoices issued</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="primary" onClick={() => viewLedger(c)}><Visibility fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedCustomers.length === 0 && (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No matching ledger records mapped search string.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={Math.ceil(filteredCustomers.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
            </Box>
          </Paper>
        </Grid>

        {/* LEDGER & TRANSACTION HISTORY RUNNING STATEMENT PANEL */}
        {selectedCustomer && (
          <Grid item xs={12} md={8}>
            <Fade in>
              <Box>
                {/* Account Summary Header Info Box */}
                <Card variant="outlined" sx={{ mb: 2, borderLeft: '5px solid #10b981', bgcolor: '#f9fafb' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={5}>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">{selectedCustomer.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedCustomer.shop_name || 'Individual Retail Account'}</Typography>
                        <Typography variant="caption" color="text.secondary">{selectedCustomer.phone || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} md={4}>
                        <Typography variant="caption" color="text.secondary" display="block">Running Outstanding Debt Receivable</Typography>
                        <Typography variant="h5" fontWeight="bold" color={(selectedCustomer.current_balance || 0) > 0 ? 'error.main' : 'green'}>{formatCurrency(selectedCustomer.current_balance)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Button fullWidth variant="contained" color="success" size="small" startIcon={<Payment />} onClick={() => setPaymentDialog(true)} disabled={(selectedCustomer.current_balance || 0) <= 0}>Receive Cash</Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Ledger Sheet Table Container */}
                <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
                  <Box sx={{ p: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                    <Typography variant="subtitle2" fontWeight="bold"><History sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.1rem', color: '#10b981' }} /> Detailed Account Transaction Statement Ledger </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 'calc(100vh - 460px)' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Posting Date', 'Type Slip', 'Audit Entry Description', 'Channel Mode', 'Debit (+)', 'Credit (-)', 'Running Balance'].map((h) => (
                            <TableCell key={h} sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ledger.map((entry) => (
                          <TableRow key={entry.id} hover>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(entry.date)}</TableCell>
                            <TableCell>
                              <Chip size="small" label={entry.type} color={entry.isDebit ? 'error' : 'success'} sx={{ height: 18, fontSize: '0.62rem', fontWeight: 'bold' }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{entry.description}</TableCell>
                            <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'gray' }}>{entry.payment_mode || 'cash'}</TableCell>
                            <TableCell align="right" sx={{ color: 'red', fontWeight: 500 }}>{entry.isDebit ? `+${formatCurrency(entry.amount)}` : '-'}</TableCell>
                            <TableCell align="right" sx={{ color: 'green', fontWeight: 500 }}>{!entry.isDebit ? `-${formatCurrency(entry.amount)}` : '-'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{formatCurrency(entry.balance_after)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>
            </Fade>
          </Grid>
        )}
      </Grid>

      {/* RECEIVE MANUAL ARREARS CASH COLLECTION SLIP DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Post Settle Recovery Balance Receipt — {selectedCustomer?.name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedCustomer && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="caption">Outstand Receivable Cap:</Typography><Typography variant="body2" color="error" fontWeight="bold">{formatCurrency(selectedCustomer.current_balance)}</Typography></Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="caption">Revised Project Balance:</Typography><Typography variant="body2" color="green" fontWeight="bold">{formatCurrency((selectedCustomer.current_balance || 0) - (parseFloat(paymentForm.amount) || 0))}</Typography></Box>
              </Box>
              <TextField fullWidth size="small" type="number" label="Collected Cash Amount Inbound (PKR) *" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} autoFocus />
              <TextField fullWidth size="small" type="date" label="Posting Value Timestamp *" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
              
              <FormControl size="small" fullWidth>
                <InputLabel>Payment Mode safe Channel</InputLabel>
                <Select value={paymentForm.payment_mode} onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })} label="Payment Mode safe Channel">
                  <MenuItem value="cash">Cash Account Drawer</MenuItem>
                  <MenuItem value="bank_transfer">Bank Wire Settlement</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa Hub</MenuItem>
                  <MenuItem value="jazzcash">JazzCash Wallet</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth size="small" label="Audit Internal Note Remarks Descriptions" value={paymentForm.description} onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPaymentDialog(false)}>Cancel Slip</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}>Post Recovery Settlement</Button>
        </DialogActions>
      </Dialog>

      {/* GLOBAL TOAST ALERTS NOTIFIER */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}