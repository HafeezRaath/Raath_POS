import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Tabs, Tab, IconButton, Stack, Divider, 
  LinearProgress, InputAdornment, FormControl, InputLabel, Select, MenuItem, Snackbar
} from '@mui/material';
import {
  Calculate as CalcIcon, Payment as PayIcon, History as HistoryIcon,
  Timeline, FilterList, Refresh, Warning, CheckCircle, Search
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

const getDaysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

export default function EMI() {
  const [activeTab, setActiveTab] = useState(0);
  const [emis, setEmis] = useState([]);
  const [emiPayments, setEmiPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters Matrix (Search query handles name, phone, and product)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showFilters, setShowFilters] = useState(true); // Default open for faster access

  // Pagination Matrix
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Deep Product Lifecycle Tracker State Bounds
  const [trackSKU, setTrackSKU] = useState('');
  const [trackHistoryResult, setTrackHistoryResult] = useState(null);

  // Modals Framework Controls Node
  const [openCalculator, setOpenCalculator] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Calculator Form Setup State
  const [calc, setCalc] = useState({
    productName: '',
    totalAmount: 0,
    downPayment: 0,
    interestRate: 0,
    months: 12,
    customerId: ''
  });

  // Payment Setup State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'cash',
    notes: ''
  });

  // ==================== DATABASE DATA LOAD ENGINE ====================
  const loadData = async () => {
    setLoading(true);
    try {
      const emisData = await db.electronQuery("SELECT * FROM emis ORDER BY id DESC").catch(() => []);
      const customersData = await db.getCustomers().catch(() => []);
      const rawPayments = await db.electronQuery("SELECT * FROM emi_payments ORDER BY id DESC").catch(() => []);

      setEmis(Array.isArray(emisData) ? emisData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setEmiPayments(Array.isArray(rawPayments) ? rawPayments : []);
    } catch (err) {
      console.error('Data loading error thread matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Structural EMI Calculations Node
  const calculatedMetrics = useMemo(() => {
    const principal = Number(calc.totalAmount || 0) - Number(calc.downPayment || 0);
    const monthlyInterest = Number(calc.interestRate || 0) / 100 / 12;
    const months = Number(calc.months || 12);

    let calculatedEmi;
    if (monthlyInterest === 0) {
      calculatedEmi = principal / months;
    } else {
      calculatedEmi = principal * monthlyInterest * Math.pow(1 + monthlyInterest, months) / (Math.pow(1 + monthlyInterest, months) - 1);
    }

    const totalPayable = calculatedEmi * months;
    const totalInterest = totalPayable - principal;

    return {
      principal,
      totalInterest: Math.max(0, Math.round(totalInterest)),
      totalPayable: Math.max(0, Math.round(totalPayable)),
      emiAmount: Math.max(0, Math.ceil(calculatedEmi))
    };
  }, [calc]);

  const saveEMI = async () => {
    if (!calc.customerId || !calc.productName || calc.totalAmount <= 0) {
      setSnackbar({ open: true, message: 'Provide all required setup parameters!', severity: 'warning' });
      return;
    }

    const startDate = new Date().toISOString().split('T')[0];
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);

    const emiPayload = {
      customer_id: Number(calc.customerId),
      product_name: calc.productName,
      total_amount: Number(calc.totalAmount),
      down_payment: Number(calc.downPayment),
      emi_amount: calculatedMetrics.emiAmount,
      interest_rate: Number(calc.interestRate),
      total_months: Number(calc.months),
      paid_months: 0,
      start_date: startDate,
      next_due_date: nextDate.toISOString().split('T')[0],
      status: 'active'
    };

    try {
      await db.electronQuery(`
        INSERT INTO emis (customer_id, product_name, total_amount, down_payment, emi_amount, interest_rate, total_months, paid_months, start_date, next_due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [emiPayload.customer_id, emiPayload.product_name, emiPayload.total_amount, emiPayload.down_payment, emiPayload.emi_amount, emiPayload.interest_rate, emiPayload.total_months, 0, emiPayload.start_date, emiPayload.next_due_date, 'active']);

      setOpenCalculator(false);
      setCalc({ productName: '', totalAmount: 0, downPayment: 0, interestRate: 0, months: 12, customerId: '' });
      await loadData();
      setSnackbar({ open: true, message: 'Fresh Installment Portfolio created successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Transaction failure: ' + err.message, severity: 'error' });
    }
  };

  const handlePayment = async () => {
    if (!selectedEMI || !paymentForm.amount) return;

    try {
      const payVal = Number(paymentForm.amount);
      
      await db.electronQuery(`
        INSERT INTO emi_payments (emi_id, amount, payment_date, payment_mode, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [selectedEMI.id, payVal, paymentForm.paymentDate, paymentForm.paymentMode, paymentForm.notes || '']);

      const updatedPaidMonths = Number(selectedEMI.paid_months || 0) + 1;
      const targetMaxMonths = Number(selectedEMI.total_months || 12);
      const targetNextDueDate = new Date(selectedEMI.next_due_date || new Date());
      targetNextDueDate.setMonth(targetNextDueDate.getMonth() + 1);

      let finalStatus = 'active';
      if (updatedPaidMonths >= targetMaxMonths) finalStatus = 'completed';

      await db.electronQuery(`
        UPDATE emis 
        SET paid_months = ?, next_due_date = ?, status = ? 
        WHERE id = ?
      `, [updatedPaidMonths, targetNextDueDate.toISOString().split('T')[0], finalStatus, selectedEMI.id]);

      setPaymentDialog(false);
      setSelectedEMI(null);
      await loadData();
      setSnackbar({ open: true, message: 'Installment payment entry posted!', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Execution Pipeline block error structural trace failed.', severity: 'error' });
    }
  };

  const openPaymentDialog = (emi) => {
    setSelectedEMI(emi);
    setPaymentForm({
      amount: emi.emi_amount || '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'cash',
      notes: ''
    });
    setPaymentDialog(true);
  };

  const getEMIDetails = (emi) => {
    const totalPaid = Number(emi.paid_months || 0) * Number(emi.emi_amount || 0);
    const totalDue = Math.max(0, (Number(emi.total_months || 0) - Number(emi.paid_months || 0)) * Number(emi.emi_amount || 0));
    const progress = emi.total_months > 0 ? (Number(emi.paid_months || 0) / Number(emi.total_months || 1)) * 100 : 0;
    const daysOverdue = getDaysOverdue(emi.next_due_date);
    const isOverdue = daysOverdue > 0 && emi.status === 'active' && emi.paid_months < emi.total_months;
    const remainingMonths = Math.max(0, Number(emi.total_months || 0) - Number(emi.paid_months || 0));

    return { totalPaid, totalDue, progress, daysOverdue, isOverdue, remainingMonths };
  };

  const openHistoryDialog = (emi) => {
    setSelectedEMI(emi);
    const generatedSchedule = [];
    const baseDate = new Date(emi.start_date || new Date());
    const matchesPayments = emiPayments.filter(p => p.emi_id === emi.id);

    for (let i = 0; i < emi.total_months; i++) {
      const stepDueDate = new Date(baseDate);
      stepDueDate.setMonth(stepDueDate.getMonth() + i + 1);
      const isSettled = i < emi.paid_months;

      generatedSchedule.push({
        monthIndex: i + 1,
        dueDate: stepDueDate.toISOString().split('T')[0],
        amount: emi.emi_amount,
        status: isSettled ? 'PAID' : (new Date() > stepDueDate ? 'OVERDUE' : 'PENDING'),
        paymentLog: matchesPayments[i] || null
      });
    }

    setSelectedSchedule(generatedSchedule);
    setHistoryDialog(true);
  };

  const handleDeepTrackSourcedHistory = async () => {
    if (!trackSKU.trim()) return;
    try {
      const historyQuery = `
        SELECT pv.sku, pv.variant_name, pv.purchase_price as current_cost_rate, pv.retail_price as current_retail_rate, pv.current_stock,
               p.name as item_name,
               pi.purchase_price as sourced_vendor_rate, pur.purchase_no as batch_inflow_slip, pur.purchase_date as sourced_on_timestamp, sup.name as supplier_name,
               s.invoice_no as distributed_sale_invoice, s.date as customer_sold_on, s.customer_name as buyer_party, s.grand_total as bill_valuation_rate
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN purchase_items pi ON pi.product_variant_id = pv.id
        LEFT JOIN purchases pur ON pi.purchase_id = pur.id
        LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
        LEFT JOIN sale_items si ON si.product_variant_id = pv.id
        LEFT JOIN sales s ON si.sale_id = s.id
        WHERE LOWER(pv.sku) = LOWER(?) OR LOWER(pv.barcode) = LOWER(?)
        ORDER BY s.id DESC LIMIT 1
      `;
      const datasetRows = await db.electronQuery(historyQuery, [trackSKU.trim(), trackSKU.trim()]);
      setTrackHistoryResult(datasetRows.length > 0 ? datasetRows[0] : null);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed tracking operation lookup.', severity: 'error' });
    }
  };

  // ==================== DYNAMIC FUZZY MULTI-KEY LIVE SEARCH ENGINE ====================
  const filteredEMIs = useMemo(() => {
    return emis.filter(emi => {
      const customer = customers.find(c => c.id === emi.customer_id);
      const details = getEMIDetails(emi);

      // Matches against customer name, customer phone and asset name safely
      const matchesSearch = !searchQuery.trim() || 
        (emi.product_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (customer?.phone || '').includes(searchQuery.trim());

      const matchStatus = filterStatus === 'all' || 
        (filterStatus === 'overdue' && details.isOverdue) ||
        (filterStatus === 'active' && emi.status === 'active' && !details.isOverdue) ||
        (filterStatus === 'completed' && emi.status === 'completed');

      const matchCustomer = !filterCustomer || String(emi.customer_id) === String(filterCustomer);

      return matchesSearch && matchStatus && matchCustomer;
    });
  }, [emis, customers, searchQuery, filterStatus, filterCustomer]);

  const paginatedEMIs = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredEMIs.slice(start, start + rowsPerPage);
  }, [filteredEMIs, page, rowsPerPage]);

  const stats = useMemo(() => {
    const active = emis.filter(e => e.status === 'active');
    const completed = emis.filter(e => e.status === 'completed');
    const overdue = emis.filter(e => getEMIDetails(e).isOverdue);

    const totalOutstanding = active.reduce((sum, e) => sum + getEMIDetails(e).totalDue, 0);
    const totalCollected = emis.reduce((sum, e) => sum + getEMIDetails(e).totalPaid, 0);
    const thisMonthDue = active.filter(e => String(e.next_due_date).substring(5, 7) === String(new Date().getMonth() + 1).padStart(2, '0')).length;

    return { active: active.length, completed: completed.length, overdue: overdue.length, totalOutstanding, totalCollected, thisMonthDue };
  }, [emis]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <Timeline sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Universal EMI Allocation & Installments Ledger Dashboard
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>Toggle Search Filters</Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<CalcIcon />} onClick={() => setOpenCalculator(true)}>New EMI Agreement</Button>
        </Stack>
      </Box>

      {/* METRICS BLOCKS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Running Accounts', value: stats.active, color: 'primary' },
          { title: 'Volume Collected Sum', value: formatCurrency(stats.totalCollected), color: 'success' },
          { title: 'Book Outstanding Receivable', value: formatCurrency(stats.totalOutstanding), color: 'warning' },
          { title: 'Current Month Due Inflows', value: stats.thisMonthDue, color: 'info' },
          { title: 'Default Overdue Flags Count', value: stats.overdue, color: 'error' },
          { title: 'Completed Books', value: stats.completed, color: 'success' },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '5px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500} noWrap>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`}>{stat.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* TABS MODULE PANEL */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<Timeline fontSize="small" />} iconPosition="start" label={`Active Accounts Portfolio (${filteredEMIs.length})`} />
          <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label={`Installments Receipt History Sheet (${emiPayments.length})`} />
          <Tab icon={<Search fontSize="small" />} iconPosition="start" label="Supply Chain Sourced Lifecycle Tracker" />
        </Tabs>
      </Paper>

      {/* ==================== SEARCH BAR AND ADVANCED FILTERS PANEL ==================== */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb', boxShadow: 0 }}>
          <Grid container spacing={2} alignItems="center">
            {/* LIVE DYNAMIC SEARCH FIELD */}
            <Grid item xs={12} md={5}>
              <TextField 
                fullWidth 
                size="small" 
                variant="outlined"
                label="Search Ledger Master"
                placeholder="Type Customer Name, Phone number or Mobile/Product model..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Account State Flag</InputLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Account State Flag">
                  <MenuItem value="all">Display All Structural Records</MenuItem>
                  <MenuItem value="active">Active Running Nodes</MenuItem>
                  <MenuItem value="overdue">Default Overdue Flags Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterCustomer(''); }}>Clear Parameters</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ==================== VIEWPORT SCREENS SWAPPERS ==================== */}
      {activeTab === 0 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Customer Settle Holder', 'Product Asset Model', 'Monthly Rate Due', 'Collection Progress', 'Remitted Cash Volume', 'Open Outstanding Debt', 'State Book Chip', 'Next Settle Limit Date', 'Actions Matrix Handles'].map((h) => (
                    <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEMIs.map((emi) => {
                  const details = getEMIDetails(emi);
                  const customer = customers.find(c => c.id === emi.customer_id);

                  return (
                    <TableRow key={emi.id} hover sx={{ bgcolor: details.isOverdue ? '#fff5f5' : 'inherit' }}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">{customer?.name || 'Walk-in Account'}</Typography>
                        <Typography variant="caption" color="text.secondary">{customer?.phone || 'No Contact Link'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{emi.product_name}</Typography>
                        <Typography variant="caption" color="text.secondary">Asset Valuation: {formatCurrency(emi.total_amount)}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatCurrency(emi.emi_amount)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={details.progress} sx={{ width: 60, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption">{emi.paid_months}/{emi.total_months} m</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'green', fontWeight: 500 }}>{formatCurrency(details.totalPaid)}</TableCell>
                      <TableCell sx={{ color: details.isOverdue ? 'red' : 'orange', fontWeight: 'bold' }}>{formatCurrency(details.totalDue)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={details.isOverdue ? 'OVERDUE' : String(emi.status).toUpperCase()} color={details.isOverdue ? 'error' : emi.status === 'completed' ? 'success' : 'primary'} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{formatDate(emi.next_due_date)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {details.remainingMonths > 0 && (
                            <IconButton size="small" color="success" onClick={() => openPaymentDialog(emi)}><PayIcon fontSize="small" /></IconButton>
                          )}
                          <IconButton size="small" color="info" onClick={() => openHistoryDialog(emi)}><HistoryIcon fontSize="small" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedEMIs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No matching custom EMI profile rows found for current search string.</Typography></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB PANEL INDEX 1: HISTORY LEDGERS SHEET */}
      {activeTab === 1 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Receipt Date Stamp', 'Customer Name Holder', 'Dispatched Model Reference', 'Cash Volume Remitted In', 'Payment Mode Channel', 'Internal Audit Remarks Note'].map((h) => (
                    <TableCell key={h} sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {emiPayments.map((payment, idx) => {
                  const boundEmi = emis.find(e => e.id === payment.emi_id);
                  const boundCustomer = customers.find(c => c.id === boundEmi?.customer_id);

                  return (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontSize: '0.85rem' }}>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{boundCustomer?.name || 'Walk-in Profile'}</TableCell>
                      <TableCell>{boundEmi?.product_name || 'Stock Reference'}</TableCell>
                      <TableCell sx={{ color: 'green', fontWeight: 'bold' }}>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell><Chip size="small" label={String(payment.payment_mode || 'cash').toUpperCase()} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{payment.notes || 'Reconciled installment trace snapshot index row.'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB PANEL INDEX 2: EXECUTIVE LIFECYCLE SUPPLY CHAIN TRACKER */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Deep Sourced Supply Chain Traceability Node</Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, maxWidth: 500 }}>
            <TextField fullWidth size="small" placeholder="Scan product SKU / Input unique barcodes tags pointer..." value={trackSKU} onChange={(e) => setTrackSKU(e.target.value)} />
            <Button variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} onClick={handleDeepTrackSourcedHistory}>Evaluate Pipeline</Button>
          </Box>

          {trackHistoryResult ? (
            <Card variant="outlined" sx={{ bgcolor: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>{trackHistoryResult.item_name} [{trackHistoryResult.variant_name || 'Default Model'}]</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Inventory Base Bounds</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>SKU Code Structure:</strong> {trackHistoryResult.sku}</Typography>
                    <Typography variant="body2"><strong>Base Retail Target Pricing:</strong> {formatCurrency(trackHistoryResult.current_retail_rate)}</Typography>
                    <Typography variant="body2"><strong>System Stock Balance Left:</strong> {trackHistoryResult.current_stock} units</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="green" display="block">Upstream Sourced History (Supplier Vendor)</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Sourced From Linked Vendor:</strong> {trackHistoryResult.supplier_name || 'Seeded Master Pool'}</Typography>
                    <Typography variant="body2"><strong>Procure Batch Inflow Invoice:</strong> {trackHistoryResult.batch_inflow_slip || '-'}</Typography>
                    <Typography variant="body2" sx={{ color: 'green.main', fontWeight: 'bold' }}><strong>Sourced Cost Rate per Unit:</strong> {formatCurrency(trackHistoryResult.sourced_vendor_rate || trackHistoryResult.current_cost_rate)}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="secondary" display="block">Downstream Consumer History (Sales Points)</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Sold Outflow Invoice Profile:</strong> {trackHistoryResult.distributed_sale_invoice || 'Unsold Unit Stack'}</Typography>
                    <Typography variant="body2"><strong>Sold Outflow Date Timestamp:</strong> {formatDate(trackHistoryResult.customer_sold_on)}</Typography>
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}><strong>Final Settle Bill Valuation:</strong> {formatCurrency(trackHistoryResult.bill_valuation_rate)}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ) : trackSKU && <Alert severity="info" sx={{ mt: 2 }}>No traceability parameters records mapped inside dynamic tables links matching this input index.</Alert>}
        </Paper>
      )}

      {/* SETUP FRESH ACCOUNT MODAL */}
      <Dialog open={openCalculator} onClose={() => setOpenCalculator(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Setup Fresh Installment Agreement Portfolio Book</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Target Registered Customer Holder</InputLabel>
              <Select value={calc.customerId} onChange={(e) => setCalc({ ...calc, customerId: e.target.value })} label="Target Registered Customer Holder">
                {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `[${c.phone}]` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Product Dispatched Asset Nomenclature Model" value={calc.productName} onChange={(e) => setCalc({ ...calc, productName: e.target.value })} />
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Total Product Value Rate" value={calc.totalAmount || ''} onChange={(e) => setCalc({ ...calc, totalAmount: Number(e.target.value) })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Down Payment Cash Received" value={calc.downPayment || ''} onChange={(e) => setCalc({ ...calc, downPayment: Number(e.target.value) })} /></Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Interest Percent Premium Charge Rate (%)" value={calc.interestRate || ''} onChange={(e) => setCalc({ ...calc, interestRate: Number(e.target.value) })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Tenure Commitment Installment Months" value={calc.months || ''} onChange={(e) => setCalc({ ...calc, months: Number(e.target.value) })} /></Grid>
            </Grid>
            <Paper sx={{ p: 2, bgcolor: '#f9fafb', textAlign: 'right', border: '1px solid #e5e7eb' }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary.main">Calculated Installment Projection Rate: {formatCurrency(calculatedMetrics.emiAmount)} / Month</Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCalculator(false)}>Dismiss</Button>
          <Button variant="contained" sx={{ bgcolor: '#10b981' }} onClick={saveEMI}>Write Master Profile Account</Button>
        </DialogActions>
      </Dialog>

      {/* COLLECT RECOVERY STATEMENT DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Post Installment Settle Recovery Statement</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedEMI && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth size="small" type="number" label="Collected Cash Inbound Sum Value" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              <TextField fullWidth size="small" type="date" label="Payment Processing Timestamp" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              
              <FormControl size="small" fullWidth>
                <InputLabel>Payment Mode Channel</InputLabel>
                <Select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} label="Payment Mode Channel">
                  <MenuItem value="cash">Cash Account Drawer</MenuItem>
                  <MenuItem value="bank">Bank Wire Settlement</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa Digital Hub</MenuItem>
                  <MenuItem value="jazzcash">JazzCash Wallet Portal</MenuItem>
                </Select>
              </FormControl>
              
              <TextField fullWidth size="small" label="Internal Memo Notes Remarks" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Drop Slip</Button>
          <Button variant="contained" color="success" onClick={handlePayment}>Post Settle Installment</Button>
        </DialogActions>
      </Dialog>

      {/* SCHEDULE LIKECYCLE DETAILED POPUP MODAL */}
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Agreement Account Milestone Tracking Schedule</DialogTitle>
        <DialogContent>
          {selectedEMI && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ mb: 2 }}>
                Model Identity: <strong>{selectedEMI.product_name}</strong> | Contract Sum Valuation: {formatCurrency(selectedEMI.total_amount)}
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 0, maxHeight: 350 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>Installment Month #</TableCell>
                      <TableCell>Due Milestone Date</TableCell>
                      <TableCell align="right">Amount Target Rate</TableCell>
                      <TableCell align="center">Milestone Status Badge</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSchedule.map((row) => (
                      <TableRow key={row.monthIndex} sx={{ bgcolor: row.status === 'PAID' ? '#f0fdf4' : (row.status === 'OVERDUE' ? '#fef2f2' : 'inherit') }}>
                        <TableCell sx={{ fontWeight: 600 }}>Month Cycle {row.monthIndex}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(row.dueDate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(row.amount)}</TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={row.status} color={row.status === 'PAID' ? 'success' : (row.status === 'OVERDUE' ? 'error' : 'default')} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryDialog(false)}>Dismiss Manifest View</Button></DialogActions>
      </Dialog>

      {/* SNACKBAR NOTIFIER */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}