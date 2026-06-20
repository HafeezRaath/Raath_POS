
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab, Pagination,
  Snackbar, Alert, Avatar, Tooltip, Divider, InputAdornment,
  List, ListItem, ListItemText, ListItemIcon, Accordion, AccordionSummary,
  AccordionDetails, Badge, LinearProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  Search, FilterList, Visibility, Refresh, Close, Receipt,
  ShoppingCart, LocalShipping, Payment, AccountBalance, TrendingUp,
  TrendingDown, Warning, CheckCircle, Error, History, DateRange,
  Person, Phone, LocationOn, Print, Download, ArrowBack, ArrowForward,
  MonetizationOn, CreditCard, MoneyOff, CalendarToday, ExpandMore,
  Inventory, Category, AttachMoney, PointOfSale, AccountCircle,
  Store, ArrowUpward, ArrowDownward, SwapHoriz, DoneAll,
  Cancel, Pending, Schedule, Restore, DeleteOutline, Edit
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

export default function HistoryPage() {
  // ==================== GLOBAL STATES ====================
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

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
  const perPage = 25;

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
    const d = new Date();
    d.setDate(d.getDate() - parseInt(days));
    setDateFrom(d.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
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
    
    const csv = [headers, ...rows].join('\\n');
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
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">{title}</Typography>
              <Typography variant="h6" fontWeight="bold" color={`${color}.dark`} noWrap>{value}</Typography>
              {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
            </Box>
            <Avatar sx={{ bgcolor: `${color}.main`, width: 32, height: 32 }}>
              {React.cloneElement(icon, { sx: { fontSize: 18 } })}
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
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          <History sx={{ verticalAlign: 'middle', mr: 1 }} />
          Transaction History
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<Download />} onClick={exportCSV}>
            Export CSV
          </Button>
          <Button variant="outlined" size="small" startIcon={<Print />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="contained" size="small" startIcon={<Refresh />} onClick={loadAllData} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* SUMMARY CARDS */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <StatCard title="Total Sales" value={formatCurrency(summaryStats.totalSales)} color="success" icon={<PointOfSale />} />
        <StatCard title="Purchases" value={formatCurrency(summaryStats.totalPurchases)} color="info" icon={<LocalShipping />} />
        <StatCard title="Payments" value={formatCurrency(summaryStats.totalPayments)} color="primary" icon={<Payment />} />
        <StatCard title="Returns" value={formatCurrency(summaryStats.totalReturns)} color="warning" icon={<Restore />} />
        <StatCard title="Expenses" value={formatCurrency(summaryStats.totalExpenses)} color="error" icon={<MoneyOff />} />
        <StatCard title="Net Cash" value={formatCurrency(summaryStats.netCash)} color={summaryStats.netCash >= 0 ? 'success' : 'error'} icon={summaryStats.netCash >= 0 ? <TrendingUp /> : <TrendingDown />} />
      </Grid>

      {/* FILTERS BAR */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth size="small"
              placeholder="Search invoice, customer, supplier, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
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
              <InputLabel>Quick Range</InputLabel>
              <Select value={quickDate} onChange={(e) => handleQuickDate(e.target.value)} label="Quick Range">
                <MenuItem value="1">Today</MenuItem>
                <MenuItem value="7">Last 7 Days</MenuItem>
                <MenuItem value="30">Last 30 Days</MenuItem>
                <MenuItem value="90">Last 3 Months</MenuItem>
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
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          {HISTORY_TABS.map((tab, idx) => (
            <Tab 
              key={tab.id}
              icon={tab.icon} 
              label={`${tab.label} (${
                tab.id === 'sales' ? salesData.length :
                tab.id === 'purchases' ? purchaseData.length :
                tab.id === 'payments' ? paymentData.length :
                tab.id === 'returns' ? returnData.length :
                tab.id === 'emi' ? emiData.length :
                tab.id === 'expenses' ? expenseData.length :
                ledgerData.length
              })`}
              sx={{ color: tab.color + '.main' }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* ==================== SALES TAB ==================== */}
      {activeTab === 0 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Invoice #</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Customer</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Items</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Qty</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Grand Total</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Paid</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Due</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Payment</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Status</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((sale) => (
                  <TableRow key={sale.id} hover>
                    <TableCell fontWeight="bold">{sale.invoice_no}</TableCell>
                    <TableCell>{formatShortDate(sale.date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{sale.customer_name || 'Walk-in'}</Typography>
                      {sale.customer_phone && <Typography variant="caption" color="text.secondary">{sale.customer_phone}</Typography>}
                    </TableCell>
                    <TableCell align="right">{sale.total_items || 0}</TableCell>
                    <TableCell align="right">{sale.total_qty || 0}</TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(sale.grand_total || sale.grand_total)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: (sale.due_amount || 0) > 0 ? 'error.main' : 'text.secondary' }} fontWeight="bold">
                      {formatCurrency(sale.due_amount)}
                    </TableCell>
                    <TableCell align="center">{getPaymentChip(sale.payment_mode)}</TableCell>
                    <TableCell align="center">{getStatusChip(sale.payment_status)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" color="primary" onClick={() => handleViewDetail(sale, 'sales')}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No sales found for selected period</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== PURCHASES TAB ==================== */}
      {activeTab === 1 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'info.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Purchase #</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Supplier</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Grand Total</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Paid</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Due</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Status</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell fontWeight="bold">{p.purchase_no}</TableCell>
                    <TableCell>{formatShortDate(p.purchase_date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.supplier_name || '-'}</Typography>
                      {p.supplier_phone && <Typography variant="caption" color="text.secondary">{p.supplier_phone}</Typography>}
                    </TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(p.grand_total)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(p.paid_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: (p.grand_total - p.paid_amount) > 0 ? 'error.main' : 'inherit' }}>
                      {formatCurrency(p.grand_total - p.paid_amount)}
                    </TableCell>
                    <TableCell align="center">{getStatusChip(p.payment_status)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" color="info" onClick={() => handleViewDetail(p, 'purchases')}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No purchases found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== PAYMENTS TAB ==================== */}
      {activeTab === 2 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'success.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Party</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Note</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Amount</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Mode</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((p, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{formatShortDate(p.date)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.payment_type?.toUpperCase() || 'PAYMENT'} color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.supplier_name || 'Unknown'}</Typography>
                      {p.supplier_phone && <Typography variant="caption" color="text.secondary">{p.supplier_phone}</Typography>}
                    </TableCell>
                    <TableCell>{p.note || '-'}</TableCell>
                    <TableCell align="right" fontWeight="bold" color="success.main">{formatCurrency(p.amount)}</TableCell>
                    <TableCell align="center">{getPaymentChip(p.type || p.payment_mode)}</TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No payments found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== RETURNS TAB ==================== */}
      {activeTab === 3 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'warning.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Return #</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Original Invoice</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Customer</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Reason</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Refund</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Mode</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell fontWeight="bold">RET-{r.id}</TableCell>
                    <TableCell>{formatShortDate(r.return_date)}</TableCell>
                    <TableCell>{r.original_invoice || '-'}</TableCell>
                    <TableCell>{r.customer_name || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.reason || 'No reason'}</Typography>
                      {r.notes && <Typography variant="caption" color="text.secondary">{r.notes}</Typography>}
                    </TableCell>
                    <TableCell align="right" fontWeight="bold" color="warning.main">{formatCurrency(r.refund_amount)}</TableCell>
                    <TableCell align="center">{getPaymentChip(r.refund_mode)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" color="warning" onClick={() => handleViewDetail(r, 'returns')}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No returns found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== EMI TAB ==================== */}
      {activeTab === 4 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'secondary.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Customer</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Product</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Total</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Down</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">EMI/Month</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Paid</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Remaining</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Status</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Next Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((emi) => {
                  const remaining = (emi.total_months || 0) - (emi.paid_months || 0);
                  const progress = emi.total_months > 0 ? (emi.paid_months / emi.total_months) * 100 : 0;
                  return (
                    <TableRow key={emi.id} hover>
                      <TableCell>
                        <Typography variant="body2">{emi.customer_name || '-'}</Typography>
                        {emi.phone && <Typography variant="caption" color="text.secondary">{emi.phone}</Typography>}
                      </TableCell>
                      <TableCell>{emi.product_name || '-'}</TableCell>
                      <TableCell align="right" fontWeight="bold">{formatCurrency(emi.total_amount)}</TableCell>
                      <TableCell align="right" color="success.main">{formatCurrency(emi.down_payment)}</TableCell>
                      <TableCell align="right">{formatCurrency(emi.emi_amount)}/mo</TableCell>
                      <TableCell align="right">{emi.paid_months}/{emi.total_months}</TableCell>
                      <TableCell align="right" fontWeight="bold" color={remaining <= 2 ? 'success.main' : 'warning.main'}>
                        {remaining} months
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" 
                          label={emi.status?.toUpperCase()} 
                          color={emi.status === 'active' ? 'success' : emi.status === 'completed' ? 'info' : 'error'}
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={new Date(emi.next_due_date) < new Date() ? 'error.main' : 'inherit'}>
                          {formatShortDate(emi.next_due_date)}
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 4, mt: 0.5 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No EMI records found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== EXPENSES TAB ==================== */}
      {activeTab === 5 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'error.main' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Title</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Amount</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Payment</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{formatShortDate(e.date)}</TableCell>
                    <TableCell fontWeight="bold">{e.title}</TableCell>
                    <TableCell>
                      <Chip size="small" label={e.category_name || 'Uncategorized'} 
                        sx={{ bgcolor: e.category_color || '#888', color: '#fff' }} />
                    </TableCell>
                    <TableCell>{e.description || '-'}</TableCell>
                    <TableCell align="right" fontWeight="bold" color="error.main">{formatCurrency(e.amount)}</TableCell>
                    <TableCell align="center">{getPaymentChip(e.payment_mode)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={e.status?.toUpperCase()} color={e.status === 'active' ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No expenses found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==================== LEDGER TAB ==================== */}
      {activeTab === 6 && (
        <Paper>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.700' }}>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Customer/Supplier</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Amount</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="right">Balance After</TableCell>
                  <TableCell sx={{ color: 'black', fontWeight: 'bold' }} align="center">Mode</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((l, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{formatShortDate(l.date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{l.customer_name || l.supplier_name || '-'}</Typography>
                      {l.customer_phone && <Typography variant="caption" color="text.secondary">{l.customer_phone}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" 
                        label={l.type?.toUpperCase()} 
                        color={l.type === 'sale' ? 'success' : l.type === 'payment' ? 'primary' : 'warning'}
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell>{l.description || '-'}</TableCell>
                    <TableCell align="right" fontWeight="bold" color={l.type === 'sale' ? 'success.main' : l.type === 'payment' ? 'primary.main' : 'inherit'}>
                      {l.type === 'sale' ? '+' : l.type === 'payment' ? '-' : ''}{formatCurrency(l.amount)}
                    </TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(l.balance_after)}</TableCell>
                    <TableCell align="center">{getPaymentChip(l.payment_mode)}</TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No ledger entries found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* PAGINATION */}
      <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination 
          count={Math.ceil(filteredData.length / perPage)} 
          page={page} 
          onChange={(e, p) => setPage(p)} 
          color="primary" 
        />
      </Box>

      {/* ==================== DETAIL DIALOG ==================== */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Receipt sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
          {selectedRecord?.recordType === 'sales' ? 'Sale Invoice' : 
           selectedRecord?.recordType === 'purchases' ? 'Purchase Order' : 
           selectedRecord?.recordType === 'returns' ? 'Return Details' : 'Details'} — 
          {selectedRecord?.invoice_no || selectedRecord?.purchase_no || `RET-${selectedRecord?.id}`}
        </DialogTitle>
        <DialogContent>
          {selectedRecord && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography variant="h6" fontWeight="bold">{formatDate(selectedRecord.date || selectedRecord.purchase_date || selectedRecord.return_date)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      {formatCurrency(selectedRecord.grand_total || selectedRecord.grand_total || selectedRecord.total_amount || selectedRecord.refund_amount)}
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
                    <Typography variant="caption" color="text.secondary">Payment Mode</Typography>
                    <Box sx={{ mt: 0.5 }}>{getPaymentChip(selectedRecord.payment_mode || selectedRecord.refund_mode)}</Box>
                  </Paper>
                </Grid>
              </Grid>

              {detailItems.length > 0 && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {selectedRecord.recordType === 'sales' ? 'Sold Items' : 
                     selectedRecord.recordType === 'purchases' ? 'Purchased Items' : 
                     selectedRecord.recordType === 'returns' ? 'Returned Items' : 'Items'}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell>#</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU/Variant</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
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

              {selectedRecord.recordType === 'sales' && (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary">Customer: {selectedRecord.customer_name || 'Walk-in'}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary">Phone: {selectedRecord.customer_phone || '-'}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary">Subtotal: {formatCurrency(selectedRecord.subtotal)}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary">Discount: {formatCurrency(selectedRecord.discount)}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary">Paid: {formatCurrency(selectedRecord.paid_amount)}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2" color="text.secondary" fontWeight="bold">Due: {formatCurrency(selectedRecord.due_amount)}</Typography></Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

