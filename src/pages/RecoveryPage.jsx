import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Fade, Pagination, Alert, Snackbar,
  Stack, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Avatar, Badge, Divider, List, ListItem,
  ListItemText, ListItemIcon, SwipeableDrawer,
  InputAdornment  // ✅ ADDED
} from '@mui/material';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error as ErrorIcon, TrendingUp,
  AccountBalanceWallet, Visibility, Menu as MenuIcon, Close,
  ArrowUpward, ArrowDownward, Receipt
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

// ==================== MOBILE CUSTOMER CARD ====================
const MobileCustomerCard = ({ customer, onView, getCustomerSalesSummary }) => {
  const [expanded, setExpanded] = useState(false);
  const summary = getCustomerSalesSummary(customer.id);
  const balance = parseFloat(customer.current_balance || 0);

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: balance > 0 ? '4px solid #ef4444' : '4px solid #10b981',
      overflow: 'hidden'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {customer.name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {customer.phone || 'No phone'}
              </Typography>
              <Chip 
                size="small" 
                color={customer.customer_type === 'wholesale' ? 'info' : 'default'} 
                label={String(customer.customer_type || 'retail').toUpperCase()} 
                sx={{ height: 16, fontSize: '0.5rem' }} 
              />
            </Stack>
            {customer.shop_name && (
              <Typography variant="caption" color="primary" display="block">
                {customer.shop_name}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={balance > 0 ? 'error.main' : 'success.main'}>
              {formatCurrency(balance)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {summary.invoiceCount} invoices
            </Typography>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Sales</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(summary.totalSales)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Paid</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(summary.totalPaid)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Due</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(summary.totalDue)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Customer Since</Typography>
              <Typography variant="body2">{formatDate(customer.created_at)}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            onClick={() => onView(customer)}
            sx={{ flex: 1, bgcolor: '#10b981' }}
          >
            View Ledger
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function RecoveryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 15);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // ==================== LOAD DATA ====================
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

  // ==================== BUILD LEDGER ====================
  const buildLedger = useCallback(async (customer) => {
    if (!customer) return [];

    try {
      const customerSales = sales.filter(s => 
        s.customer_id === customer.id && 
        !s.is_deleted
      );

      let ledgerEntries = [];
      try {
        ledgerEntries = await db.getCustomerLedger(customer.id);
      } catch (e) {
        console.warn('Ledger fetch failed:', e);
      }

      const transactions = [];

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

      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      let balance = parseFloat(customer.opening_balance || 0);
      const processed = transactions.map(t => {
        if (t.isDebit) {
          balance += t.amount;
        } else {
          balance -= t.amount;
        }
        return { ...t, balance_after: parseFloat(balance.toFixed(2)) };
      });

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
    if (isMobile) setMobileDrawer(false);
  };

  // ==================== PAYMENT ====================
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

      await loadData();

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
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <AccountBalanceWallet sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Recovery' : 'Recovery Audit Desk'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            {isMobile ? 'Filters' : 'Toggle Search'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : isMobile ? 'Sync' : 'Sync Ledgers'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: 'Total Receivable', value: formatCurrency(stats.totalReceivable), color: 'error', icon: <TrendingUp /> },
          { title: 'Pending', value: formatCurrency(stats.totalPending), color: 'warning', icon: <Warning /> },
          { title: 'Arrears', value: stats.defaulters, color: 'error', icon: <ErrorIcon /> },
          { title: 'Wholesale', value: stats.wholesale, color: 'info', icon: <Store /> },
          { title: 'Retail', value: stats.retail, color: 'success', icon: <Person /> },
          { title: 'Total', value: customers.length, color: 'primary', icon: <AccountBalance /> },
        ].map((stat, idx) => (
          <Grid item xs={4} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: isMobile ? 1 : 1.5, '&:last-child': { pb: isMobile ? 1 : 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500} sx={{ fontSize: isMobile ? '0.55rem' : '0.75rem' }}>
                  {stat.title}
                </Typography>
                <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color={`${stat.color}.dark`} noWrap>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          indicatorColor="primary" 
          textColor="primary" 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<AccountBalance fontSize="small" />} 
            iconPosition="start" 
            label={isMobile ? `All (${customers.length})` : `All Ledgers (${customers.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Warning fontSize="small" />} 
            iconPosition="start" 
            label={isMobile ? `Due (${stats.defaulters})` : `Arrears (${stats.defaulters})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<CheckCircle fontSize="small" />} 
            iconPosition="start" 
            label={isMobile ? 'Settled' : 'Fully Settled'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Store fontSize="small" />} 
            iconPosition="start" 
            label={isMobile ? 'Whole' : 'Wholesale'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Person fontSize="small" />} 
            iconPosition="start" 
            label={isMobile ? 'Retail' : 'Retail'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* SEARCH */}
      {showFilters && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth 
                size="small" 
                label="Search Customers"
                placeholder={isMobile ? "Name, phone..." : "Name, phone, or shop name..."}
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ 
                  startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} />,
                  endAdornment: searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setPage(1); }}>
                Clear
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      <Grid container spacing={isMobile ? 1 : 2}>
        {/* CUSTOMER LIST */}
        <Grid item xs={12} md={selectedCustomer && !isMobile ? 4 : 12}>
          <Paper sx={{ border: '1px solid #e5e7eb' }}>
            {isMobile ? (
              // Mobile Cards View
              <Box sx={{ p: 0.5 }}>
                {loading ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography>Loading...</Typography>
                  </Box>
                ) : paginatedCustomers.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <AccountBalanceWallet sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No customers found</Typography>
                  </Paper>
                ) : (
                  paginatedCustomers.map((c) => (
                    <MobileCustomerCard
                      key={c.id}
                      customer={c}
                      onView={viewLedger}
                      getCustomerSalesSummary={getCustomerSalesSummary}
                    />
                  ))
                )}
                {filteredCustomers.length > rowsPerPage && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination 
                      count={Math.ceil(filteredCustomers.length / rowsPerPage)} 
                      page={page} 
                      onChange={(e, p) => setPage(p)} 
                      color="primary" 
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            ) : (
              // Desktop Table View
              <>
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
                  <Pagination 
                    count={Math.ceil(filteredCustomers.length / rowsPerPage)} 
                    page={page} 
                    onChange={(e, p) => setPage(p)} 
                    color="primary" 
                    size="small"
                  />
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* LEDGER PANEL - Desktop */}
        {selectedCustomer && !isMobile && (
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
                          Receive
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Ledger Table */}
                <Paper sx={{ border: '1px solid #e5e7eb' }}>
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

      {/* ===== MOBILE LEDGER DRAWER ===== */}
      {isMobile && (
        <Drawer 
          anchor="bottom" 
          open={!!selectedCustomer} 
          onClose={() => setSelectedCustomer(null)}
          sx={{ '& .MuiDrawer-paper': { height: '85vh', maxHeight: '90vh' } }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {selectedCustomer?.name}
              </Typography>
              <IconButton onClick={() => setSelectedCustomer(null)}>
                <Close />
              </IconButton>
            </Box>

            {selectedCustomer && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 1.5, bgcolor: '#f9fafb', borderRadius: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                    <Typography variant="h6" fontWeight="bold" color={(selectedCustomer.current_balance || 0) > 0 ? 'error.main' : 'green'}>
                      {formatCurrency(selectedCustomer.current_balance)}
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    color="success" 
                    size="small" 
                    startIcon={<Payment />} 
                    onClick={() => { setPaymentDialog(true); }}
                    disabled={(selectedCustomer.current_balance || 0) <= 0}
                  >
                    Pay
                  </Button>
                </Box>

                <List dense sx={{ maxHeight: 'calc(70vh - 100px)', overflow: 'auto' }}>
                  {ledger.length === 0 ? (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      No transactions found
                    </Typography>
                  ) : (
                    ledger.map((entry, idx) => (
                      <Paper key={entry.id || idx} sx={{ mb: 1, p: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">{formatDate(entry.date)}</Typography>
                            <Typography variant="body2" fontWeight="medium">{entry.description}</Typography>
                            <Chip 
                              size="small" 
                              label={entry.type} 
                              color={entry.isDebit ? 'error' : 'success'} 
                              sx={{ height: 16, fontSize: '0.5rem' }} 
                            />
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" fontWeight="bold" color={entry.isDebit ? 'error.main' : 'success.main'}>
                              {formatCurrency(entry.amount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Bal: {formatCurrency(entry.balance_after)}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))
                  )}
                </List>
              </>
            )}
          </Box>
        </Drawer>
      )}

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <Payment sx={{ verticalAlign: 'middle', mr: 1 }} />
          Receive Payment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedCustomer && (
            <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption">Customer:</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedCustomer.name}</Typography>
                </Box>
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
                InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
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
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            fullWidth={isMobile}
            variant="contained" 
            color="success" 
            onClick={handlePayment} 
            disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
            sx={{ bgcolor: '#10b981' }}
          >
            Post Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* MOBILE DRAWER */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); setShowFilters(!showFilters); }}>
              <ListItemIcon><FilterList /></ListItemIcon>
              <ListItemText primary={showFilters ? 'Hide Filters' : 'Show Filters'} />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadData(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Sync Data" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(p => ({ ...p, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 0 }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}