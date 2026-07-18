import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Tabs, Tab, IconButton, Stack, Divider, 
  LinearProgress, InputAdornment, FormControl, InputLabel, Select, MenuItem, Snackbar,
  useMediaQuery, useTheme, Collapse, Avatar, Badge, Tooltip,
  Drawer, List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import {
  Calculate as CalcIcon, Payment as PayIcon, History as HistoryIcon,
  Timeline, FilterList, Refresh, Warning, CheckCircle, Search,
  People, AttachMoney, TrendingUp, TrendingDown, CalendarToday,
  Menu as MenuIcon, Close, Receipt, Store, Phone, Person,
  Cancel, Check, ArrowForward, ArrowBack
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

// ==================== MOBILE EMI CARD ====================
const MobileEMICard = ({ emi, customer, details, onPay, onHistory }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: details.isOverdue ? '4px solid #ef4444' : 
                   emi.status === 'completed' ? '4px solid #10b981' : 
                   '4px solid #3b82f6',
      overflow: 'hidden'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {customer?.name || 'Walk-in'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {emi.product_name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip 
                size="small" 
                label={details.isOverdue ? 'OVERDUE' : emi.status.toUpperCase()} 
                color={details.isOverdue ? 'error' : emi.status === 'completed' ? 'success' : 'primary'}
                sx={{ height: 18, fontSize: '0.55rem' }}
              />
              <Typography variant="caption" color="text.secondary">
                {emi.paid_months}/{emi.total_months} months
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="#10b981">
              {formatCurrency(emi.emi_amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Due: {formatDate(emi.next_due_date)}
            </Typography>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={details.progress} 
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
            color={details.isOverdue ? 'error' : 'primary'}
          />
          <Typography variant="caption" fontWeight="bold">
            {Math.round(details.progress)}%
          </Typography>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Amount</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(emi.total_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Paid So Far</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(details.totalPaid)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Remaining</Typography>
              <Typography variant="body2" fontWeight="bold" color={details.isOverdue ? 'error' : 'warning.main'}>
                {formatCurrency(details.totalDue)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Customer</Typography>
              <Typography variant="body2">{customer?.phone || 'N/A'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          {details.remainingMonths > 0 && (
            <Button 
              size="small" 
              variant="contained" 
              startIcon={<PayIcon />}
              onClick={() => onPay(emi)}
              sx={{ flex: 1, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              Pay
            </Button>
          )}
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<HistoryIcon />}
            onClick={() => onHistory(emi)}
            sx={{ flex: details.remainingMonths > 0 ? 1 : 1 }}
          >
            History
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowBack fontSize="small" /> : <ArrowForward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function EMI() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [emis, setEmis] = useState([]);
  const [emiPayments, setEmiPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [trackSKU, setTrackSKU] = useState('');
  const [trackHistoryResult, setTrackHistoryResult] = useState(null);

  const [openCalculator, setOpenCalculator] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const [calc, setCalc] = useState({
    productName: '',
    totalAmount: 0,
    downPayment: 0,
    interestRate: 0,
    months: 12,
    customerId: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'cash',
    notes: ''
  });

  // ==================== LOAD DATA ====================
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
      console.error('Data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ==================== CALCULATIONS ====================
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

  // ==================== HELPERS ====================
  const getEMIDetails = (emi) => {
    const totalPaid = Number(emi.paid_months || 0) * Number(emi.emi_amount || 0);
    const totalDue = Math.max(0, (Number(emi.total_months || 0) - Number(emi.paid_months || 0)) * Number(emi.emi_amount || 0));
    const progress = emi.total_months > 0 ? (Number(emi.paid_months || 0) / Number(emi.total_months || 1)) * 100 : 0;
    const daysOverdue = getDaysOverdue(emi.next_due_date);
    const isOverdue = daysOverdue > 0 && emi.status === 'active' && emi.paid_months < emi.total_months;
    const remainingMonths = Math.max(0, Number(emi.total_months || 0) - Number(emi.paid_months || 0));

    return { totalPaid, totalDue, progress, daysOverdue, isOverdue, remainingMonths };
  };

  // ==================== SAVE EMI ====================
  const saveEMI = async () => {
    if (!calc.customerId || !calc.productName || calc.totalAmount <= 0) {
      setSnackbar({ open: true, message: 'Please fill all required fields!', severity: 'warning' });
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
      setSnackbar({ open: true, message: 'EMI created successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== PAYMENT FUNCTIONS ====================
  // ✅ FIXED: Added this function
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
      setSnackbar({ open: true, message: 'Payment posted successfully!', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Payment failed!', severity: 'error' });
    }
  };

  // ==================== HISTORY ====================
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

  // ==================== TRACK ====================
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
      setSnackbar({ open: true, message: 'Track failed!', severity: 'error' });
    }
  };

  // ==================== FILTERS ====================
  const filteredEMIs = useMemo(() => {
    return emis.filter(emi => {
      const customer = customers.find(c => c.id === emi.customer_id);
      const details = getEMIDetails(emi);

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

  // ==================== STATS ====================
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
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <Timeline sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'EMI Dashboard' : 'Universal EMI & Installments Ledger'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button 
            variant="contained" 
            size="small" 
            startIcon={<CalcIcon />} 
            onClick={() => setOpenCalculator(true)}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, width: isMobile ? '100%' : 'auto' }}
          >
            {isMobile ? 'New EMI' : 'New EMI Agreement'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'primary.light', borderLeft: '5px solid', borderLeftColor: 'primary.main' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Active</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary.dark">{stats.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'success.light', borderLeft: '5px solid', borderLeftColor: 'success.main' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Collected</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="success.dark">{formatCurrency(stats.totalCollected)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'warning.light', borderLeft: '5px solid', borderLeftColor: 'warning.main' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Outstanding</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="warning.dark">{formatCurrency(stats.totalOutstanding)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'info.light', borderLeft: '5px solid', borderLeftColor: 'info.main' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Due This Month</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="info.dark">{stats.thisMonthDue}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'error.light', borderLeft: '5px solid', borderLeftColor: 'error.main' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Overdue</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="error.dark">{stats.overdue}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4} md={2}>
          <Card sx={{ bgcolor: 'grey.100', borderLeft: '5px solid', borderLeftColor: 'grey.500' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Completed</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="grey.700">{stats.completed}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          indicatorColor="primary" 
          textColor="primary" 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={isMobile ? <Timeline fontSize="small" /> : <Timeline />} 
            iconPosition={isMobile ? 'start' : 'start'}
            label={isMobile ? `EMIs (${filteredEMIs.length})` : `Active EMI Accounts (${filteredEMIs.length})`} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={isMobile ? <HistoryIcon fontSize="small" /> : <HistoryIcon />} 
            iconPosition={isMobile ? 'start' : 'start'}
            label={isMobile ? `History (${emiPayments.length})` : `Payment History (${emiPayments.length})`} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={isMobile ? <Search fontSize="small" /> : <Search />} 
            iconPosition={isMobile ? 'start' : 'start'}
            label={isMobile ? 'Track' : 'Supply Chain Tracker'} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* FILTERS */}
      {activeTab === 0 && (
        <Paper sx={{ p: isMobile ? 1 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField 
                fullWidth 
                size="small" 
                label="Search" 
                placeholder="Name, Phone, Product..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#10b981', fontSize: isMobile ? 18 : 24 }} />,
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}><Close fontSize="small" /></IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
                  <MenuItem value="all">All Records</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="overdue">Overdue Only</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}>
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* TAB 0: EMI LIST */}
      {activeTab === 0 && (
        <>
          {isMobile ? (
            // Mobile Cards View
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LinearProgress />
                  <Typography sx={{ mt: 2 }}>Loading...</Typography>
                </Box>
              ) : paginatedEMIs.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Timeline sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No EMI records found</Typography>
                  <Button variant="contained" startIcon={<CalcIcon />} onClick={() => setOpenCalculator(true)} sx={{ mt: 2, bgcolor: '#10b981' }}>
                    Create New EMI
                  </Button>
                </Paper>
              ) : (
                paginatedEMIs.map((emi) => {
                  const details = getEMIDetails(emi);
                  const customer = customers.find(c => c.id === emi.customer_id);
                  return (
                    <MobileEMICard 
                      key={emi.id}
                      emi={emi}
                      customer={customer}
                      details={details}
                      onPay={openPaymentDialog}
                      onHistory={openHistoryDialog}
                    />
                  );
                })
              )}
              {filteredEMIs.length > rowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                    <Typography sx={{ display: 'flex', alignItems: 'center' }}>Page {page} of {Math.ceil(filteredEMIs.length / rowsPerPage)}</Typography>
                    <Button size="small" disabled={page >= Math.ceil(filteredEMIs.length / rowsPerPage)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </Stack>
                </Box>
              )}
            </Box>
          ) : (
            // Desktop Table View
            <Paper sx={{ border: '1px solid #e5e7eb' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 450px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Customer', 'Product', 'Monthly EMI', 'Progress', 'Paid', 'Due', 'Status', 'Next Due', 'Actions'].map((h) => (
                        <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2, fontSize: '0.75rem' }}>{h}</TableCell>
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
                            <Typography variant="subtitle2" fontWeight="bold">{customer?.name || 'Walk-in'}</Typography>
                            <Typography variant="caption" color="text.secondary">{customer?.phone || 'No Contact'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{emi.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{formatCurrency(emi.total_amount)}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatCurrency(emi.emi_amount)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress variant="determinate" value={details.progress} sx={{ width: 60, height: 6, borderRadius: 3 }} />
                              <Typography variant="caption">{emi.paid_months}/{emi.total_months}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: 'success.main', fontWeight: 500 }}>{formatCurrency(details.totalPaid)}</TableCell>
                          <TableCell sx={{ color: details.isOverdue ? 'error' : 'warning.main', fontWeight: 'bold' }}>{formatCurrency(details.totalDue)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={details.isOverdue ? 'OVERDUE' : emi.status.toUpperCase()} color={details.isOverdue ? 'error' : emi.status === 'completed' ? 'success' : 'primary'} />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(emi.next_due_date)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              {details.remainingMonths > 0 && (
                                <Tooltip title="Pay">
                                  <IconButton size="small" color="success" onClick={() => openPaymentDialog(emi)}><PayIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="History">
                                <IconButton size="small" color="info" onClick={() => openHistoryDialog(emi)}><HistoryIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginatedEMIs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                          <Typography color="text.secondary">No EMI records found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {filteredEMIs.length > rowsPerPage && (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Typography sx={{ display: 'flex', alignItems: 'center' }}>Page {page} of {Math.ceil(filteredEMIs.length / rowsPerPage)}</Typography>
                    <Button size="small" disabled={page >= Math.ceil(filteredEMIs.length / rowsPerPage)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </Stack>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {/* TAB 1: PAYMENT HISTORY */}
      {activeTab === 1 && (
        <Paper sx={{ border: '1px solid #e5e7eb' }}>
          <TableContainer sx={{ maxHeight: isMobile ? 'calc(100vh - 400px)' : 'calc(100vh - 450px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>Date</TableCell>
                  {!isMobile && <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>Customer</TableCell>}
                  <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>Product</TableCell>
                  <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }} align="right">Amount</TableCell>
                  <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>Mode</TableCell>
                  {!isMobile && <TableCell sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', py: 1.2 }}>Notes</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {emiPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No payments recorded yet</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  emiPayments.map((payment, idx) => {
                    const boundEmi = emis.find(e => e.id === payment.emi_id);
                    const boundCustomer = customers.find(c => c.id === boundEmi?.customer_id);
                    return (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{formatDate(payment.payment_date)}</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 600 }}>{boundCustomer?.name || 'Walk-in'}</TableCell>}
                        <TableCell>{boundEmi?.product_name || '-'}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={String(payment.payment_mode || 'cash').toUpperCase()} variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                        </TableCell>
                        {!isMobile && <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{payment.notes || '-'}</TableCell>}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB 2: TRACKER */}
      {activeTab === 2 && (
        <Paper sx={{ p: isMobile ? 1.5 : 3, border: '1px solid #e5e7eb' }}>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" gutterBottom>
            <Search sx={{ verticalAlign: 'middle', mr: 1, color: '#10b981' }} />
            Product Lifecycle Tracker
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 3 }}>
            <TextField 
              fullWidth 
              size="small" 
              placeholder="Enter SKU / Barcode..." 
              value={trackSKU} 
              onChange={(e) => setTrackSKU(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDeepTrackSourcedHistory(); }}
            />
            <Button 
              variant="contained" 
              sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, minWidth: isMobile ? '100%' : 'auto' }}
              onClick={handleDeepTrackSourcedHistory}
            >
              Track
            </Button>
          </Box>

          {trackHistoryResult ? (
            <Card variant="outlined" sx={{ bgcolor: '#f9fafb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>
                  {trackHistoryResult.item_name} [{trackHistoryResult.variant_name || 'Default'}]
                </Typography>
                <Grid container spacing={isMobile ? 2 : 3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Inventory</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>SKU:</strong> {trackHistoryResult.sku}</Typography>
                    <Typography variant="body2"><strong>Retail:</strong> {formatCurrency(trackHistoryResult.current_retail_rate)}</Typography>
                    <Typography variant="body2"><strong>Stock:</strong> {trackHistoryResult.current_stock} units</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="success.main" fontWeight="bold">Supplier Source</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Vendor:</strong> {trackHistoryResult.supplier_name || '-'}</Typography>
                    <Typography variant="body2"><strong>Invoice:</strong> {trackHistoryResult.batch_inflow_slip || '-'}</Typography>
                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      <strong>Cost:</strong> {formatCurrency(trackHistoryResult.sourced_vendor_rate || trackHistoryResult.current_cost_rate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="secondary" fontWeight="bold">Sales History</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Invoice:</strong> {trackHistoryResult.distributed_sale_invoice || 'Unsold'}</Typography>
                    <Typography variant="body2"><strong>Sold:</strong> {formatDate(trackHistoryResult.customer_sold_on)}</Typography>
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      <strong>Sold For:</strong> {formatCurrency(trackHistoryResult.bill_valuation_rate)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ) : trackSKU && (
            <Alert severity="info" sx={{ mt: 2 }}>No product found with this SKU/Barcode.</Alert>
          )}
        </Paper>
      )}

      {/* ==================== DIALOGS ==================== */}

      {/* NEW EMI DIALOG */}
      <Dialog open={openCalculator} onClose={() => setOpenCalculator(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <CalcIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          New EMI Agreement
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Customer</InputLabel>
              <Select value={calc.customerId} onChange={(e) => setCalc({ ...calc, customerId: e.target.value })} label="Customer">
                {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `[${c.phone}]` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Product Name" value={calc.productName} onChange={(e) => setCalc({ ...calc, productName: e.target.value })} />
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Total Amount" value={calc.totalAmount || ''} onChange={(e) => setCalc({ ...calc, totalAmount: Number(e.target.value) })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Down Payment" value={calc.downPayment || ''} onChange={(e) => setCalc({ ...calc, downPayment: Number(e.target.value) })} /></Grid>
            </Grid>
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Interest Rate %" value={calc.interestRate || ''} onChange={(e) => setCalc({ ...calc, interestRate: Number(e.target.value) })} /></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Months" value={calc.months || ''} onChange={(e) => setCalc({ ...calc, months: Number(e.target.value) })} /></Grid>
            </Grid>
            <Paper sx={{ p: 2, bgcolor: '#f9fafb', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                Monthly EMI: {formatCurrency(calculatedMetrics.emiAmount)}
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setOpenCalculator(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" sx={{ bgcolor: '#10b981' }} onClick={saveEMI}>Create EMI</Button>
        </DialogActions>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <PayIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Record Payment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedEMI && (
            <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
              <TextField fullWidth size="small" type="number" label="Amount" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              <TextField fullWidth size="small" type="date" label="Date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <FormControl size="small" fullWidth>
                <InputLabel>Payment Mode</InputLabel>
                <Select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} label="Payment Mode">
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth size="small" label="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" color="success" onClick={handlePayment}>Post Payment</Button>
        </DialogActions>
      </Dialog>

      {/* HISTORY DIALOG */}
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Payment Schedule
        </DialogTitle>
        <DialogContent>
          {selectedEMI && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ mb: 2 }}>
                {selectedEMI.product_name} | Total: {formatCurrency(selectedEMI.total_amount)}
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>#</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSchedule.map((row) => (
                      <TableRow key={row.monthIndex} sx={{ bgcolor: row.status === 'PAID' ? '#f0fdf4' : (row.status === 'OVERDUE' ? '#fef2f2' : 'inherit') }}>
                        <TableCell>{row.monthIndex}</TableCell>
                        <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{formatDate(row.dueDate)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={row.status} color={row.status === 'PAID' ? 'success' : (row.status === 'OVERDUE' ? 'error' : 'default')} sx={{ height: 18, fontSize: '0.6rem' }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(false)}>Close</Button>
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
            <ListItem button onClick={() => { setMobileDrawer(false); setOpenCalculator(true); }}>
              <ListItemIcon><CalcIcon /></ListItemIcon>
              <ListItemText primary="New EMI" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadData(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Refresh Data" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 8 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}