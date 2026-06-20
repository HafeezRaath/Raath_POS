import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Tooltip, Pagination, Snackbar, Alert, Avatar, LinearProgress,
  InputAdornment, Checkbox, Divider 
} from '@mui/material';
import {
  Search, FilterList, Visibility, Print, Refresh, Today, DateRange, 
  TrendingUp, KeyboardReturn, AssignmentReturn, Phone,History
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

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(getStartOfMonth());
  const [filterDateTo, setFilterDateTo] = useState(getToday());
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(25);

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

  // ==================== LOAD DATA POOL VIA RAW SQLITE JOINS ====================
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch sales history with aggregated items row count count constraints natively
      const salesQuery = `
        SELECT s.*, (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as total_items
        FROM sales s 
        WHERE s.is_deleted = 0
        ORDER BY s.id DESC
      `;
      const rawSales = await db.electronQuery(salesQuery);

      // Filter rows via JavaScript layer safely mapping ISO String dates parameters
      const filteredSalesRows = rawSales.filter(sale => {
        const checkDate = String(sale.date || '').substring(0, 10);
        if (filterDateFrom && checkDate < filterDateFrom) return false;
        if (filterDateTo && checkDate > filterDateTo) return false;
        if (filterCustomer && Number(sale.customer_id) !== Number(filterCustomer)) return false;
        return true;
      });

      // 2. Fetch master sale returns journal directly reading columns mapping matching screenshots
      const returnsQuery = `
        SELECT r.*, s.invoice_no as original_invoice, s.customer_name
        FROM sale_returns r
        LEFT JOIN sales s ON r.sale_id = s.id
        WHERE r.is_deleted = 0
        ORDER BY r.id DESC
      `;
      const rawReturns = await db.electronQuery(returnsQuery);

      const customersList = await db.getCustomers();

      setSales(filteredSalesRows);
      setReturns(rawReturns);
      setCustomers(customersList || []);

      // 3. Dynamic Stats Profile Calculations Engine Loops
      const todayStr = getToday();
      const todayReturnsRows = rawReturns.filter(r => String(r.return_date || '').substring(0, 10) === todayStr);
      const todayRefundSum = todayReturnsRows.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
      const periodRefundSum = rawReturns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

      // Group breakdown distribution
      const modeMap = {};
      rawReturns.forEach(r => {
        const mode = r.payment_mode || r.refund_mode || 'cash';
        modeMap[mode] = (modeMap[mode] || 0) + Number(r.refund_amount || 0);
      });
      const byModeArray = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));

      setStats({
        todayReturns: todayReturnsRows.length,
        todayRefund: todayRefundSum,
        periodReturns: rawReturns.length,
        periodRefund: periodRefundSum,
        byMode: byModeArray
      });

    } catch (err) {
      console.error('Data stack matrix parsing failure:', err);
      setSnackbar({ open: true, message: 'Sync Failure: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDateFrom, filterDateTo, filterCustomer, searchInvoice]);

  // ==================== OPEN AND COMPILE RETURNS DESK ====================
  const handleOpenProcess = async (sale) => {
    setSelectedSale(sale);
    try {
      const items = await db.electronQuery(`
        SELECT si.*, pv.variant_name, pv.sku, p.name as product_name 
        FROM sale_items si
        JOIN product_variants pv ON si.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE si.sale_id = ?
      `, [sale.id]);

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
      setSnackbar({ open: true, message: 'Failed compilation line items: ' + err.message, severity: 'error' });
    }
  };

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

  const handleProcessReturn = async () => {
    const selectedItems = returnItems.filter(item => item.selected && item.returnQty > 0);
    if (selectedItems.length === 0) {
      setSnackbar({ open: true, message: 'Select targeted row items!', severity: 'warning' });
      return;
    }
    if (!returnForm.reason) {
      setSnackbar({ open: true, message: 'Return reason profile required!', severity: 'warning' });
      return;
    }

    setProcessingReturn(true);
    try {
      const generatedReturnNo = `RET-${Date.now().toString().slice(-5)}`;
      
      // 1. Post to sale_returns layout matching master index
      const parentInsert = await db.electronQuery(`
        INSERT INTO sale_returns (sale_id, invoice_no, return_no, customer_id, return_date, refund_amount, payment_mode, notes)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)
      `, [selectedSale.id, selectedSale.invoice_no, generatedReturnNo, selectedSale.customer_id || null, totalRefund, returnForm.refund_mode, returnForm.notes]);

      const parentReturnId = parentInsert.lastInsertRowid;

      // 2. Adjust rows lines metrics and inventory allocations back into system hooks
      for (const item of selectedItems) {
        await db.electronQuery(`
          INSERT INTO sale_return_items (sale_return_id, product_variant_id, quantity, price, sub_total, reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [parentReturnId, item.product_variant_id, item.returnQty, item.returnPrice, (item.returnQty * item.returnPrice), returnForm.reason]);

        await db.updateVariantStock(item.product_variant_id, item.returnQty);
      }

      // 3. Customer Ledger Balance balancing checks
      if (selectedSale.customer_id && selectedSale.payment_status !== 'paid') {
        await db.electronQuery("UPDATE customers SET current_balance = current_balance - ? WHERE id = ?", [totalRefund, selectedSale.customer_id]);
      }

      setSnackbar({ open: true, message: 'Return posted successfully across all logs!', severity: 'success' });
      setProcessDialog(false);
      loadData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Pipeline failure thread crash: ' + err.message, severity: 'error' });
    } finally {
      setProcessingReturn(false);
    }
  };

  // ==================== VIEW DETAILED RETURN ROW MATRIX ====================
  const handleViewReturn = async (ret) => {
    setSelectedReturn(ret);
    try {
      const items = await db.electronQuery(`
        SELECT sri.*, pv.variant_name, pv.sku, p.name as product_name 
        FROM sale_return_items sri
        JOIN product_variants pv ON sri.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE sri.sale_return_id = ?
      `, [ret.id]);
      setReturnItemsView(items);
      setViewReturnDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Fetch array error line: ' + err.message, severity: 'error' });
    }
  };

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
        <head><title>Return Slip Reference #${ret.id}</title></head>
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

  // ==================== DATA CALCULATORS MEMOIZED ====================
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
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <KeyboardReturn sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Returns & Refunds Controller Journal
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            Filters Toggle
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData}>
            Sync Tables
          </Button>
        </Stack>
      </Box>

      {/* SNAPSHOT COUNTERS */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { title: "Today's Return Refund Value", value: stats.todayRefund, count: stats.todayReturns, label: 'slips today', color: 'warning' },
          { title: 'Period Accumulated Refunds Volume', value: stats.periodRefund, count: stats.periodReturns, label: 'total slips logged', color: 'error' },
          { title: 'Gross Balance Reverse Drawback Impact', value: stats.periodRefund, count: null, label: 'Capital Adjustments Share', color: 'info' },
        ].map((stat, idx) => (
          <Grid item xs={12} md={4} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '5px solid', borderLeftColor: `${stat.color}.main` }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`}>{formatCurrency(stat.value)}</Typography>
                {stat.count !== null && <Typography variant="caption" color="text.secondary">{stat.count} {stat.label}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* NAVIGATION TABS CONTROL */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<History fontSize="small" />} iconPosition="start" label="Sales Logs Master (Trigger Returns)" />
          <Tab icon={<AssignmentReturn fontSize="small" />} iconPosition="start" label={`Returns Journal History Database (${returns.length})`} />
          <Tab icon={<TrendingUp fontSize="small" />} iconPosition="start" label="Refund Analytics & Breakdown" />
        </Tabs>
      </Paper>

      {/* FILTER DRAWER BOX NODE */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" type="date" label="Bound From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" type="date" label="Bound To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" placeholder="Search index sequence matching invoice..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter Customer</InputLabel>
                <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} label="Filter Customer">
                  <MenuItem value="">Show Display All Accounts</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `[${c.phone}]` : ''}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* TAB PANEL 0: TRIGGER TRANS DESK */}
      {activeTab === 0 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Invoice Profile ID', 'Date Stamp', 'Client Details', 'Dispatched Count', 'Gross Total', 'Cash Received', 'Ledger Status', 'Action Module'].map((h) => (
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
                    <TableCell>{sale.customer_name || 'Walk-in Account Pool'}</TableCell>
                    <TableCell><Chip size="small" label={`${sale.total_items || 1} units`} variant="outlined" sx={{ height: 20 }} /></TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                    <TableCell sx={{ color: 'green' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                    <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                    <TableCell>
                      <Button variant="contained" size="small" sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' }, textTransform: 'none', height: 26, fontSize: '0.75rem' }} startIcon={<KeyboardReturn />} onClick={() => handleOpenProcess(sale)}>
                        Process Return
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

      {/* TAB PANEL 1: MASTER JOURNAL ARCHIVE LOGS */}
      {activeTab === 1 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Return Token ID', 'Original Linked Bill ID', 'Timestamp Execution', 'Account Holder Name', 'Reason Matrix Category', 'Contra Capital Refunded', 'Refund Settle Channel Mode', 'Action'].map((h) => (
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
                    <TableCell>{ret.customer_name || 'Walk-in Cash Customer'}</TableCell>
                    <TableCell><Chip size="small" label={ret.reason || 'General Sourced Return'} color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} /></TableCell>
                    <TableCell align="right" sx={{ color: 'red', fontWeight: 'bold' }}>{formatCurrency(ret.refund_amount)}</TableCell>
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

      {/* TAB PANEL 2: ANALYTICAL BREAKDOWNS SHARE */}
      {activeTab === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Volume Allocation Matrix By Channel Mode</Typography>
              <Divider sx={{ mb: 2 }} />
              {stats.byMode.map((mode, i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" textTransform="uppercase">{mode.mode}</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(mode.amount)}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={stats.periodRefund > 0 ? (mode.amount / stats.periodRefund) * 100 : 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }} />
                </Box>
              ))}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Return Incident Classification Categories Logs</Typography>
              <Divider sx={{ mb: 2 }} />
              {(() => {
                const map = {};
                returns.forEach(r => { map[r.reason] = (map[r.reason] || 0) + 1; });
                return Object.entries(map).map(([reason, count]) => (
                  <Box key={reason} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f3f4f6' }}>
                    <Typography variant="body2">{reason}</Typography>
                    <Chip size="small" label={`${count} incidents`} color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                  </Box>
                ));
              })()}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* MODAL WINDOWS DIALOG MODULE: CONSTRUCT TRANS ENTRY ACTION */}
      <Dialog open={processDialog} onClose={() => !processingReturn && setProcessDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5 }}>
          <KeyboardReturn sx={{ verticalAlign: 'middle', mr: 1 }} /> Process Reverse Return Ledger — Invoice #{selectedSale?.invoice_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Box>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, boxShadow: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#fffbeb' }}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={returnItems.length > 0 && returnItems.every(i => i.selected)} indeterminate={returnItems.some(i => i.selected) && !returnItems.every(i => i.selected)} onChange={(e) => handleToggleSelectAll(e.target.checked)} />
                      </TableCell>
                      <TableCell>Product Variant Descriptor</TableCell>
                      <TableCell align="right">Invoice Dispatched Volume</TableCell>
                      <TableCell align="right">Return Qty Target</TableCell>
                      <TableCell align="right">Refund Price Value Rate</TableCell>
                      <TableCell align="right">Net Return Row Valuation</TableCell>
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
                    <InputLabel>Return Reason *</InputLabel>
                    <Select value={returnForm.reason} onChange={(e) => setReturnForm(p => ({ ...p, reason: e.target.value }))} label="Return Reason *">
                      {RETURN_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Channel Mode</InputLabel>
                    <Select value={returnForm.refund_mode} onChange={(e) => setReturnForm(p => ({ ...p, refund_mode: e.target.value }))} label="Refund Channel Mode">
                      {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Audit Remarks Note" value={returnForm.notes} onChange={(e) => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#fffbeb', borderRadius: 1, border: '1px solid #fecaca', textAlign: 'right' }}>
                <Typography variant="h6" color="#b45309" fontWeight="bold">Net Cash Refunded Sum Out: {formatCurrency(totalRefund)}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setProcessDialog(false)} disabled={processingReturn}>Abort Entry</Button>
          <Button variant="contained" sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }} onClick={handleProcessReturn} disabled={processingReturn || totalRefund <= 0}>
            {processingReturn ? 'Processing Rollbacks...' : 'Commit Reverse Settle Statement'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW RETURN ARCHIVE DETAIL DIALOG */}
      <Dialog open={viewReturnDialog} onClose={() => setViewReturnDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Return Audit Breakdown — RET-{selectedReturn?.id}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedReturn && (
            <Stack spacing={2}>
              <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 0 }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Returned Vol</TableCell><TableCell align="right">Refund Cash</TableCell></TableRow></TableHead>
                  <TableBody>
                    {returnItemsView.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell><Typography variant="body2">{item.product_name}</Typography><Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku}</Typography></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{item.quantity || item.returned_quantity}</TableCell>
                        <TableCell align="right" sx={{ color: 'red', fontWeight: 'bold' }}>{formatCurrency(item.price || item.refund_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ textAlign: 'right', p: 1.5, bgcolor: '#fffbeb', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="#b45309">Net Capital Drawn Back: {formatCurrency(selectedReturn.refund_amount)}</Typography>
                <Typography variant="caption">Channel Mode: {String(selectedReturn.payment_mode || selectedReturn.refund_mode).toUpperCase()}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewReturnDialog(false)}>Dismiss</Button><Button variant="contained" sx={{ bgcolor: '#10b981' }} startIcon={<Print />} onClick={() => handlePrintReturn(selectedReturn)}>Print Slip</Button></DialogActions>
      </Dialog>

      {/* SNACKBAR NOTIFIER */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}