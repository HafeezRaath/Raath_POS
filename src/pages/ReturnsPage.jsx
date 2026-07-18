import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Tooltip, Pagination, Snackbar, Alert, Avatar, LinearProgress,
  InputAdornment, Checkbox, Divider, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Badge, List, ListItem, ListItemText,
  ListItemIcon, Fade, Zoom
} from '@mui/material';
import {
  Search, FilterList, Visibility, Print, Refresh, Today, DateRange,
  TrendingUp, KeyboardReturn, AssignmentReturn, Phone, History,
  Menu as MenuIcon, Close, ArrowUpward, ArrowDownward, Receipt,
  CheckCircle, Cancel, Warning, Error, ShoppingCart
} from '@mui/icons-material';
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
const MobileSaleCard = ({ sale, onProcessReturn }) => {
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
              <Typography variant="body2">{sale.total_items || 1} units</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Paid</Typography>
              <Typography variant="body2" color="success.main">{formatCurrency(sale.paid_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Due</Typography>
              <Typography variant="body2" color="error.main">{formatCurrency(sale.due_amount)}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Type</Typography>
              <Typography variant="body2">{sale.sale_type || 'retail'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<KeyboardReturn />} 
            onClick={() => onProcessReturn(sale)}
            sx={{ flex: 1, bgcolor: '#f59e0b' }}
          >
            Process Return
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
const MobileReturnCard = ({ ret, onView }) => {
  return (
    <Card sx={{ mb: 1.5, borderLeft: '4px solid #f59e0b' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              RET-{ret.id}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {ret.customer_name || 'Walk-in Customer'}
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
            Invoice: {ret.invoice_no || ret.original_invoice}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(ret.return_date)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<Visibility />} 
            onClick={() => onView(ret)}
            sx={{ flex: 1 }}
          >
            View
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function ReturnsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  // Filters
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(getStartOfMonth());
  const [filterDateTo, setFilterDateTo] = useState(getToday());
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

  // Process Return Dialog
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [returnForm, setReturnForm] = useState({ reason: '', refund_mode: 'cash', notes: '' });
  const [processingReturn, setProcessingReturn] = useState(false);

  // View Return Dialog
  const [viewReturnDialog, setViewReturnDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnItemsView, setReturnItemsView] = useState([]);

  // Stats Counters
  const [stats, setStats] = useState({
    todayReturns: 0,
    todayRefund: 0,
    periodReturns: 0,
    periodRefund: 0,
    byMode: []
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ==================== LOAD DATA ====================
  const loadData = async () => {
    setLoading(true);
    try {
      // Get sales with items count
      const allSales = await db.getSalesHistory().catch(() => []);
      const salesWithCount = await Promise.all(allSales.map(async (s) => {
        const items = await db.getSaleItems(s.id).catch(() => []);
        return { ...s, total_items: items.length };
      }));

      // Filter sales by date and customer
      const filteredSales = salesWithCount.filter(sale => {
        if (sale.is_deleted) return false;
        const checkDate = String(sale.date || '').substring(0, 10);
        if (filterDateFrom && checkDate < filterDateFrom) return false;
        if (filterDateTo && checkDate > filterDateTo) return false;
        if (filterCustomer && Number(sale.customer_id) !== Number(filterCustomer)) return false;
        return true;
      });

      // Get returns
      const allReturns = await db.getSaleReturns().catch(() => []);

      // Get customers
      const customersList = await db.getCustomers().catch(() => []);

      setSales(filteredSales);
      setReturns(allReturns);
      setCustomers(customersList || []);

      // Calculate stats
      const todayStr = getToday();
      const todayReturns = allReturns.filter(r => String(r.return_date || '').substring(0, 10) === todayStr);
      const todayRefundSum = todayReturns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
      const periodRefundSum = allReturns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

      // Group by mode
      const modeMap = {};
      allReturns.forEach(r => {
        const mode = r.payment_mode || r.refund_mode || 'cash';
        modeMap[mode] = (modeMap[mode] || 0) + Number(r.refund_amount || 0);
      });
      const byModeArray = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));

      setStats({
        todayReturns: todayReturns.length,
        todayRefund: todayRefundSum,
        periodReturns: allReturns.length,
        periodRefund: periodRefundSum,
        byMode: byModeArray
      });

    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDateFrom, filterDateTo, filterCustomer]);

  // ==================== OPEN PROCESS RETURN ====================
  const handleOpenProcess = async (sale) => {
    setSelectedSale(sale);
    try {
      const items = await db.getSaleItems(sale.id).catch(() => []);
      const validItems = Array.isArray(items) ? items : [];
      
      setSaleItems(validItems);
      setReturnItems(validItems.map(item => ({
        ...item,
        selected: false,
        returnQty: 0,
        returnPrice: item.price || 0,
        condition: 'good'
      })));
      setReturnForm({ reason: '', refund_mode: 'cash', notes: '' });
      setProcessDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error loading sale items: ' + err.message, severity: 'error' });
    }
  };

  // ==================== HANDLE RETURN LOGIC ====================
  const handleReturnQtyChange = (index, qty) => {
    const updated = [...returnItems];
    const maxQty = Number(updated[index].quantity || updated[index].qty || 0);
    const val = Math.min(Number(qty) || 0, maxQty);
    updated[index].returnQty = val;
    updated[index].selected = val > 0;
    setReturnItems(updated);
  };

  const handleToggleSelectAll = (checked) => {
    setReturnItems(prev => prev.map(i => ({
      ...i,
      selected: checked,
      returnQty: checked ? (i.quantity || i.qty) : 0
    })));
  };

  const totalRefund = useMemo(() => {
    return returnItems
      .filter(i => i.selected)
      .reduce((sum, i) => sum + (i.returnQty * i.returnPrice), 0);
  }, [returnItems]);

  // ==================== PROCESS RETURN - FIXED ====================
  const handleProcessReturn = async () => {
    const selectedItems = returnItems.filter(item => item.selected && item.returnQty > 0);
    if (selectedItems.length === 0) {
      setSnackbar({ open: true, message: 'Please select items to return!', severity: 'warning' });
      return;
    }
    if (!returnForm.reason) {
      setSnackbar({ open: true, message: 'Please select a return reason!', severity: 'warning' });
      return;
    }

    setProcessingReturn(true);
    try {
      const generatedReturnNo = `RET-${Date.now().toString().slice(-5)}`;
      
      // 1. Create return record
      const returnData = {
        sale_id: selectedSale.id,
        invoice_no: selectedSale.invoice_no,
        return_no: generatedReturnNo,
        customer_id: selectedSale.customer_id || null,
        return_date: new Date().toISOString().split('T')[0],
        total_amount: totalRefund,
        discount_amount: 0,
        tax_amount: 0,
        refund_amount: totalRefund,
        payment_mode: returnForm.refund_mode,
        notes: returnForm.notes
      };

      // Use db.createSaleReturn (works in both Electron and Browser)
      const result = await db.createSaleReturn(returnData);
      const parentReturnId = result.lastInsertRowid || result.id;

      // 2. Add return items and update stock
      for (const item of selectedItems) {
        const itemData = {
          sale_return_id: parentReturnId,
          product_variant_id: item.product_variant_id,
          quantity: item.returnQty,
          price: item.returnPrice,
          sub_total: item.returnQty * item.returnPrice,
          reason: returnForm.reason
        };
        await db.createSaleReturnItem(itemData);

        // ✅ FIXED: Update stock - add back the returned quantity
        await db.updateVariantStock(item.product_variant_id, item.returnQty);
      }

      // 3. Update customer balance if needed
      if (selectedSale.customer_id && selectedSale.payment_status !== 'paid') {
        const customer = await db.getCustomerById(selectedSale.customer_id);
        if (customer) {
          const currentBalance = Number(customer.current_balance || 0);
          const newBalance = Math.max(0, currentBalance - totalRefund);
          await db.updateCustomer(selectedSale.customer_id, { 
            ...customer, 
            current_balance: newBalance 
          });
        }
      }

      // 4. Log to general ledger
      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger('return', parentReturnId, 0, totalRefund, `Return for invoice ${selectedSale.invoice_no}`);
      }

      setSnackbar({ open: true, message: 'Return processed successfully! Stock updated.', severity: 'success' });
      setProcessDialog(false);
      loadData();
    } catch (err) {
      console.error('Return error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setProcessingReturn(false);
    }
  };

  // ==================== VIEW RETURN ====================
  const handleViewReturn = async (ret) => {
    setSelectedReturn(ret);
    try {
      const items = await db.getSaleReturnItems(ret.id).catch(() => []);
      setReturnItemsView(items);
      setViewReturnDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error loading return items: ' + err.message, severity: 'error' });
    }
  };

  // ==================== PRINT RETURN ====================
  const handlePrintReturn = (ret) => {
    const printWindow = window.open('', '_blank');
    const itemsHtml = returnItemsView.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.product_name} [${item.variant_name || 'Default'}]</td>
        <td>${item.quantity || item.returned_quantity}</td>
        <td>${formatCurrency(item.price || item.refund_price)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head><title>Return Slip #${ret.id}</title></head>
        <body style="font-family: monospace; padding: 15px; width: 58mm; font-size: 11px;">
          <h3 style="text-align: center; margin: 0;">RETURN RECEIPT</h3>
          <hr style="border-top: 1px dashed #000;">
          <p>Slip RET-${ret.id}<br>Original Invoice: ${ret.invoice_no || ret.original_invoice}<br>Date: ${formatDate(ret.return_date)}</p>
          <hr style="border-top: 1px dashed #000;">
          <table width="100%" style="font-size: 11px; text-align: left;">
            <thead><tr><th>Item</th><th>Qty</th><th>Refund</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <hr style="border-top: 1px dashed #000;">
          <h4 style="text-align: right; margin: 5px 0;">Total Refunded: ${formatCurrency(ret.refund_amount)}</h4>
          <p style="text-align: center; font-size: 9px; margin-top: 15px;">Powered by Raath Developers</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // ==================== FILTERS ====================
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (!searchInvoice.trim()) return true;
      return (sale.invoice_no || '').toLowerCase().includes(searchInvoice.toLowerCase().trim());
    });
  }, [sales, searchInvoice]);

  const paginatedSales = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, page, rowsPerPage]);

  const getPaymentStatusChip = (status) => {
    const colors = { paid: 'success', partial: 'warning', due: 'error' };
    return <Chip size="small" color={colors[status] || 'default'} label={String(status || 'unknown').toUpperCase()} sx={{ fontWeight: 'bold' }} />;
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <KeyboardReturn sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Returns' : 'Returns & Refunds Controller'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            {isMobile ? 'Filters' : 'Toggle Filters'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData}>
            {isMobile ? 'Sync' : 'Sync Tables'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#fef3c7', borderLeft: '5px solid', borderLeftColor: '#f59e0b' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Today's Returns</Typography>
              <Typography variant="h6" fontWeight="bold" color="#92400e">{stats.todayReturns}</Typography>
              <Typography variant="caption" color="text.secondary">{formatCurrency(stats.todayRefund)} refunded</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#fecaca', borderLeft: '5px solid', borderLeftColor: '#ef4444' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Period Returns</Typography>
              <Typography variant="h6" fontWeight="bold" color="#991b1b">{stats.periodReturns}</Typography>
              <Typography variant="caption" color="text.secondary">{formatCurrency(stats.periodRefund)} total refunded</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#dbeafe', borderLeft: '5px solid', borderLeftColor: '#3b82f6' }}>
            <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Net Impact</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1e40af">{formatCurrency(stats.periodRefund)}</Typography>
              <Typography variant="caption" color="text.secondary">Total reversals</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* TABS */}
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
            label={isMobile ? 'Sales' : 'Sales (Trigger Returns)'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<AssignmentReturn fontSize="small" />} 
            label={isMobile ? `Returns (${returns.length})` : `Returns History (${returns.length})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<TrendingUp fontSize="small" />} 
            label={isMobile ? 'Analytics' : 'Refund Analytics'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* FILTERS */}
      {showFilters && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="date" label="From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="date" label="To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" placeholder="Search invoice..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer</InputLabel>
                <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} label="Customer">
                  <MenuItem value="">All Customers</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ==================== TAB 0: SALES ==================== */}
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
                    onProcessReturn={handleOpenProcess} 
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
                      {['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Status', 'Action'].map((h) => (
                        <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>{h}</TableCell>
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
                        <TableCell><Chip size="small" label={`${sale.total_items || 1} items`} variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                        <TableCell sx={{ color: 'success.main' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                        <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                        <TableCell>
                          <Button variant="contained" size="small" sx={{ bgcolor: '#f59e0b', textTransform: 'none', height: 26, fontSize: '0.75rem' }} startIcon={<KeyboardReturn />} onClick={() => handleOpenProcess(sale)}>
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

      {/* ==================== TAB 1: RETURNS ==================== */}
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
                  <MobileReturnCard 
                    key={ret.id} 
                    ret={ret} 
                    onView={handleViewReturn} 
                  />
                ))
              )}
            </Box>
          ) : (
            // Desktop Table
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Return ID', 'Original Invoice', 'Date', 'Customer', 'Reason', 'Refund', 'Mode', 'Action'].map((h) => (
                        <TableCell key={h} sx={{ bgcolor: '#f59e0b', color: 'white', fontWeight: 'bold', py: 1.2 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returns.map((ret) => (
                      <TableRow key={ret.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>RET-{ret.id}</TableCell>
                        <TableCell color="primary" sx={{ fontWeight: 500 }}>{ret.invoice_no || ret.original_invoice}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(ret.return_date)}</TableCell>
                        <TableCell>{ret.customer_name || 'Walk-in'}</TableCell>
                        <TableCell><Chip size="small" label={ret.reason || 'General'} color="warning" variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>{formatCurrency(ret.refund_amount)}</TableCell>
                        <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{ret.payment_mode || 'cash'}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="info" onClick={() => handleViewReturn(ret)}><Visibility fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Fade>
      )}

      {/* ==================== TAB 2: ANALYTICS ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>By Payment Mode</Typography>
                <Divider sx={{ mb: 2 }} />
                {stats.byMode.length === 0 ? (
                  <Typography color="text.secondary" align="center">No data</Typography>
                ) : (
                  stats.byMode.map((mode, i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" textTransform="uppercase">{mode.mode}</Typography>
                        <Typography variant="body2" fontWeight="bold">{formatCurrency(mode.amount)}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={stats.periodRefund > 0 ? (mode.amount / stats.periodRefund) * 100 : 0} 
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }} 
                      />
                    </Box>
                  ))
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Return Reasons</Typography>
                <Divider sx={{ mb: 2 }} />
                {(() => {
                  const map = {};
                  returns.forEach(r => { 
                    const reason = r.reason || 'Other';
                    map[reason] = (map[reason] || 0) + 1; 
                  });
                  const entries = Object.entries(map);
                  return entries.length === 0 ? (
                    <Typography color="text.secondary" align="center">No data</Typography>
                  ) : (
                    entries.map(([reason, count]) => (
                      <Box key={reason} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f3f4f6' }}>
                        <Typography variant="body2">{reason}</Typography>
                        <Chip size="small" label={`${count} incidents`} color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                      </Box>
                    ))
                  );
                })()}
              </Paper>
            </Grid>
          </Grid>
        </Fade>
      )}

      {/* ==================== PROCESS RETURN DIALOG ==================== */}
      <Dialog open={processDialog} onClose={() => !processingReturn && setProcessDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5 }}>
          <KeyboardReturn sx={{ verticalAlign: 'middle', mr: 1 }} /> 
          Process Return — Invoice #{selectedSale?.invoice_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Box>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#fffbeb' }}>
                      <TableCell padding="checkbox">
                        <Checkbox 
                          checked={returnItems.length > 0 && returnItems.every(i => i.selected)} 
                          indeterminate={returnItems.some(i => i.selected) && !returnItems.every(i => i.selected)} 
                          onChange={(e) => handleToggleSelectAll(e.target.checked)} 
                        />
                      </TableCell>
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
                          <Checkbox 
                            checked={item.selected} 
                            onChange={(e) => {
                              const updated = [...returnItems];
                              updated[idx].selected = e.target.checked;
                              updated[idx].returnQty = e.target.checked ? (item.quantity || item.qty) : 0;
                              setReturnItems(updated);
                            }} 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{item.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity || item.qty}</TableCell>
                        <TableCell align="right">
                          <TextField 
                            type="number" 
                            size="small" 
                            sx={{ width: isMobile ? 60 : 80 }} 
                            value={item.returnQty} 
                            onChange={(e) => handleReturnQtyChange(idx, e.target.value)} 
                            disabled={!item.selected} 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField 
                            type="number" 
                            size="small" 
                            sx={{ width: isMobile ? 70 : 100 }} 
                            value={item.returnPrice} 
                            onChange={(e) => {
                              const updated = [...returnItems];
                              updated[idx].returnPrice = Number(e.target.value) || 0;
                              setReturnItems(updated);
                            }} 
                            disabled={!item.selected} 
                          />
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
                    <InputLabel>Return Reason *</InputLabel>
                    <Select 
                      value={returnForm.reason} 
                      onChange={(e) => setReturnForm(p => ({ ...p, reason: e.target.value }))} 
                      label="Return Reason *"
                    >
                      {RETURN_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Mode</InputLabel>
                    <Select 
                      value={returnForm.refund_mode} 
                      onChange={(e) => setReturnForm(p => ({ ...p, refund_mode: e.target.value }))} 
                      label="Refund Mode"
                    >
                      {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Notes" value={returnForm.notes} onChange={(e) => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#fffbeb', borderRadius: 1, border: '1px solid #fecaca', textAlign: 'right' }}>
                <Typography variant="h6" color="#b45309" fontWeight="bold">
                  Total Refund: {formatCurrency(totalRefund)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setProcessDialog(false)} disabled={processingReturn}>Cancel</Button>
          <Button 
            fullWidth={isMobile} 
            variant="contained" 
            sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }} 
            onClick={handleProcessReturn} 
            disabled={processingReturn || totalRefund <= 0}
          >
            {processingReturn ? 'Processing...' : 'Process Return'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== VIEW RETURN DIALOG ==================== */}
      <Dialog open={viewReturnDialog} onClose={() => setViewReturnDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          Return Details — RET-{selectedReturn?.id}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedReturn && (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Original Invoice</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedReturn.invoice_no || selectedReturn.original_invoice}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2">{formatDate(selectedReturn.return_date)}</Typography>
                </Box>
              </Box>
              <Divider />
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Refund</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnItemsView.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Typography variant="body2">{item.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography>
                        </TableCell>
                        <TableCell align="right" fontWeight={600}>{item.quantity || item.returned_quantity}</TableCell>
                        <TableCell align="right" color="error.main" fontWeight="bold">{formatCurrency(item.price || item.refund_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ textAlign: 'right', p: 1.5, bgcolor: '#fffbeb', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="#b45309">
                  Total Refund: {formatCurrency(selectedReturn.refund_amount)}
                </Typography>
                <Typography variant="caption">Mode: {String(selectedReturn.payment_mode || selectedReturn.refund_mode).toUpperCase()}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setViewReturnDialog(false)}>Close</Button>
          <Button 
            fullWidth={isMobile} 
            variant="contained" 
            sx={{ bgcolor: '#10b981' }} 
            startIcon={<Print />} 
            onClick={() => handlePrintReturn(selectedReturn)}
          >
            Print Slip
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== MOBILE DRAWER ==================== */}
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

      {/* ==================== SNACKBAR ==================== */}
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