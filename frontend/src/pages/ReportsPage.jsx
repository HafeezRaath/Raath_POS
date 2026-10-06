import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Pagination, Divider, LinearProgress, Tooltip, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Avatar, Badge, List, ListItem, ListItemText,
  ListItemIcon, Fade, Zoom, Snackbar, Alert, TablePagination,
  Switch, FormControlLabel, Popover, ListSubheader
} from '../components/ui/tailwind-mui';
import {
  Search, Refresh, Visibility, Assessment, Timeline, PointOfSale,
  LocalShipping, People, ShowChart, Inventory, MoneyOff, Warning, Error,
  CheckCircle, AccessTime, RemoveShoppingCart, Speed, TrendingDown,
  Menu as MenuIcon, Close, ArrowUpward, ArrowDownward, Receipt,
  TrendingUp, AccountBalance, Store, Person, AttachMoney, Add,
  Edit, Delete, Save, Cancel, Print, Download, FilterList,
  MoreVert, Done, Clear, PostAdd, AddCircle, RemoveCircle
} from '../components/ui/icons';
import db from '../database/db';
import { useSyncListener } from '../hooks/useSyncListener';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import UnifiedPagination from '../components/common/UnifiedPagination';

const extractDateOnly = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (_) {}
  return String(val).substring(0, 10);
};

const exportToCSV = (filename, headers, rows) => {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ];
  const blob = new Blob(['\ufeff' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

const getDaysAgo = (dateStr) => {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
};

const FORECAST_STATUS = {
  critical_low: { color: 'error', label: 'Critical Low', icon: <Error fontSize="small" /> },
  low_stock: { color: 'warning', label: 'Low Stock', icon: <Warning fontSize="small" /> },
  over_stock: { color: 'warning', label: 'Over Stock', icon: <TrendingDown fontSize="small" /> },
  dead_stock: { color: 'default', label: 'Dead Stock', icon: <AccessTime fontSize="small" /> },
  out_of_stock: { color: 'error', label: 'Out of Stock', icon: <RemoveShoppingCart fontSize="small" /> },
  ok: { color: 'success', label: 'Optimal', icon: <CheckCircle fontSize="small" /> },
  fast_moving: { color: 'info', label: 'Fast Moving', icon: <Speed fontSize="small" /> },
};

// ==================== MOBILE FORECAST CARD ====================
const MobileForecastCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const status = FORECAST_STATUS[item.status] || FORECAST_STATUS.ok;

  return (
    <Card sx={{ mb: 1.5, borderLeft: `4px solid ${status.color === 'error' ? '#ef4444' : status.color === 'warning' ? '#f59e0b' : status.color === 'success' ? '#10b981' : '#94a3b8'}` }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {item.product_name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
              <Chip 
                size="small" 
                color={status.color} 
                label={status.label}
                sx={{ height: 16, fontSize: '0.5rem' }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={item.current_stock <= 0 ? 'error.main' : 'success.main'}>
              {item.current_stock}
            </Typography>
            <Typography variant="caption" color="text.secondary">Stock</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Sold (Period)</Typography>
            <Typography variant="body2" fontWeight="bold">{item.total_sold_period || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Daily Velocity</Typography>
            <Typography variant="body2" fontWeight="bold">{item.daily_velocity.toFixed(2)}/d</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Days Left</Typography>
            <Typography variant="body2" fontWeight="bold" color={item.days_remaining <= 7 ? 'error.main' : 'success.main'}>
              {item.daily_velocity > 0 ? item.days_remaining : '-'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Value</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(item.stock_value)}</Typography>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Alert Qty</Typography>
              <Typography variant="body2">{item.alert_qty}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Suggested Order</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">{item.suggested_order || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Retail Value</Typography>
              <Typography variant="body2">{formatCurrency(item.retail_value)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Potential Profit</Typography>
              <Typography variant="body2" color="success.main">{formatCurrency(item.potential_profit)}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Last Sale</Typography>
              <Typography variant="body2">{item.last_sale_date ? formatDate(item.last_sale_date) : 'Never'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            sx={{ flex: 1, bgcolor: '#10b981' }}
          >
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

// ==================== NEW ENTRY DIALOG ====================
const EntryDialog = ({ open, onClose, onSave, title, fields, initialData, isEdit }) => {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      const defaults = {};
      fields.forEach(f => {
        if (f.type === 'date') defaults[f.name] = new Date().toISOString().split('T')[0];
        else if (f.type === 'select') defaults[f.name] = f.options?.[0]?.value || '';
        else if (f.type === 'number') defaults[f.name] = 0;
        else defaults[f.name] = '';
      });
      setFormData(defaults);
    }
    setErrors({});
  }, [initialData, fields, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (f.required && !formData[f.name]) {
        newErrors[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        {isEdit ? 'Edit' : 'New'} {title}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {fields.map((field) => (
            <Grid item xs={field.fullWidth ? 12 : 6} key={field.name}>
              {field.type === 'select' ? (
                <FormControl fullWidth size="small" error={!!errors[field.name]}>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    label={field.label}
                  >
                    {field.options?.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                  {errors[field.name] && <Typography variant="caption" color="error">{errors[field.name]}</Typography>}
                </FormControl>
              ) : field.type === 'textarea' ? (
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={3}
                  name={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  error={!!errors[field.name]}
                  helperText={errors[field.name]}
                />
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  type={field.type || 'text'}
                  name={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  error={!!errors[field.name]}
                  helperText={errors[field.name]}
                  InputProps={field.startAdornment ? { startAdornment: field.startAdornment } : {}}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<Cancel />}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== CONFIRM DELETE DIALOG ====================
const ConfirmDialog = ({ open, onClose, onConfirm, title, message }) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ color: 'error.main' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm} startIcon={<Delete />}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== MAIN COMPONENT ====================
export default function ReportsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // ==================== GLOBAL STATES ====================
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ==================== DIALOG STATES ====================
  const [entryDialog, setEntryDialog] = useState({ open: false, mode: 'add', data: null });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, data: null, type: '' });
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState({ sales: [], purchases: [], summary: {} });

  // ==================== FORECASTING STATES ====================
  const [forecastData, setForecastData] = useState([]);
  const [forecastPeriod, setForecastPeriod] = useState(30);
  const [forecastThreshold, setForecastThreshold] = useState(7);
  const [overstockMultiplier, setOverstockMultiplier] = useState(60);
  const [fcSearch, setFcSearch] = useState('');
  const [fcStatus, setFcStatus] = useState('all');
  const [fcPage, setFcPage] = useState(0);
  const [fcRowsPerPage, setFcRowsPerPage] = useState(isMobile ? 10 : 25);

  // ==================== SALES REPORT STATES ====================
  const [salesData, setSalesData] = useState([]);
  const [salesSummary, setSalesSummary] = useState({});
  const [salesFrom, setSalesFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [salesTo, setSalesTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [salesPaymentMode, setSalesPaymentMode] = useState('all');
  const [salesPage, setSalesPage] = useState(0);
  const [salesRowsPerPage, setSalesRowsPerPage] = useState(isMobile ? 10 : 25);
  const [salesPeriodType, setSalesPeriodType] = useState('monthly');
  const [itemSalesBreakdown, setItemSalesBreakdown] = useState([]);
  const [itemBreakdownSearch, setItemBreakdownSearch] = useState('');
  const [itemBreakdownPage, setItemBreakdownPage] = useState(0);
  const [itemBreakdownRowsPerPage, setItemBreakdownRowsPerPage] = useState(10);

  const handleQuickSalesFilter = (type) => {
    setSalesPeriodType(type);
    const today = new Date().toISOString().split('T')[0];
    if (type === 'daily') {
      setSalesFrom(today);
      setSalesTo(today);
    } else if (type === 'weekly') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setSalesFrom(d.toISOString().split('T')[0]);
      setSalesTo(today);
    } else if (type === 'monthly') {
      const d = new Date();
      d.setDate(1);
      setSalesFrom(d.toISOString().split('T')[0]);
      setSalesTo(today);
    } else if (type === 'all') {
      setSalesFrom('2020-01-01');
      setSalesTo(today);
    }
  };

  const handleQuickDate = (setFrom, setTo, type) => {
    const today = new Date().toISOString().split('T')[0];
    if (type === 'today') {
      setFrom(today);
      setTo(today);
    } else if (type === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFrom(d.toISOString().split('T')[0]);
      setTo(today);
    } else if (type === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFrom(d.toISOString().split('T')[0]);
      setTo(today);
    } else if (type === 'month') {
      const d = new Date();
      d.setDate(1);
      setFrom(d.toISOString().split('T')[0]);
      setTo(today);
    } else if (type === 'all') {
      setFrom('2020-01-01');
      setTo(today);
    }
  };

  // ==================== PURCHASE / SUPPLIER STATES ====================
  const [purchaseData, setPurchaseData] = useState([]);
  const [supplierSummary, setSupplierSummary] = useState([]);
  const [purchaseFrom, setPurchaseFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [purchaseTo, setPurchaseTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [supSearch, setSupSearch] = useState('');
  const [supBalanceFilter, setSupBalanceFilter] = useState('all'); // all, payable, settled
  const [supPage, setSupPage] = useState(0);
  const [supRowsPerPage, setSupRowsPerPage] = useState(isMobile ? 10 : 25);

  // ==================== CUSTOMER STATES ====================
  const [customerData, setCustomerData] = useState([]);
  const [customerFrom, setCustomerFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [customerTo, setCustomerTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [custSearch, setCustSearch] = useState('');
  const [custBalanceFilter, setCustBalanceFilter] = useState('all'); // all, debt, settled
  const [custPage, setCustPage] = useState(0);
  const [custRowsPerPage, setCustRowsPerPage] = useState(isMobile ? 10 : 25);

  // ==================== PROFIT & LOSS STATES ====================
  const [plFrom, setPlFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [plTo, setPlTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [plSummary, setPlSummary] = useState({ revenue: 0, cogs: 0, expenses: 0, gross: 0, net: 0, grossMargin: 0, netMargin: 0 });

  // ==================== STOCK / INVENTORY STATES ====================
  const [stockValuation, setStockValuation] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topFrom, setTopFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [topTo, setTopTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockSearch, setStockSearch] = useState('');

  // ==================== EXPENSE STATES ====================
  const [expenseData, setExpenseData] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState([]);
  const [expFrom, setExpFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [expTo, setExpTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [expSearch, setExpSearch] = useState('');
  const [expCategoryFilter, setExpCategoryFilter] = useState('all');
  const [expPaymentFilter, setExpPaymentFilter] = useState('all');
  const [expPage, setExpPage] = useState(0);
  const [expRowsPerPage, setExpRowsPerPage] = useState(isMobile ? 10 : 25);

  // ==================== HELPER FUNCTIONS ====================
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // ==================== CRUD OPERATIONS ====================
  
  // FORECAST CRUD (Product Variant Management)
  const handleAddForecast = async (data) => {
    try {
      await db.addVariant(data);
      showSnackbar('Product variant added successfully');
      loadForecasting();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error adding variant: ' + err.message, 'error');
    }
  };

  const handleEditForecast = async (data) => {
    try {
      await db.updateVariant(data.id, data);
      showSnackbar('Product variant updated successfully');
      loadForecasting();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error updating variant: ' + err.message, 'error');
    }
  };

  const handleDeleteForecast = async (item) => {
    try {
      await db.deleteVariant(item.id);
      showSnackbar('Product variant deleted successfully');
      loadForecasting();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error deleting variant: ' + err.message, 'error');
    }
  };

  // SALES CRUD
  const handleAddSale = async (data) => {
    try {
      const saleId = await db.addSale(data);
      if (data.items) {
        for (const item of data.items) {
          await db.addSaleItem(saleId, item);
        }
      }
      showSnackbar('Sale added successfully');
      loadSalesReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error adding sale: ' + err.message, 'error');
    }
  };

  const handleEditSale = async (data) => {
    try {
      await db.updateSale(data.id, data);
      showSnackbar('Sale updated successfully');
      loadSalesReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error updating sale: ' + err.message, 'error');
    }
  };

  const handleDeleteSale = async (item) => {
    try {
      await db.deleteSale(item.id);
      showSnackbar('Sale deleted successfully');
      loadSalesReport();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error deleting sale: ' + err.message, 'error');
    }
  };

  // SUPPLIER CRUD
  const handleAddSupplier = async (data) => {
    try {
      await db.addSupplier(data);
      showSnackbar('Supplier added successfully');
      loadPurchaseReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error adding supplier: ' + err.message, 'error');
    }
  };

  const handleEditSupplier = async (data) => {
    try {
      await db.updateSupplier(data.id, data);
      showSnackbar('Supplier updated successfully');
      loadPurchaseReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error updating supplier: ' + err.message, 'error');
    }
  };

  const handleDeleteSupplier = async (item) => {
    try {
      await db.deleteSupplier(item.id);
      showSnackbar('Supplier deleted successfully');
      loadPurchaseReport();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error deleting supplier: ' + err.message, 'error');
    }
  };

  // CUSTOMER CRUD
  const handleAddCustomer = async (data) => {
    try {
      await db.addCustomer(data);
      showSnackbar('Customer added successfully');
      loadCustomerReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error adding customer: ' + err.message, 'error');
    }
  };

  const handleEditCustomer = async (data) => {
    try {
      await db.updateCustomer(data.id, data);
      showSnackbar('Customer updated successfully');
      loadCustomerReport();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error updating customer: ' + err.message, 'error');
    }
  };

  const handleDeleteCustomer = async (item) => {
    try {
      await db.deleteCustomer(item.id);
      showSnackbar('Customer deleted successfully');
      loadCustomerReport();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error deleting customer: ' + err.message, 'error');
    }
  };

  // EXPENSE CRUD
  const handleAddExpense = async (data) => {
    try {
      await db.addExpense(data);
      showSnackbar('Expense added successfully');
      loadExpenses();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error adding expense: ' + err.message, 'error');
    }
  };

  const handleEditExpense = async (data) => {
    try {
      await db.updateExpense(data.id, data);
      showSnackbar('Expense updated successfully');
      loadExpenses();
      setEntryDialog({ open: false, mode: 'add', data: null });
    } catch (err) {
      showSnackbar('Error updating expense: ' + err.message, 'error');
    }
  };

  const handleDeleteExpense = async (item) => {
    try {
      await db.deleteExpense(item.id);
      showSnackbar('Expense deleted successfully');
      loadExpenses();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error deleting expense: ' + err.message, 'error');
    }
  };

  // ==================== LOAD FUNCTIONS ====================
  const loadForecasting = async () => {
    setLoading(true);
    try {
      const variants = await db.getAllVariants().catch(() => []);
      if (!Array.isArray(variants)) { setForecastData([]); return; }

      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - forecastPeriod);
      const periodStartStr = extractDateOnly(periodStart.toISOString());

      const allSales = await db.getSalesHistory().catch(() => []);
      const periodSales = (allSales || []).filter(s => {
        if (s.is_deleted) return false;
        const sd = extractDateOnly(s.date || s.created_at || s.sale_date);
        return !periodStartStr || sd >= periodStartStr;
      });

      // Single fetch for all items to eliminate N+1 IDB transaction bottleneck
      const allSaleItems = await db.getAllSaleItems().catch(() => []);
      const periodSaleIds = new Set(periodSales.map(s => String(s.id)));
      const periodInvoices = new Set(periodSales.filter(s => s.invoice_no).map(s => String(s.invoice_no)));

      const matchedSaleItems = allSaleItems.filter(item => 
        periodSaleIds.has(String(item.sale_id)) || periodInvoices.has(String(item.sale_id))
      );

      const variantSales = {};
      const variantRevenue = {};
      const lastSaleDates = {};

      matchedSaleItems.forEach(item => {
        const vid = String(item.product_variant_id || item.variant_id || '');
        if (!vid) return;
        if (!variantSales[vid]) { variantSales[vid] = 0; variantRevenue[vid] = 0; }
        variantSales[vid] += (Number(item.quantity) || Number(item.qty) || 0);
        variantRevenue[vid] += (Number(item.total) || 0);

        const parentSale = periodSales.find(s => String(s.id) === String(item.sale_id) || String(s.invoice_no) === String(item.sale_id));
        const saleDate = parentSale?.date || parentSale?.created_at || item.sale_date;
        if (saleDate) {
          if (!lastSaleDates[vid] || saleDate > lastSaleDates[vid]) lastSaleDates[vid] = saleDate;
        }
      });

      const enriched = variants.map(v => {
        const variantId = String(v.id);
        const currentStock = Number(v.current_stock) || 0;
        const alertQty = Number(v.stock_alert_quantity) || 5;
        const purchasePrice = Number(v.purchase_price) || 0;
        const retailPrice = Number(v.retail_price) || 0;

        const totalSold = variantSales[variantId] || 0;
        const totalRevenue = variantRevenue[variantId] || 0;
        const lastSaleDate = lastSaleDates[variantId] || null;

        const dailyVelocity = totalSold > 0 ? totalSold / forecastPeriod : 0;
        const daysRemaining = dailyVelocity > 0 ? Math.floor(currentStock / dailyVelocity) : (currentStock > 0 ? 9999 : 0);

        let status = 'ok';
        let suggestedOrder = 0;

        if (currentStock === 0) {
          status = 'out_of_stock';
          suggestedOrder = Math.ceil(dailyVelocity * 60);
        } else if (dailyVelocity > 0) {
          if (daysRemaining <= forecastThreshold) {
            status = daysRemaining <= 3 ? 'critical_low' : 'low_stock';
            suggestedOrder = Math.ceil((dailyVelocity * 60) - currentStock);
            if (suggestedOrder < 0) suggestedOrder = 0;
          } else if (currentStock > dailyVelocity * overstockMultiplier) {
            status = 'over_stock';
          } else if (totalSold > 20 && daysRemaining < 14) {
            status = 'fast_moving';
          }
        } else {
          if (currentStock > alertQty * 20) status = 'over_stock';
          else if (currentStock > 0 && getDaysAgo(lastSaleDate) > 90) status = 'dead_stock';
        }

        return {
          ...v,
          product_name: v.product_name || v.name || 'Product',
          current_stock: currentStock,
          alert_qty: alertQty,
          total_sold_period: totalSold,
          total_revenue_period: totalRevenue,
          daily_velocity: dailyVelocity,
          days_remaining: daysRemaining,
          last_sale_date: lastSaleDate,
          days_since_sale: getDaysAgo(lastSaleDate),
          status,
          suggested_order: suggestedOrder,
          stock_value: currentStock * purchasePrice,
          retail_value: currentStock * retailPrice,
          potential_profit: currentStock * (retailPrice - purchasePrice)
        };
      });

      setForecastData(enriched);
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading forecast: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadSalesReport = async () => {
    setLoading(true);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      const fromStr = salesFrom ? extractDateOnly(salesFrom) : '';
      const toStr = salesTo ? extractDateOnly(salesTo) : '';

      let filtered = (allSales || []).filter(s => {
        if (s.is_deleted) return false;
        const sd = extractDateOnly(s.date || s.created_at || s.sale_date);
        if (fromStr && sd < fromStr) return false;
        if (toStr && sd > toStr) return false;
        return true;
      });

      if (salesPaymentMode !== 'all') {
        filtered = filtered.filter(s => String(s.payment_mode || '').toLowerCase() === salesPaymentMode.toLowerCase());
      }

      // Single fetch for all sale items
      const allSaleItems = await db.getAllSaleItems().catch(() => []);
      const saleItemsMap = new Map();
      allSaleItems.forEach(item => {
        const sid = String(item.sale_id || '');
        if (sid) {
          if (!saleItemsMap.has(sid)) saleItemsMap.set(sid, []);
          saleItemsMap.get(sid).push(item);
        }
      });

      const enriched = filtered.map(s => {
        let items = Array.isArray(s.items) && s.items.length > 0 
          ? s.items 
          : (saleItemsMap.get(String(s.id)) || (s.invoice_no ? saleItemsMap.get(String(s.invoice_no)) : []) || []);
        
        return {
          ...s,
          total_items: items.length,
          total_qty: items.reduce((sum, i) => sum + (Number(i.quantity) || Number(i.qty) || 0), 0),
          total_cost: items.reduce((sum, i) => sum + ((Number(i.quantity) || Number(i.qty) || 0) * (Number(i.unit_cost) || Number(i.purchase_price) || 0)), 0),
          items: items
        };
      });

      setSalesData(enriched);

      const summary = {
        total_bills: enriched.length,
        total_sales: enriched.reduce((s, x) => s + (Number(x.grand_total) || 0), 0),
        total_paid: enriched.reduce((s, x) => s + (Number(x.paid_amount) || 0), 0),
        total_due: enriched.reduce((s, x) => s + (Number(x.due_amount) || 0), 0),
        total_discount: enriched.reduce((s, x) => s + (Number(x.discount) || 0), 0),
        total_cost: enriched.reduce((s, x) => s + (Number(x.total_cost) || 0), 0),
        total_items_sold: enriched.reduce((s, x) => s + (Number(x.total_qty) || 0), 0)
      };
      summary.gross_profit = summary.total_sales - summary.total_cost;

      setSalesSummary(summary);

      // Item-Wise Sales Breakdown
      const itemMap = {};
      enriched.forEach(s => {
        (s.items || []).forEach(item => {
          const key = String(item.product_variant_id || item.product_id || item.product_name || item.name || 'item');
          const name = item.product_name || item.name || 'Product';
          const sku = item.sku || '-';
          const qty = Number(item.quantity || item.qty || 0);
          const price = Number(item.price || 0);
          const total = Number(item.total || (qty * price));
          const unitCost = Number(item.unit_cost || item.purchase_price || 0);
          const cost = unitCost * qty;

          if (!itemMap[key]) {
            itemMap[key] = {
              id: key,
              name,
              sku,
              quantity: 0,
              total_revenue: 0,
              total_cost: 0,
              total_profit: 0,
              bills_count: 0
            };
          }
          itemMap[key].quantity += qty;
          itemMap[key].total_revenue += total;
          itemMap[key].total_cost += cost;
          itemMap[key].total_profit += (total - cost);
          itemMap[key].bills_count += 1;
        });
      });

      const breakdown = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
      setItemSalesBreakdown(breakdown);
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading sales: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadPurchaseReport = async () => {
    setLoading(true);
    try {
      const allPurchases = await db.getPurchases().catch(() => []);
      const fromStr = purchaseFrom ? extractDateOnly(purchaseFrom) : '';
      const toStr = purchaseTo ? extractDateOnly(purchaseTo) : '';

      const filtered = (allPurchases || []).filter(p => {
        if (p.is_deleted) return false;
        const pd = extractDateOnly(p.purchase_date || p.date || p.created_at);
        if (fromStr && pd < fromStr) return false;
        if (toStr && pd > toStr) return false;
        return true;
      });
      setPurchaseData(filtered);

      const allSuppliers = await db.getSuppliers().catch(() => []);
      const summary = (allSuppliers || []).map(s => {
        const supPurchases = filtered.filter(p => String(p.supplier_id) === String(s.id));
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          company_name: s.company_name,
          current_balance: Number(s.current_balance || 0),
          total_purchases: supPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0),
          total_paid: supPurchases.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0),
          bill_count: supPurchases.length
        };
      }).sort((a, b) => b.total_purchases - a.total_purchases);

      setSupplierSummary(summary);
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading suppliers: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadCustomerReport = async () => {
    setLoading(true);
    try {
      const allCustomers = await db.getCustomers().catch(() => []);
      const allSales = await db.getSalesHistory().catch(() => []);
      const fromStr = customerFrom ? extractDateOnly(customerFrom) : '';
      const toStr = customerTo ? extractDateOnly(customerTo) : '';

      const periodSales = (allSales || []).filter(s => {
        if (s.is_deleted) return false;
        const sd = extractDateOnly(s.date || s.created_at || s.sale_date);
        if (fromStr && sd < fromStr) return false;
        if (toStr && sd > toStr) return false;
        return true;
      });

      const data = (allCustomers || []).map(c => {
        const custPeriodSales = periodSales.filter(s => String(s.customer_id) === String(c.id));
        return {
          ...c,
          period_sales: custPeriodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
          period_paid: custPeriodSales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0),
          current_balance: Number(c.current_balance || 0)
        };
      });

      setCustomerData(data);
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading customers: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadProfitLoss = async () => {
    setLoading(true);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      const fromStr = plFrom ? extractDateOnly(plFrom) : '';
      const toStr = plTo ? extractDateOnly(plTo) : '';

      const periodSales = (allSales || []).filter(s => {
        if (s.is_deleted) return false;
        const sd = extractDateOnly(s.date || s.created_at || s.sale_date);
        if (fromStr && sd < fromStr) return false;
        if (toStr && sd > toStr) return false;
        return true;
      });

      const revenue = periodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);

      // Compute COGS in 1 single pass
      const allSaleItems = await db.getAllSaleItems().catch(() => []);
      const periodSaleIds = new Set(periodSales.map(s => String(s.id)));
      const periodInvoices = new Set(periodSales.filter(s => s.invoice_no).map(s => String(s.invoice_no)));

      let cogs = 0;
      allSaleItems.forEach(item => {
        if (periodSaleIds.has(String(item.sale_id)) || periodInvoices.has(String(item.sale_id))) {
          const qty = Number(item.quantity) || Number(item.qty) || 0;
          const unitCost = Number(item.unit_cost) || Number(item.purchase_price) || 0;
          cogs += qty * unitCost;
        }
      });

      const allExpenses = await db.getExpenses().catch(() => []);
      const periodExpenses = (allExpenses || []).filter(e => {
        if (e.is_deleted) return false;
        const ed = extractDateOnly(e.date || e.created_at);
        if (fromStr && ed < fromStr) return false;
        if (toStr && ed > toStr) return false;
        return true;
      });
      const expenses = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const gross = revenue - cogs;
      const net = gross - expenses;

      setPlSummary({
        revenue, cogs, expenses, gross, net,
        grossMargin: revenue > 0 ? (gross / revenue) * 100 : 0,
        netMargin: revenue > 0 ? (net / revenue) * 100 : 0
      });
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading P&L: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadStockAnalytics = async () => {
    setLoading(true);
    try {
      const allVariants = await db.getAllVariants().catch(() => []);
      const allProducts = await db.getProducts().catch(() => []);

      const productMap = {};
      (allProducts || []).forEach(p => { productMap[String(p.id)] = p; });

      const categoryMap = {};
      (allVariants || []).forEach(v => {
        const product = productMap[String(v.product_id)];
        const catName = v.category_name || product?.category_name || 'General';
        if (!categoryMap[catName]) {
          categoryMap[catName] = { 
            category_name: catName, 
            variant_count: 0, 
            total_qty: 0, 
            stock_value_at_cost: 0, 
            stock_value_at_retail: 0, 
            potential_profit: 0 
          };
        }
        const stock = Number(v.current_stock) || 0;
        const purchasePrice = Number(v.purchase_price) || 0;
        const retailPrice = Number(v.retail_price) || 0;
        categoryMap[catName].variant_count++;
        categoryMap[catName].total_qty += stock;
        categoryMap[catName].stock_value_at_cost += stock * purchasePrice;
        categoryMap[catName].stock_value_at_retail += stock * retailPrice;
        categoryMap[catName].potential_profit += stock * (retailPrice - purchasePrice);
      });

      setStockValuation(Object.values(categoryMap).sort((a, b) => b.stock_value_at_cost - a.stock_value_at_cost));
      const top = await db.getTopSellingProducts(topFrom, topTo, 20).catch(() => []);
      setTopProducts(top);
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading stock: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const allExpenses = await db.getExpenses().catch(() => []);
      const fromStr = expFrom ? extractDateOnly(expFrom) : '';
      const toStr = expTo ? extractDateOnly(expTo) : '';

      const filtered = (allExpenses || []).filter(e => {
        if (e.is_deleted) return false;
        const ed = extractDateOnly(e.date || e.created_at);
        if (fromStr && ed < fromStr) return false;
        if (toStr && ed > toStr) return false;
        return true;
      });
      setExpenseData(filtered);

      const catMap = {};
      filtered.forEach(e => {
        const cat = e.category_name || e.category || 'General Expense';
        if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, total: 0 };
        catMap[cat].count++;
        catMap[cat].total += Number(e.amount || 0);
      });

      const totalExpenses = Object.values(catMap).reduce((s, c) => s + c.total, 0);
      setExpenseSummary(Object.values(catMap).map(c => ({
        ...c, percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
      })).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading expenses: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const handleViewDetail = async (product) => {
    setSelectedProduct(product);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      const allPurchases = await db.getPurchases().catch(() => []);
      const allSaleItems = await db.getAllSaleItems().catch(() => []);
      const targetVariantId = String(product.id || '');

      const matchedSaleItems = allSaleItems.filter(i => String(i.product_variant_id) === targetVariantId);
      const salesHistory = matchedSaleItems.map(item => {
        const parentSale = allSales.find(s => String(s.id) === String(item.sale_id) || String(s.invoice_no) === String(item.sale_id));
        return {
          invoice_no: item.sale_invoice_no || parentSale?.invoice_no || '-',
          date: item.sale_date || parentSale?.date || parentSale?.created_at || '',
          quantity: Number(item.quantity) || Number(item.qty) || 0,
          price: item.price,
          total: item.total,
          customer_name: parentSale?.customer_name || 'Walk-in',
          total_profit: ((Number(item.price) || 0) - (Number(item.unit_cost) || Number(item.purchase_price) || 0)) * (Number(item.quantity) || Number(item.qty) || 0)
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

      const purchaseItemsArrays = await Promise.all(allPurchases.filter(p => !p.is_deleted).map(async p => {
        const items = await db.getPurchaseItems(p.id).catch(() => []);
        return { ...p, items: (items || []).filter(i => String(i.product_variant_id) === targetVariantId) };
      }));

      const purchaseHistory = purchaseItemsArrays.filter(p => p.items.length > 0).flatMap(p => p.items.map(item => ({
        purchase_no: p.purchase_no,
        purchase_date: p.purchase_date || p.date || p.created_at,
        supplier_name: p.supplier_name || '-',
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        sub_total: item.sub_total
      }))).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date)).slice(0, 50);

      setProductHistory({
        sales: salesHistory, purchases: purchaseHistory,
        summary: {
          total_sold: salesHistory.reduce((s, h) => s + h.quantity, 0),
          total_revenue: salesHistory.reduce((s, h) => s + (Number(h.total) || 0), 0),
          total_profit: salesHistory.reduce((s, h) => s + h.total_profit, 0),
          total_purchased: purchaseHistory.reduce((s, h) => s + (Number(h.quantity) || 0), 0),
          total_purchase_cost: purchaseHistory.reduce((s, h) => s + (Number(h.sub_total) || 0), 0)
        }
      });
      setDetailDialog(true);
    } catch (err) { console.error(err); }
  };

  useSyncListener(() => {
    if (activeTab === 0) loadForecasting();
    else if (activeTab === 1) loadSalesReport();
    else if (activeTab === 2) loadPurchaseReport();
    else if (activeTab === 3) loadCustomerReport();
    else if (activeTab === 4) loadProfitLoss();
    else if (activeTab === 5) loadStockAnalytics();
    else if (activeTab === 6) loadExpenses();
  });

  useEffect(() => {
    if (activeTab === 0) loadForecasting();
    else if (activeTab === 1) loadSalesReport();
    else if (activeTab === 2) loadPurchaseReport();
    else if (activeTab === 3) loadCustomerReport();
    else if (activeTab === 4) loadProfitLoss();
    else if (activeTab === 5) loadStockAnalytics();
    else if (activeTab === 6) loadExpenses();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 1) loadSalesReport();
  }, [salesFrom, salesTo, salesPaymentMode]);

  useEffect(() => {
    if (activeTab === 2) loadPurchaseReport();
  }, [purchaseFrom, purchaseTo]);

  useEffect(() => {
    if (activeTab === 3) loadCustomerReport();
  }, [customerFrom, customerTo]);

  useEffect(() => {
    if (activeTab === 4) loadProfitLoss();
  }, [plFrom, plTo]);

  useEffect(() => {
    if (activeTab === 5) loadStockAnalytics();
  }, [topFrom, topTo]);

  useEffect(() => {
    if (activeTab === 6) loadExpenses();
  }, [expFrom, expTo]);

  const filteredItemBreakdown = useMemo(() => {
    if (!itemBreakdownSearch) return itemSalesBreakdown;
    const q = itemBreakdownSearch.toLowerCase();
    return itemSalesBreakdown.filter(it => 
      (it.name || '').toLowerCase().includes(q) || 
      (it.sku || '').toLowerCase().includes(q)
    );
  }, [itemSalesBreakdown, itemBreakdownSearch]);

  const filteredForecast = useMemo(() => {
    return forecastData.filter(v => {
      const matchSearch = !fcSearch || (v.product_name || '').toLowerCase().includes(fcSearch.toLowerCase()) || (v.sku || '').toLowerCase().includes(fcSearch.toLowerCase());
      return matchSearch && (fcStatus === 'all' || v.status === fcStatus);
    });
  }, [forecastData, fcSearch, fcStatus]);

  const paginatedForecast = useMemo(() => {
    return filteredForecast.slice(fcPage * fcRowsPerPage, fcPage * fcRowsPerPage + fcRowsPerPage);
  }, [filteredForecast, fcPage, fcRowsPerPage]);

  const forecastStats = useMemo(() => {
    const criticalLow = forecastData.filter(v => v.status === 'critical_low').length;
    const lowStock = forecastData.filter(v => v.status === 'low_stock').length;
    const outOfStock = forecastData.filter(v => v.status === 'out_of_stock').length;
    const overStock = forecastData.filter(v => v.status === 'over_stock').length;
    const ok = forecastData.filter(v => v.status === 'ok').length;
    return { criticalLow, lowStock, outOfStock, overStock, ok };
  }, [forecastData]);

  const filteredSuppliers = useMemo(() => {
    return supplierSummary.filter(s => {
      const q = (supSearch || '').toLowerCase().trim();
      const matchSearch = !q || (s.name || '').toLowerCase().includes(q) || (s.company_name || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
      const matchBalance = supBalanceFilter === 'all' || 
        (supBalanceFilter === 'payable' && Number(s.current_balance || 0) > 0) ||
        (supBalanceFilter === 'settled' && Number(s.current_balance || 0) <= 0);
      return matchSearch && matchBalance;
    });
  }, [supplierSummary, supSearch, supBalanceFilter]);

  const supplierStats = useMemo(() => {
    const totalPurchases = filteredSuppliers.reduce((s, x) => s + (Number(x.total_purchases) || 0), 0);
    const totalPaid = filteredSuppliers.reduce((s, x) => s + (Number(x.total_paid) || 0), 0);
    const totalPayable = filteredSuppliers.reduce((s, x) => s + (Number(x.current_balance) || 0), 0);
    return { count: filteredSuppliers.length, totalPurchases, totalPaid, totalPayable };
  }, [filteredSuppliers]);

  const paginatedSuppliers = useMemo(() => {
    return filteredSuppliers.slice(supPage * supRowsPerPage, supPage * supRowsPerPage + supRowsPerPage);
  }, [filteredSuppliers, supPage, supRowsPerPage]);

  const filteredCustomers = useMemo(() => {
    return customerData.filter(c => {
      const q = (custSearch || '').toLowerCase().trim();
      const matchSearch = !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.shop_name || '').toLowerCase().includes(q);
      const matchBalance = custBalanceFilter === 'all' || 
        (custBalanceFilter === 'debt' && Number(c.current_balance || 0) > 0) ||
        (custBalanceFilter === 'settled' && Number(c.current_balance || 0) <= 0);
      return matchSearch && matchBalance;
    });
  }, [customerData, custSearch, custBalanceFilter]);

  const customerStats = useMemo(() => {
    const totalSales = filteredCustomers.reduce((s, c) => s + (Number(c.period_sales) || 0), 0);
    const totalPaid = filteredCustomers.reduce((s, c) => s + (Number(c.period_paid) || 0), 0);
    const totalDebt = filteredCustomers.reduce((s, c) => s + (Number(c.current_balance) || 0), 0);
    return { count: filteredCustomers.length, totalSales, totalPaid, totalDebt };
  }, [filteredCustomers]);

  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(custPage * custRowsPerPage, custPage * custRowsPerPage + custRowsPerPage);
  }, [filteredCustomers, custPage, custRowsPerPage]);

  const filteredExpenses = useMemo(() => {
    return expenseData.filter(e => {
      const q = (expSearch || '').toLowerCase().trim();
      const matchSearch = !q || (e.title || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || (e.reference_no || '').toLowerCase().includes(q);
      const matchCat = expCategoryFilter === 'all' || String(e.category_name || '').toLowerCase() === expCategoryFilter.toLowerCase();
      const matchMode = expPaymentFilter === 'all' || String(e.payment_mode || '').toLowerCase() === expPaymentFilter.toLowerCase();
      return matchSearch && matchCat && matchMode;
    });
  }, [expenseData, expSearch, expCategoryFilter, expPaymentFilter]);

  const expenseStats = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { count: filteredExpenses.length, total, average: filteredExpenses.length > 0 ? total / filteredExpenses.length : 0 };
  }, [filteredExpenses]);

  const paginatedExpenses = useMemo(() => {
    return filteredExpenses.slice(expPage * expRowsPerPage, expPage * expRowsPerPage + expRowsPerPage);
  }, [filteredExpenses, expPage, expRowsPerPage]);

  const filteredStockValuation = useMemo(() => {
    if (!stockSearch.trim()) return stockValuation;
    const q = stockSearch.toLowerCase().trim();
    return stockValuation.filter(cat => (cat.category_name || '').toLowerCase().includes(q));
  }, [stockValuation, stockSearch]);

  const stockValuationStats = useMemo(() => {
    const totalCost = stockValuation.reduce((s, c) => s + (Number(c.stock_value_at_cost) || 0), 0);
    const totalRetail = stockValuation.reduce((s, c) => s + (Number(c.stock_value_at_retail) || 0), 0);
    const potentialProfit = stockValuation.reduce((s, c) => s + (Number(c.potential_profit) || 0), 0);
    const totalQty = stockValuation.reduce((s, c) => s + (Number(c.total_qty) || 0), 0);
    return { totalCost, totalRetail, potentialProfit, totalQty };
  }, [stockValuation]);

  const handleSyncActiveReport = () => {
    if (activeTab === 0) loadForecasting();
    else if (activeTab === 1) loadSalesReport();
    else if (activeTab === 2) loadPurchaseReport();
    else if (activeTab === 3) loadCustomerReport();
    else if (activeTab === 4) loadProfitLoss();
    else if (activeTab === 5) loadStockAnalytics();
    else if (activeTab === 6) loadExpenses();
  };

  const exportCurrentReportPDF = () => {
    try {
      const isLandscape = activeTab === 0 || activeTab === 1;
      const doc = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const genDate = formatDateTime(new Date().toISOString());

      // Top Navy Header Band (#1c2580)
      doc.setFillColor(28, 37, 128);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shop.name || 'RAATH POS', 14, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(shop.phone || shop.address ? `${shop.phone || ''} ${shop.address ? ' | ' + shop.address : ''}` : 'ENTERPRISE RETAIL MANAGEMENT SYSTEM', 14, 19);

      let reportTitle = 'ANALYTICAL REPORT';
      let subTitle = '';
      let head = [];
      let body = [];
      let secondHead = null;
      let secondBody = null;
      let secondTitle = null;

      if (activeTab === 0) {
        reportTitle = 'VELOCITY FORECASTING & REORDER AUDIT';
        subTitle = `Inventory Demand & Velocity Analysis (Last ${forecastPeriod} Days) | Status: ${fcStatus.toUpperCase()}`;
        head = [['#', 'Product Name', 'SKU', 'Stock', 'Sold', 'Velocity', 'Days Left', 'Status', 'Suggested Order', 'Stock Value']];
        body = filteredForecast.map((v, i) => [
          i + 1,
          `${v.product_name || ''} ${v.variant_name && v.variant_name !== 'Default' ? `(${v.variant_name})` : ''}`,
          v.sku || '-',
          v.current_stock || 0,
          v.total_sold_period || 0,
          `${(v.daily_velocity || 0).toFixed(2)}/d`,
          v.daily_velocity > 0 ? `${v.days_remaining}d` : '-',
          String(v.status || 'ok').toUpperCase().replace('_', ' '),
          v.suggested_order > 0 ? `+${v.suggested_order}` : '-',
          formatCurrency(v.stock_value)
        ]);
      } else if (activeTab === 1) {
        reportTitle = 'CONSOLIDATED SALES ANALYSIS REPORT';
        subTitle = `Period: ${formatDate(salesFrom)} to ${formatDate(salesTo)} | Mode: ${salesPaymentMode.toUpperCase()} | Total Bills: ${salesSummary.total_bills || 0} | Revenue: ${formatCurrency(salesSummary.total_sales)}`;
        head = [['Invoice #', 'Date', 'Customer', 'Items', 'Qty', 'Grand Total', 'Paid', 'Due', 'Mode']];
        body = salesData.map(s => [
          s.invoice_no || '-',
          formatDate(s.date || s.created_at),
          s.customer_name || 'Walk-in',
          s.total_items || 0,
          s.total_qty || 0,
          formatCurrency(s.grand_total),
          formatCurrency(s.paid_amount),
          formatCurrency(s.due_amount),
          String(s.payment_mode || 'cash').toUpperCase()
        ]);
        if (filteredItemBreakdown.length > 0) {
          secondTitle = 'TOP SELLING ITEMS BREAKDOWN';
          secondHead = [['#', 'Item Name', 'SKU', 'Bills Count', 'Quantity Sold', 'Revenue', 'Est. Profit']];
          secondBody = filteredItemBreakdown.slice(0, 30).map((it, i) => [
            i + 1,
            it.name || 'Item',
            it.sku || '-',
            it.bills_count || 0,
            it.quantity || 0,
            formatCurrency(it.total_revenue),
            formatCurrency(it.total_profit)
          ]);
        }
      } else if (activeTab === 2) {
        reportTitle = 'SUPPLIERS PURCHASE & OUTSTANDING LEDGER';
        subTitle = `Period: ${formatDate(purchaseFrom)} to ${formatDate(purchaseTo)} | Filter: ${supBalanceFilter.toUpperCase()}`;
        head = [['#', 'Supplier Name', 'Company', 'Phone', 'Bills', 'Purchases', 'Paid', 'Payable Balance']];
        body = filteredSuppliers.map((s, i) => [
          i + 1,
          s.name || '-',
          s.company_name || '-',
          s.phone || '-',
          s.bill_count || 0,
          formatCurrency(s.total_purchases),
          formatCurrency(s.total_paid),
          formatCurrency(s.current_balance)
        ]);
      } else if (activeTab === 3) {
        reportTitle = 'CUSTOMERS DEBT & RECEIVABLE STATEMENT';
        subTitle = `Period: ${formatDate(customerFrom)} to ${formatDate(customerTo)} | Filter: ${custBalanceFilter.toUpperCase()}`;
        head = [['#', 'Customer Name', 'Phone', 'Shop / Business', 'Period Sales', 'Period Collected', 'Debt Balance']];
        body = filteredCustomers.map((c, i) => [
          i + 1,
          c.name || '-',
          c.phone || '-',
          c.shop_name || '-',
          formatCurrency(c.period_sales),
          formatCurrency(c.period_paid),
          formatCurrency(c.current_balance)
        ]);
      } else if (activeTab === 4) {
        reportTitle = 'STATEMENT OF PROFIT & LOSS';
        subTitle = `Financial Period: ${formatDate(plFrom)} to ${formatDate(plTo)} | Currency: PKR`;
        head = [['Financial Metric', 'Amount (PKR)', '% of Revenue']];
        body = [
          ['Operating Sales Revenue', formatCurrency(plSummary.revenue), '100.0%'],
          ['Less: Cost of Goods Sold (COGS)', `-${formatCurrency(plSummary.cogs)}`, `${plSummary.revenue > 0 ? ((plSummary.cogs / plSummary.revenue) * 100).toFixed(1) : 0}%`],
          ['GROSS PROFIT', formatCurrency(plSummary.gross), `${plSummary.grossMargin.toFixed(1)}%`],
          ['Less: Operating Expenses', `-${formatCurrency(plSummary.expenses)}`, `${plSummary.revenue > 0 ? ((plSummary.expenses / plSummary.revenue) * 100).toFixed(1) : 0}%`],
          ['NET INCOME / PROFIT', formatCurrency(plSummary.net), `${plSummary.netMargin.toFixed(1)}%`]
        ];
      } else if (activeTab === 5) {
        reportTitle = 'INVENTORY & STOCK VALUATION REPORT';
        subTitle = `Current Valuation & Asset Distribution | Total Units: ${stockValuationStats.totalQty} | Cost Value: ${formatCurrency(stockValuationStats.totalCost)}`;
        head = [['#', 'Category Name', 'Variants', 'Total Units', 'Cost Value', 'Retail Value', 'Potential Profit']];
        body = filteredStockValuation.map((cat, i) => [
          i + 1,
          cat.category_name || 'General',
          cat.variant_count || 0,
          cat.total_qty || 0,
          formatCurrency(cat.stock_value_at_cost),
          formatCurrency(cat.stock_value_at_retail),
          formatCurrency(cat.potential_profit)
        ]);
        if (topProducts.length > 0) {
          secondTitle = 'TOP SELLING PRODUCTS';
          secondHead = [['#', 'Product Name', 'SKU', 'Units Sold', 'Total Revenue']];
          secondBody = topProducts.slice(0, 20).map((p, i) => [
            i + 1,
            p.product_name || '-',
            p.sku || '-',
            `${p.total_sold} units`,
            formatCurrency(p.total_revenue)
          ]);
        }
      } else if (activeTab === 6) {
        reportTitle = 'OPERATING EXPENSES & OVERHEAD STATEMENT';
        subTitle = `Period: ${formatDate(expFrom)} to ${formatDate(expTo)} | Total Expenses: ${formatCurrency(expenseStats.total)} | Count: ${expenseStats.count}`;
        head = [['#', 'Date', 'Category', 'Description', 'Mode', 'Amount']];
        body = filteredExpenses.map((e, i) => [
          i + 1,
          formatDate(e.date),
          e.category_name || 'General',
          e.description || e.title || '-',
          String(e.payment_mode || 'cash').toUpperCase(),
          formatCurrency(e.amount)
        ]);
        if (expenseSummary.length > 0) {
          secondTitle = 'EXPENSE CATEGORY DISTRIBUTION';
          secondHead = [['#', 'Category Name', 'Count', 'Total Amount', '% of Total']];
          secondBody = expenseSummary.map((c, i) => [
            i + 1,
            c.category || 'General',
            c.count || 0,
            formatCurrency(c.total),
            `${(c.percentage || 0).toFixed(1)}%`
          ]);
        }
      }

      // Header on the right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(reportTitle, pageWidth - 14, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Generated: ${genDate}`, pageWidth - 14, 19, { align: 'right' });

      // Subtitle bar
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(subTitle, 14, 34);

      // Primary Table
      autoTable(doc, {
        head,
        body,
        startY: 38,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
        headStyles: { fillColor: [28, 37, 128], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      // Secondary Table (if present)
      if (secondHead && secondBody && secondBody.length > 0) {
        const finalY = doc.lastAutoTable.finalY + 10;
        if (finalY + 30 > pageHeight) {
          doc.addPage();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(28, 37, 128);
          doc.text(secondTitle || '', 14, 16);
          autoTable(doc, {
            head: secondHead,
            body: secondBody,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 }
          });
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(28, 37, 128);
          doc.text(secondTitle || '', 14, finalY);
          autoTable(doc, {
            head: secondHead,
            body: secondBody,
            startY: finalY + 4,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 }
          });
        }
      }

      // Footer with page numbering
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`RAATH POS Enterprise Analytical Suite • Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }

      const cleanFileName = reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`Raath_${cleanFileName}_${new Date().toISOString().split('T')[0]}.pdf`);
      showSnackbar('PDF statement downloaded successfully');
    } catch (err) {
      console.error(err);
      showSnackbar('Error generating PDF: ' + err.message, 'error');
    }
  };

  const exportCurrentReportCSV = () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      if (activeTab === 0) {
        const headers = ['#', 'Product Name', 'Variant', 'SKU', 'Current Stock', 'Sold in Period', 'Daily Velocity', 'Days Remaining', 'Status', 'Suggested Reorder', 'Stock Value (Cost)', 'Retail Value', 'Potential Profit'];
        const rows = filteredForecast.map((v, i) => [
          i + 1,
          v.product_name,
          v.variant_name || '',
          v.sku || '',
          v.current_stock,
          v.total_sold_period || 0,
          (v.daily_velocity || 0).toFixed(2),
          v.days_remaining,
          v.status,
          v.suggested_order,
          v.stock_value,
          v.retail_value,
          v.potential_profit
        ]);
        exportToCSV(`Raath_Velocity_Forecast_${todayStr}.csv`, headers, rows);
      } else if (activeTab === 1) {
        const headers = ['Invoice #', 'Date', 'Customer Name', 'Items Count', 'Total Quantity', 'Grand Total (PKR)', 'Paid Amount (PKR)', 'Due Amount (PKR)', 'Discount (PKR)', 'Payment Mode', 'Status'];
        const rows = salesData.map(s => [
          s.invoice_no,
          s.date || s.created_at,
          s.customer_name || 'Walk-in Customer',
          s.total_items || 0,
          s.total_qty || 0,
          s.grand_total || 0,
          s.paid_amount || 0,
          s.due_amount || 0,
          s.discount || 0,
          s.payment_mode || 'cash',
          s.payment_status || 'paid'
        ]);
        exportToCSV(`Raath_Sales_Invoices_${salesFrom}_to_${salesTo}.csv`, headers, rows);
      } else if (activeTab === 2) {
        const headers = ['#', 'Supplier Name', 'Company', 'Phone', 'Bills Count', 'Total Purchases (PKR)', 'Total Paid (PKR)', 'Current Payable Balance (PKR)'];
        const rows = filteredSuppliers.map((s, i) => [
          i + 1,
          s.name,
          s.company_name || '',
          s.phone || '',
          s.bill_count || 0,
          s.total_purchases || 0,
          s.total_paid || 0,
          s.current_balance || 0
        ]);
        exportToCSV(`Raath_Suppliers_Ledger_${purchaseFrom}_to_${purchaseTo}.csv`, headers, rows);
      } else if (activeTab === 3) {
        const headers = ['#', 'Customer Name', 'Phone', 'Shop / Business', 'Period Sales (PKR)', 'Period Paid (PKR)', 'Debt Balance (PKR)'];
        const rows = filteredCustomers.map((c, i) => [
          i + 1,
          c.name,
          c.phone || '',
          c.shop_name || '',
          c.period_sales || 0,
          c.period_paid || 0,
          c.current_balance || 0
        ]);
        exportToCSV(`Raath_Customers_Debt_${customerFrom}_to_${customerTo}.csv`, headers, rows);
      } else if (activeTab === 4) {
        const headers = ['Financial Metric', 'Amount (PKR)', '% of Revenue'];
        const rows = [
          ['Operating Sales Revenue', plSummary.revenue, '100.0%'],
          ['Less: Cost of Goods Sold (COGS)', `-${plSummary.cogs}`, `${plSummary.revenue > 0 ? ((plSummary.cogs / plSummary.revenue) * 100).toFixed(1) : 0}%`],
          ['GROSS PROFIT', plSummary.gross, `${plSummary.grossMargin.toFixed(1)}%`],
          ['Less: Operating & Administrative Expenses', `-${plSummary.expenses}`, `${plSummary.revenue > 0 ? ((plSummary.expenses / plSummary.revenue) * 100).toFixed(1) : 0}%`],
          ['NET INCOME / PROFIT', plSummary.net, `${plSummary.netMargin.toFixed(1)}%`]
        ];
        exportToCSV(`Raath_Profit_and_Loss_${plFrom}_to_${plTo}.csv`, headers, rows);
      } else if (activeTab === 5) {
        const headers = ['#', 'Category Name', 'Variant Count', 'Total Stock Units', 'Cost Value (PKR)', 'Retail Value (PKR)', 'Potential Profit Margin (PKR)'];
        const rows = filteredStockValuation.map((cat, i) => [
          i + 1,
          cat.category_name,
          cat.variant_count || 0,
          cat.total_qty || 0,
          cat.stock_value_at_cost || 0,
          cat.stock_value_at_retail || 0,
          cat.potential_profit || 0
        ]);
        exportToCSV(`Raath_Stock_Valuation_${todayStr}.csv`, headers, rows);
      } else if (activeTab === 6) {
        const headers = ['#', 'Date', 'Expense Title', 'Category', 'Payment Mode', 'Reference #', 'Amount (PKR)'];
        const rows = filteredExpenses.map((e, i) => [
          i + 1,
          e.date || e.created_at,
          e.title || '',
          e.category_name || e.category || 'General',
          e.payment_mode || 'cash',
          e.reference_no || '',
          e.amount || 0
        ]);
        exportToCSV(`Raath_Expense_Ledger_${expFrom}_to_${expTo}.csv`, headers, rows);
      }
      showSnackbar('CSV file exported successfully');
    } catch (err) {
      console.error(err);
      showSnackbar('Error exporting CSV: ' + err.message, 'error');
    }
  };

  const exportItemBreakdownCSV = () => {
    try {
      const headers = ['#', 'Item Name', 'SKU', 'Bills Count', 'Quantity Sold', 'Revenue (PKR)', 'Total Cost (PKR)', 'Estimated Profit (PKR)'];
      const rows = filteredItemBreakdown.map((it, i) => [
        i + 1,
        it.name,
        it.sku || '',
        it.bills_count || 0,
        it.quantity || 0,
        it.total_revenue || 0,
        it.total_cost || 0,
        it.total_profit || 0
      ]);
      exportToCSV(`Raath_Item_Sales_Breakdown_${salesFrom}_to_${salesTo}.csv`, headers, rows);
      showSnackbar('Item breakdown CSV exported successfully');
    } catch (err) {
      console.error(err);
      showSnackbar('Error exporting Item Breakdown CSV: ' + err.message, 'error');
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1050,height=800');
    if (!printWindow) {
      showSnackbar('Please allow popups to download/print PDF reports', 'warning');
      return;
    }

    let reportTitle = 'Raath Analytical Report';
    let subTitle = '';
    let metaHtml = '';
    let summaryHtml = '';
    let contentHtml = '';

    const genDate = formatDateTime(new Date().toISOString());

    if (activeTab === 0) {
      reportTitle = 'VELOCITY FORECASTING & REORDER AUDIT';
      subTitle = `Inventory Demand & Velocity Analysis (Last ${forecastPeriod} Days)`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Period:</strong> Last ${forecastPeriod} Days | <strong>Status Filter:</strong> ${fcStatus.toUpperCase()}</div>
          <div><strong>Total Analyzed:</strong> ${filteredForecast.length} variants | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Critical Low</div><div class="stat-val" style="color:#ef4444;">${forecastStats.criticalLow}</div></div>
          <div class="stat-box"><div class="stat-lbl">Low Stock</div><div class="stat-val" style="color:#f59e0b;">${forecastStats.lowStock}</div></div>
          <div class="stat-box"><div class="stat-lbl">Out of Stock</div><div class="stat-val" style="color:#dc2626;">${forecastStats.outOfStock}</div></div>
          <div class="stat-box"><div class="stat-lbl">Optimal Stock</div><div class="stat-val" style="color:#10b981;">${forecastStats.ok}</div></div>
        </div>
      `;
      const rows = filteredForecast.map((v, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${v.product_name} <span style="font-size:10px;color:#6b7280;">(${v.variant_name})</span></td>
          <td><code>${v.sku || '-'}</code></td>
          <td class="right bold">${v.current_stock}</td>
          <td class="right">${v.total_sold_period || 0}</td>
          <td class="right">${v.daily_velocity ? v.daily_velocity.toFixed(2) : '0.00'}/d</td>
          <td class="right bold" style="color:${v.days_remaining <= 7 ? '#ef4444' : '#10b981'};">${v.daily_velocity > 0 ? `${v.days_remaining}d` : '-'}</td>
          <td class="center"><span style="padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;background:#f3f4f6;">${v.status?.toUpperCase()}</span></td>
          <td class="right bold" style="color:${v.suggested_order > 0 ? '#dc2626' : 'inherit'};">${v.suggested_order > 0 ? `+${v.suggested_order}` : '-'}</td>
          <td class="right">${formatCurrency(v.stock_value)}</td>
        </tr>
      `).join('');
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th class="center">#</th><th>Product Name</th><th>SKU</th><th class="right">Current</th><th class="right">Sold</th>
              <th class="right">Velocity</th><th class="right">Days Left</th><th class="center">Status</th><th class="right">Reorder</th><th class="right">Stock Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTab === 1) {
      reportTitle = 'SALES & REVENUE AUDIT REPORT';
      subTitle = `Consolidated Sales Ledger (${formatDate(salesFrom)} to ${formatDate(salesTo)})`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${formatDate(salesFrom)} to ${formatDate(salesTo)} | <strong>Payment Mode:</strong> ${salesPaymentMode.toUpperCase()}</div>
          <div><strong>Total Invoices:</strong> ${salesSummary.total_bills || 0} | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Total Sales</div><div class="stat-val" style="color:#047857;">${formatCurrency(salesSummary.total_sales)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Gross Profit</div><div class="stat-val" style="color:#0284c7;">${formatCurrency(salesSummary.gross_profit)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Receivable (Due)</div><div class="stat-val" style="color:#ef4444;">${formatCurrency(salesSummary.total_due)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Items Sold</div><div class="stat-val">${salesSummary.total_items_sold || 0} units</div></div>
        </div>
      `;
      const itemRows = filteredItemBreakdown.slice(0, 30).map((it, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${it.name}</td>
          <td><code>${it.sku || '-'}</code></td>
          <td class="center">${it.bills_count}</td>
          <td class="right bold">${it.quantity}</td>
          <td class="right bold">${formatCurrency(it.total_revenue)}</td>
          <td class="right" style="color:${it.total_profit >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(it.total_profit)}</td>
        </tr>
      `).join('');
      const invoiceRows = salesData.slice(0, 50).map(s => `
        <tr>
          <td class="bold">${s.invoice_no}</td>
          <td>${formatDate(s.date)}</td>
          <td>${s.customer_name || 'Walk-in'}</td>
          <td class="right">${s.total_qty || 0}</td>
          <td class="right bold">${formatCurrency(s.grand_total)}</td>
          <td class="right" style="color:#10b981;">${formatCurrency(s.paid_amount)}</td>
          <td class="right" style="color:${s.due_amount > 0 ? '#ef4444' : 'inherit'};">${formatCurrency(s.due_amount)}</td>
          <td class="center">${String(s.payment_mode || 'cash').toUpperCase()}</td>
        </tr>
      `).join('');
      contentHtml = `
        <h3 style="margin:16px 0 8px;color:#047857;font-size:13px;">TOP SELLING ITEMS BREAKDOWN</h3>
        <table>
          <thead>
            <tr><th class="center">#</th><th>Item Name</th><th>SKU</th><th class="center">Bills</th><th class="right">Qty Sold</th><th class="right">Revenue</th><th class="right">Est. Profit</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <h3 style="margin:20px 0 8px;color:#374151;font-size:13px;">INVOICES HISTORY</h3>
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Date</th><th>Customer</th><th class="right">Qty</th><th class="right">Grand Total</th><th class="right">Paid</th><th class="right">Due</th><th class="center">Mode</th></tr>
          </thead>
          <tbody>${invoiceRows}</tbody>
        </table>
      `;
    } else if (activeTab === 2) {
      reportTitle = 'SUPPLIERS PURCHASE & PAYABLE STATEMENT';
      subTitle = `Procurement & Outstanding Ledger (${formatDate(purchaseFrom)} to ${formatDate(purchaseTo)})`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${formatDate(purchaseFrom)} to ${formatDate(purchaseTo)} | <strong>Filter:</strong> ${supBalanceFilter.toUpperCase()}</div>
          <div><strong>Total Suppliers:</strong> ${filteredSuppliers.length} | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Total Suppliers</div><div class="stat-val">${supplierStats.count}</div></div>
          <div class="stat-box"><div class="stat-lbl">Total Purchases</div><div class="stat-val" style="color:#0284c7;">${formatCurrency(supplierStats.totalPurchases)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Total Paid</div><div class="stat-val" style="color:#10b981;">${formatCurrency(supplierStats.totalPaid)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Outstanding Payable</div><div class="stat-val" style="color:#ef4444;">${formatCurrency(supplierStats.totalPayable)}</div></div>
        </div>
      `;
      const rows = filteredSuppliers.map((s, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${s.name}</td>
          <td>${s.company_name || '-'}</td>
          <td>${s.phone || '-'}</td>
          <td class="center">${s.bill_count || 0}</td>
          <td class="right">${formatCurrency(s.total_purchases)}</td>
          <td class="right" style="color:#10b981;">${formatCurrency(s.total_paid)}</td>
          <td class="right bold" style="color:${s.current_balance > 0 ? '#ef4444' : 'inherit'};">${formatCurrency(s.current_balance)}</td>
        </tr>
      `).join('');
      contentHtml = `
        <table>
          <thead>
            <tr><th class="center">#</th><th>Supplier Name</th><th>Company</th><th>Phone</th><th class="center">Bills</th><th class="right">Purchases</th><th class="right">Paid</th><th class="right">Payable Balance</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTab === 3) {
      reportTitle = 'CUSTOMERS DEBT & RECEIVABLE STATEMENT';
      subTitle = `Customer Balances & Credit Ledger (${formatDate(customerFrom)} to ${formatDate(customerTo)})`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${formatDate(customerFrom)} to ${formatDate(customerTo)} | <strong>Filter:</strong> ${custBalanceFilter.toUpperCase()}</div>
          <div><strong>Total Customers:</strong> ${filteredCustomers.length} | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Total Customers</div><div class="stat-val">${customerStats.count}</div></div>
          <div class="stat-box"><div class="stat-lbl">Period Sales</div><div class="stat-val" style="color:#0284c7;">${formatCurrency(customerStats.totalSales)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Period Collected</div><div class="stat-val" style="color:#10b981;">${formatCurrency(customerStats.totalPaid)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Total Debt (Receivable)</div><div class="stat-val" style="color:#ef4444;">${formatCurrency(customerStats.totalDebt)}</div></div>
        </div>
      `;
      const rows = filteredCustomers.map((c, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${c.name}</td>
          <td>${c.phone || '-'}</td>
          <td>${c.shop_name || '-'}</td>
          <td class="right">${formatCurrency(c.period_sales)}</td>
          <td class="right" style="color:#10b981;">${formatCurrency(c.period_paid)}</td>
          <td class="right bold" style="color:${c.current_balance > 0 ? '#ef4444' : 'inherit'};">${formatCurrency(c.current_balance)}</td>
        </tr>
      `).join('');
      contentHtml = `
        <table>
          <thead>
            <tr><th class="center">#</th><th>Customer Name</th><th>Phone</th><th>Shop / Business</th><th class="right">Period Sales</th><th class="right">Period Paid</th><th class="right">Debt Balance</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTab === 4) {
      reportTitle = 'STATEMENT OF PROFIT & LOSS';
      subTitle = `Financial Performance Statement (${formatDate(plFrom)} to ${formatDate(plTo)})`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Reporting Period:</strong> ${formatDate(plFrom)} to ${formatDate(plTo)}</div>
          <div><strong>Currency:</strong> PKR | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Revenue</div><div class="stat-val" style="color:#047857;">${formatCurrency(plSummary.revenue)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Gross Profit</div><div class="stat-val" style="color:#0284c7;">${formatCurrency(plSummary.gross)} (${plSummary.grossMargin.toFixed(1)}%)</div></div>
          <div class="stat-box"><div class="stat-lbl">Operating Expenses</div><div class="stat-val" style="color:#f59e0b;">${formatCurrency(plSummary.expenses)}</div></div>
          <div class="stat-box" style="background:${plSummary.net >= 0 ? '#ecfdf5' : '#fef2f2'};"><div class="stat-lbl">Net Income</div><div class="stat-val" style="color:${plSummary.net >= 0 ? '#047857' : '#dc2626'};">${formatCurrency(plSummary.net)} (${plSummary.netMargin.toFixed(1)}%)</div></div>
        </div>
      `;
      contentHtml = `
        <table>
          <thead>
            <tr><th colspan="2">Financial Metric</th><th class="right">Amount (PKR)</th><th class="right">% of Revenue</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="2" class="bold" style="color:#047857;">Operating Sales Revenue</td><td class="right bold" style="color:#047857;">${formatCurrency(plSummary.revenue)}</td><td class="right bold">100.0%</td></tr>
            <tr><td colspan="2" style="padding-left:24px;color:#dc2626;">Less: Cost of Goods Sold (COGS)</td><td class="right" style="color:#dc2626;">-${formatCurrency(plSummary.cogs)}</td><td class="right">${plSummary.revenue > 0 ? ((plSummary.cogs / plSummary.revenue) * 100).toFixed(1) : 0}%</td></tr>
            <tr style="background:#eff6ff;font-weight:bold;"><td colspan="2" style="color:#1e40af;">GROSS PROFIT</td><td class="right" style="color:#1e40af;">${formatCurrency(plSummary.gross)}</td><td class="right">${plSummary.grossMargin.toFixed(1)}%</td></tr>
            <tr><td colspan="2" style="padding-left:24px;color:#b45309;">Less: Operating & Administrative Expenses</td><td class="right" style="color:#b45309;">-${formatCurrency(plSummary.expenses)}</td><td class="right">${plSummary.revenue > 0 ? ((plSummary.expenses / plSummary.revenue) * 100).toFixed(1) : 0}%</td></tr>
            <tr style="background:${plSummary.net >= 0 ? '#d1fae5' : '#fee2e2'};font-weight:bold;font-size:13px;">
              <td colspan="2" style="color:${plSummary.net >= 0 ? '#065f46' : '#991b1b'};">NET INCOME / PROFIT</td>
              <td class="right" style="color:${plSummary.net >= 0 ? '#065f46' : '#991b1b'};">${formatCurrency(plSummary.net)}</td>
              <td class="right" style="color:${plSummary.net >= 0 ? '#065f46' : '#991b1b'};">${plSummary.netMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 5) {
      reportTitle = 'INVENTORY & STOCK VALUATION REPORT';
      subTitle = 'Current Inventory Valuation & Asset Distribution';
      metaHtml = `
        <div class="meta-box">
          <div><strong>Total Categories:</strong> ${stockValuation.length} | <strong>Total Stock Units:</strong> ${stockValuationStats.totalQty}</div>
          <div><strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Stock Value (at Cost)</div><div class="stat-val" style="color:#0284c7;">${formatCurrency(stockValuationStats.totalCost)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Retail Value</div><div class="stat-val" style="color:#047857;">${formatCurrency(stockValuationStats.totalRetail)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Potential Profit</div><div class="stat-val" style="color:#10b981;">${formatCurrency(stockValuationStats.potentialProfit)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Total Inventory Qty</div><div class="stat-val">${stockValuationStats.totalQty} units</div></div>
        </div>
      `;
      const catRows = filteredStockValuation.map((cat, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${cat.category_name}</td>
          <td class="center">${cat.variant_count || 0}</td>
          <td class="right bold">${cat.total_qty || 0}</td>
          <td class="right">${formatCurrency(cat.stock_value_at_cost)}</td>
          <td class="right" style="color:#047857;">${formatCurrency(cat.stock_value_at_retail)}</td>
          <td class="right bold" style="color:#10b981;">${formatCurrency(cat.potential_profit)}</td>
        </tr>
      `).join('');
      const topRows = topProducts.slice(0, 20).map((p, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${p.product_name}</td>
          <td><code>${p.sku || '-'}</code></td>
          <td class="right bold">${p.total_sold} units</td>
          <td class="right bold" style="color:#047857;">${formatCurrency(p.total_revenue)}</td>
        </tr>
      `).join('');
      contentHtml = `
        <h3 style="margin:16px 0 8px;color:#0284c7;font-size:13px;">CATEGORY VALUATION BREAKDOWN</h3>
        <table>
          <thead>
            <tr><th class="center">#</th><th>Category Name</th><th class="center">Variants</th><th class="right">Total Units</th><th class="right">Cost Value</th><th class="right">Retail Value</th><th class="right">Potential Margin</th></tr>
          </thead>
          <tbody>${catRows}</tbody>
        </table>
        <h3 style="margin:20px 0 8px;color:#047857;font-size:13px;">TOP SELLING PRODUCTS (VOLUME & REVENUE)</h3>
        <table>
          <thead>
            <tr><th class="center">#</th><th>Product Name</th><th>SKU</th><th class="right">Units Sold</th><th class="right">Total Revenue</th></tr>
          </thead>
          <tbody>${topRows}</tbody>
        </table>
      `;
    } else if (activeTab === 6) {
      reportTitle = 'OPERATING EXPENSES & OVERHEAD LEDGER';
      subTitle = `Expense Classification & Audit (${formatDate(expFrom)} to ${formatDate(expTo)})`;
      metaHtml = `
        <div class="meta-box">
          <div><strong>Date Range:</strong> ${formatDate(expFrom)} to ${formatDate(expTo)} | <strong>Category:</strong> ${expCategoryFilter.toUpperCase()} | <strong>Mode:</strong> ${expPaymentFilter.toUpperCase()}</div>
          <div><strong>Total Records:</strong> ${filteredExpenses.length} | <strong>Generated:</strong> ${genDate}</div>
        </div>
      `;
      summaryHtml = `
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-lbl">Total Expenses</div><div class="stat-val" style="color:#dc2626;">${formatCurrency(expenseStats.total)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Transactions</div><div class="stat-val">${expenseStats.count}</div></div>
          <div class="stat-box"><div class="stat-lbl">Average Expense</div><div class="stat-val">${formatCurrency(expenseStats.average)}</div></div>
          <div class="stat-box"><div class="stat-lbl">Expense Categories</div><div class="stat-val">${expenseSummary.length}</div></div>
        </div>
      `;
      const catRows = expenseSummary.map((c, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="bold">${c.category}</td>
          <td class="center">${c.count}</td>
          <td class="right bold" style="color:#dc2626;">${formatCurrency(c.total)}</td>
          <td class="right">${c.percentage ? c.percentage.toFixed(1) : 0}%</td>
        </tr>
      `).join('');
      const expRows = filteredExpenses.map((e, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${formatDate(e.date)}</td>
          <td class="bold">${e.category_name || 'General'}</td>
          <td>${e.description || '-'}</td>
          <td class="center">${String(e.payment_mode || 'cash').toUpperCase()}</td>
          <td class="right bold" style="color:#dc2626;">${formatCurrency(e.amount)}</td>
        </tr>
      `).join('');
      contentHtml = `
        <h3 style="margin:16px 0 8px;color:#b45309;font-size:13px;">EXPENSE CATEGORY DISTRIBUTION</h3>
        <table>
          <thead>
            <tr><th class="center">#</th><th>Category Name</th><th class="center">Count</th><th class="right">Total Amount</th><th class="right">% of Total</th></tr>
          </thead>
          <tbody>${catRows}</tbody>
        </table>
        <h3 style="margin:20px 0 8px;color:#dc2626;font-size:13px;">DETAILED EXPENSE TRANSACTIONS</h3>
        <table>
          <thead>
            <tr><th class="center">#</th><th>Date</th><th>Category</th><th>Description</th><th class="center">Mode</th><th class="right">Amount</th></tr>
          </thead>
          <tbody>${expRows}</tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            @media print {
              @page { margin: 12mm; size: A4; }
              body { padding: 0 !important; color: #111827; }
              .no-print { display: none !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; padding: 25px; margin: 0; background: #ffffff; }
            .header { border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; color: #065f46; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
            .header .sub { font-size: 11px; color: #4b5563; margin-top: 4px; font-weight: 500; }
            .meta-box { background: #f3f4f6; border-radius: 6px; padding: 10px 14px; font-size: 11px; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 10px; border: 1px solid #e5e7eb; }
            .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
            .stat-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; background: #fafafa; }
            .stat-val { font-size: 15px; font-weight: bold; margin-top: 3px; }
            .stat-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
            th { background: #10b981; color: white; padding: 7px 9px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 6px 9px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) { background: #f9fafb; }
            .right { text-align: right; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            code { font-family: monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10px; }
            .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 25px; text-align: center; font-size: 10px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${reportTitle}</h1>
              <div class="sub">${subTitle}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:bold;color:#10b981;font-size:14px;">RAATH POS</div>
              <div style="font-size:10px;color:#9ca3af;">Analytical Enterprise Suite</div>
            </div>
          </div>
          ${metaHtml}
          ${summaryHtml}
          ${contentHtml}
          <div class="footer">Powered by Raath Developers • This is a computer generated analytical report.</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 350);
  };

  // ==================== ENTRY FIELD CONFIGURATIONS ====================
  const getForecastFields = () => [
    { name: 'product_id', label: 'Product ID', type: 'number', required: true },
    { name: 'variant_name', label: 'Variant Name', required: true },
    { name: 'sku', label: 'SKU', required: true },
    { name: 'purchase_price', label: 'Purchase Price', type: 'number', required: true, startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'retail_price', label: 'Retail Price', type: 'number', required: true, startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'current_stock', label: 'Current Stock', type: 'number', required: true },
    { name: 'stock_alert_quantity', label: 'Alert Quantity', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'discontinued', label: 'Discontinued' }
    ]}
  ];

  const getSaleFields = () => [
    { name: 'customer_id', label: 'Customer ID', type: 'number' },
    { name: 'customer_name', label: 'Customer Name' },
    { name: 'invoice_no', label: 'Invoice No', required: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'grand_total', label: 'Grand Total', type: 'number', required: true, startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'paid_amount', label: 'Paid Amount', type: 'number', startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'discount', label: 'Discount', type: 'number', startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
      { value: 'cash', label: 'Cash' },
      { value: 'bank', label: 'Bank Transfer' },
      { value: 'credit', label: 'Credit' },
      { value: 'card', label: 'Card' }
    ]}
  ];

  const getSupplierFields = () => [
    { name: 'name', label: 'Supplier Name', required: true },
    { name: 'company_name', label: 'Company Name' },
    { name: 'phone', label: 'Phone' },
    { name: 'email', label: 'Email' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'current_balance', label: 'Balance', type: 'number', startAdornment: <AttachMoney fontSize="small" /> }
  ];

  const getCustomerFields = () => [
    { name: 'name', label: 'Customer Name', required: true },
    { name: 'shop_name', label: 'Shop/Business Name' },
    { name: 'phone', label: 'Phone', required: true },
    { name: 'email', label: 'Email' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'current_balance', label: 'Balance', type: 'number', startAdornment: <AttachMoney fontSize="small" /> }
  ];

  const getExpenseFields = () => [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'category_name', label: 'Category', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'amount', label: 'Amount', type: 'number', required: true, startAdornment: <AttachMoney fontSize="small" /> },
    { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
      { value: 'cash', label: 'Cash' },
      { value: 'bank', label: 'Bank' },
      { value: 'credit', label: 'Credit' }
    ]}
  ];

  // ==================== RENDER TAB CONTENT ====================
  const renderTabContent = () => {
    switch(activeTab) {
      case 0: return renderForecastTab();
      case 1: return renderSalesTab();
      case 2: return renderSuppliersTab();
      case 3: return renderCustomersTab();
      case 4: return renderProfitLossTab();
      case 5: return renderStockTab();
      case 6: return renderExpensesTab();
      default: return null;
    }
  };

  // ==================== FORECAST TAB ====================
  const renderForecastTab = () => (
    <Fade in>
      <Box>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: isMobile ? 1 : 2,
          mb: 2
        }}>
          {[
            { title: 'Critical Low', value: forecastStats.criticalLow },
            { title: 'Low Stock', value: forecastStats.lowStock },
            { title: 'Out of Stock', value: forecastStats.outOfStock },
            { title: 'Over Stock', value: forecastStats.overStock },
            { title: 'Optimal', value: forecastStats.ok }
          ].map((stat, i) => (
            <Card key={i} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: i === 4 ? { xs: 'span 2', sm: 'auto' } : 'auto' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{stat.value}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5 }}>
                PERIOD:
              </Typography>
              {[7, 30, 90].map(days => (
                <Chip
                  key={days}
                  label={`${days} Days`}
                  clickable
                  size="small"
                  color={forecastPeriod === days ? 'success' : 'default'}
                  variant={forecastPeriod === days ? 'filled' : 'outlined'}
                  onClick={() => setForecastPeriod(days)}
                  sx={{ fontWeight: 'bold' }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={exportCurrentReportPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={exportCurrentReportCSV}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" label="Search Products" placeholder="Search products..." value={fcSearch} onChange={(e) => setFcSearch(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select value={forecastPeriod} onChange={(e) => setForecastPeriod(Number(e.target.value))} label="Period">
                  <MenuItem value={7}>7 Days</MenuItem>
                  <MenuItem value={30}>30 Days</MenuItem>
                  <MenuItem value={90}>90 Days</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={fcStatus} onChange={(e) => setFcStatus(e.target.value)} label="Status">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="critical_low">Critical Low</MenuItem>
                  <MenuItem value="low_stock">Low Stock</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  <MenuItem value="over_stock">Over Stock</MenuItem>
                  <MenuItem value="ok">Optimal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" color="success" size="small" sx={{ height: 38 }} onClick={() => { setFcSearch(''); setFcStatus('all'); }}>Clear Filters</Button>
            </Grid>
          </Grid>
        </Paper>

        {isMobile ? (
          // Mobile Forecast Cards
          <Box>
            {paginatedForecast.map(v => (
              <MobileForecastCard 
                key={v.id} 
                item={v} 
              />
            ))}
            {paginatedForecast.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Timeline sx={{ fontSize: 48, color: '#d1d5db' }} />
                <Typography color="text.secondary">No products found</Typography>
              </Paper>
            )}
            <UnifiedPagination
              count={filteredForecast.length}
              page={fcPage}
              rowsPerPage={fcRowsPerPage}
              isZeroBased={true}
              onPageChange={(e, p) => setFcPage(p)}
              onRowsPerPageChange={(newR) => {
                setFcRowsPerPage(newR);
                setFcPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </Box>
        ) : (
          // Desktop Forecast Table
          <Paper sx={{ border: '1px solid #e5e7eb' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Product', 'SKU', 'Stock', 'Sold', 'Velocity', 'Days Left', 'Status', 'Order', 'Value'].map(h => (
                      <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedForecast.map(v => {
                    const status = FORECAST_STATUS[v.status] || FORECAST_STATUS.ok;
                    return (
                      <TableRow key={v.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">{v.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{v.variant_name}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="caption" fontFamily="monospace">{v.sku}</Typography></TableCell>
                        <TableCell align="right" fontWeight="bold">{v.current_stock}</TableCell>
                        <TableCell align="right">{v.total_sold_period}</TableCell>
                        <TableCell align="right" fontWeight="bold">{v.daily_velocity.toFixed(2)}/d</TableCell>
                        <TableCell align="right">
                          {v.daily_velocity > 0 ? (
                            <Box>
                              <Typography fontWeight="bold" color={v.days_remaining <= 7 ? 'error.main' : 'success.main'}>
                                {v.days_remaining} days
                              </Typography>
                              <LinearProgress variant="determinate" value={Math.min((v.days_remaining / 60) * 100, 100)} color={v.days_remaining <= 7 ? 'error' : 'success'} sx={{ height: 4, borderRadius: 2 }} />
                            </Box>
                          ) : 'No data'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" color={status.color} label={status.label} sx={{ height: 18, fontSize: '0.6rem' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ color: v.suggested_order > 0 ? 'error.main' : 'inherit', fontWeight: 'bold' }}>
                          {v.suggested_order > 0 ? `+${v.suggested_order}` : '-'}
                        </TableCell>
                        <TableCell align="right" fontWeight="500">{formatCurrency(v.stock_value)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <UnifiedPagination
              count={filteredForecast.length}
              page={fcPage}
              rowsPerPage={fcRowsPerPage}
              isZeroBased={true}
              onPageChange={(e, p) => setFcPage(p)}
              onRowsPerPageChange={(newR) => {
                setFcRowsPerPage(newR);
                setFcPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </Paper>
        )}
      </Box>
    </Fade>
  );

  // ==================== SALES TAB ====================
  const renderSalesTab = () => (
    <Fade in>
      <Box>
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          {/* Quick Date Filters & Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5, letterSpacing: 0.5 }}>
                QUICK FILTER:
              </Typography>
              <Chip 
                label="Today" 
                clickable 
                size="small"
                color={salesPeriodType === 'daily' ? 'success' : 'default'} 
                variant={salesPeriodType === 'daily' ? 'filled' : 'outlined'}
                onClick={() => handleQuickSalesFilter('daily')}
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label="Yesterday" 
                clickable 
                size="small"
                color={salesPeriodType === 'yesterday' ? 'success' : 'default'} 
                variant={salesPeriodType === 'yesterday' ? 'filled' : 'outlined'}
                onClick={() => {
                  setSalesPeriodType('yesterday');
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = d.toISOString().split('T')[0];
                  setSalesFrom(y);
                  setSalesTo(y);
                }}
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label="This Week" 
                clickable 
                size="small"
                color={salesPeriodType === 'weekly' ? 'success' : 'default'} 
                variant={salesPeriodType === 'weekly' ? 'filled' : 'outlined'}
                onClick={() => handleQuickSalesFilter('weekly')}
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label="This Month" 
                clickable 
                size="small"
                color={salesPeriodType === 'monthly' ? 'success' : 'default'} 
                variant={salesPeriodType === 'monthly' ? 'filled' : 'outlined'}
                onClick={() => handleQuickSalesFilter('monthly')}
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label="Last 30 Days" 
                clickable 
                size="small"
                color={salesPeriodType === '30d' ? 'success' : 'default'} 
                variant={salesPeriodType === '30d' ? 'filled' : 'outlined'}
                onClick={() => {
                  setSalesPeriodType('30d');
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setSalesFrom(d.toISOString().split('T')[0]);
                  setSalesTo(new Date().toISOString().split('T')[0]);
                }}
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label="All Time" 
                clickable 
                size="small"
                color={salesPeriodType === 'all' ? 'success' : 'default'} 
                variant={salesPeriodType === 'all' ? 'filled' : 'outlined'}
                onClick={() => handleQuickSalesFilter('all')}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportCSV}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Invoices CSV
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportItemBreakdownCSV}
                sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, color: '#fff', fontWeight: 'bold' }}
              >
                Items CSV
              </Button>
            </Stack>
          </Box>

          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="date" label="From Date" value={salesFrom} onChange={(e) => { setSalesFrom(e.target.value); setSalesPeriodType('custom'); }} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="date" label="To Date" value={salesTo} onChange={(e) => { setSalesTo(e.target.value); setSalesPeriodType('custom'); }} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select value={salesPaymentMode} onChange={(e) => setSalesPaymentMode(e.target.value)} label="Payment Mode">
                  <MenuItem value="all">All Modes</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="credit">Credit</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<Refresh />} 
                onClick={loadSalesReport}
                sx={{ height: 38, borderColor: '#10b981', color: '#10b981', '&:hover': { bgcolor: '#f0fdf4' } }}
              >
                Refresh Sales
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Revenue</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(salesSummary.total_sales)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Gross Profit</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(salesSummary.gross_profit)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Receivable (Due)</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(salesSummary.total_due)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Bills / Items Sold</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>
                  {salesSummary.total_bills || 0} bills ({salesSummary.total_items_sold || 0} units)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ===== ITEM-WISE SALES BREAKDOWN (KAUNSA ITEM KITNA SALE HOWA) ===== */}
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#047857', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Inventory sx={{ color: '#10b981' }} />
                Item-Wise Sales Breakdown ({salesPeriodType.toUpperCase()})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Period me kaunsa item kitna sale howa (Units, Revenue, Profit)
              </Typography>
            </Box>
            <TextField 
              size="small" 
              placeholder="Search items..." 
              value={itemBreakdownSearch} 
              onChange={(e) => { setItemBreakdownSearch(e.target.value); setItemBreakdownPage(0); }}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray', fontSize: 18 }} /> }}
              sx={{ minWidth: isMobile ? '100%' : 220 }}
            />
          </Box>

          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['#', 'Item Name', 'SKU', 'Bills', 'Qty Sold', 'Revenue', 'Est. Profit', 'Share'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItemBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No item sales recorded for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItemBreakdown.slice(itemBreakdownPage * itemBreakdownRowsPerPage, itemBreakdownPage * itemBreakdownRowsPerPage + itemBreakdownRowsPerPage).map((it, idx) => {
                    const percentOfSales = salesSummary.total_sales > 0 ? ((it.total_revenue / salesSummary.total_sales) * 100).toFixed(1) : 0;
                    return (
                      <TableRow key={it.id || idx} hover>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{itemBreakdownPage * itemBreakdownRowsPerPage + idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{it.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{it.sku || '-'}</TableCell>
                        <TableCell align="center"><Chip size="small" label={`${it.bills_count} bills`} sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#047857' }}>{it.quantity} units</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(it.total_revenue)}</TableCell>
                        <TableCell align="right" sx={{ color: it.total_profit >= 0 ? 'success.main' : 'error.main' }}>{formatCurrency(it.total_profit)}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography variant="caption" fontWeight="bold">{percentOfSales}%</Typography>
                            <Box sx={{ width: 40, bgcolor: '#e5e7eb', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                              <Box sx={{ width: `${Math.min(100, percentOfSales)}%`, bgcolor: '#10b981', height: '100%' }} />
                            </Box>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <UnifiedPagination
            count={filteredItemBreakdown.length}
            page={itemBreakdownPage}
            rowsPerPage={itemBreakdownRowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setItemBreakdownPage(p)}
            onRowsPerPageChange={(newR) => {
              setItemBreakdownRowsPerPage(newR);
              setItemBreakdownPage(0);
            }}
            rowsPerPageOptions={[5, 10, 20]}
          />
        </Paper>

        {/* ===== DETAILED INVOICES LIST ===== */}
        <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#374151' }}>
              Invoices History ({salesData.length} records)
            </Typography>
          </Box>
          <TableContainer sx={{ maxHeight: isMobile ? 'calc(100vh - 350px)' : 'calc(100vh - 360px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Invoice', 'Date', 'Customer', 'Qty', 'Total', 'Paid', 'Due', 'Mode'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {salesData.slice(salesPage * salesRowsPerPage, salesPage * salesRowsPerPage + salesRowsPerPage).map(sale => (
                  <TableRow key={sale.id} hover>
                    <TableCell sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: isMobile ? '0.7rem' : '0.875rem' }}>{sale.invoice_no}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.65rem' : '0.8rem' }}>{formatDate(sale.date)}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}>{sale.customer_name || 'Walk-in'}</TableCell>
                    <TableCell align="right">{sale.total_qty || 0}</TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(sale.grand_total)}</TableCell>
                    <TableCell align="right" color="success.main">{formatCurrency(sale.paid_amount)}</TableCell>
                    <TableCell align="right" color={sale.due_amount > 0 ? 'error.main' : 'inherit'}>{formatCurrency(sale.due_amount)}</TableCell>
                    <TableCell align="center"><Chip size="small" label={String(sale.payment_mode || 'Cash').toUpperCase()} variant="outlined" sx={{ height: 16, fontSize: '0.5rem' }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <UnifiedPagination
            count={salesData.length}
            page={salesPage}
            rowsPerPage={salesRowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setSalesPage(p)}
            onRowsPerPageChange={(newR) => {
              setSalesRowsPerPage(newR);
              setSalesPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== SUPPLIERS TAB ====================
  const renderSuppliersTab = () => (
    <Fade in>
      <Box>
        {/* Quick Date Presets */}
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5 }}>
                QUICK FILTER:
              </Typography>
              <Chip label="Today" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, 'today')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Yesterday" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, 'yesterday')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 7 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, '7d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="This Month" clickable size="small" color="primary" variant="filled" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, 'month')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 30 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, '30d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="All Time" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPurchaseFrom, setPurchaseTo, 'all')} sx={{ fontWeight: 'bold' }} />
            </Box>

            <Stack direction="row" spacing={1}>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportCSV}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>

          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={purchaseFrom} onChange={(e) => setPurchaseFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={purchaseTo} onChange={(e) => setPurchaseTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Balance Status</InputLabel>
                <Select value={supBalanceFilter} onChange={(e) => setSupBalanceFilter(e.target.value)} label="Balance Status">
                  <MenuItem value="all">All Suppliers</MenuItem>
                  <MenuItem value="payable">With Payable Due</MenuItem>
                  <MenuItem value="settled">Settled (Zero Due)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Search Supplier" placeholder="Search supplier / company / phone..." value={supSearch} onChange={(e) => setSupSearch(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} />
            </Grid>
            <Grid item xs={6} sm={6} md={2}>
              <Button fullWidth variant="outlined" size="small" startIcon={<Refresh />} onClick={loadPurchaseReport} sx={{ height: 38, borderColor: '#0284c7', color: '#0284c7' }}>
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Suppliers Summary Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: isMobile ? 1 : 2,
          mb: 2
        }}>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Total Suppliers</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }}>{supplierStats.count}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Total Purchases</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }}>{formatCurrency(supplierStats.totalPurchases)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Total Paid</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }}>{formatCurrency(supplierStats.totalPaid)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Outstanding Payable</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }}>{formatCurrency(supplierStats.totalPayable)}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Suppliers Table */}
        <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['#', 'Supplier', 'Company', 'Contact', 'Bills', 'Total Purchases', 'Total Paid', 'Payable Balance'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSuppliers.map((sup, idx) => (
                  <TableRow key={sup.id} hover>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{supPage * supRowsPerPage + idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{sup.name}</TableCell>
                    <TableCell>{sup.company_name || '-'}</TableCell>
                    <TableCell>{sup.phone || '-'}</TableCell>
                    <TableCell align="center"><Chip size="small" label={`${sup.bill_count} bills`} sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(sup.total_purchases)}</TableCell>
                    <TableCell align="right" sx={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(sup.total_paid)}</TableCell>
                    <TableCell align="right" sx={{ color: sup.current_balance > 0 ? 'error.main' : 'inherit', fontWeight: 'bold' }}>{formatCurrency(sup.current_balance)}</TableCell>
                  </TableRow>
                ))}
                {filteredSuppliers.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No suppliers found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <UnifiedPagination
            count={filteredSuppliers.length}
            page={supPage}
            rowsPerPage={supRowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setSupPage(p)}
            onRowsPerPageChange={(newR) => {
              setSupRowsPerPage(newR);
              setSupPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== CUSTOMERS TAB ====================
  const renderCustomersTab = () => (
    <Fade in>
      <Box>
        {/* Quick Date Presets */}
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5 }}>
                QUICK FILTER:
              </Typography>
              <Chip label="Today" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, 'today')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Yesterday" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, 'yesterday')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 7 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, '7d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="This Month" clickable size="small" color="primary" variant="filled" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, 'month')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 30 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, '30d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="All Time" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setCustomerFrom, setCustomerTo, 'all')} sx={{ fontWeight: 'bold' }} />
            </Box>

            <Stack direction="row" spacing={1}>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportCSV}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>

          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={customerFrom} onChange={(e) => setCustomerFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={customerTo} onChange={(e) => setCustomerTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Debt Status</InputLabel>
                <Select value={custBalanceFilter} onChange={(e) => setCustBalanceFilter(e.target.value)} label="Debt Status">
                  <MenuItem value="all">All Customers</MenuItem>
                  <MenuItem value="debt">With Due/Debt</MenuItem>
                  <MenuItem value="settled">Settled (Zero Balance)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Search Customer" placeholder="Search customer / phone / shop..." value={custSearch} onChange={(e) => setCustSearch(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} />
            </Grid>
            <Grid item xs={6} sm={6} md={2}>
              <Button fullWidth variant="outlined" size="small" startIcon={<Refresh />} onClick={loadCustomerReport} sx={{ height: 38, borderColor: '#7c3aed', color: '#7c3aed' }}>
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Customer Summary Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: isMobile ? 1 : 2,
          mb: 2
        }}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Customers</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{customerStats.count}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Period Sales</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(customerStats.totalSales)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Period Collected</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(customerStats.totalPaid)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Debt (Receivable)</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(customerStats.totalDebt)}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Customer Table */}
        <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['#', 'Customer Name', 'Phone', 'Shop / Business', 'Period Sales', 'Period Collected', 'Current Debt Balance'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedCustomers.map((cust, idx) => (
                  <TableRow key={cust.id} hover>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{custPage * custRowsPerPage + idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{cust.name}</TableCell>
                    <TableCell>{cust.phone || '-'}</TableCell>
                    <TableCell>{cust.shop_name || '-'}</TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(cust.period_sales)}</TableCell>
                    <TableCell align="right" sx={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(cust.period_paid)}</TableCell>
                    <TableCell align="right" sx={{ color: cust.current_balance > 0 ? 'error.main' : 'inherit', fontWeight: 'bold' }}>{formatCurrency(cust.current_balance)}</TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No customers found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <UnifiedPagination
            count={filteredCustomers.length}
            page={custPage}
            rowsPerPage={custRowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setCustPage(p)}
            onRowsPerPageChange={(newR) => {
              setCustRowsPerPage(newR);
              setCustPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== PROFIT & LOSS TAB ====================
  const renderProfitLossTab = () => (
    <Fade in>
      <Box>
        {/* Quick Date Presets */}
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5 }}>
                QUICK FILTER:
              </Typography>
              <Chip label="Today" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPlFrom, setPlTo, 'today')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Yesterday" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPlFrom, setPlTo, 'yesterday')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 7 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPlFrom, setPlTo, '7d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="This Month" clickable size="small" color="primary" variant="filled" onClick={() => handleQuickDate(setPlFrom, setPlTo, 'month')} sx={{ fontWeight: 'bold' }} />
              <Chip label="Last 30 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPlFrom, setPlTo, '30d')} sx={{ fontWeight: 'bold' }} />
              <Chip label="This Year" clickable size="small" variant="outlined" onClick={() => {
                const now = new Date();
                setPlFrom(`${now.getFullYear()}-01-01`);
                setPlTo(`${now.getFullYear()}-12-31`);
              }} sx={{ fontWeight: 'bold' }} />
              <Chip label="All Time" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setPlFrom, setPlTo, 'all')} sx={{ fontWeight: 'bold' }} />
            </Box>

            <Stack direction="row" spacing={1}>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportPDF}
                sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download fontSize="small" />} 
                onClick={exportCurrentReportCSV}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>

          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" type="date" label="From" value={plFrom} onChange={(e) => setPlFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" type="date" label="To" value={plTo} onChange={(e) => setPlTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button fullWidth variant="outlined" size="small" startIcon={<Refresh />} onClick={loadProfitLoss} sx={{ height: 38, borderColor: '#10b981', color: '#10b981' }}>
                Refresh P&L
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* P&L Top Stat Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: isMobile ? 1 : 2,
          mb: 2
        }}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Revenue</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(plSummary.revenue)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cost of Goods (COGS)</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(plSummary.cogs)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Operating Expenses</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(plSummary.expenses)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Net Profit / Margin</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>
                {formatCurrency(plSummary.net)}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Detailed Statement Paper */}
        <Paper sx={{ p: isMobile ? 2 : 3, maxWidth: 800, mx: 'auto', border: '1px solid #e5e7eb', borderRadius: 2 }}>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color="primary">Comprehensive Statement of Profit & Loss</Typography>
            <Typography variant="caption" color="text.secondary">
              Period: {formatDate(plFrom)} to {formatDate(plTo)}
            </Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <Stack spacing={isMobile ? 1.5 : 2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #dcfce7' }}>
              <Box>
                <Typography fontWeight="bold" color="#047857">Gross Operating Revenue</Typography>
                <Typography variant="caption" color="text.secondary">All completed sales & invoices</Typography>
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#047857">+{formatCurrency(plSummary.revenue)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fee2e2' }}>
              <Box>
                <Typography fontWeight="bold" color="#dc2626">Cost of Goods Sold (COGS)</Typography>
                <Typography variant="caption" color="text.secondary">Actual purchase cost of items sold</Typography>
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#dc2626">-{formatCurrency(plSummary.cogs)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #dbeafe' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" color="#1d4ed8">Gross Operating Profit</Typography>
                <Typography variant="caption" color="text.secondary">Revenue minus Direct Item Costs</Typography>
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#1d4ed8">{formatCurrency(plSummary.gross)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fef3c7' }}>
              <Box>
                <Typography variant="body2" fontWeight="bold" color="#b45309">Operating Expenses</Typography>
                <Typography variant="caption" color="text.secondary">Rent, utilities, salaries, general</Typography>
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="#b45309">-{formatCurrency(plSummary.expenses)}</Typography>
            </Box>

            <Divider />

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              bgcolor: plSummary.net >= 0 ? '#10b981' : '#ef4444',
              color: 'white',
              borderRadius: 2,
              boxShadow: 2
            }}>
              <Box>
                <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">NET INCOME (PROFIT / LOSS)</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Final bottom-line earnings after all costs</Typography>
              </Box>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">{formatCurrency(plSummary.net)}</Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">Gross Margin %</Typography>
                  <Typography variant="h6" fontWeight="bold" color="#2563eb">{(plSummary.grossMargin || 0).toFixed(1)}%</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">Net Profit Margin %</Typography>
                  <Typography variant="h6" fontWeight="bold" color={plSummary.netMargin >= 0 ? 'success.main' : 'error.main'}>
                    {(plSummary.netMargin || 0).toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== STOCK TAB ====================
  const renderStockTab = () => (
    <Fade in>
      <Box>
        {/* Top Stock Valuation Summary Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: isMobile ? 1 : 2,
          mb: 2
        }}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Cost Valuation</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(stockValuationStats.totalCost)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Retail Valuation</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(stockValuationStats.totalRetail)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Potential Profit Margin</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(stockValuationStats.potentialProfit)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Units in Stock</Typography>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{stockValuationStats.totalQty} Units</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Search & Refresh Controls */}
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={5}>
              <TextField
                fullWidth
                size="small"
                label="Search Category"
                placeholder="Search category..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'gray', fontSize: 20 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={7} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={exportCurrentReportPDF}
                sx={{ height: 38, bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
              >
                Download PDF
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={exportCurrentReportCSV}
                sx={{ height: 38, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadStockAnalytics}
                size="small"
                sx={{ height: 38, borderColor: '#10b981', color: '#10b981' }}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={isMobile ? 1 : 2}>
          {/* Category Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb', height: '100%', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1f2937' }}>
                  Category Valuation Breakdown ({filteredStockValuation.length} categories)
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ maxHeight: 460, overflowY: 'auto', pr: 0.5 }}>
                {filteredStockValuation.map((cat, i) => (
                  <Card key={i} variant="outlined" sx={{ mb: 1.5, bgcolor: '#f9fafb', '&:hover': { bgcolor: '#f3f4f6' } }}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography fontWeight="bold" sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem' }}>{cat.category_name}</Typography>
                        <Chip size="small" label={`${cat.total_qty} units`} color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Box>
                      <Grid container spacing={1}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Cost Value</Typography>
                          <Typography variant="body2" fontWeight="bold" color="#475569">{formatCurrency(cat.stock_value_at_cost)}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Retail Value</Typography>
                          <Typography variant="body2" color="#059669" fontWeight="bold">{formatCurrency(cat.stock_value_at_retail)}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Potential Profit</Typography>
                          <Typography variant="body2" color="#2563eb" fontWeight="bold">{formatCurrency(cat.potential_profit)}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
                {filteredStockValuation.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                    No categories found
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Top Selling Products */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb', height: '100%', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1f2937' }}>
                  Top Moving Products
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip size="small" label="7 Days" clickable variant="outlined" onClick={() => handleQuickDate(setTopFrom, setTopTo, '7d')} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                  <Chip size="small" label="Month" clickable variant="outlined" onClick={() => handleQuickDate(setTopFrom, setTopTo, 'month')} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                  <Chip size="small" label="All" clickable variant="outlined" onClick={() => handleQuickDate(setTopFrom, setTopTo, 'all')} sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                </Box>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <TableContainer sx={{ maxHeight: 460 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['#', 'Product', 'Sold', 'Revenue'].map(h => (
                        <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topProducts.map((p, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>#{i + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{p.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.sku || '-'}</Typography>
                        </TableCell>
                        <TableCell align="right" fontWeight="bold" sx={{ color: '#047857' }}>{p.total_sold} units</TableCell>
                        <TableCell align="right" fontWeight="bold" sx={{ color: '#2563eb' }}>{formatCurrency(p.total_revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {topProducts.length === 0 && (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales data for this period</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );

  // ==================== EXPENSES TAB ====================
  const renderExpensesTab = () => {
    const expenseCategories = Array.from(new Set(expenseData.map(e => e.category_name || 'General Expense')));
    const expensePaymentModes = Array.from(new Set(expenseData.map(e => e.payment_mode).filter(Boolean)));

    return (
      <Fade in>
        <Box>
          {/* Quick Date Presets */}
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mr: 0.5 }}>
                  QUICK FILTER:
                </Typography>
                <Chip label="Today" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setExpFrom, setExpTo, 'today')} sx={{ fontWeight: 'bold' }} />
                <Chip label="Yesterday" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setExpFrom, setExpTo, 'yesterday')} sx={{ fontWeight: 'bold' }} />
                <Chip label="Last 7 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setExpFrom, setExpTo, '7d')} sx={{ fontWeight: 'bold' }} />
                <Chip label="This Month" clickable size="small" color="primary" variant="filled" onClick={() => handleQuickDate(setExpFrom, setExpTo, 'month')} sx={{ fontWeight: 'bold' }} />
                <Chip label="Last 30 Days" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setExpFrom, setExpTo, '30d')} sx={{ fontWeight: 'bold' }} />
                <Chip label="All Time" clickable size="small" variant="outlined" onClick={() => handleQuickDate(setExpFrom, setExpTo, 'all')} sx={{ fontWeight: 'bold' }} />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<Download fontSize="small" />} 
                  onClick={exportCurrentReportPDF}
                  sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#fff', fontWeight: 'bold' }}
                >
                  Download PDF
                </Button>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<Download fontSize="small" />} 
                  onClick={exportCurrentReportCSV}
                  sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#fff', fontWeight: 'bold' }}
                >
                  Export CSV
                </Button>
              </Stack>
            </Box>

            <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
              <Grid item xs={6} md={2}>
                <TextField fullWidth size="small" type="date" label="From" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth size="small" type="date" label="To" value={expTo} onChange={(e) => setExpTo(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select value={expCategoryFilter} onChange={(e) => { setExpCategoryFilter(e.target.value); setExpPage(0); }} label="Category">
                    <MenuItem value="all">All Categories</MenuItem>
                    {expenseCategories.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select value={expPaymentFilter} onChange={(e) => { setExpPaymentFilter(e.target.value); setExpPage(0); }} label="Payment Mode">
                    <MenuItem value="all">All Modes</MenuItem>
                    {expensePaymentModes.map(mode => (
                      <MenuItem key={mode} value={mode}>{String(mode).toUpperCase()}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Search Expenses"
                  placeholder="Search expense description..." 
                  value={expSearch} 
                  onChange={(e) => { setExpSearch(e.target.value); setExpPage(0); }} 
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} 
                />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <Button fullWidth variant="outlined" size="small" startIcon={<Refresh />} onClick={loadExpenses} sx={{ height: 38, borderColor: '#ef4444', color: '#ef4444' }}>
                  {isMobile ? 'Refresh' : 'Refresh'}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Expenses Top Summary Cards */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: isMobile ? 1 : 2,
            mb: 2
          }}>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Expenses</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(expenseStats.total)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Transactions Count</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{expenseStats.count}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Avg Expense / Entry</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(expenseStats.average)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Active Categories</Typography>
                <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{expenseSummary.length}</Typography>
              </CardContent>
            </Card>
          </Box>

          <Grid container spacing={isMobile ? 1 : 2}>
            {/* Expense Distribution Column */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, border: '1px solid #e5e7eb', height: '100%', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1f2937', mb: 1 }}>
                  Category Breakdown
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ maxHeight: 460, overflowY: 'auto' }}>
                  {expenseSummary.map((exp, i) => (
                    <Card key={i} sx={{ mb: 1.5, borderLeft: '4px solid #1c2580', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <CardContent sx={{ p: isMobile ? 1.5 : 1.75, '&:last-child': { pb: isMobile ? 1.5 : 1.75 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography fontWeight="bold" sx={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }}>{exp.category}</Typography>
                          <Typography variant="caption" color="text.secondary">{exp.count} entries</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography fontWeight="bold" color="error.main" sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem' }}>{formatCurrency(exp.total)}</Typography>
                          <Typography variant="caption" sx={{ bgcolor: '#fef3c7', px: 1, py: 0.25, borderRadius: 1, fontWeight: 'bold' }}>{(exp.percentage || 0).toFixed(1)}%</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                  {expenseSummary.length === 0 && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                      No expenses recorded
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Detailed Expense Ledger Table */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                <TableContainer sx={{ maxHeight: 460 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['#', 'Date', 'Category', 'Description', 'Payment Mode', 'Amount'].map(h => (
                          <TableCell key={h} sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedExpenses.map((e, idx) => (
                        <TableRow key={e.id || idx} hover>
                          <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{expPage * expRowsPerPage + idx + 1}</TableCell>
                          <TableCell sx={{ fontSize: isMobile ? '0.65rem' : '0.8rem' }}>{formatDate(e.date)}</TableCell>
                          <TableCell><Chip label={e.category_name || 'General'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} /></TableCell>
                          <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || e.title || '-'}</TableCell>
                          <TableCell><Chip label={String(e.payment_mode || 'Cash').toUpperCase()} size="small" sx={{ height: 18, fontSize: '0.6rem' }} /></TableCell>
                          <TableCell align="right" fontWeight="bold" sx={{ color: 'error.main' }}>{formatCurrency(e.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredExpenses.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No expense transactions found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <UnifiedPagination
                  count={filteredExpenses.length}
                  page={expPage}
                  rowsPerPage={expRowsPerPage}
                  isZeroBased={true}
                  onPageChange={(e, p) => setExpPage(p)}
                  onRowsPerPageChange={(newR) => {
                    setExpRowsPerPage(newR);
                    setExpPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    );
  };

  // ==================== HANDLE ENTRY SAVE ====================
  const handleEntrySave = (data) => {
    const type = entryDialog.mode === 'add' ? 'add' : 'edit';
    const handlers = {
      forecast: type === 'add' ? handleAddForecast : handleEditForecast,
      sale: type === 'add' ? handleAddSale : handleEditSale,
      supplier: type === 'add' ? handleAddSupplier : handleEditSupplier,
      customer: type === 'add' ? handleAddCustomer : handleEditCustomer,
      expense: type === 'add' ? handleAddExpense : handleEditExpense,
    };
    const handler = handlers[entryDialog.type] || handlers.forecast;
    handler(data);
  };

  // ==================== HANDLE CONFIRM DELETE ====================
  const handleConfirmDelete = () => {
    const { data, type } = confirmDialog;
    const handlers = {
      forecast: handleDeleteForecast,
      sale: handleDeleteSale,
      supplier: handleDeleteSupplier,
      customer: handleDeleteCustomer,
      expense: handleDeleteExpense,
    };
    const handler = handlers[type] || handlers.forecast;
    handler(data);
  };

  // ==================== GET ENTRY FIELDS ====================
  const getEntryFields = () => {
    const type = entryDialog.type || 'forecast';
    const fieldMap = {
      forecast: getForecastFields,
      sale: getSaleFields,
      supplier: getSupplierFields,
      customer: getCustomerFields,
      expense: getExpenseFields,
    };
    return (fieldMap[type] || getForecastFields)();
  };

  // ==================== GET ENTRY TITLE ====================
  const getEntryTitle = () => {
    const type = entryDialog.type || 'forecast';
    const titleMap = {
      forecast: 'Product Variant',
      sale: 'Sale',
      supplier: 'Supplier',
      customer: 'Customer',
      expense: 'Expense',
    };
    return titleMap[type] || 'Entry';
  };

  // ==================== MAIN RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <Assessment sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Reports Center' : 'Enterprise Analytical Control Center'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap', gap: 0.5 }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button 
            variant="contained" 
            size="small" 
            startIcon={<Download />} 
            onClick={exportCurrentReportPDF}
            sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151d66' }, color: '#ffffff', fontWeight: 'bold' }}
          >
            Export PDF
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            startIcon={<Download />} 
            onClick={exportCurrentReportCSV}
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, color: '#ffffff', fontWeight: 'bold' }}
          >
            Export CSV
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<Print />} 
            onClick={handlePrintReport}
            sx={{ borderColor: '#64748b', color: '#475569', fontWeight: 'bold' }}
          >
            Print
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 'bold' }} 
            startIcon={<Refresh />} 
            onClick={handleSyncActiveReport}
          >
            {isMobile ? 'Sync' : 'Sync Engine'}
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* TABS */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<Timeline fontSize="small" />} 
            label={isMobile ? 'Forecast' : 'Velocity Forecast'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<PointOfSale fontSize="small" />} 
            label={isMobile ? 'Sales' : 'Sales Analysis'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<LocalShipping fontSize="small" />} 
            label={isMobile ? 'Suppliers' : 'Suppliers Ledger'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<People fontSize="small" />} 
            label={isMobile ? 'Customers' : 'Customers Debt'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<ShowChart fontSize="small" />} 
            label={isMobile ? 'P&L' : 'Profit & Loss'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Inventory fontSize="small" />} 
            label={isMobile ? 'Stock' : 'Stock Valuation'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<MoneyOff fontSize="small" />} 
            label={isMobile ? 'Expenses' : 'Expense Ledger'} 
            sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* TAB CONTENT */}
      {renderTabContent()}

      {/* ==================== ENTRY DIALOG ==================== */}
      <EntryDialog
        open={entryDialog.open}
        onClose={() => setEntryDialog({ open: false, mode: 'add', data: null })}
        onSave={handleEntrySave}
        title={getEntryTitle()}
        fields={getEntryFields()}
        initialData={entryDialog.mode === 'edit' ? entryDialog.data : null}
        isEdit={entryDialog.mode === 'edit'}
      />

      {/* ==================== CONFIRM DELETE DIALOG ==================== */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, data: null, type: '' })}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${confirmDialog.type || 'item'}? This action cannot be undone.`}
      />

      {/* ==================== DETAIL DIALOG ==================== */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#1c2580', color: 'white', fontWeight: 'bold' }}>
          Asset Audit: {selectedProduct?.product_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedProduct && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3, textAlign: 'center' }}>
                <Grid item xs={6} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Total Sold</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{productHistory.summary.total_sold || 0} units</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Revenue</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(productHistory.summary.total_revenue)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>Profit</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1c2580', mt: 0.5 }}>{formatCurrency(productHistory.summary.total_profit)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>Sales History</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Invoice</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Qty</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Price</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productHistory.sales?.map((s, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontSize: isMobile ? '0.65rem' : '0.78rem' }}>{formatDate(s.date)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{s.invoice_no}</TableCell>
                        <TableCell>{s.customer_name}</TableCell>
                        <TableCell align="right">{s.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(s.price)}</TableCell>
                        <TableCell align="right" fontWeight="bold">{formatCurrency(s.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== MOBILE DRAWER ==================== */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Reports Menu</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(0); }}>
              <ListItemIcon><Timeline /></ListItemIcon>
              <ListItemText primary="Forecast" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(1); }}>
              <ListItemIcon><PointOfSale /></ListItemIcon>
              <ListItemText primary="Sales" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(2); }}>
              <ListItemIcon><LocalShipping /></ListItemIcon>
              <ListItemText primary="Suppliers" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(3); }}>
              <ListItemIcon><People /></ListItemIcon>
              <ListItemText primary="Customers" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(4); }}>
              <ListItemIcon><ShowChart /></ListItemIcon>
              <ListItemText primary="P&L" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(5); }}>
              <ListItemIcon><Inventory /></ListItemIcon>
              <ListItemText primary="Stock" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setActiveTab(6); }}>
              <ListItemIcon><MoneyOff /></ListItemIcon>
              <ListItemText primary="Expenses" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* ==================== FAB BUTTON ==================== */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }}
          onClick={() => loadForecasting()}
        >
          <Refresh />
        </Fab>
      )}

      {/* ==================== SNACKBAR ==================== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}