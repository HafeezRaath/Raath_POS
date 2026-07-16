import {
  AssignmentReturn,
  FilterList,
  History,
  Payment,
  Refresh,
  Search,
  TrendingUp,
  Visibility
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card, CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import db from '../database/db';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'credit', label: 'Credit' },
];

const RETURN_REASONS = [
  'Defective / Faulty',
  'Wrong Item',
  'Customer Changed Mind',
  'Size/Color Issue',
  'Damaged in Transit',
  'Expired Product',
  'Not as Described',
  'Other'
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const getToday = () => new Date().toISOString().split('T')[0];
const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

export default function SalesHistoryPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(getStartOfMonth());
  const [filterDateTo, setFilterDateTo] = useState(getToday());
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(25);

  // Dialogs State
  const [viewSaleDialog, setViewSaleDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  
  const [returnDialog, setReturnDialog] = useState(false);
  const [returningSale, setReturningSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnForm, setReturnForm] = useState({ reason: '', refund_mode: 'cash', notes: '' });

  const [trackQuery, setTrackQuery] = useState('');
  const [trackResult, setTrackResult] = useState(null);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Dashboard Metrics Counters State
  const [stats, setStats] = useState({
    today: { count: 0, amount: 0 },
    period: { count: 0, amount: 0, paid: 0, due: 0, discount: 0 },
    byMode: [],
    byCustomer: []
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ==================== DATABASE LOAD MATRIX ====================
  const loadData = async () => {
    setLoading(true);
    try {
      // Direct raw query execution mapping sub-aggregates smoothly
      const salesQuery = `
        SELECT s.*, 
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as total_items
        FROM sales s 
        WHERE s.is_deleted = 0
        ORDER BY s.id DESC
      `;
      const rawSales = await db.electronQuery(salesQuery);

      // Sanitize date strings safely via substring comparison
      const filteredSalesRows = rawSales.filter(sale => {
        const saleDateClean = String(sale.date || '').substring(0, 10);
        
        if (filterDateFrom && saleDateClean < filterDateFrom) return false;
        if (filterDateTo && saleDateClean > filterDateTo) return false;
        if (filterCustomer && Number(sale.customer_id) !== Number(filterCustomer)) return false;
        if (filterPaymentMode && sale.payment_mode !== filterPaymentMode) return false;
        if (filterPaymentStatus && sale.payment_status !== filterPaymentStatus) return false;
        
        return true;
      });

      const rawReturns = await db.electronQuery("SELECT * FROM sale_returns WHERE is_deleted = 0 ORDER BY id DESC");
      const customersList = await db.getCustomers();

      setSales(filteredSalesRows);
      setReturns(rawReturns);
      setCustomers(customersList || []);

      const todayString = getToday();
      const todayRows = rawSales.filter(x => String(x.date || '').substring(0, 10) === todayString);

      // Financial Metrics Aggregations
      setStats({
        today: {
          count: todayRows.length,
          amount: todayRows.reduce((a, b) => a + Number(b.grand_total || 0), 0)
        },
        period: {
          count: filteredSalesRows.length,
          amount: filteredSalesRows.reduce((a, b) => a + Number(b.grand_total || 0), 0),
          paid: filteredSalesRows.reduce((a, b) => a + Number(b.paid_amount || 0), 0),
          due: filteredSalesRows.reduce((a, b) => a + Number(b.due_amount || 0), 0),
          discount: filteredSalesRows.reduce((a, b) => a + Number(b.discount || b.item_discount || 0), 0)
        },
        byMode: Object.values(filteredSalesRows.reduce((acc, sale) => {
          const mode = sale.payment_mode || 'cash';
          if (!acc[mode]) acc[mode] = { payment_mode: mode, total: 0 };
          acc[mode].total += Number(sale.grand_total || 0);
          return acc;
        }, {})),
        byCustomer: Object.values(filteredSalesRows.reduce((acc, sale) => {
          const name = sale.customer_name || 'Walk-in Account';
          if (!acc[name]) acc[name] = { customer_name: name, total_sales: 0, total_bills: 0 };
          acc[name].total_sales += Number(sale.grand_total || 0);
          acc[name].total_bills += 1;
          return acc;
        }, {})).slice(0, 5)
      });

    } catch (err) {
      console.error("Critical Matrix Settle Fetch Crash Error:", err);
      setSnackbar({ open: true, message: 'Execution Error: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDateFrom, filterDateTo, filterPaymentMode, filterPaymentStatus, filterCustomer]);

  // ==================== VIEW SALES DIALOG ====================
  const handleViewSale = async (sale) => {
    setSelectedSale(sale);
    try {
      const items = await db.electronQuery(`
        SELECT si.*, pv.variant_name, pv.sku, p.name as product_name 
        FROM sale_items si
        JOIN product_variants pv ON si.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE si.sale_id = ?
      `, [sale.id]);
      setSaleItems(items);
      setViewSaleDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Item retrieval error thread failed.', severity: 'error' });
    }
  };

  // ==================== DEBT BALANCE RECOVERY INSTALLMENTS ====================
  const handleUpdatePayment = async () => {
    if (!paymentSale || !paymentAmount) return;
    try {
      const parsedAddedCash = Number(paymentAmount);
      const computedTotalPaid = Number(paymentSale.paid_amount || 0) + parsedAddedCash;
      const originalGrandTotal = Number(paymentSale.grand_total || 0);
      
      let revisedStatus = 'due';
      if (computedTotalPaid >= originalGrandTotal) revisedStatus = 'paid';
      else if (computedTotalPaid > 0) revisedStatus = 'partial';

      const revisedDueAmount = Math.max(0, originalGrandTotal - computedTotalPaid);

      await db.electronQuery(
        "UPDATE sales SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?",
        [computedTotalPaid, revisedDueAmount, revisedStatus, paymentSale.id]
      );

      if (paymentSale.customer_id) {
        await db.electronQuery("UPDATE customers SET current_balance = current_balance - ? WHERE id = ?", [parsedAddedCash, paymentSale.customer_id]);
        await db.addCustomerLedgerEntry({
          customer_id: paymentSale.customer_id,
          type: 'payment',
          amount: parsedAddedCash,
          description: `Manual balance recovery statement registered against invoice reference #${paymentSale.invoice_no}`,
          payment_mode: 'cash'
        });
      }

      setSnackbar({ open: true, message: 'Payment allocation book settled successfully!', severity: 'success' });
      setPaymentDialog(false);
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Post operation failure: ' + err.message, severity: 'error' });
    }
  };

  // ==================== REVERSE RETURNS TRANS PROCESSING ====================
  const handleOpenReturn = (sale) => {
    setReturningSale(sale);
    setReturnItems(saleItems.map(item => ({
      ...item,
      returnQty: 0,
      returnPrice: item.price,
      selected: false,
      condition: 'good'
    })));
    setReturnForm({ reason: '', refund_mode: 'cash', notes: '' });
    setReturnDialog(true);
  };

  const handleReturnQtyChange = (index, qty) => {
    const updated = [...returnItems];
    const upperLimit = Number(updated[index].quantity || updated[index].qty || 0);
    updated[index].returnQty = Math.min(Number(qty) || 0, upperLimit);
    updated[index].selected = updated[index].returnQty > 0;
    setReturnItems(updated);
  };

  const handleProcessReturn = async () => {
    const activeReturnRows = returnItems.filter(i => i.selected && i.returnQty > 0);
    if (activeReturnRows.length === 0) {
      setSnackbar({ open: true, message: 'Select rows to execute return statement compilation!', severity: 'warning' });
      return;
    }

    const netRefundCalculatedSum = activeReturnRows.reduce((a, b) => a + (b.returnQty * b.returnPrice), 0);

    try {
      const generatedReturnNo = `RET-${Date.now().toString().slice(-5)}`;
      const parentInsert = await db.electronQuery(`
        INSERT INTO sale_returns (sale_id, invoice_no, return_no, customer_id, return_date, refund_amount, payment_mode, notes)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)
      `, [returningSale.id, returningSale.invoice_no, generatedReturnNo, returningSale.customer_id || null, netRefundCalculatedSum, returnForm.refund_mode, returnForm.notes]);

      const parentReturnRowId = parentInsert.lastInsertRowid;

      for (const row of activeReturnRows) {
        await db.electronQuery(`
          INSERT INTO sale_return_items (sale_return_id, product_variant_id, quantity, price, sub_total, reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [parentReturnRowId, row.product_variant_id, row.returnQty, row.returnPrice, (row.returnQty * row.returnPrice), returnForm.reason]);

        await db.updateVariantStock(row.product_variant_id, row.returnQty);
      }

      if (returningSale.customer_id && returningSale.payment_status !== 'paid') {
        await db.electronQuery("UPDATE customers SET current_balance = current_balance - ? WHERE id = ?", [netRefundCalculatedSum, returningSale.customer_id]);
      }

      setSnackbar({ open: true, message: 'Reverse return profile updated completely.', severity: 'success' });
      setReturnDialog(false);
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Return execution crash pipeline: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DEEP PRODUCT LIFECYCLE SUPPLY CHAIN TRACKER ====================
  const handleTrackLifecycle = async () => {
    if (!trackQuery.trim()) return;
    try {
      const lifeQuery = `
        SELECT pv.sku, pv.variant_name, pv.purchase_price, pv.retail_price, pv.current_stock,
               p.name as product_name,
               pi.purchase_price as vendor_cost, pur.purchase_no as batch_purchase_invoice, pur.purchase_date as purchased_on, sup.name as supplier_company,
               s.invoice_no as final_sale_invoice, s.date as sold_on, s.customer_name as sold_to_party, s.payment_mode as sale_channel
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN purchase_items pi ON pi.product_variant_id = pv.id
        LEFT JOIN purchases pur ON pi.purchase_id = pur.id
        LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
        LEFT JOIN sale_items si ON si.product_variant_id = pv.id
        LEFT JOIN sales s ON si.sale_id = s.id
        WHERE LOWER(pv.sku) = LOWER(?) OR LOWER(pv.barcode) = LOWER(?)
        LIMIT 1
      `;
      const executionRows = await db.electronQuery(lifeQuery, [trackQuery.trim(), trackQuery.trim()]);
      setTrackResult(executionRows.length > 0 ? executionRows[0] : null);
    } catch (err) {
      setSnackbar({ open: true, message: 'Tracker Engine lifecycle mismatch lookup trace failed.', severity: 'error' });
    }
  };

  // ==================== MEMOIZED FILTER RENDERING ====================
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (!searchInvoice.trim()) return true;
      return String(sale.invoice_no || '').toLowerCase().includes(searchInvoice.trim().toLowerCase());
    });
  }, [sales, searchInvoice]);

  const paginatedSales = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, page, rowsPerPage]);

  // ==================== UI HELPER METHODS FOR TABLE ROWS ====================
  const getPaymentStatusChip = (status) => {
    const colors = { paid: 'success', partial: 'warning', due: 'error' };
    return <Chip size="small" color={colors[status] || 'default'} label={String(status || 'unknown').toUpperCase()} sx={{ fontWeight: 'bold' }} />;
  };

  const handleOpenPayment = (sale) => {
    setPaymentSale(sale);
    setPaymentAmount(String(Number(sale.grand_total || 0) - Number(sale.paid_amount || 0)));
    setPaymentDialog(true);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      
      {/* ===== CONTROL BOARD CONSOLE HEADER ===== */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <History sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Audit Control Desk: Sales & Returns Logs
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            Filters Engine
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData}>
            Sync Tables Matrix
          </Button>
        </Stack>
      </Box>

      {/* ===== DASHBOARD METRICS SYSTEM STATUS CARDS ===== */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { title: "Today's Gross Sales", value: stats.today.amount, label: `${stats.today.count} bills`, color: 'success' },
          { title: 'Selected Filter Total', value: stats.period.amount, label: `${stats.period.count} bills`, color: 'primary' },
          { title: 'Recovered Cash Received', value: stats.period.paid, label: 'Ledger In', color: 'info' },
          { title: 'Open Debt Balance (Due)', value: stats.period.due, label: 'Book Receivable', color: 'error' },
          { title: 'Discounts Granted', value: stats.period.discount, label: 'Deductions Volume', color: 'warning' },
          { title: 'Processed Returns Count', value: returns.length, label: 'Reverse Slips', color: 'secondary' },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: `5px solid`, borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`}>
                  {idx === 5 ? stat.value : formatCurrency(stat.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ===== NAVIGATION DASHBOARD TABS ENGINE ===== */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<History fontSize="small" />} iconPosition="start" label="Sales Logs Master" />
          <Tab icon={<AssignmentReturn fontSize="small" />} iconPosition="start" label={`Returns Dashboard (${returns.length})`} />
          <Tab icon={<TrendingUp fontSize="small" />} iconPosition="start" label="Graphical Breakdown" />
          <Tab icon={<Search fontSize="small" />} iconPosition="start" label="Product Sourced Lifecycle Tracker" />
        </Tabs>
      </Paper>

      {/* ===== FILTERS PANELS ===== */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" type="date" label="Bound Date From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth size="small" type="date" label="Bound Date To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" placeholder="Search exact invoice profile reference matching..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter Party Account</InputLabel>
                <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} label="Filter Party Account">
                  <MenuItem value=""><em>Display All Sourced Books Profiles</em></MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `[${c.phone}]` : ''}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} label="Payment Status">
                  <MenuItem value="">Show All Statuses</MenuItem>
                  <MenuItem value="paid">Fully Settled (Paid)</MenuItem>
                  <MenuItem value="partial">Partial Ledger</MenuItem>
                  <MenuItem value="due">Unpaid Overdue Book</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ===== TAB PANEL INDEX 0: MASTER MAIN DATA VIEWPORT ===== */}
      {activeTab === 0 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Invoice Identity', 'Date Timestamp', 'Target Party Details', 'Items Count', 'Gross Total', 'Net Remitted', 'Ledger Status', 'Action Handles'].map((head) => (
                    <TableCell key={head} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>{head}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSales.map((sale) => (
                  <TableRow key={sale.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">{sale.invoice_no}</Typography>
                      <Typography variant="caption" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>{sale.sale_type || 'retail'}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(sale.date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{sale.customer_name || 'Walk-in Cash Customer'}</Typography>
                    </TableCell>
                    <TableCell><Chip label={`${sale.total_items || 1} items`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.72rem' }} /></TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                    <TableCell sx={{ color: 'green', fontWeight: 500 }}>{formatCurrency(sale.paid_amount)}</TableCell>
                    <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                    <TableCell>
                      <IconButton size="small" color="primary" onClick={() => handleViewSale(sale)}><Visibility fontSize="small" /></IconButton>
                      {sale.payment_status !== 'paid' && (
                        <IconButton size="small" color="success" onClick={() => handleOpenPayment(sale)}><Payment fontSize="small" /></IconButton>
                      )}
                      <IconButton size="small" color="warning" onClick={() => { handleViewSale(sale); setTimeout(() => handleOpenReturn(sale), 150); }}><AssignmentReturn fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedSales.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No records matched active parameters layout.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Pagination count={Math.ceil(filteredSales.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
          </Box>
        </Paper>
      )}

      {/* ===== TAB PANEL INDEX 1: REVERSE TRADE RETURN JOURNAL ===== */}
      {activeTab === 1 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Return Row ID', 'Original Parent Invoice', 'Execution Timestamp', 'Reason Category Statement', 'Net Cash Reversed Refunded', 'Refund Channel Mode'].map((h) => (
                    <TableCell key={h} sx={{ bgcolor: '#f59e0b', color: 'white', fontWeight: 'bold', py: 1.2 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {returns.map((ret) => (
                  <TableRow key={ret.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>RET-{ret.id}</TableCell>
                    <TableCell sx={{ color: 'primary.main', fontWeight: 500 }}>{ret.invoice_no}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(ret.return_date)}</TableCell>
                    <TableCell><Chip size="small" label={ret.reason || 'General Return'} color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} /></TableCell>
                    <TableCell sx={{ color: 'red', fontWeight: 'bold' }}>{formatCurrency(ret.refund_amount)}</TableCell>
                    <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{ret.payment_mode || 'cash'}</TableCell>
                  </TableRow>
                ))}
                {returns.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No reverse logic returns captured in database system store.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ===== TAB PANEL INDEX 2: EXECUTIVE SHARE PROFILE ANALYSIS ===== */}
      {activeTab === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Volume Allocation Matrix By Channel Mode</Typography>
              <Divider sx={{ mb: 2 }} />
              {stats.byMode.length === 0 ? <Typography color="text.secondary" variant="body2">No entries logged to compile specific periodo matrix layout visualization graphics.</Typography> : stats.byMode.map((mode, i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" textTransform="uppercase" fontWeight={500}>{mode.payment_mode}</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(mode.total)}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={stats.period.amount > 0 ? (mode.total / stats.period.amount) * 100 : 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
                </Box>
              ))}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Top Contributing Customer Profiles Ledger Share</Typography>
              <Divider sx={{ mb: 2 }} />
              {stats.byCustomer.length === 0 ? <Typography color="text.secondary" variant="body2">Apply metrics configurations elements criteria to structure dataset rows links.</Typography> : stats.byCustomer.map((cust, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f3f4f6' }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{cust.customer_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{cust.total_bills} active issued bills profiles references</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(cust.total_sales)}</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ===== TAB PANEL INDEX 3: ADVANCED LIFECYCLE VENDOR TO CUSTOMER LIFECYCLE ===== */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Product Lifecycle Supply Chain Tracker Dashboard Node</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Provide accurate SKU nomenclature bounds keywords identifiers or barcodes tags pointers parameters indexes to evaluate absolute historical logs mappings profiles completely.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, maxWidth: 500 }}>
            <TextField fullWidth size="small" placeholder="Scan SKU / Input product barcodes references identity constraints tracking bounds..." value={trackQuery} onChange={(e) => setTrackQuery(e.target.value)} />
            <Button variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} onClick={handleTrackLifecycle}>Track Profile</Button>
          </Box>

          {trackResult && (
            <Card variant="outlined" sx={{ bgcolor: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>
                  {trackResult.product_name} — Variant Specific Profile Spec [{trackResult.variant_name}]
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Internal Inventory Bounds Meta</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>SKU Code Anchor:</strong> {trackResult.sku}</Typography>
                    <Typography variant="body2"><strong>Settle Base Cost Price Rate:</strong> {formatCurrency(trackResult.purchase_price)}</Typography>
                    <Typography variant="body2"><strong>Retail Value Pricing Matrix:</strong> {formatCurrency(trackResult.retail_price)}</Typography>
                    <Typography variant="body2"><strong>Running Physical Available Stocks Volume:</strong> {trackResult.current_stock} units left</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="green" display="block">Upstream Sourced Procurement Batches Node Logs</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Procure Batch Inflow Slips Reference Index:</strong> {trackResult.batch_purchase_invoice || 'No Batch Inflow'}</Typography>
                    <Typography variant="body2"><strong>Procure Log Sourced Date Stamp:</strong> {formatDate(trackResult.purchased_on)}</Typography>
                    <Typography variant="body2"><strong>Assigned Linked Vendor Supplier Enterprise Name:</strong> {trackResult.supplier_company || 'Direct Stock Seeded Pool'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="secondary" display="block">Downstream Consumer Outflow Dispatched Manifest Nodes</Typography>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="body2"><strong>Sale Points Invoices Reference Identity Token:</strong> {trackResult.final_sale_invoice || 'Unsold Unit Stack'}</Typography>
                    <Typography variant="body2"><strong>Outflow Date Dispatch Execution Timestamp:</strong> {formatDate(trackResult.sold_on)}</Typography>
                    <Typography variant="body2"><strong>Acquired Consumer End-user Party Name Assignment:</strong> {trackResult.sold_to_party || 'Cash Counters Pool'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Paper>
      )}

      {/* ===== VIEW SALE DIALOG PREVIEW MODAL ===== */}
      <Dialog open={viewSaleDialog} onClose={() => setViewSaleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e5e7eb', pb: 1.5 }}>
          Parent Line Audit Manifest Reference: {selectedSale?.invoice_no}
          <Chip size="small" label={String(selectedSale?.payment_status || 'unknown').toUpperCase()} color={selectedSale?.payment_status === 'paid' ? 'success' : 'warning'} sx={{ ml: 2, fontWeight: 'bold' }} />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Execution Timestamp</Typography><Typography variant="body2" fontWeight={500}>{formatDate(selectedSale.date)}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Entity Party Holder</Typography><Typography variant="body2" fontWeight="bold">{selectedSale.customer_name || 'Walk-in Sourced Settle'}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Assigned Safe Channel</Typography><Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.payment_mode}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Pricing Paradigm</Typography><Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.sale_type || 'Retail View'}</Typography></Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 0, borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>#Sr</TableCell>
                      <TableCell>Catalog Nomenclature Description</TableCell>
                      <TableCell align="right">Units Dispatched</TableCell>
                      <TableCell align="right">Rate per Value</TableCell>
                      <TableCell align="right">Item Discount Deduct</TableCell>
                      <TableCell align="right">Net Row Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saleItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{item.product_name || 'Dispatched stock variant stack'}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku || 'No SKU Index'}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{item.quantity || item.qty}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                        <TableCell align="right" sx={{ color: 'red' }}>-{formatCurrency(item.discount || 0)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2.5, p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Gross Subtotal</Typography><Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.subtotal)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Trade Discount</Typography><Typography variant="body2" color="red" fontWeight={600}>-{formatCurrency(selectedSale.discount)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Tax Matrix Applied</Typography><Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.tax)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="primary">Net Invoice Payable</Typography><Typography variant="body1" fontWeight="bold" color="primary">{formatCurrency(selectedSale.grand_total)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="green">Total Cash Paid</Typography><Typography variant="body1" fontWeight="bold" color="green">{formatCurrency(selectedSale.paid_amount)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="red">Remaining Balance Overdue</Typography><Typography variant="body1" fontWeight="bold" color="red">{formatCurrency(selectedSale.due_amount || (selectedSale.grand_total - selectedSale.paid_amount))}</Typography></Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setViewSaleDialog(false)} variant="outlined">Dismiss Manifest</Button>
          <Button variant="contained" sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }} startIcon={<AssignmentReturn />} onClick={() => { setViewSaleDialog(false); handleOpenReturn(selectedSale); }}>Open Return Desk</Button>
        </DialogActions>
      </Dialog>

      {/* ===== CREDIT BALANCE RECOVERY MODAL MODULE ===== */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Post Debt Balance Recovery Installment Statement Slip</DialogTitle>
        <DialogContent>
          {paymentSale && (
            <Stack spacing={2} sx={{ mt: 1.5 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Gross Invoice Limit Cap Bound</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(paymentSale.grand_total)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Aggregate Cash Collected Currently</Typography>
                  <Typography variant="body2" fontWeight="bold" color="green">{formatCurrency(paymentSale.paid_amount)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="error" fontWeight="bold">Remaining Outstand Receivable Ledger</Typography>
                  <Typography variant="body2" fontWeight="bold" color="red">{formatCurrency(Number(paymentSale.grand_total || 0) - Number(paymentSale.paid_amount || 0))}</Typography>
                </Box>
              </Box>
              <TextField fullWidth label="Recovered Settlement Split Installment Cash Input" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} autoFocus />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPaymentDialog(false)}>Cancel Collection</Button>
          <Button variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} onClick={handleUpdatePayment}> Post Settle Receipt Balance </Button>
        </DialogActions>
      </Dialog>

      {/* ===== GLOBAL DIALOG CONSOLE WINDOW FOR RETURNS ===== */}
      <Dialog open={returnDialog} onClose={() => setReturnDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5 }}>
          <AssignmentReturn sx={{ verticalAlign: 'middle', mr: 1 }} />
          Dynamic Reverse Trade Processing Window Reference — Invoice #{returningSale?.invoice_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {returningSale && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Account Holder Profile Index Node: <strong>{returningSale.customer_name || 'Walk-in Account'}</strong> | Settle Date Reference: {formatDate(returningSale.date)}
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, boxShadow: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#fffbeb' }}>
                      <TableCell>Select Row</TableCell>
                      <TableCell>Product Variant Descriptor</TableCell>
                      <TableCell align="right">Invoice Despatched Volume</TableCell>
                      <TableCell align="right">Return Quantity Target</TableCell>
                      <TableCell align="right">Refund Execution Price Value</TableCell>
                      <TableCell align="right">Net Aggregate Return Allocation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnItems.map((item, idx) => (
                      <TableRow key={idx} sx={{ bgcolor: item.selected ? '#fffbeb' : 'inherit' }}>
                        <TableCell>
                          <Checkbox checked={item.selected} onChange={(e) => setReturnItems(prev => {
                            const updated = [...prev];
                            updated[idx].selected = e.target.checked;
                            updated[idx].returnQty = e.target.checked ? (item.quantity || item.qty) : 0;
                            return updated;
                          })} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{item.product_name || 'Stock item reference'}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity || item.qty}</TableCell>
                        <TableCell align="right">
                          <TextField type="number" size="small" sx={{ width: 80 }} value={item.returnQty} onChange={(e) => handleReturnQtyChange(idx, e.target.value)} disabled={!item.selected} />
                        </TableCell>
                        <TableCell align="right">
                          <TextField type="number" size="small" sx={{ width: 100 }} value={item.returnPrice} onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].returnPrice = Number(e.target.value);
                            setReturnItems(updated);
                          }} disabled={!item.selected} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#f59e0b' }}>
                          {item.selected ? formatCurrency(item.returnQty * item.returnPrice) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Return Reason Category</InputLabel>
                    <Select value={returnForm.reason} onChange={(e) => setReturnForm(p => ({ ...p, reason: e.target.value }))} label="Return Reason Category">
                      {RETURN_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Settlement Channel</InputLabel>
                    <Select value={returnForm.refund_mode} onChange={(e) => setReturnForm(p => ({ ...p, refund_mode: e.target.value }))} label="Refund Settlement Channel">
                      {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Audit Internal Note Remarks" value={returnForm.notes} onChange={(e) => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#fffbeb', borderRadius: 1, border: '1px solid #fef3c7', textAlign: 'right' }}>
                <Typography variant="h6" color="#b45309" fontWeight="bold">
                  Net Contra Cash Back Return Valuation Sum: {formatCurrency(returnItems.filter(i => i.selected).reduce((s, i) => s + (i.returnQty * i.returnPrice), 0))}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setReturnDialog(false)}>Abort Reverse Entry</Button>
          <Button variant="contained" sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }} onClick={handleProcessReturn}>
            Commit Return To Ledger & Reverse Inventory Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== GLOBAL SNACKBAR NOTIFICATIONS ENGINE ===== */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(p => ({ ...p, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}