import {
  AssignmentReturn,
  FilterList,
  History,
  Payment,
  Refresh,
  Search,
  TrendingUp,
  Visibility,
  Menu as MenuIcon,
  Close,
  ArrowUpward,
  ArrowDownward,
  Receipt,
  CheckCircle,
  Cancel,
  Warning,
  ShoppingCart
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
  Typography,
  useMediaQuery,
  useTheme,
  Drawer,
  Collapse,
  Fab,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Fade,
  Zoom
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

// ==================== MOBILE SALE CARD ====================
const MobileSaleCard = ({ sale, onView, onPayment, onReturn }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: sale.payment_status === 'paid' ? '4px solid #10b981' : sale.payment_status === 'partial' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {sale.invoice_no}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {sale.customer_name || 'Walk-in Customer'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
              {formatCurrency(sale.grand_total)}
            </Typography>
            <Chip 
              size="small" 
              color={sale.payment_status === 'paid' ? 'success' : sale.payment_status === 'partial' ? 'warning' : 'error'} 
              label={String(sale.payment_status || 'unknown').toUpperCase()}
              sx={{ height: 16, fontSize: '0.5rem' }}
            />
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2">{formatDate(sale.date)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Items</Typography>
              <Typography variant="body2">{sale.total_items || 1}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Paid</Typography>
              <Typography variant="body2" color="success.main">{formatCurrency(sale.paid_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Due</Typography>
              <Typography variant="body2" color="error.main">{formatCurrency(sale.due_amount || (sale.grand_total - sale.paid_amount))}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Type</Typography>
              <Typography variant="body2">{sale.sale_type || 'retail'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<Visibility />} 
            onClick={() => onView(sale)}
            sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}
          >
            View
          </Button>
          {sale.payment_status !== 'paid' && (
            <Button 
              size="small" 
              variant="contained" 
              startIcon={<Payment />} 
              onClick={() => onPayment(sale)}
              sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, bgcolor: '#10b981' }}
            >
              Pay
            </Button>
          )}
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<AssignmentReturn />} 
            onClick={() => onReturn(sale)}
            sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, bgcolor: '#f59e0b' }}
          >
            Return
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE RETURN CARD ====================
const MobileReturnCard = ({ ret }) => {
  return (
    <Card sx={{ mb: 1.5, borderLeft: '4px solid #f59e0b' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              RET-{ret.id}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {ret.invoice_no || 'N/A'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="error.main">
              {formatCurrency(ret.refund_amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ret.payment_mode || 'cash'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {formatDate(ret.return_date)}
          </Typography>
          <Chip size="small" label={ret.reason || 'General'} color="warning" variant="outlined" sx={{ height: 16, fontSize: '0.5rem' }} />
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function SalesHistoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

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
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

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
      const salesQuery = `
        SELECT s.*, 
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as total_items
        FROM sales s 
        WHERE s.is_deleted = 0
        ORDER BY s.id DESC
      `;
      const rawSales = await db.electronQuery(salesQuery);

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

  // ==================== DEBT BALANCE RECOVERY ====================
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
          description: `Manual balance recovery for invoice #${paymentSale.invoice_no}`,
          payment_mode: 'cash'
        });
      }

      setSnackbar({ open: true, message: 'Payment posted successfully!', severity: 'success' });
      setPaymentDialog(false);
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Payment failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== REVERSE RETURNS ====================
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
      setSnackbar({ open: true, message: 'Select items to return!', severity: 'warning' });
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

      setSnackbar({ open: true, message: 'Return processed successfully!', severity: 'success' });
      setReturnDialog(false);
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Return failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== TRACK LIFECYCLE ====================
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
      setSnackbar({ open: true, message: 'Track failed: ' + err.message, severity: 'error' });
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

  // ==================== UI HELPER METHODS ====================
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
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* ===== HEADER ===== */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <History sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Sales History' : 'Audit Control Desk: Sales & Returns'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            {isMobile ? 'Filters' : 'Filters Engine'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData}>
            {isMobile ? 'Sync' : 'Sync Tables'}
          </Button>
        </Stack>
      </Box>

      {/* ===== STATS CARDS ===== */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: "Today's Sales", value: stats.today.amount, label: `${stats.today.count} bills`, color: 'success' },
          { title: 'Period Total', value: stats.period.amount, label: `${stats.period.count} bills`, color: 'primary' },
          { title: 'Cash Recovered', value: stats.period.paid, label: 'Ledger In', color: 'info' },
          { title: 'Open Due', value: stats.period.due, label: 'Receivable', color: 'error' },
          { title: 'Discounts', value: stats.period.discount, label: 'Deductions', color: 'warning' },
          { title: 'Returns', value: returns.length, label: 'Reverse Slips', color: 'secondary' },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: `5px solid`, borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: isMobile ? 1 : 1.5, '&:last-child': { pb: isMobile ? 1 : 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500} sx={{ fontSize: isMobile ? '0.55rem' : '0.75rem' }}>
                  {stat.title}
                </Typography>
                <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color={`${stat.color}.dark`}>
                  {idx === 5 ? stat.value : formatCurrency(stat.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.5rem' : '0.75rem' }}>{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ===== TABS ===== */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<History fontSize="small" />} 
            label={isMobile ? 'Sales' : 'Sales Logs'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<AssignmentReturn fontSize="small" />} 
            label={isMobile ? `Returns (${returns.length})` : `Returns (${returns.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<TrendingUp fontSize="small" />} 
            label={isMobile ? 'Analytics' : 'Breakdown'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Search fontSize="small" />} 
            label={isMobile ? 'Track' : 'Lifecycle Tracker'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* ===== FILTERS ===== */}
      {showFilters && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={6} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" placeholder="Search invoice..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer</InputLabel>
                <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} label="Customer">
                  <MenuItem value="">All</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} label="Status">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="due">Due</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ===== TAB 0: SALES ===== */}
      {activeTab === 0 && (
        <Fade in>
          {isMobile ? (
            // Mobile Cards
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LinearProgress />
                  <Typography sx={{ mt: 2 }}>Loading...</Typography>
                </Box>
              ) : paginatedSales.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <ShoppingCart sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No sales found</Typography>
                </Paper>
              ) : (
                paginatedSales.map((sale) => (
                  <MobileSaleCard 
                    key={sale.id} 
                    sale={sale} 
                    onView={handleViewSale}
                    onPayment={handleOpenPayment}
                    onReturn={() => { handleViewSale(sale); setTimeout(() => handleOpenReturn(sale), 300); }}
                  />
                ))
              )}
              {filteredSales.length > rowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination 
                    count={Math.ceil(filteredSales.length / rowsPerPage)} 
                    page={page} 
                    onChange={(e, p) => setPage(p)} 
                    color="primary" 
                    size="small"
                  />
                </Box>
              )}
            </Box>
          ) : (
            // Desktop Table
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Status', 'Actions'].map((head) => (
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
                        <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                        <TableCell><Chip label={`${sale.total_items || 1} items`} size="small" variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                        <TableCell sx={{ color: 'success.main' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                        <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary" onClick={() => handleViewSale(sale)}><Visibility fontSize="small" /></IconButton>
                          {sale.payment_status !== 'paid' && (
                            <IconButton size="small" color="success" onClick={() => handleOpenPayment(sale)}><Payment fontSize="small" /></IconButton>
                          )}
                          <IconButton size="small" color="warning" onClick={() => { handleViewSale(sale); setTimeout(() => handleOpenReturn(sale), 300); }}><AssignmentReturn fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedSales.length === 0 && (
                      <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No records found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
                <Pagination count={Math.ceil(filteredSales.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
              </Box>
            </Paper>
          )}
        </Fade>
      )}

      {/* ===== TAB 1: RETURNS ===== */}
      {activeTab === 1 && (
        <Fade in>
          {isMobile ? (
            // Mobile Returns Cards
            <Box>
              {returns.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <AssignmentReturn sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No returns found</Typography>
                </Paper>
              ) : (
                returns.map((ret) => (
                  <MobileReturnCard key={ret.id} ret={ret} />
                ))
              )}
            </Box>
          ) : (
            // Desktop Table
            <Paper>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Return ID', 'Invoice', 'Date', 'Reason', 'Refund', 'Mode'].map((h) => (
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
                        <TableCell><Chip size="small" label={ret.reason || 'General'} color="warning" variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>{formatCurrency(ret.refund_amount)}</TableCell>
                        <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{ret.payment_mode || 'cash'}</TableCell>
                      </TableRow>
                    ))}
                    {returns.length === 0 && (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No returns found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Fade>
      )}

      {/* ===== TAB 2: ANALYTICS ===== */}
      {activeTab === 2 && (
        <Fade in>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>By Payment Mode</Typography>
                <Divider sx={{ mb: 2 }} />
                {stats.byMode.length === 0 ? (
                  <Typography color="text.secondary" variant="body2" align="center">No data</Typography>
                ) : stats.byMode.map((mode, i) => (
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
              <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Top Customers</Typography>
                <Divider sx={{ mb: 2 }} />
                {stats.byCustomer.length === 0 ? (
                  <Typography color="text.secondary" variant="body2" align="center">No data</Typography>
                ) : stats.byCustomer.map((cust, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f3f4f6' }}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{cust.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{cust.total_bills} bills</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(cust.total_sales)}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </Fade>
      )}

      {/* ===== TAB 3: TRACKER ===== */}
      {activeTab === 3 && (
        <Fade in>
          <Paper sx={{ p: isMobile ? 1.5 : 3, border: '1px solid #e5e7eb' }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" gutterBottom>
              <Search sx={{ verticalAlign: 'middle', mr: 1, color: '#10b981' }} />
              Product Lifecycle Tracker
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Enter SKU or Barcode to track product history
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 3 }}>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="Enter SKU / Barcode..." 
                value={trackQuery} 
                onChange={(e) => setTrackQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTrackLifecycle(); }}
              />
              <Button 
                variant="contained" 
                sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, minWidth: isMobile ? '100%' : 'auto' }} 
                onClick={handleTrackLifecycle}
              >
                Track
              </Button>
            </Box>

            {trackResult && (
              <Card variant="outlined" sx={{ bgcolor: '#f9fafb' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>
                    {trackResult.product_name} — {trackResult.variant_name}
                  </Typography>
                  <Grid container spacing={isMobile ? 2 : 3}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">Inventory</Typography>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2"><strong>SKU:</strong> {trackResult.sku}</Typography>
                      <Typography variant="body2"><strong>Cost:</strong> {formatCurrency(trackResult.purchase_price)}</Typography>
                      <Typography variant="body2"><strong>Retail:</strong> {formatCurrency(trackResult.retail_price)}</Typography>
                      <Typography variant="body2"><strong>Stock:</strong> {trackResult.current_stock} units</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="success.main" fontWeight="bold">Supplier Source</Typography>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2"><strong>Invoice:</strong> {trackResult.batch_purchase_invoice || '-'}</Typography>
                      <Typography variant="body2"><strong>Purchased:</strong> {formatDate(trackResult.purchased_on)}</Typography>
                      <Typography variant="body2"><strong>Supplier:</strong> {trackResult.supplier_company || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="secondary" fontWeight="bold">Sales History</Typography>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2"><strong>Invoice:</strong> {trackResult.final_sale_invoice || 'Unsold'}</Typography>
                      <Typography variant="body2"><strong>Sold:</strong> {formatDate(trackResult.sold_on)}</Typography>
                      <Typography variant="body2"><strong>Customer:</strong> {trackResult.sold_to_party || '-'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Paper>
        </Fade>
      )}

      {/* ===== VIEW SALE DIALOG ===== */}
      <Dialog open={viewSaleDialog} onClose={() => setViewSaleDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          Invoice: {selectedSale?.invoice_no}
          <Chip size="small" label={String(selectedSale?.payment_status || 'unknown').toUpperCase()} color={selectedSale?.payment_status === 'paid' ? 'success' : 'warning'} sx={{ ml: 2, fontWeight: 'bold' }} />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body2" fontWeight={500}>{formatDate(selectedSale.date)}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Customer</Typography><Typography variant="body2" fontWeight="bold">{selectedSale.customer_name || 'Walk-in'}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Payment Mode</Typography><Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.payment_mode}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Type</Typography><Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.sale_type || 'Retail'}</Typography></Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>#</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Discount</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saleItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{item.product_name || 'Item'}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography>
                        </TableCell>
                        <TableCell align="right" fontWeight={600}>{item.quantity || item.qty}</TableCell>
                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                        <TableCell align="right" color="error.main">-{formatCurrency(item.discount || 0)}</TableCell>
                        <TableCell align="right" fontWeight="bold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={isMobile ? 1 : 2} sx={{ textAlign: 'center' }}>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Subtotal</Typography><Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.subtotal)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Discount</Typography><Typography variant="body2" color="error.main" fontWeight={600}>-{formatCurrency(selectedSale.discount)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="text.secondary">Tax</Typography><Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.tax)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="primary">Grand Total</Typography><Typography variant="body1" fontWeight="bold" color="primary">{formatCurrency(selectedSale.grand_total)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="success.main">Paid</Typography><Typography variant="body1" fontWeight="bold" color="success.main">{formatCurrency(selectedSale.paid_amount)}</Typography></Grid>
                  <Grid item xs={4} md={2}><Typography variant="caption" color="error.main">Due</Typography><Typography variant="body1" fontWeight="bold" color="error.main">{formatCurrency(selectedSale.due_amount || (selectedSale.grand_total - selectedSale.paid_amount))}</Typography></Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setViewSaleDialog(false)}>Close</Button>
          <Button fullWidth={isMobile} variant="contained" sx={{ bgcolor: '#f59e0b' }} startIcon={<AssignmentReturn />} onClick={() => { setViewSaleDialog(false); handleOpenReturn(selectedSale); }}>Open Return</Button>
        </DialogActions>
      </Dialog>

      {/* ===== PAYMENT DIALOG ===== */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Post Payment</DialogTitle>
        <DialogContent>
          {paymentSale && (
            <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1.5 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Invoice Total</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(paymentSale.grand_total)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Paid So Far</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(paymentSale.paid_amount)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="error.main" fontWeight="bold">Remaining Due</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(Number(paymentSale.grand_total || 0) - Number(paymentSale.paid_amount || 0))}</Typography>
                </Box>
              </Box>
              <TextField fullWidth label="Payment Amount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} autoFocus />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" sx={{ bgcolor: '#10b981' }} onClick={handleUpdatePayment}>Post Payment</Button>
        </DialogActions>
      </Dialog>

      {/* ===== RETURN DIALOG ===== */}
      <Dialog open={returnDialog} onClose={() => setReturnDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5 }}>
          <AssignmentReturn sx={{ verticalAlign: 'middle', mr: 1 }} />
          Process Return — Invoice #{returningSale?.invoice_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {returningSale && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Customer: <strong>{returningSale.customer_name || 'Walk-in'}</strong> | Date: {formatDate(returningSale.date)}
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#fffbeb' }}>
                      <TableCell padding="checkbox">Select</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Return</TableCell>
                      <TableCell align="right">Refund Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnItems.map((item, idx) => (
                      <TableRow key={idx} sx={{ bgcolor: item.selected ? '#fffbeb' : 'inherit' }}>
                        <TableCell padding="checkbox">
                          <Checkbox checked={item.selected} onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].selected = e.target.checked;
                            updated[idx].returnQty = e.target.checked ? (item.quantity || item.qty) : 0;
                            setReturnItems(updated);
                          }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{item.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity || item.qty}</TableCell>
                        <TableCell align="right">
                          <TextField type="number" size="small" sx={{ width: isMobile ? 60 : 80 }} value={item.returnQty} onChange={(e) => handleReturnQtyChange(idx, e.target.value)} disabled={!item.selected} />
                        </TableCell>
                        <TableCell align="right">
                          <TextField type="number" size="small" sx={{ width: isMobile ? 70 : 100 }} value={item.returnPrice} onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].returnPrice = Number(e.target.value);
                            setReturnItems(updated);
                          }} disabled={!item.selected} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#f59e0b' }}>
                          {item.selected ? formatCurrency((item.returnQty || 0) * (item.returnPrice || 0)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Grid container spacing={isMobile ? 1 : 2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Return Reason</InputLabel>
                    <Select value={returnForm.reason} onChange={(e) => setReturnForm(p => ({ ...p, reason: e.target.value }))} label="Return Reason">
                      {RETURN_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Mode</InputLabel>
                    <Select value={returnForm.refund_mode} onChange={(e) => setReturnForm(p => ({ ...p, refund_mode: e.target.value }))} label="Refund Mode">
                      {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Notes" value={returnForm.notes} onChange={(e) => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#fffbeb', borderRadius: 1, border: '1px solid #fef3c7', textAlign: 'right' }}>
                <Typography variant="h6" color="#b45309" fontWeight="bold">
                  Total Refund: {formatCurrency(returnItems.filter(i => i.selected).reduce((s, i) => s + ((i.returnQty || 0) * (i.returnPrice || 0)), 0))}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setReturnDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" sx={{ bgcolor: '#f59e0b' }} onClick={handleProcessReturn}>Process Return</Button>
        </DialogActions>
      </Dialog>

      {/* ===== MOBILE DRAWER ===== */}
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

      {/* ===== SNACKBAR ===== */}
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