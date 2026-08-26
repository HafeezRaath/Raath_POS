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
} from '@mui/material';
import {
  Search, Refresh, Visibility, Assessment, Timeline, PointOfSale,
  LocalShipping, People, ShowChart, Inventory, MoneyOff, Warning, Error,
  CheckCircle, AccessTime, RemoveShoppingCart, Speed, TrendingDown,
  Menu as MenuIcon, Close, ArrowUpward, ArrowDownward, Receipt,
  TrendingUp, AccountBalance, Store, Person, AttachMoney, Add,
  Edit, Delete, Save, Cancel, Print, Download, FilterList,
  MoreVert, Done, Clear, PostAdd, AddCircle, RemoveCircle
} from '@mui/icons-material';
import db from '../database/db';

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
const MobileForecastCard = ({ item, onView, onEdit, onDelete }) => {
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
            onClick={() => onView(item)}
            sx={{ flex: 1, bgcolor: '#10b981' }}
          >
            View
          </Button>
          <IconButton size="small" color="primary" onClick={() => onEdit(item)}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(item)}>
            <Delete fontSize="small" />
          </IconButton>
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

  // ==================== PURCHASE / SUPPLIER STATES ====================
  const [purchaseData, setPurchaseData] = useState([]);
  const [supplierSummary, setSupplierSummary] = useState([]);
  const [purchaseFrom, setPurchaseFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [purchaseTo, setPurchaseTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [supSearch, setSupSearch] = useState('');

  // ==================== CUSTOMER STATES ====================
  const [customerData, setCustomerData] = useState([]);
  const [customerFrom, setCustomerFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [customerTo, setCustomerTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [custSearch, setCustSearch] = useState('');

  // ==================== PROFIT & LOSS STATES ====================
  const [plFrom, setPlFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [plTo, setPlTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [plSummary, setPlSummary] = useState({ revenue: 0, cogs: 0, expenses: 0, gross: 0, net: 0, grossMargin: 0, netMargin: 0 });

  // ==================== STOCK / INVENTORY STATES ====================
  const [stockValuation, setStockValuation] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topFrom, setTopFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [topTo, setTopTo] = useState(() => new Date().toISOString().split('T')[0]);

  // ==================== EXPENSE STATES ====================
  const [expenseData, setExpenseData] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState([]);
  const [expFrom, setExpFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [expTo, setExpTo] = useState(() => new Date().toISOString().split('T')[0]);

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
      const periodStartStr = periodStart.toISOString().split('T')[0];

      const allSales = await db.getSalesHistory().catch(() => []);
      const periodSales = allSales.filter(s => {
        if (s.is_deleted) return false;
        return String(s.date || '').substring(0, 10) >= periodStartStr;
      });

      const saleItemsArrays = await Promise.all(periodSales.map(s => db.getSaleItems(s.id).catch(() => [])));
      const allSaleItems = saleItemsArrays.flat();

      const variantSales = {};
      const variantRevenue = {};
      const lastSaleDates = {};

      allSaleItems.forEach(item => {
        const vid = Number(item.product_variant_id);
        if (!variantSales[vid]) { variantSales[vid] = 0; variantRevenue[vid] = 0; }
        variantSales[vid] += (Number(item.quantity) || Number(item.qty) || 0);
        variantRevenue[vid] += (Number(item.total) || 0);

        const sale = periodSales.find(s => s.id === item.sale_id);
        if (sale?.date) {
          if (!lastSaleDates[vid] || sale.date > lastSaleDates[vid]) lastSaleDates[vid] = sale.date;
        }
      });

      const enriched = variants.map(v => {
        const variantId = Number(v.id);
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
      let filtered = allSales.filter(s => {
        if (s.is_deleted) return false;
        const sd = String(s.date || '').substring(0, 10);
        return sd >= salesFrom && sd <= salesTo;
      });

      if (salesPaymentMode !== 'all') filtered = filtered.filter(s => s.payment_mode === salesPaymentMode);

      const enriched = await Promise.all(filtered.map(async s => {
        const items = await db.getSaleItems(s.id).catch(() => []);
        return {
          ...s,
          total_items: items.length,
          total_qty: items.reduce((sum, i) => sum + (Number(i.quantity) || Number(i.qty) || 0), 0),
          total_cost: items.reduce((sum, i) => sum + ((Number(i.quantity) || Number(i.qty) || 0) * (Number(i.unit_cost) || Number(i.purchase_price) || 0)), 0),
          items: items
        };
      }));

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
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading sales: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  const loadPurchaseReport = async () => {
    setLoading(true);
    try {
      const allPurchases = await db.getPurchases().catch(() => []);
      const filtered = allPurchases.filter(p => {
        if (p.is_deleted) return false;
        const pd = String(p.purchase_date || '').substring(0, 10);
        return pd >= purchaseFrom && pd <= purchaseTo;
      });
      setPurchaseData(filtered);

      const allSuppliers = await db.getSuppliers().catch(() => []);
      const summary = allSuppliers.map(s => {
        const supPurchases = filtered.filter(p => p.supplier_id === s.id);
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
      const periodSales = allSales.filter(s => !s.is_deleted && String(s.date || '').substring(0, 10) >= customerFrom && String(s.date || '').substring(0, 10) <= customerTo);

      const data = allCustomers.map(c => {
        const custPeriodSales = periodSales.filter(s => s.customer_id === c.id);
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
      const periodSales = allSales.filter(s => !s.is_deleted && String(s.date || '').substring(0, 10) >= plFrom && String(s.date || '').substring(0, 10) <= plTo);

      const revenue = periodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);
      let cogs = 0;

      for (const sale of periodSales) {
        const items = await db.getSaleItems(sale.id).catch(() => []);
        for (const item of items) {
          cogs += (Number(item.quantity) || Number(item.qty) || 0) * (Number(item.unit_cost) || Number(item.purchase_price) || 0);
        }
      }

      const allExpenses = await db.getExpenses().catch(() => []);
      const periodExpenses = allExpenses.filter(e => !e.is_deleted && String(e.date || '').substring(0, 10) >= plFrom && String(e.date || '').substring(0, 10) <= plTo);
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
      allProducts.forEach(p => productMap[Number(p.id)] = p);

      const categoryMap = {};
      allVariants.forEach(v => {
        const product = productMap[Number(v.product_id)];
        const catName = product?.category_name || 'Uncategorized';
        if (!categoryMap[catName]) {
          categoryMap[catName] = { category_name: catName, variant_count: 0, total_qty: 0, stock_value_at_cost: 0, stock_value_at_retail: 0, potential_profit: 0 };
        }
        const stock = Number(v.current_stock) || 0;
        categoryMap[catName].variant_count++;
        categoryMap[catName].total_qty += stock;
        categoryMap[catName].stock_value_at_cost += stock * (Number(v.purchase_price) || 0);
        categoryMap[catName].stock_value_at_retail += stock * (Number(v.retail_price) || 0);
        categoryMap[catName].potential_profit += stock * ((Number(v.retail_price) || 0) - (Number(v.purchase_price) || 0));
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
      const filtered = allExpenses.filter(e => !e.is_deleted && String(e.date || '').substring(0, 10) >= expFrom && String(e.date || '').substring(0, 10) <= expTo);
      setExpenseData(filtered);

      const catMap = {};
      filtered.forEach(e => {
        const cat = e.category_name || 'General Expense';
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

      const salesWithItems = await Promise.all(allSales.filter(s => !s.is_deleted).map(async s => {
        const items = await db.getSaleItems(s.id).catch(() => []);
        return { ...s, items: items.filter(i => Number(i.product_variant_id) === Number(product.id)) };
      }));

      const purchaseItemsArrays = await Promise.all(allPurchases.filter(p => !p.is_deleted).map(async p => {
        const items = await db.getPurchaseItems(p.id).catch(() => []);
        return { ...p, items: items.filter(i => Number(i.product_variant_id) === Number(product.id)) };
      }));

      const salesHistory = salesWithItems.filter(s => s.items.length > 0).flatMap(s => s.items.map(item => ({
        invoice_no: s.invoice_no, date: s.date, quantity: Number(item.quantity) || Number(item.qty) || 0,
        price: item.price, total: item.total, customer_name: s.customer_name || 'Walk-in',
        total_profit: ((Number(item.price) || 0) - (Number(item.unit_cost) || Number(item.purchase_price) || 0)) * (Number(item.quantity) || Number(item.qty) || 0)
      }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

      const purchaseHistory = purchaseItemsArrays.filter(p => p.items.length > 0).flatMap(p => p.items.map(item => ({
        purchase_no: p.purchase_no, purchase_date: p.purchase_date, supplier_name: p.supplier_name || '-',
        quantity: item.quantity, purchase_price: item.purchase_price, sub_total: item.sub_total
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

  useEffect(() => {
    if (activeTab === 0) loadForecasting();
    else if (activeTab === 1) loadSalesReport();
    else if (activeTab === 2) loadPurchaseReport();
    else if (activeTab === 3) loadCustomerReport();
    else if (activeTab === 4) loadProfitLoss();
    else if (activeTab === 5) loadStockAnalytics();
    else if (activeTab === 6) loadExpenses();
  }, [activeTab]);

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

  const filteredSuppliers = supplierSummary.filter(s => s.name?.toLowerCase().includes(supSearch.toLowerCase()) || s.company_name?.toLowerCase().includes(supSearch.toLowerCase()));
  const filteredCustomers = customerData.filter(c => c.name?.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch));

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
        <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
          {[
            { title: 'Critical Low', value: forecastStats.criticalLow, color: 'error' },
            { title: 'Low Stock', value: forecastStats.lowStock, color: 'warning' },
            { title: 'Out of Stock', value: forecastStats.outOfStock, color: 'error' },
            { title: 'Over Stock', value: forecastStats.overStock, color: 'warning' },
            { title: 'Optimal', value: forecastStats.ok, color: 'success' }
          ].map((stat, i) => (
            <Grid item xs={6} md={2.4} key={i}>
              <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main` }}>
                <CardContent sx={{ p: isMobile ? 1 : 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.55rem' : '0.75rem' }}>{stat.title}</Typography>
                  <Typography variant="h6" fontWeight="bold">{stat.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" placeholder="Search products..." value={fcSearch} onChange={(e) => setFcSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
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
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setFcSearch(''); setFcStatus('all'); }}>Clear</Button>
            </Grid>
            <Grid item xs={6} md={2}>
             
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
                onView={handleViewDetail}
                onEdit={() => setEntryDialog({ open: true, mode: 'edit', data: v })}
                onDelete={() => setConfirmDialog({ open: true, data: v, type: 'forecast' })}
              />
            ))}
            {paginatedForecast.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Timeline sx={{ fontSize: 48, color: '#d1d5db' }} />
                <Typography color="text.secondary">No products found</Typography>
              </Paper>
            )}
            <TablePagination
              component="div"
              count={filteredForecast.length}
              page={fcPage}
              onPageChange={(e, p) => setFcPage(p)}
              rowsPerPage={fcRowsPerPage}
              onRowsPerPageChange={(e) => setFcRowsPerPage(parseInt(e.target.value, 10))}
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
                    {['Product', 'SKU', 'Stock', 'Sold', 'Velocity', 'Days Left', 'Status', 'Order', 'Value', 'Actions'].map(h => (
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
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <IconButton size="small" color="primary" onClick={() => handleViewDetail(v)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="info" onClick={() => setEntryDialog({ open: true, mode: 'edit', data: v })}>
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setConfirmDialog({ open: true, data: v, type: 'forecast' })}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredForecast.length}
              page={fcPage}
              onPageChange={(e, p) => setFcPage(p)}
              rowsPerPage={fcRowsPerPage}
              onRowsPerPageChange={(e) => setFcRowsPerPage(parseInt(e.target.value, 10))}
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
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select value={salesPaymentMode} onChange={(e) => setSalesPaymentMode(e.target.value)} label="Payment Mode">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="credit">Credit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
                </Grid>
            <Grid item xs={12} md={2}>
             
            </Grid>
          </Grid>
        </Paper>

        {!isMobile && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: '#f0fdf4' }}>
                <CardContent><Typography variant="caption">Total Revenue</Typography>
                  <Typography variant="h5" fontWeight="bold" color="green">{formatCurrency(salesSummary.total_sales)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card><CardContent><Typography variant="caption">Gross Profit</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary">{formatCurrency(salesSummary.gross_profit)}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card><CardContent><Typography variant="caption">Receivable</Typography>
                <Typography variant="h5" fontWeight="bold" color="error">{formatCurrency(salesSummary.total_due)}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card><CardContent><Typography variant="caption">Bills</Typography>
                <Typography variant="h5" fontWeight="bold">{salesSummary.total_bills || 0}</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>
        )}

        <Paper sx={{ border: '1px solid #e5e7eb' }}>
          <TableContainer sx={{ maxHeight: isMobile ? 'calc(100vh - 350px)' : 'calc(100vh - 360px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Invoice', 'Date', 'Customer', 'Qty', 'Total', 'Paid', 'Due', 'Mode', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold', fontSize: isMobile ? '0.6rem' : '0.75rem' }}>{h}</TableCell>
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
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" color="info" onClick={() => setEntryDialog({ open: true, mode: 'edit', data: sale })}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDialog({ open: true, data: sale, type: 'sale' })}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={salesData.length}
            page={salesPage}
            onPageChange={(e, p) => setSalesPage(p)}
            rowsPerPage={salesRowsPerPage}
            onRowsPerPageChange={(e) => setSalesRowsPerPage(parseInt(e.target.value, 10))}
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
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={purchaseFrom} onChange={(e) => setPurchaseFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={purchaseTo} onChange={(e) => setPurchaseTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={2}>
                </Grid>
            <Grid item xs={6} md={2}>
             
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" placeholder="Search suppliers..." value={supSearch} onChange={(e) => setSupSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} />
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ border: '1px solid #e5e7eb' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Supplier', 'Company', 'Contact', 'Bills', 'Total', 'Paid', 'Payable', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#0284c7', color: 'white', fontWeight: 'bold', fontSize: isMobile ? '0.6rem' : '0.75rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSuppliers.map(sup => (
                  <TableRow key={sup.id} hover>
                    <TableCell fontWeight="bold">{sup.name}</TableCell>
                    <TableCell>{sup.company_name || '-'}</TableCell>
                    <TableCell>{sup.phone || '-'}</TableCell>
                    <TableCell align="center">{sup.bill_count}</TableCell>
                    <TableCell align="right">{formatCurrency(sup.total_purchases)}</TableCell>
                    <TableCell align="right" color="success.main">{formatCurrency(sup.total_paid)}</TableCell>
                    <TableCell align="right" color={sup.current_balance > 0 ? 'error.main' : 'inherit'} fontWeight="bold">{formatCurrency(sup.current_balance)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" color="info" onClick={() => setEntryDialog({ open: true, mode: 'edit', data: sup })}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDialog({ open: true, data: sup, type: 'supplier' })}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== CUSTOMERS TAB ====================
  const renderCustomersTab = () => (
    <Fade in>
      <Box>
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={customerFrom} onChange={(e) => setCustomerFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={5} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={customerTo} onChange={(e) => setCustomerTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={2}>
             </Grid>
            <Grid item xs={6} md={2}>
          
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" placeholder="Search customers..." value={custSearch} onChange={(e) => setCustSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} />
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ border: '1px solid #e5e7eb' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Customer', 'Phone', 'Shop', 'Period Sales', 'Period Paid', 'Balance', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: isMobile ? '0.6rem' : '0.75rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.map(cust => (
                  <TableRow key={cust.id} hover>
                    <TableCell fontWeight="bold">{cust.name}</TableCell>
                    <TableCell>{cust.phone || '-'}</TableCell>
                    <TableCell>{cust.shop_name || '-'}</TableCell>
                    <TableCell align="right">{formatCurrency(cust.period_sales)}</TableCell>
                    <TableCell align="right" color="success.main">{formatCurrency(cust.period_paid)}</TableCell>
                    <TableCell align="right" color={cust.current_balance > 0 ? 'error.main' : 'inherit'} fontWeight="bold">{formatCurrency(cust.current_balance)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" color="info" onClick={() => setEntryDialog({ open: true, mode: 'edit', data: cust })}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDialog({ open: true, data: cust, type: 'customer' })}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Fade>
  );

  // ==================== PROFIT & LOSS TAB ====================
  const renderProfitLossTab = () => (
    <Fade in>
      <Box>
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={5} md={3}>
              <TextField fullWidth size="small" type="date" label="From" value={plFrom} onChange={(e) => setPlFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={5} md={3}>
              <TextField fullWidth size="small" type="date" label="To" value={plTo} onChange={(e) => setPlTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
               </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: isMobile ? 2 : 3, maxWidth: 800, mx: 'auto', border: '1px solid #e5e7eb' }}>
          <Typography variant={isMobile ? 'h6' : 'h6'} align="center" fontWeight="bold" color="primary" gutterBottom>Profit & Loss Statement</Typography>
          <Typography variant="caption" align="center" display="block" color="text.secondary" sx={{ mb: 3 }}>
            {formatDate(plFrom)} to {formatDate(plTo)}
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Stack spacing={isMobile ? 1.5 : 2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1 }}>
              <Typography fontWeight="bold" color="green">Revenue</Typography>
              <Typography fontWeight="bold" color="green">{formatCurrency(plSummary.revenue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fef2f2', borderRadius: 1 }}>
              <Typography fontWeight="bold" color="red">COGS</Typography>
              <Typography fontWeight="bold" color="red">-{formatCurrency(plSummary.cogs)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#eff6ff', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">Gross Profit</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{formatCurrency(plSummary.gross)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fffbeb', borderRadius: 1 }}>
              <Typography variant="body2">Expenses</Typography>
              <Typography variant="body2">-{formatCurrency(plSummary.expenses)}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: plSummary.net >= 0 ? '#10b981' : '#ef4444', color: 'white', borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold">NET INCOME</Typography>
              <Typography variant="h6" fontWeight="bold">{formatCurrency(plSummary.net)}</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f3f4f6', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Gross Margin</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{plSummary.grossMargin.toFixed(1)}%</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f3f4f6', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Net Margin</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" color={plSummary.netMargin >= 0 ? 'success.main' : 'error.main'}>{plSummary.netMargin.toFixed(1)}%</Typography>
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
      <Grid container spacing={isMobile ? 1 : 2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Category Distribution</Typography>
          <Divider sx={{ mb: 1.5 }} />
          {stockValuation.map((cat, i) => (
            <Card key={i} variant="outlined" sx={{ mb: 1.5, bgcolor: '#f9fafb' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography fontWeight="bold">{cat.category_name}</Typography>
                  <Chip size="small" label={`${cat.total_qty} units`} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Cost</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(cat.stock_value_at_cost)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Retail</Typography>
                    <Typography variant="body2" color="green" fontWeight="bold">{formatCurrency(cat.stock_value_at_retail)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Profit</Typography>
                    <Typography variant="body2" color="primary.main" fontWeight="bold">{formatCurrency(cat.potential_profit)}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Top Products</Typography>
          <Divider sx={{ mb: 1.5 }} />
          <Paper sx={{ border: '1px solid #e5e7eb' }}>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f9fafb' }}>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Sold</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">{p.product_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.sku}</Typography>
                      </TableCell>
                      <TableCell align="right" fontWeight="bold">{p.total_sold} units</TableCell>
                      <TableCell align="right" color="success.main" fontWeight="bold">{formatCurrency(p.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Fade>
  );

  // ==================== EXPENSES TAB ====================
  const renderExpensesTab = () => (
    <Fade in>
      <Grid container spacing={isMobile ? 1 : 2}>
        <Grid item xs={12} md={5}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Expense Distribution</Typography>
          <Divider sx={{ mb: 1.5 }} />
          {expenseSummary.map((exp, i) => (
            <Card key={i} sx={{ mb: 1.5, borderLeft: '4px solid #f59e0b' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight="bold">{exp.category}</Typography>
                  <Typography variant="caption" color="text.secondary">{exp.count} transactions</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography fontWeight="bold" color="error.main">{formatCurrency(exp.total)}</Typography>
                  <Typography variant="caption" sx={{ bgcolor: '#fef3c7', px: 1, borderRadius: 1 }}>{exp.percentage.toFixed(1)}%</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={4}><TextField fullWidth size="small" type="date" label="From" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={4}><TextField fullWidth size="small" type="date" label="To" value={expTo} onChange={(e) => setExpTo(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={4}>
                <Button fullWidth variant="outlined" size="small" onClick={loadExpenses}><Refresh /></Button>
              </Grid>
            </Grid>
          </Paper>

          

          <Paper sx={{ border: '1px solid #e5e7eb' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Date', 'Category', 'Description', 'Mode', 'Amount', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: isMobile ? '0.6rem' : '0.75rem' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expenseData.map(e => (
                    <TableRow key={e.id} hover>
                      <TableCell sx={{ fontSize: isMobile ? '0.65rem' : '0.8rem' }}>{formatDate(e.date)}</TableCell>
                      <TableCell><Chip label={e.category_name || 'General'} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.5rem' }} /></TableCell>
                      <TableCell>{e.description || '-'}</TableCell>
                      <TableCell>{String(e.payment_mode || 'Cash').toUpperCase()}</TableCell>
                      <TableCell align="right" fontWeight="bold" color="error.main">{formatCurrency(e.amount)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton size="small" color="info" onClick={() => setEntryDialog({ open: true, mode: 'edit', data: e })}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setConfirmDialog({ open: true, data: e, type: 'expense' })}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Fade>
  );

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
          {isMobile ? 'Reports' : 'Enterprise Analytical Control Center'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={() => loadForecasting()}>
            {isMobile ? 'Sync' : 'Force Sync Engine'}
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

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
            icon={<Timeline fontSize="small" />} 
            label={isMobile ? 'Forecast' : 'Velocity Forecast'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<PointOfSale fontSize="small" />} 
            label={isMobile ? 'Sales' : 'Sales Analysis'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<LocalShipping fontSize="small" />} 
            label={isMobile ? 'Suppliers' : 'Suppliers Ledger'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<People fontSize="small" />} 
            label={isMobile ? 'Customers' : 'Customers Debt'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<ShowChart fontSize="small" />} 
            label={isMobile ? 'P&L' : 'Profit & Loss'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Inventory fontSize="small" />} 
            label={isMobile ? 'Stock' : 'Stock Valuation'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<MoneyOff fontSize="small" />} 
            label={isMobile ? 'Expenses' : 'Expense Ledger'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
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
        <DialogTitle sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#10b981', color: 'white' }}>
          Asset Audit: {selectedProduct?.product_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedProduct && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3, textAlign: 'center' }}>
                <Grid item xs={6} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Total Sold</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">{productHistory.summary.total_sold || 0} units</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Revenue</Typography>
                    <Typography variant="h6" fontWeight="bold" color="green">{formatCurrency(productHistory.summary.total_revenue)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Profit</Typography>
                    <Typography variant="h6" fontWeight="bold" color="green">{formatCurrency(productHistory.summary.total_profit)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" fontWeight="bold" color="secondary" gutterBottom>Sales History</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Total</TableCell>
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