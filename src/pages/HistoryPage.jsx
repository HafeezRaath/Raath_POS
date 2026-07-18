import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab, Pagination,
  Snackbar, Alert, Avatar, Tooltip, Divider, InputAdornment,
  List, ListItem, ListItemText, ListItemIcon, Accordion, AccordionSummary,
  AccordionDetails, Badge, LinearProgress, ToggleButton, ToggleButtonGroup,
  useMediaQuery, useTheme, Drawer, Collapse, Fab, SwipeableDrawer,
  Fade, Zoom
} from '@mui/material';
import {
  Search, FilterList, Visibility, Refresh, Close, Receipt,
  ShoppingCart, LocalShipping, Payment, AccountBalance, TrendingUp,
  TrendingDown, Warning, CheckCircle, Error, History, DateRange,
  Person, Phone, LocationOn, Print, Download, ArrowBack, ArrowForward,
  MonetizationOn, CreditCard, MoneyOff, CalendarToday, ExpandMore,
  Inventory, Category, AttachMoney, PointOfSale, AccountCircle,
  Store, ArrowUpward, ArrowDownward, SwapHoriz, DoneAll,
  Cancel, Pending, Schedule, Restore, DeleteOutline, Edit,
  Menu as MenuIcon
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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return dateStr; }
};

const HISTORY_TABS = [
  { id: 'sales', label: 'Sales', icon: <PointOfSale fontSize="small" />, color: 'primary' },
  { id: 'purchases', label: 'Purchases', icon: <LocalShipping fontSize="small" />, color: 'info' },
  { id: 'payments', label: 'Payments', icon: <Payment fontSize="small" />, color: 'success' },
  { id: 'returns', label: 'Returns', icon: <Restore fontSize="small" />, color: 'warning' },
  { id: 'emi', label: 'EMI', icon: <AccountBalance fontSize="small" />, color: 'secondary' },
  { id: 'expenses', label: 'Expenses', icon: <MoneyOff fontSize="small" />, color: 'error' },
  { id: 'ledger', label: 'Ledger', icon: <Receipt fontSize="small" />, color: 'default' },
];

// ==================== MOBILE HISTORY CARD ====================
const MobileHistoryCard = ({ record, type, onView }) => {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    switch(type) {
      case 'sales': return <PointOfSale color="primary" />;
      case 'purchases': return <LocalShipping color="info" />;
      case 'payments': return <Payment color="success" />;
      case 'returns': return <Restore color="warning" />;
      case 'emi': return <AccountBalance color="secondary" />;
      case 'expenses': return <MoneyOff color="error" />;
      default: return <Receipt />;
    }
  };

  const getTitle = () => {
    switch(type) {
      case 'sales': return record.invoice_no || 'INV-0000';
      case 'purchases': return record.purchase_no || 'PUR-0000';
      case 'returns': return `RET-${record.id}`;
      case 'emi': return record.product_name || 'EMI';
      case 'expenses': return record.title || 'Expense';
      default: return 'Record';
    }
  };

  const getCustomer = () => {
    switch(type) {
      case 'sales': return record.customer_name || 'Walk-in';
      case 'purchases': return record.supplier_name || 'Supplier';
      case 'returns': return record.customer_name || 'Customer';
      case 'emi': return record.customer_name || 'Customer';
      default: return '-';
    }
  };

  const getAmount = () => {
    switch(type) {
      case 'sales': return record.grand_total || 0;
      case 'purchases': return record.grand_total || 0;
      case 'returns': return record.refund_amount || 0;
      case 'payments': return record.amount || 0;
      case 'expenses': return record.amount || 0;
      default: return 0;
    }
  };

  const getStatus = () => {
    switch(type) {
      case 'sales': return record.payment_status || 'paid';
      case 'purchases': return record.payment_status || 'received';
      case 'returns': return 'returned';
      case 'emi': return record.status || 'active';
      case 'expenses': return record.status || 'active';
      default: return 'active';
    }
  };

  const getDate = () => {
    switch(type) {
      case 'sales': return record.date;
      case 'purchases': return record.purchase_date;
      case 'returns': return record.return_date;
      case 'payments': return record.date;
      case 'expenses': return record.date;
      default: return record.date;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      paid: 'success', received: 'success', active: 'success', completed: 'success',
      due: 'warning', pending: 'warning', partial: 'info',
      returned: 'error', cancelled: 'error', overdue: 'error'
    };
    return colors[status] || 'default';
  };

  return (
    <Card sx={{ mb: 1.5, borderLeft: `4px solid ${getStatusColor(getStatus()) === 'success' ? '#10b981' : getStatusColor(getStatus()) === 'warning' ? '#f59e0b' : '#ef4444'}` }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
              {getIcon()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight="bold" noWrap>
                {getTitle()}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {getCustomer()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
              {formatCurrency(getAmount())}
            </Typography>
            <Chip 
              size="small" 
              label={getStatus().toUpperCase()} 
              color={getStatusColor(getStatus())}
              sx={{ height: 18, fontSize: '0.55rem' }}
            />
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2">{formatShortDate(getDate())}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Payment</Typography>
              <Typography variant="body2">
                {record.payment_mode || record.refund_mode || 'N/A'}
              </Typography>
            </Grid>
            {record.description && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2" color="text.secondary">{record.description}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button size="small" variant="contained" startIcon={<Visibility />} onClick={() => onView(record, type)} sx={{ flex: 1, bgcolor: '#10b981' }}>
            View
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
export default function HistoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // ==================== GLOBAL STATES ====================
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // ==================== DATE RANGE ====================
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [quickDate, setQuickDate] = useState('30');

  // ==================== SEARCH & FILTERS ====================
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // ==================== PAGINATION ====================
  const [page, setPage] = useState(1);
  const perPage = isMobile ? 10 : 25;

  // ==================== DATA STATES ====================
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [returnData, setReturnData] = useState([]);
  const [emiData, setEmiData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);

  // ==================== DETAIL DIALOGS ====================
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailItems, setDetailItems] = useState([]);

  // ==================== SUMMARY STATS ====================
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0, totalPurchases: 0, totalPayments: 0,
    totalReturns: 0, totalEMI: 0, totalExpenses: 0,
    netCash: 0, totalBills: 0
  });

  // ==================== LOAD DATA ====================
  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSales(),
        loadPurchases(),
        loadPayments(),
        loadReturns(),
        loadEMI(),
        loadExpenses(),
        loadLedger()
      ]);
      await loadSummaryStats();
    } catch (err) {
      console.error('Load all error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSales = async () => {
    try {
      const data = await db.getSalesHistory({ dateFrom, dateTo, limit: 1000 });
      setSalesData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Sales load error:', err); }
  };

  const loadPurchases = async () => {
    try {
      const data = await db.query(`
        SELECT p.*, 
          CASE WHEN s.is_deleted = 1 THEN s.name || ' (Deleted)' ELSE s.name END as supplier_name,
          s.phone as supplier_phone
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE date(p.purchase_date) BETWEEN date(?) AND date(?)
          AND p.is_deleted = 0
        ORDER BY p.purchase_date DESC
      `, [dateFrom, dateTo]);
      setPurchaseData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Purchase load error:', err); }
  };

  const loadPayments = async () => {
    try {
      const data = await db.query(`
        SELECT p.*, s.name as supplier_name, s.phone as supplier_phone,
          'supplier' as payment_type
        FROM payments p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE date(p.date) BETWEEN date(?) AND date(?)
        ORDER BY p.date DESC
      `, [dateFrom, dateTo]);
      setPaymentData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Payment load error:', err); }
  };

  const loadReturns = async () => {
    try {
      const data = await db.getSaleReturns({ dateFrom, dateTo });
      setReturnData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Returns load error:', err); }
  };

  const loadEMI = async () => {
    try {
      const data = await db.getEMIs();
      setEmiData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('EMI load error:', err); }
  };

  const loadExpenses = async () => {
    try {
      const data = await db.query(`
        SELECT e.*, c.name as category_name, c.color as category_color
        FROM expenses e
        LEFT JOIN expense_categories c ON e.category_id = c.id
        WHERE date(e.date) BETWEEN date(?) AND date(?)
          AND e.is_deleted = 0
        ORDER BY e.date DESC
      `, [dateFrom, dateTo]);
      setExpenseData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Expense load error:', err); }
  };

  const loadLedger = async () => {
    try {
      const data = await db.getAllLedger();
      setLedgerData(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Ledger load error:', err); }
  };

  const loadSummaryStats = async () => {
    try {
      const [salesSum, purSum, paySum, retSum, expSum] = await Promise.all([
        db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM sales WHERE date(date) BETWEEN date(?) AND date(?) AND is_deleted = 0`, [dateFrom, dateTo]),
        db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM purchases WHERE date(purchase_date) BETWEEN date(?) AND date(?) AND is_deleted = 0`, [dateFrom, dateTo]),
        db.query(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM payments WHERE date(date) BETWEEN date(?) AND date(?)`, [dateFrom, dateTo]),
        db.query(`SELECT COALESCE(SUM(refund_amount), 0) as total, COUNT(*) as count FROM sale_returns WHERE date(return_date) BETWEEN date(?) AND date(?)`, [dateFrom, dateTo]),
        db.query(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date(date) BETWEEN date(?) AND date(?) AND is_deleted = 0`, [dateFrom, dateTo])
      ]);

      setSummaryStats({
        totalSales: Number(salesSum?.[0]?.total || 0),
        totalPurchases: Number(purSum?.[0]?.total || 0),
        totalPayments: Number(paySum?.[0]?.total || 0),
        totalReturns: Number(retSum?.[0]?.total || 0),
        totalExpenses: Number(expSum?.[0]?.total || 0),
        netCash: Number(salesSum?.[0]?.total || 0) - Number(purSum?.[0]?.total || 0) - Number(expSum?.[0]?.total || 0),
        totalBills: Number(salesSum?.[0]?.count || 0) + Number(purSum?.[0]?.count || 0)
      });
    } catch (err) { console.error('Summary error:', err); }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    loadAllData();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, statusFilter, paymentFilter]);

  // ==================== QUICK DATE FILTER ====================
  const handleQuickDate = (days) => {
    setQuickDate(days);
    if (days === 'all') {
      setDateFrom('2000-01-01');
      setDateTo(today);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - parseInt(days));
    setDateFrom(d.toISOString().split('T')[0]);
    setDateTo(today);
  };

  // ==================== FILTERED DATA ====================
  const getFilteredData = () => {
    let data = [];
    switch (HISTORY_TABS[activeTab].id) {
      case 'sales': data = salesData; break;
      case 'purchases': data = purchaseData; break;
      case 'payments': data = paymentData; break;
      case 'returns': data = returnData; break;
      case 'emi': data = emiData; break;
      case 'expenses': data = expenseData; break;
      case 'ledger': data = ledgerData; break;
      default: data = [];
    }

    return data.filter(item => {
      const matchSearch = !searchQuery || 
        JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchStatus = true;
      let matchPayment = true;

      if (statusFilter !== 'all' && item.payment_status) {
        matchStatus = item.payment_status === statusFilter;
      }
      if (paymentFilter !== 'all' && item.payment_mode) {
        matchPayment = item.payment_mode === paymentFilter;
      }

      return matchSearch && matchStatus && matchPayment;
    });
  };

  const filteredData = getFilteredData();
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page]);

  // ==================== VIEW DETAIL ====================
  const handleViewDetail = async (record, type) => {
    setSelectedRecord({ ...record, recordType: type });
    setLoading(true);
    try {
      let items = [];
      if (type === 'sales') {
        items = await db.getSaleItems(record.id);
      } else if (type === 'purchases') {
        items = await db.getPurchaseItems(record.id);
      } else if (type === 'returns') {
        items = await db.getSaleReturnItems(record.id);
      }
      setDetailItems(Array.isArray(items) ? items : []);
      setDetailDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Detail load error: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ==================== EXPORT CSV ====================
  const exportCSV = () => {
    const currentData = filteredData;
    if (currentData.length === 0) return;

    const headers = Object.keys(currentData[0]).join(',');
    const rows = currentData.map(row => 
      Object.values(row).map(v => 
        typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
      ).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${HISTORY_TABS[activeTab].id}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    setSnackbar({ open: true, message: 'CSV exported successfully!', severity: 'success' });
  };

  // ==================== PRINT ====================
  const handlePrint = () => {
    window.print();
  };

  // ==================== RENDER HELPERS ====================
  const StatCard = ({ title, value, sub, color, icon }) => (
    <Grid item xs={6} md={3} lg={2}>
      <Card sx={{ bgcolor: `${color}.light`, opacity: 0.95, height: '100%' }}>
        <CardContent sx={{ p: isMobile ? 1 : 1.5, '&:last-child': { pb: isMobile ? 1 : 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                {title}
              </Typography>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color={`${color}.dark`} noWrap>
                {value}
              </Typography>
              {sub && <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.5rem' : '0.75rem' }}>{sub}</Typography>}
            </Box>
            <Avatar sx={{ bgcolor: `${color}.main`, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32 }}>
              {React.cloneElement(icon, { sx: { fontSize: isMobile ? 14 : 18 } })}
            </Avatar>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );

  const getStatusChip = (status) => {
    const config = {
      paid: { color: 'success', icon: <CheckCircle fontSize="small" /> },
      due: { color: 'warning', icon: <Pending fontSize="small" /> },
      partial: { color: 'info', icon: <Schedule fontSize="small" /> },
      returned: { color: 'error', icon: <Restore fontSize="small" /> },
      received: { color: 'success', icon: <CheckCircle fontSize="small" /> },
      pending: { color: 'warning', icon: <Pending fontSize="small" /> },
      cancelled: { color: 'error', icon: <Cancel fontSize="small" /> },
      active: { color: 'success', icon: <CheckCircle fontSize="small" /> },
      completed: { color: 'success', icon: <DoneAll fontSize="small" /> },
      overdue: { color: 'error', icon: <Warning fontSize="small" /> },
    };
    const c = config[status] || { color: 'default', icon: <Receipt fontSize="small" /> };
    return <Chip size="small" color={c.color} icon={c.icon} label={status?.toUpperCase() || 'N/A'} variant="outlined" />;
  };

  const getPaymentChip = (mode) => {
    const colors = { cash: 'success', credit: 'warning', bank: 'info', easypaisa: 'secondary', jazzcash: 'primary' };
    return <Chip size="small" color={colors[mode] || 'default'} label={mode?.toUpperCase() || 'N/A'} variant="outlined" />;
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
          <History sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'History' : 'Transaction History'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          {!isMobile && (
            <>
              <Button variant="outlined" size="small" startIcon={<Download />} onClick={exportCSV}>
                Export CSV
              </Button>
              <Button variant="outlined" size="small" startIcon={<Print />} onClick={handlePrint}>
                Print
              </Button>
            </>
          )}
          <Button variant="contained" size="small" startIcon={<Refresh />} onClick={loadAllData} disabled={loading}>
            {isMobile ? 'Refresh' : 'Refresh'}
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* SUMMARY CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        <StatCard title="Sales" value={formatCurrency(summaryStats.totalSales)} color="success" icon={<PointOfSale />} />
        <StatCard title="Purchases" value={formatCurrency(summaryStats.totalPurchases)} color="info" icon={<LocalShipping />} />
        <StatCard title="Payments" value={formatCurrency(summaryStats.totalPayments)} color="primary" icon={<Payment />} />
        <StatCard title="Returns" value={formatCurrency(summaryStats.totalReturns)} color="warning" icon={<Restore />} />
        <StatCard title="Expenses" value={formatCurrency(summaryStats.totalExpenses)} color="error" icon={<MoneyOff />} />
        <StatCard title="Net Cash" value={formatCurrency(summaryStats.netCash)} color={summaryStats.netCash >= 0 ? 'success' : 'error'} icon={summaryStats.netCash >= 0 ? <TrendingUp /> : <TrendingDown />} />
      </Grid>

      {/* FILTERS BAR */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth size="small"
              placeholder={isMobile ? "Search..." : "Search invoice, customer, supplier, amount..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ 
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: isMobile ? 18 : 24 }} />,
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Range</InputLabel>
              <Select value={quickDate} onChange={(e) => handleQuickDate(e.target.value)} label="Range">
                <MenuItem value="1">Today</MenuItem>
                <MenuItem value="7">7 Days</MenuItem>
                <MenuItem value="30">30 Days</MenuItem>
                <MenuItem value="90">3 Months</MenuItem>
                <MenuItem value="365">This Year</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="due">Due</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="returned">Returned</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment</InputLabel>
              <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} label="Payment">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="credit">Credit</MenuItem>
                <MenuItem value="bank">Bank</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                <MenuItem value="jazzcash">JazzCash</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          {HISTORY_TABS.map((tab, idx) => {
            const count = tab.id === 'sales' ? salesData.length :
                         tab.id === 'purchases' ? purchaseData.length :
                         tab.id === 'payments' ? paymentData.length :
                         tab.id === 'returns' ? returnData.length :
                         tab.id === 'emi' ? emiData.length :
                         tab.id === 'expenses' ? expenseData.length :
                         ledgerData.length;
            return (
              <Tab 
                key={tab.id}
                icon={isMobile ? tab.icon : tab.icon} 
                label={isMobile ? tab.label : `${tab.label} (${count})`}
                sx={{ 
                  fontSize: isMobile ? '0.6rem' : '0.875rem',
                  py: isMobile ? 0.5 : 1,
                  minWidth: isMobile ? 'auto' : 'auto',
                  px: isMobile ? 1 : 2,
                  color: `${tab.color}.main`
                }}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* ==================== DATA TABLE / CARDS ==================== */}
      {isMobile ? (
        // Mobile Cards View
        <Box>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LinearProgress />
              <Typography sx={{ mt: 2 }}>Loading...</Typography>
            </Box>
          ) : paginatedData.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Receipt sx={{ fontSize: 48, color: '#d1d5db' }} />
              <Typography color="text.secondary">No records found</Typography>
              <Typography variant="caption" color="text.secondary">Try changing filters</Typography>
            </Paper>
          ) : (
            paginatedData.map((record, idx) => (
              <MobileHistoryCard
                key={record.id || idx}
                record={record}
                type={HISTORY_TABS[activeTab].id}
                onView={handleViewDetail}
              />
            ))
          )}
          {filteredData.length > perPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination 
                count={Math.ceil(filteredData.length / perPage)} 
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
          <Paper>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice/Ref</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Party</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Amount</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map((record, idx) => {
                    const type = HISTORY_TABS[activeTab].id;
                    const getInvoice = () => {
                      switch(type) {
                        case 'sales': return record.invoice_no;
                        case 'purchases': return record.purchase_no;
                        case 'returns': return `RET-${record.id}`;
                        case 'payments': return `PAY-${record.id}`;
                        case 'emi': return record.product_name;
                        case 'expenses': return record.title;
                        default: return record.id;
                      }
                    };
                    const getParty = () => {
                      switch(type) {
                        case 'sales': return record.customer_name || 'Walk-in';
                        case 'purchases': return record.supplier_name || '-';
                        case 'returns': return record.customer_name || '-';
                        case 'emi': return record.customer_name || '-';
                        default: return '-';
                      }
                    };
                    const getAmount = () => {
                      switch(type) {
                        case 'sales': return record.grand_total || 0;
                        case 'purchases': return record.grand_total || 0;
                        case 'returns': return record.refund_amount || 0;
                        case 'payments': return record.amount || 0;
                        case 'expenses': return record.amount || 0;
                        default: return 0;
                      }
                    };
                    const getDate = () => {
                      switch(type) {
                        case 'sales': return record.date;
                        case 'purchases': return record.purchase_date;
                        case 'returns': return record.return_date;
                        case 'payments': return record.date;
                        case 'expenses': return record.date;
                        default: return record.date;
                      }
                    };
                    const getStatus = () => {
                      switch(type) {
                        case 'sales': return record.payment_status || 'paid';
                        case 'purchases': return record.payment_status || 'received';
                        case 'returns': return 'returned';
                        case 'emi': return record.status || 'active';
                        case 'expenses': return record.status || 'active';
                        default: return 'active';
                      }
                    };

                    return (
                      <TableRow key={record.id || idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell fontWeight="bold">{getInvoice()}</TableCell>
                        <TableCell>{formatShortDate(getDate())}</TableCell>
                        <TableCell>{getParty()}</TableCell>
                        <TableCell align="right" fontWeight="bold" color="primary.main">
                          {formatCurrency(getAmount())}
                        </TableCell>
                        <TableCell align="center">{getStatusChip(getStatus())}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Details">
                            <IconButton size="small" color="primary" onClick={() => handleViewDetail(record, type)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No records found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* PAGINATION */}
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination 
              count={Math.ceil(filteredData.length / perPage)} 
              page={page} 
              onChange={(e, p) => setPage(p)} 
              color="primary" 
            />
          </Box>
        </>
      )}

      {/* ==================== DETAIL DIALOG ==================== */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <Receipt sx={{ verticalAlign: 'middle', mr: 1 }} />
          {selectedRecord?.recordType === 'sales' ? 'Sale Invoice' : 
           selectedRecord?.recordType === 'purchases' ? 'Purchase Order' : 
           selectedRecord?.recordType === 'returns' ? 'Return Details' : 'Details'} — 
          {selectedRecord?.invoice_no || selectedRecord?.purchase_no || `RET-${selectedRecord?.id}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedRecord && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography variant="h6" fontWeight="bold">{formatDate(selectedRecord.date || selectedRecord.purchase_date || selectedRecord.return_date)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      {formatCurrency(selectedRecord.grand_total || selectedRecord.total_amount || selectedRecord.refund_amount)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>{getStatusChip(selectedRecord.payment_status || selectedRecord.status)}</Box>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Payment</Typography>
                    <Box sx={{ mt: 0.5 }}>{getPaymentChip(selectedRecord.payment_mode || selectedRecord.refund_mode)}</Box>
                  </Paper>
                </Grid>
              </Grid>

              {detailItems.length > 0 && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Items</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell>#</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Price</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailItems.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{item.product_name || item.title || '-'}</TableCell>
                            <TableCell>{item.sku || item.variant_name || '-'}</TableCell>
                            <TableCell align="right">{item.quantity || item.qty || item.returned_quantity || 0}</TableCell>
                            <TableCell align="right">{formatCurrency(item.price || item.purchase_price || item.refund_price || 0)}</TableCell>
                            <TableCell align="right" fontWeight="bold">{formatCurrency(item.total || item.sub_total || (item.quantity * item.price) || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setDetailDialog(false)}>Close</Button>
          <Button fullWidth={isMobile} variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== MOBILE DRAWER ==================== */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); exportCSV(); }}>
              <ListItemIcon><Download /></ListItemIcon>
              <ListItemText primary="Export CSV" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); handlePrint(); }}>
              <ListItemIcon><Print /></ListItemIcon>
              <ListItemText primary="Print" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadAllData(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Refresh Data" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* ==================== SNACKBAR ==================== */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 8 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}