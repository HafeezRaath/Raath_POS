import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab, Pagination,
  Snackbar, Alert, Avatar, Tooltip, Divider, InputAdornment,
  List, ListItem, ListItemText, ListItemIcon, Badge, LinearProgress,
  useMediaQuery, useTheme, Drawer, Collapse, Fab,
  TablePagination, Checkbox, FormControlLabel
} from '../components/ui/tailwind-mui';
import {
  Search, Refresh, Close, Receipt, PointOfSale, LocalShipping,
  Payment, AccountBalance, TrendingUp, TrendingDown, Warning,
  CheckCircle, Error, History as HistoryIcon, Person, Phone,
  LocationOn, Print, Download, ArrowBack, ArrowForward,
  MonetizationOn, CreditCard, MoneyOff, CalendarToday, ExpandMore,
  Inventory, Category, AttachMoney, Restore, DoneAll,
  Cancel, Pending, Schedule, DeleteOutline, Edit,
  Menu as MenuIcon, Add, Save, Delete, Clear, Visibility, FilterList
} from '../components/ui/icons';
import db from '../database/db';
import { printReceiptDirect, getEffectiveReceiptSettings } from '../utils/receiptGenerator';
import UnifiedPagination from '../components/common/UnifiedPagination';
// ==================== ISLAMABAD / LOCAL TIME ====================
const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalISOString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

// ==================== FIXED DATE FUNCTIONS ====================

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    // ISO string se direct date extract karo - timezone shift avoid karne ke liye
    if (typeof dateStr === 'string') {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
      if (match) {
        const [, year, month, day, hour, minute] = match;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthName = monthNames[parseInt(month, 10) - 1];
        if (hour !== undefined) {
          // AM/PM format mein convert karo
          let h = parseInt(hour, 10);
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12;
          h = h ? h : 12; // hour 0 = 12 AM
          return `${day} ${monthName} ${year}, ${h}:${minute} ${ampm}`;
        }
        return `${day} ${monthName} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return dateStr; }
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    // ISO string se direct date extract karo - timezone shift avoid karne ke liye
    if (typeof dateStr === 'string') {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${day} ${monthNames[parseInt(month, 10) - 1]}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { 
      day: '2-digit', month: 'short' 
    });
  } catch { return dateStr; }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

// ==================== ENTRY DIALOG ====================
// ==================== ENTRY DIALOG ====================
const EntryDialog = ({ open, onClose, onSave, title, fields, initialData, isEdit }) => {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState({});
  
  // NEW: Items state for sales/purchases
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      if (initialData._items) setItems(initialData._items);
      else setItems([]);
    } else {
      const defaults = {};
      fields.forEach(f => {
        if (f.type === 'date') defaults[f.name] = getLocalDateStr();
        else if (f.type === 'select') defaults[f.name] = f.options?.[0]?.value || '';
        else if (f.type === 'number') defaults[f.name] = 0;
        else if (f.type === 'checkbox') defaults[f.name] = false;
        else defaults[f.name] = '';
      });
      setFormData(defaults);
      setItems([]);
    }
    setErrors({});
  }, [initialData, fields, open]);

  // NEW: Fetch products when sales/purchases dialog opens
  useEffect(() => {
    if (open && (title === 'Sales' || title === 'Purchases') && !isEdit) {
      db.getProducts?.().then(p => {
        if (Array.isArray(p) && p.length > 0) setProducts(p);
      }).catch(() => {
        // Agar getProducts na ho toh silent fail
        setProducts([]);
      });
    }
  }, [open, title, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // NEW: Items handlers
  const addItem = () => {
    setItems(prev => [...prev, { 
      product_variant_id: '', 
      product_id: '',
      name: '',
      qty: 1, 
      price: 0, 
      discount: 0 
    }]);
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[idx] = { ...newItems[idx], [field]: value };
      if (field === 'product_variant_id' && products.length > 0) {
        const prod = products.find(p => String(p.id) === String(value));
        if (prod) {
          newItems[idx].product_id = prod.id;
          newItems[idx].name = prod.name;
          newItems[idx].price = Number(prod.sale_price || prod.price || 0);
        }
      }
      return newItems;
    });
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
    const itemDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
    const extraDiscount = Number(formData.discount || 0);
    const grandTotal = Math.max(0, subtotal - itemDiscount - extraDiscount);
    return { subtotal, grandTotal };
  };

  const handleSubmit = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (f.required && !formData[f.name] && f.type !== 'number') {
        newErrors[f.name] = `${f.label} is required`;
      }
    });
    
    // NEW: Validate items for sales/purchases
    if ((title === 'Sales' || title === 'Purchases') && items.length === 0 && !isEdit) {
      newErrors._items = 'At least one item is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const { grandTotal } = calculateTotals();
    
    // NEW: Attach items to payload
    const payload = { 
      ...formData,
      _items: items,
      _autoGrandTotal: grandTotal
    };
    
    onSave(payload);
  };

  const { subtotal, grandTotal } = calculateTotals();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={window.innerWidth < 600}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Add /> {isEdit ? 'Edit' : 'New'} {title}
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
                  fullWidth size="small"
                  multiline rows={3}
                  name={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  error={!!errors[field.name]}
                  helperText={errors[field.name]}
                />
              ) : field.type === 'checkbox' ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      name={field.name}
                      checked={formData[field.name] || false}
                      onChange={handleChange}
                    />
                  }
                  label={field.label}
                />
              ) : (
                <TextField
                  fullWidth size="small"
                  type={field.type || 'text'}
                  name={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  error={!!errors[field.name]}
                  helperText={errors[field.name]}
                  slotProps={{ input: field.startAdornment ? { 
                    startAdornment: <InputAdornment position="start">{field.startAdornment}</InputAdornment> 
                  } : {} }}
                />
              )}
            </Grid>
          ))}
        </Grid>

        {/* NEW: Inline Items Editor for Sales/Purchases */}
        {(title === 'Sales' || title === 'Purchases') && !isEdit && (
          <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory fontSize="small" /> Items ({items.length})
            </Typography>
            
            {items.length === 0 && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                {errors._items || 'Koi item add nahi ki. Neeche button se item add karo.'}
              </Typography>
            )}

            {items.map((item, idx) => (
              <Grid container spacing={1} key={idx} sx={{ mb: 1.5, alignItems: 'center' }}>
                <Grid item xs={products.length > 0 ? 4 : 4}>
                  {products.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>Product</InputLabel>
                      <Select
                        value={item.product_variant_id || ''}
                        onChange={(e) => updateItem(idx, 'product_variant_id', e.target.value)}
                        label="Product"
                      >
                        {products.map(p => (
                          <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField 
                      fullWidth size="small" 
                      label="Item Name" 
                      value={item.name || ''} 
                      onChange={(e) => updateItem(idx, 'name', e.target.value)} 
                    />
                  )}
                </Grid>
                <Grid item xs={2}>
                  <TextField 
                    fullWidth size="small" 
                    type="number" 
                    label="Qty" 
                    value={item.qty || 0} 
                    onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))} 
                  />
                </Grid>
                <Grid item xs={2}>
                  <TextField 
                    fullWidth size="small" 
                    type="number" 
                    label="Price" 
                    value={item.price || 0} 
                    onChange={(e) => updateItem(idx, 'price', Number(e.target.value))} 
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
                  />
                </Grid>
                <Grid item xs={2}>
                  <TextField 
                    fullWidth size="small" 
                    type="number" 
                    label="Disc" 
                    value={item.discount || 0} 
                    onChange={(e) => updateItem(idx, 'discount', Number(e.target.value))} 
                  />
                </Grid>
                <Grid item xs={1.5}>
                  <Typography variant="body2" fontWeight="bold" color="primary.main" sx={{ textAlign: 'right' }}>
                    ₹{((Number(item.qty)||0) * (Number(item.price)||0) - (Number(item.discount)||0)).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={0.5}>
                  <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            ))}

            <Button 
              size="small" 
              variant="outlined" 
              startIcon={<Add />} 
              onClick={addItem}
              sx={{ mt: 1 }}
            >
              Add Item
            </Button>

            <Box sx={{ mt: 2, pt: 1, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Subtotal: ₹{subtotal.toLocaleString()}</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="success.main">Grand Total: ₹{grandTotal.toLocaleString()}</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} startIcon={<Close />}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== CONFIRM DIALOG ====================
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

// ==================== TAB CONFIGURATIONS ====================
const HISTORY_TABS = [
  { id: 'sales', label: 'Sales', icon: <PointOfSale />, color: 'success' },
  { id: 'purchases', label: 'Purchases', icon: <LocalShipping />, color: 'info' },
  { id: 'payments', label: 'Payments', icon: <Payment />, color: 'primary' },
  { id: 'returns', label: 'Returns', icon: <Restore />, color: 'warning' },
  { id: 'expenses', label: 'Expenses', icon: <MoneyOff />, color: 'error' },
];

// ==================== PERMISSIONS HOOK ====================
const usePermissions = () => {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('current_user') || '{}'); }
    catch { return {}; }
  }, []);
  const rolePermissions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('role_permissions') || '{}'); }
    catch { return {}; }
  }, []);
  const can = (page, action = 'view') => {
    const roleId = currentUser?.role;
    if (!roleId || !rolePermissions) return false;
    if (roleId === 'admin') return true;
    const pagePerms = rolePermissions[roleId]?.[page];
    return !!pagePerms?.[action];
  };
  return { can, currentUser };
};

// ==================== MOBILE CARD ====================
const MobileHistoryCard = ({ record, type, onView, onDelete, canDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    const icons = {
      sales: <PointOfSale color="primary" />,
      purchases: <LocalShipping color="info" />,
      payments: <Payment color="success" />,
      returns: <Restore color="warning" />,
      expenses: <MoneyOff color="error" />,
    };
    return icons[type] || <Receipt />;
  };

  const getTitle = () => {
    switch(type) {
      case 'sales': return record.invoice_no || 'INV-0000';
      case 'purchases': return record.purchase_no || 'PUR-0000';
      case 'returns': return `RET-${record.id}`;
      case 'payments': return `PAY-${record.id}`;
      case 'expenses': return record.title || 'Expense';
      default: return 'Record';
    }
  };

  const getParty = () => {
    switch(type) {
      case 'sales': return record.customer_name || 'Walk-in Customer';
      case 'purchases': return record.supplier_name || 'Supplier';
      case 'returns': return record.customer_name || 'Customer';
      case 'payments': return record.party_name || 'Party';
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
      case 'payments': return 'completed';
      case 'expenses': return 'active';
      default: return 'active';
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      paid: 'success', received: 'success', completed: 'success',
      due: 'warning', pending: 'warning', partial: 'info',
      returned: 'error', cancelled: 'error', active: 'success'
    };
    return colors[status] || 'default';
  };

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: `4px solid ${getStatusColor(getStatus()) === 'success' ? '#10b981' : 
                                   getStatusColor(getStatus()) === 'warning' ? '#f59e0b' : '#ef4444'}`,
      position: 'relative'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: `${getStatusColor(getStatus())}.light` }}>
              {getIcon()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight="bold" noWrap>
                {getTitle()}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {getParty()}
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

        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Date</Typography>
            <Typography variant="body2">{formatShortDate(getDate())}</Typography>
          </Box>
          {record.payment_mode && (
            <Box>
              <Typography variant="caption" color="text.secondary">Payment</Typography>
              <Typography variant="body2">{record.payment_mode?.toUpperCase()}</Typography>
            </Box>
          )}
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            {record.description && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2">{record.description}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            onClick={() => onView(record, type)}
            sx={{ flex: 1, bgcolor: '#10b981' }}
          >
            View
          </Button>
          {canDelete && (
            <IconButton size="small" color="error" onClick={() => onDelete(record)}>
              <Delete fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowBack fontSize="small" /> : <ArrowForward fontSize="small" />}
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
  const { can } = usePermissions();

  // ==================== DIALOG STATES ====================
  const [entryDialog, setEntryDialog] = useState({ open: false, mode: 'add', data: null, type: 'sales' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, data: null, type: '' });
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailItems, setDetailItems] = useState([]);

// ==================== LOCAL DATE HELPER (Module Level) ====================
const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};;
  const today = getLocalDateStr();
  const thirtyDaysAgo = getLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [quickDate, setQuickDate] = useState('30');

  // ==================== SEARCH & FILTERS ====================
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all'); // NEW: Day filter

  // ==================== PAGINATION ====================
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

  // ==================== DATA STATES ====================
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [returnData, setReturnData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);

  // ==================== SUMMARY STATS ====================
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0, totalPurchases: 0, totalPayments: 0,
    totalReturns: 0, totalExpenses: 0, netCash: 0, totalBills: 0
  });

  // ==================== ALL DATA FOR FILTERING ====================
  const [allSales, setAllSales] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);

  // ==================== CRUD OPERATIONS ====================

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const getCurrentTabType = () => HISTORY_TABS[activeTab].id;
  const getCurrentTabLabel = () => HISTORY_TABS[activeTab].label;

  // ==================== FIXED LOAD FUNCTION ====================
  const loadCurrentTab = async () => {
    setLoading(true);
    try {
      console.log('[History] Loading all data...');
      console.log('[History] Date range:', dateFrom, 'to', dateTo);

      // ===== SAB DATA EK SAATH LOAD KARO =====
      const [salesRaw, purchasesRaw, paymentsRaw, returnsRaw, expensesRaw] = await Promise.all([
        db.getSalesHistory().catch(() => []),
        db.getPurchases().catch(() => []),
        db.getPayments().catch(() => []),
        db.getSaleReturns().catch(() => []),
        db.getExpenses().catch(() => [])
      ]);

      // Store all data for filtering
      setAllSales(salesRaw);
      setAllPurchases(purchasesRaw);
      setAllPayments(paymentsRaw);
      setAllReturns(returnsRaw);
      setAllExpenses(expensesRaw);

      console.log('[History] Raw data:', {
        sales: salesRaw.length,
        purchases: purchasesRaw.length,
        payments: paymentsRaw.length,
        returns: returnsRaw.length,
        expenses: expensesRaw.length
      });

      // Apply all filters
      applyAllFilters(salesRaw, purchasesRaw, paymentsRaw, returnsRaw, expensesRaw);

    } catch (err) {
      console.error('[History] Load error:', err);
      showSnackbar('Error loading data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== APPLY ALL FILTERS ====================
  const applyAllFilters = (salesRaw, purchasesRaw, paymentsRaw, returnsRaw, expensesRaw) => {
    // Date filter function (LOCAL timezone)
    const getLocalDate = (dateStr) => {
      if (!dateStr) return '';
      // ISO string se direct YYYY-MM-DD nikalo - NO timezone conversion
      if (typeof dateStr === 'string') {
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr).substring(0, 10);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const filterByDate = (arr, dateField) => arr.filter(item => {
      if (item.is_deleted) return false;
      const d = getLocalDate(item[dateField]);
      return d >= dateFrom && d <= dateTo;
    });

    // Day filter function (filter by day of week)
    const filterByDay = (arr, dateField) => {
      if (dayFilter === 'all') return arr;
      return arr.filter(item => {
        const d = item[dateField] ? new Date(item[dateField]) : null;
        if (!d || isNaN(d.getTime())) return false;
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return dayNames[d.getDay()] === dayFilter;
      });
    };

    // Status filter
    const filterByStatus = (arr, statusField) => {
      if (statusFilter === 'all') return arr;
      return arr.filter(item => item[statusField] === statusFilter);
    };

    // Payment mode filter
    const filterByPayment = (arr) => {
      if (paymentFilter === 'all') return arr;
      return arr.filter(item => item.payment_mode === paymentFilter);
    };

    // Apply all filters
    let filteredSales = filterByDate(salesRaw, 'date');
    filteredSales = filterByDay(filteredSales, 'date');
    filteredSales = filterByStatus(filteredSales, 'payment_status');
    filteredSales = filterByPayment(filteredSales);

    let filteredPurchases = filterByDate(purchasesRaw, 'purchase_date');
    filteredPurchases = filterByDay(filteredPurchases, 'purchase_date');
    filteredPurchases = filterByStatus(filteredPurchases, 'payment_status');
    filteredPurchases = filterByPayment(filteredPurchases);

    let filteredPayments = filterByDate(paymentsRaw, 'date');
    filteredPayments = filterByDay(filteredPayments, 'date');
    filteredPayments = filterByPayment(filteredPayments);

    let filteredReturns = filterByDate(returnsRaw, 'return_date');
    filteredReturns = filterByDay(filteredReturns, 'return_date');

    let filteredExpenses = filterByDate(expensesRaw, 'date');
    filteredExpenses = filterByDay(filteredExpenses, 'date');
    filteredExpenses = filterByPayment(filteredExpenses);

    console.log('[History] Filtered data:', {
      sales: filteredSales.length,
      purchases: filteredPurchases.length,
      payments: filteredPayments.length,
      returns: filteredReturns.length,
      expenses: filteredExpenses.length
    });

    // Set data for current tab
    const tabType = getCurrentTabType();
    switch(tabType) {
      case 'sales': setSalesData(filteredSales); break;
      case 'purchases': setPurchaseData(filteredPurchases); break;
      case 'payments': setPaymentData(filteredPayments); break;
      case 'returns': setReturnData(filteredReturns); break;
      case 'expenses': setExpenseData(filteredExpenses); break;
      default: break;
    }

    // Calculate summary stats
    const totalSales = filteredSales.reduce((sum, s) => sum + (parseFloat(s.grand_total) || 0), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.grand_total) || 0), 0);
    const totalPayments = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalReturns = filteredReturns.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    setSummaryStats({
      totalSales,
      totalPurchases,
      totalPayments,
      totalReturns,
      totalExpenses,
      netCash: totalSales - totalPurchases - totalExpenses,
      totalBills: filteredSales.length + filteredPurchases.length
    });

    console.log('[History] Summary:', {
      totalSales: formatCurrency(totalSales),
      totalPurchases: formatCurrency(totalPurchases),
      netCash: formatCurrency(totalSales - totalPurchases - totalExpenses)
    });
  };

  // ==================== RE-APPLY FILTERS WHEN FILTERS CHANGE ====================
  useEffect(() => {
    if (allSales.length > 0 || allPurchases.length > 0) {
      applyAllFilters(allSales, allPurchases, allPayments, allReturns, allExpenses);
    }
  }, [dateFrom, dateTo, dayFilter, statusFilter, paymentFilter, activeTab]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    loadCurrentTab();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [activeTab, searchQuery, statusFilter, paymentFilter, dayFilter]);

  // ==================== QUICK DATE FILTER ====================
  const handleQuickDate = (days) => {
    setQuickDate(days);
    if (days === 'all') {
      setDateFrom('2000-01-01');
      setDateTo(getLocalDateStr());
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - parseInt(days));
    setDateFrom(getLocalDateStr(d));
    setDateTo(getLocalDateStr());
  };

  // ==================== GET CURRENT DATA ====================
  const getCurrentData = () => {
    switch (getCurrentTabType()) {
      case 'sales': return salesData;
      case 'purchases': return purchaseData;
      case 'payments': return paymentData;
      case 'returns': return returnData;
      case 'expenses': return expenseData;
      default: return [];
    }
  };

  // ==================== FILTERED DATA WITH SEARCH ====================
  const filteredData = useMemo(() => {
    const data = getCurrentData();
    if (!searchQuery) return data;
    
    return data.filter(item => {
      const searchString = JSON.stringify(item).toLowerCase();
      return searchString.includes(searchQuery.toLowerCase());
    });
  }, [getCurrentData(), searchQuery]);

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // ==================== VIEW DETAIL ====================
  const handleViewDetail = async (record, type) => {
    setSelectedRecord({ ...record, recordType: type });
    setLoading(true);
    try {
      let items = [];
      if (type === 'sales') {
        items = await db.getSaleItems(record.id);
        if (!items || items.length === 0) {
          if (record.items) {
            try { items = typeof record.items === 'string' ? JSON.parse(record.items) : record.items; } catch (_) {}
          } else if (record.items_json) {
            try { items = typeof record.items_json === 'string' ? JSON.parse(record.items_json) : record.items_json; } catch (_) {}
          }
        }
        
        let allVariants = [];
        let allProducts = [];
        try {
          if (typeof db.getAllVariants === 'function') allVariants = await db.getAllVariants();
          if (typeof db.getProducts === 'function') allProducts = await db.getProducts();
        } catch (_) {}
        const variantMap = new Map((allVariants || []).map(v => [String(v.id), v]));
        const productMap = new Map((allProducts || []).map(p => [String(p.id), p]));

        items = (items || []).map(i => {
          const vId = String(i.product_variant_id || i.variant_id || i.variantId || '');
          const pId = String(i.product_id || i.productId || '');
          const matchedVariant = variantMap.get(vId);
          const matchedProduct = productMap.get(pId) || (matchedVariant ? productMap.get(String(matchedVariant.product_id)) : null);

          const rawName = i.product_name || i.name || i.title || '';
          const isGeneric = !rawName || rawName === 'Item' || rawName.startsWith('Item #');

          let realName = !isGeneric ? rawName : '';
          if (!realName) {
            if (matchedVariant?.product_name) {
              realName = (matchedVariant.variant_name && matchedVariant.variant_name !== 'Standard' && matchedVariant.variant_name !== 'Default')
                ? `${matchedVariant.product_name} (${matchedVariant.variant_name})`
                : matchedVariant.product_name;
            } else if (matchedProduct?.name) {
              realName = (matchedVariant?.variant_name && matchedVariant.variant_name !== 'Standard' && matchedVariant.variant_name !== 'Default')
                ? `${matchedProduct.name} (${matchedVariant.variant_name})`
                : matchedProduct.name;
            } else if (matchedVariant?.variant_name) {
              realName = matchedVariant.variant_name;
            } else if (i.sku && i.sku !== '-') {
              realName = `Item (${i.sku})`;
            } else if (matchedVariant?.sku) {
              realName = `Item (${matchedVariant.sku})`;
            } else {
              realName = 'Product';
            }
          }

          const resolvedSku = (i.sku && i.sku !== '-') ? i.sku : (matchedVariant?.sku || matchedProduct?.sku || i.barcode || '-');
          const resolvedVariantName = i.variant_name || matchedVariant?.variant_name || '';

          return {
            ...i,
            product_name: realName,
            name: realName,
            sku: resolvedSku,
            variant_name: resolvedVariantName
          };
        });
      } else if (type === 'purchases') {
        items = await db.getPurchaseItems(record.id);
      } else if (type === 'returns') {
        items = await db.getSaleReturnItems(record.id);
      }
      setDetailItems(Array.isArray(items) ? items : []);
      setDetailDialog(true);
    } catch (err) {
      showSnackbar('Detail load error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== EXPORT CSV ====================
  const exportCSV = () => {
    const currentData = filteredData;
    if (currentData.length === 0) {
      showSnackbar('No data to export', 'warning');
      return;
    }

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
    a.download = `${getCurrentTabType()}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showSnackbar('CSV exported successfully!', 'success');
  };

  // ==================== RENDER HELPERS ====================
  const StatCard = ({ title, value, sub, color, icon }) => (
    <Grid item xs={6} sm={4} md={2}>
      <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', height: '100%' }}>
        <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ minWidth: 0, flex: 1, pr: 0.5 }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', display: 'block' }} noWrap>
                {title}
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" noWrap sx={{ fontSize: isMobile ? '1rem' : '1.25rem', lineHeight: 1.2 }}>
                {value}
              </Typography>
              {sub && <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>{sub}</Typography>}
            </Box>
            <Avatar sx={{ bgcolor: '#e8eaf6', color: '#1c2580', width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, flexShrink: 0 }}>
              {React.cloneElement(icon, { sx: { fontSize: isMobile ? 16 : 20 } })}
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

  // ==================== GET ENTRY FIELDS ====================
 // ==================== GET ENTRY FIELDS ====================
const getEntryFields = (type) => {
  const fieldsMap = {
    sales: [
      { name: 'invoice_no', label: 'Invoice No', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'customer_name', label: 'Customer Name', required: true },
      // Hata diye kyunki ab items se auto-calculate honge
      // { name: 'grand_total', label: 'Total Amount', type: 'number', required: true, startAdornment: <AttachMoney /> },
      { name: 'paid_amount', label: 'Paid Amount', type: 'number', startAdornment: <AttachMoney /> },
      { name: 'discount', label: 'Extra Discount', type: 'number', startAdornment: <AttachMoney /> },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'credit', label: 'Credit' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'easypaisa', label: 'EasyPaisa' },
        { value: 'jazzcash', label: 'JazzCash' }
      ]},
      { name: 'description', label: 'Notes', type: 'textarea', fullWidth: true }
    ],
    purchases: [
      { name: 'purchase_no', label: 'Purchase No', required: true },
      { name: 'purchase_date', label: 'Date', type: 'date', required: true },
      { name: 'supplier_name', label: 'Supplier Name', required: true },
      { name: 'paid_amount', label: 'Paid Amount', type: 'number', startAdornment: <AttachMoney /> },
      { name: 'discount', label: 'Discount', type: 'number', startAdornment: <AttachMoney /> },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'credit', label: 'Credit' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'easypaisa', label: 'EasyPaisa' },
        { value: 'jazzcash', label: 'JazzCash' }
      ]},
      { name: 'description', label: 'Notes', type: 'textarea', fullWidth: true }
    ],
    payments: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'party_type', label: 'Party Type', type: 'select', options: [
        { value: 'customer', label: 'Customer' },
        { value: 'supplier', label: 'Supplier' }
      ]},
      { name: 'party_name', label: 'Party Name', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, startAdornment: <AttachMoney /> },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'easypaisa', label: 'EasyPaisa' },
        { value: 'jazzcash', label: 'JazzCash' }
      ]},
      { name: 'description', label: 'Notes', type: 'textarea', fullWidth: true }
    ],
    returns: [
      { name: 'return_date', label: 'Date', type: 'date', required: true },
      { name: 'customer_name', label: 'Customer Name', required: true },
      { name: 'original_invoice', label: 'Original Invoice' },
      { name: 'refund_amount', label: 'Refund Amount', type: 'number', required: true, startAdornment: <AttachMoney /> },
      { name: 'refund_mode', label: 'Refund Mode', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'easypaisa', label: 'EasyPaisa' },
        { value: 'jazzcash', label: 'JazzCash' }
      ]},
      { name: 'description', label: 'Notes', type: 'textarea', fullWidth: true }
    ],
    expenses: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'category_name', label: 'Category', required: true },
      { name: 'title', label: 'Title', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, startAdornment: <AttachMoney /> },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'easypaisa', label: 'EasyPaisa' },
        { value: 'jazzcash', label: 'JazzCash' }
      ]},
      { name: 'description', label: 'Notes', type: 'textarea', fullWidth: true }
    ]
  };
  return fieldsMap[type] || [];
};
  // ==================== HANDLE ENTRY SAVE ====================
  const handleEntrySave = (data) => {
  const type = entryDialog.type;
  const isEdit = entryDialog.mode === 'edit';
  
  // Sales ke liye naya flow (items ke saath)
  if (type === 'sales' && !isEdit) {
    handleAddSale(data);
    return;
  }
  
  const handlers = {
    sales: isEdit ? handleEditSale : handleAddSale,
    purchases: isEdit ? handleEditPurchase : handleAddPurchase,
    payments: isEdit ? handleEditPayment : handleAddPayment,
    returns: isEdit ? handleEditReturn : handleAddReturn,
    expenses: isEdit ? handleEditExpense : handleAddExpense,
  };
  
  const handler = handlers[type];
  if (handler) handler(data);
};

  // ==================== HANDLE CONFIRM DELETE ====================
  const handleConfirmDelete = () => {
    const { data, type } = confirmDialog;
    if (!can(type, 'delete')) {
      showSnackbar('Permission Denied: Cannot delete!', 'error');
      setConfirmDialog({ open: false, data: null, type: '' });
      return;
    }
    const handlers = {
      sales: handleDeleteSale,
      purchases: handleDeletePurchase,
      payments: handleDeletePayment,
      returns: handleDeleteReturn,
      expenses: handleDeleteExpense,
    };
    const handler = handlers[type];
    if (handler) handler(data);
  };

  // ==================== OPEN ADD DIALOG ====================
  const openAddDialog = () => {
    setEntryDialog({
      open: true,
      mode: 'add',
      data: null,
      type: getCurrentTabType()
    });
  };

  // ==================== OPEN DELETE CONFIRM ====================
  const openDeleteConfirm = (record) => {
    setConfirmDialog({
      open: true,
      data: record,
      type: getCurrentTabType()
    });
  };

  // ==================== CRUD HANDLERS (Short versions) ====================
 const handleAddSale = async (data) => {
  if (!can('sales', 'add')) {
    showSnackbar('Permission Denied: Cannot add sales!', 'error');
    return;
  }
  try {
    const items = data._items || [];
    
    // Agar items hain toh db.createSale use karo (items ke saath)
    if (items.length > 0) {
      const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
      const itemDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
      const extraDiscount = parseFloat(data.discount) || 0;
      const grandTotal = Math.max(0, subtotal - itemDiscount - extraDiscount);
      const paidAmount = parseFloat(data.paid_amount) || 0;
      const dueAmount = Math.max(0, grandTotal - paidAmount);

      const salePayload = {
        invoice_no: data.invoice_no || `INV-${Date.now().toString().slice(-11)}`,
        date: data.date || getLocalDateStr(), // Fresh date har baar
        customer_id: null,
        customer_name: data.customer_name || 'Walk-in Customer',
        customer_ntn: '',
        subtotal: subtotal,
        item_discount: itemDiscount,
        discount: extraDiscount,
        tax: 0,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        change_amount: 0,
        payment_mode: data.payment_mode || 'cash',
        payment_status: dueAmount > 0 ? 'due' : 'paid',
        sale_type: 'retail',
        date: data.date || getLocalISOString(),
        description: data.description || ''
      };

      const formattedItems = items.map((item, idx) => ({
        product_variant_id: item.product_variant_id || `TEMP-${idx}-${Date.now()}`,
        product_id: item.product_id || null,
        quantity: Number(item.qty) || 1,
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        total: (Number(item.qty || 0) * Number(item.price || 0)) - Number(item.discount || 0),
        name: item.name || 'Item'
      }));

      // YEH LINE SAB SE ZYADA IMPORTANT HAI — createSale items ke saath chalega
      await db.createSale({ sale: salePayload, items: formattedItems });
      showSnackbar('Sale with items added successfully');
    } else {
      // Fallback: agar koi item nahi toh purana tareeqa
      const saleData = {
        invoice_no: data.invoice_no || `INV-${Date.now().toString().slice(-11)}`,
        date: data.date || getLocalISOString(),
        customer_name: data.customer_name || 'Walk-in Customer',
        grand_total: parseFloat(data._autoGrandTotal) || 0,
        paid_amount: parseFloat(data.paid_amount) || 0,
        due_amount: parseFloat(data._autoGrandTotal || 0) - parseFloat(data.paid_amount || 0),
        discount: parseFloat(data.discount) || 0,
        payment_mode: data.payment_mode || 'cash',
        payment_status: parseFloat(data._autoGrandTotal || 0) - parseFloat(data.paid_amount || 0) > 0 ? 'due' : 'paid',
        description: data.description || '',
        created_at: new Date().toISOString()
      };
      await db.addSale(saleData);
      showSnackbar('Sale added but WITHOUT items');
    }

    loadCurrentTab();
    setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
  } catch (err) {
    console.error('Sale add error:', err);
    showSnackbar('Error: ' + err.message, 'error');
  }
};

  const handleEditSale = async (data) => {
    if (!can('sales', 'edit')) {
      showSnackbar('Permission Denied: Cannot edit sales!', 'error');
      return;
    }
    try {
      await db.updateSale(data.id, data);
      showSnackbar('Sale updated successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteSale = async (item) => {
    if (!can('sales', 'delete')) {
      showSnackbar('Permission Denied: Cannot delete sales!', 'error');
      return;
    }
    try {
      await db.deleteSale(item.id);
      showSnackbar('Sale deleted successfully');
      loadCurrentTab();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleAddPurchase = async (data) => {
    if (!can('purchases', 'add')) {
      showSnackbar('Permission Denied: Cannot add purchases!', 'error');
      return;
    }
    try {
      const purchaseData = {
        purchase_no: data.purchase_no || `PUR-${Date.now().toString().slice(-11)}`,
        purchase_date: data.purchase_date || today,
        supplier_name: data.supplier_name || 'Supplier',
        grand_total: parseFloat(data.grand_total) || 0,
        paid_amount: parseFloat(data.paid_amount) || 0,
        due_amount: parseFloat(data.grand_total || 0) - parseFloat(data.paid_amount || 0),
        discount: parseFloat(data.discount) || 0,
        payment_mode: data.payment_mode || 'cash',
        payment_status: parseFloat(data.grand_total || 0) - parseFloat(data.paid_amount || 0) > 0 ? 'due' : 'paid',
        description: data.description || '',
        created_at: new Date().toISOString()
      };
      await db.addPurchase(purchaseData);
      showSnackbar('Purchase added successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleEditPurchase = async (data) => {
    if (!can('purchases', 'edit')) {
      showSnackbar('Permission Denied: Cannot edit purchases!', 'error');
      return;
    }
    try {
      await db.updatePurchase(data.id, data);
      showSnackbar('Purchase updated successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleDeletePurchase = async (item) => {
    if (!can('purchases', 'delete')) {
      showSnackbar('Permission Denied: Cannot delete purchases!', 'error');
      return;
    }
    try {
      await db.deletePurchase(item.id);
      showSnackbar('Purchase deleted successfully');
      loadCurrentTab();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleAddPayment = async (data) => {
    if (!can('payments', 'add')) {
      showSnackbar('Permission Denied: Cannot add payments!', 'error');
      return;
    }
    try {
      const paymentData = {
        date: data.date || getLocalISOString(),
        party_type: data.party_type || 'customer',
        party_name: data.party_name || 'Party',
        amount: parseFloat(data.amount) || 0,
        payment_mode: data.payment_mode || 'cash',
        description: data.description || '',
        created_at: new Date().toISOString()
      };
      await db.addPayment(paymentData);
      showSnackbar('Payment added successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleEditPayment = async (data) => {
    if (!can('payments', 'edit')) {
      showSnackbar('Permission Denied: Cannot edit payments!', 'error');
      return;
    }
    try {
      await db.updatePayment(data.id, data);
      showSnackbar('Payment updated successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleDeletePayment = async (item) => {
    if (!can('payments', 'delete')) {
      showSnackbar('Permission Denied: Cannot delete payments!', 'error');
      return;
    }
    try {
      await db.deletePayment(item.id);
      showSnackbar('Payment deleted successfully');
      loadCurrentTab();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleAddReturn = async (data) => {
    if (!can('returns', 'add')) {
      showSnackbar('Permission Denied: Cannot add returns!', 'error');
      return;
    }
    try {
      const returnData = {
        customer_name: data.customer_name || 'Customer',
        return_date: data.return_date || today,
        refund_amount: parseFloat(data.refund_amount) || 0,
        refund_mode: data.refund_mode || 'cash',
        description: data.description || '',
        created_at: new Date().toISOString()
      };
      await db.addSaleReturn(returnData);
      showSnackbar('Return added successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleEditReturn = async (data) => {
    if (!can('returns', 'edit')) {
      showSnackbar('Permission Denied: Cannot edit returns!', 'error');
      return;
    }
    try {
      await db.updateSaleReturn(data.id, data);
      showSnackbar('Return updated successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteReturn = async (item) => {
    if (!can('returns', 'delete')) {
      showSnackbar('Permission Denied: Cannot delete returns!', 'error');
      return;
    }
    try {
      await db.deleteSaleReturn(item.id);
      showSnackbar('Return deleted successfully');
      loadCurrentTab();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleAddExpense = async (data) => {
    if (!can('expenses', 'add')) {
      showSnackbar('Permission Denied: Cannot add expenses!', 'error');
      return;
    }
    try {
      const expenseData = {
        date: data.date || getLocalISOString(),
        category_name: data.category_name || 'General',
        title: data.title || 'Expense',
        amount: parseFloat(data.amount) || 0,
        payment_mode: data.payment_mode || 'cash',
        description: data.description || '',
        created_at: new Date().toISOString()
      };
      await db.addExpense(expenseData);
      showSnackbar('Expense added successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleEditExpense = async (data) => {
    if (!can('expenses', 'edit')) {
      showSnackbar('Permission Denied: Cannot edit expenses!', 'error');
      return;
    }
    try {
      await db.updateExpense(data.id, data);
      showSnackbar('Expense updated successfully');
      loadCurrentTab();
      setEntryDialog({ open: false, mode: 'add', data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteExpense = async (item) => {
    if (!can('expenses', 'delete')) {
      showSnackbar('Permission Denied: Cannot delete expenses!', 'error');
      return;
    }
    try {
      await db.deleteExpense(item.id);
      showSnackbar('Expense deleted successfully');
      loadCurrentTab();
      setConfirmDialog({ open: false, data: null, type: '' });
    } catch (err) {
      showSnackbar('Error: ' + err.message, 'error');
    }
  };
// ==================== PRINT RECEIPT ====================
// ==================== PRINT RECEIPT ====================
const handlePrintReceipt = async () => {
  if (!selectedRecord) return;
  try {
    const settings = getEffectiveReceiptSettings();
    showSnackbar('Printing receipt...', 'info');

    // Normalize items
    const items = (detailItems || []).map(item => ({
      name: item.product_name || item.title || item.name || 'Item',
      title: item.product_name || item.title || item.name || 'Item',
      sku: item.sku || item.variant_name || '',
      qty: Number(item.quantity || item.qty || item.returned_quantity || 1),
      quantity: Number(item.quantity || item.qty || item.returned_quantity || 1),
      price: Number(item.price || item.purchase_price || item.refund_price || 0),
      total: Number(item.total || item.sub_total || (Number(item.quantity || item.qty || 1) * Number(item.price || item.purchase_price || 0)))
    }));

    const totalSub = items.reduce((sum, it) => sum + it.total, 0);
    const grandTotal = Number(selectedRecord.grand_total || selectedRecord.amount || selectedRecord.refund_amount || totalSub);
    const paid = Number(selectedRecord.paid_amount !== undefined ? selectedRecord.paid_amount : grandTotal);
    const due = Number(selectedRecord.due_amount !== undefined ? selectedRecord.due_amount : Math.max(0, grandTotal - paid));

    const res = await printReceiptDirect(
      {
        sale: {
          ...selectedRecord,
          invoiceNo: selectedRecord.invoice_no || selectedRecord.purchase_no || `INV-${selectedRecord.id || '0000'}`,
          customer_name: selectedRecord.customer_name || selectedRecord.supplier_name || selectedRecord.party_name || 'Walk-in Customer',
          customer_phone: selectedRecord.customer_phone || selectedRecord.party_phone || '',
          subtotal: totalSub,
          discount: Number(selectedRecord.discount || 0),
          tax: Number(selectedRecord.tax || selectedRecord.fbr_tax_amount || 0),
          grand_total: grandTotal,
          paid_amount: paid,
          due_amount: due,
          change_amount: Number(selectedRecord.change_amount || (paid > grandTotal ? paid - grandTotal : 0)),
          payment_mode: selectedRecord.payment_mode || 'CASH',
          date: selectedRecord.date || selectedRecord.purchase_date || selectedRecord.return_date || selectedRecord.created_at,
          items: items
        },
        items: items
      },
      {
        receiptSettings: settings,
        design: settings.design
      }
    );

    if (res && res.success) {
      showSnackbar('Receipt printed successfully!', 'success');
    } else if (res && res.error) {
      showSnackbar(`Print error: ${res.error}`, 'error');
    }
  } catch (err) {
    console.error('History print receipt error:', err);
    showSnackbar('Print error: ' + err.message, 'error');
  }
};

// ==================== MAIN RENDER ====================  

  // ==================== MAIN RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
          <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'History' : 'Transaction History'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          {/* {can(getCurrentTabType(), 'add') && (
            <Button variant="contained" size="small" startIcon={<Add />} onClick={openAddDialog} sx={{ bgcolor: '#10b981' }}>
              Add {getCurrentTabLabel()}
            </Button>
          )} */}
          {/* {!isMobile && (
            <Button variant="outlined" size="small" startIcon={<Download />} onClick={exportCSV}>
              Export
            </Button>
          )} */}
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={loadCurrentTab} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* SUMMARY CARDS */}
      <Grid container spacing={isMobile ? 1 : 1.5} sx={{ mb: 2 }}>
        <StatCard title="Sales" value={formatCurrency(summaryStats.totalSales)} color="success" icon={<PointOfSale />} />
        <StatCard title="Purchases" value={formatCurrency(summaryStats.totalPurchases)} color="info" icon={<LocalShipping />} />
        <StatCard title="Payments" value={formatCurrency(summaryStats.totalPayments)} color="primary" icon={<Payment />} />
        <StatCard title="Returns" value={formatCurrency(summaryStats.totalReturns)} color="warning" icon={<Restore />} />
        <StatCard title="Expenses" value={formatCurrency(summaryStats.totalExpenses)} color="error" icon={<MoneyOff />} />
        <StatCard title="Net Cash" value={formatCurrency(summaryStats.netCash)} color={summaryStats.netCash >= 0 ? 'success' : 'error'} icon={summaryStats.netCash >= 0 ? <TrendingUp /> : <TrendingDown />} />
      </Grid>

      {/* FILTERS BAR */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Grid container spacing={isMobile ? 1 : 1.5} alignItems="flex-end">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth size="small"
              label="Search Invoices"
              placeholder={isMobile ? "Search..." : "Search invoice, party, notes..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{ 
                inputLabel: { shrink: true },
                input: { 
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <Close fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                } 
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
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
          <Grid item xs={6} sm={3} md={3}>
            <TextField fullWidth size="small" type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <TextField fullWidth size="small" type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Day</InputLabel>
              <Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} label="Day">
                <MenuItem value="all">All Days</MenuItem>
                <MenuItem value="monday">Monday</MenuItem>
                <MenuItem value="tuesday">Tuesday</MenuItem>
                <MenuItem value="wednesday">Wednesday</MenuItem>
                <MenuItem value="thursday">Thursday</MenuItem>
                <MenuItem value="friday">Friday</MenuItem>
                <MenuItem value="saturday">Saturday</MenuItem>
                <MenuItem value="sunday">Sunday</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="due">Due</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="returned">Returned</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment</InputLabel>
              <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} label="Payment">
                <MenuItem value="all">All Modes</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="credit">Credit</MenuItem>
                <MenuItem value="bank">Bank</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                <MenuItem value="jazzcash">JazzCash</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPaymentFilter('all');
                setDayFilter('all');
                handleQuickDate('30');
              }}
              startIcon={<Clear />}
              fullWidth
              sx={{ height: 38 }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            minHeight: isMobile ? 42 : 48,
            '& .MuiTab-root': {
              minHeight: isMobile ? 42 : 48,
              py: isMobile ? 0.75 : 1,
              px: isMobile ? 1.5 : 2,
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              fontWeight: 600,
              textTransform: 'none',
              whiteSpace: 'nowrap'
            }
          }}
        >
          {HISTORY_TABS.map((tab) => {
            const counts = {
              sales: salesData.length,
              purchases: purchaseData.length,
              payments: paymentData.length,
              returns: returnData.length,
              expenses: expenseData.length,
            };
            return (
              <Tab 
                key={tab.id}
                icon={tab.icon} 
                iconPosition="start"
                label={`${tab.label} (${counts[tab.id] || 0})`}
                sx={{ 
                  color: `${tab.color}.main`
                }}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* ==================== DATA TABLE / CARDS ==================== */}
      {isMobile ? (
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
              <Typography variant="caption" color="text.secondary">
                {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dayFilter !== 'all' 
                  ? 'Try changing filters' 
                  : 'Add a new record'}
              </Typography>
            </Paper>
          ) : (
            paginatedData.map((record, idx) => (
              <MobileHistoryCard
                key={record.id || idx}
                record={record}
                type={getCurrentTabType()}
                onView={handleViewDetail}
                onDelete={openDeleteConfirm}
                canDelete={can(getCurrentTabType(), 'delete')}
              />
            ))
          )}
          <UnifiedPagination
            count={filteredData.length}
            page={page}
            rowsPerPage={rowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setPage(p)}
            onRowsPerPageChange={(newR) => {
              setRowsPerPage(newR);
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Box>
      ) : (
        <>
          <Paper>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1c2580' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Invoice/Ref</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Day</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Party</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Amount</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="center">Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map((record, idx) => {
                    const type = getCurrentTabType();
                    
                    const getInvoice = () => {
                      switch(type) {
                        case 'sales': return record.invoice_no;
                        case 'purchases': return record.purchase_no;
                        case 'returns': return `RET-${record.id}`;
                        case 'payments': return `PAY-${record.id}`;
                        case 'expenses': return record.title;
                        default: return record.id;
                      }
                    };
                    
                    const getParty = () => {
                      switch(type) {
                        case 'sales': return record.customer_name || 'Walk-in Customer';
                        case 'purchases': return record.supplier_name || '-';
                        case 'returns': return record.customer_name || '-';
                        case 'payments': return record.party_name || '-';
                        case 'expenses': return 'Self';
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

                    const getDayName = (dateStr) => {
                      if (!dateStr) return '-';
                      try {
                        // ISO string se direct date parts nikalo - timezone shift avoid
                        let d;
                        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                          const [, y, m, day] = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
                        } else {
                          d = new Date(dateStr);
                        }
                        if (isNaN(d.getTime())) return '-';
                        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                      } catch { return '-'; }
                    };
                    
                    const getStatus = () => {
                      switch(type) {
                        case 'sales': return record.payment_status || 'paid';
                        case 'purchases': return record.payment_status || 'received';
                        case 'returns': return 'returned';
                        case 'payments': return 'completed';
                        case 'expenses': return 'active';
                        default: return 'active';
                      }
                    };

                    return (
                      <TableRow key={record.id || idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell fontWeight="bold">{getInvoice()}</TableCell>
                        <TableCell>{formatShortDate(getDate())}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={getDayName(getDate())} 
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell>{getParty()}</TableCell>
                        <TableCell align="right" fontWeight="bold" sx={{ color: 'primary.main' }}>
                          {formatCurrency(getAmount())}
                        </TableCell>
                        <TableCell align="center">{getStatusChip(getStatus())}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton size="small" color="primary" onClick={() => handleViewDetail(record, type)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {can(getCurrentTabType(), 'delete') && (
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => openDeleteConfirm(record)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No records found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <UnifiedPagination
            count={filteredData.length}
            page={page}
            rowsPerPage={rowsPerPage}
            isZeroBased={true}
            onPageChange={(e, p) => setPage(p)}
            onRowsPerPageChange={(newR) => {
              setRowsPerPage(newR);
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </>
      )}

      {/* ==================== DIALOGS ==================== */}
      <EntryDialog
        open={entryDialog.open}
        onClose={() => setEntryDialog({ open: false, mode: 'add', data: null, type: '' })}
        onSave={handleEntrySave}
        title={getCurrentTabLabel()}
        fields={getEntryFields(entryDialog.type || getCurrentTabType())}
        initialData={entryDialog.data}
        isEdit={entryDialog.mode === 'edit'}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, data: null, type: '' })}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${getCurrentTabLabel().toLowerCase()}? This action cannot be undone.`}
      />

      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Receipt />
          {selectedRecord?.recordType === 'sales' ? 'Sale Invoice' : 
           selectedRecord?.recordType === 'purchases' ? 'Purchase Order' : 
           selectedRecord?.recordType === 'returns' ? 'Return Details' : 
           selectedRecord?.recordType === 'payments' ? 'Payment Details' : 
           selectedRecord?.recordType === 'expenses' ? 'Expense Details' : 'Record'} — 
          {selectedRecord?.invoice_no || selectedRecord?.purchase_no || `#${selectedRecord?.id}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedRecord && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f0fdf4' }}>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {formatDate(selectedRecord.date || selectedRecord.purchase_date || selectedRecord.return_date)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#eff6ff' }}>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
                      {formatCurrency(selectedRecord.grand_total || selectedRecord.amount || selectedRecord.refund_amount)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fefce8' }}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>{getStatusChip(selectedRecord.payment_status || selectedRecord.status)}</Box>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f3e8ff' }}>
                    <Typography variant="caption" color="text.secondary">Party</Typography>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                      {selectedRecord.customer_name || selectedRecord.supplier_name || selectedRecord.party_name || '-'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {detailItems.length > 0 && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                    Items ({detailItems.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#1c2580' }}>
                        <TableRow sx={{ bgcolor: '#1c2580' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>#</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Product</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>SKU</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Qty</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Price</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Total</TableCell>
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
                            <TableCell align="right" fontWeight="bold">
                              {formatCurrency(item.total || item.sub_total || (item.quantity * item.price) || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {selectedRecord.description && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f9fafb', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography variant="body2">{selectedRecord.description}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setDetailDialog(false)} startIcon={<Close />}>Close</Button>
          <Button fullWidth={isMobile} variant="outlined" startIcon={<Print />} onClick={handlePrintReceipt}>Print Receipt</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== MOBILE DRAWER ==================== */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            {can(getCurrentTabType(), 'add') && (
              <ListItem button onClick={() => { setMobileDrawer(false); openAddDialog(); }}>
                <ListItemIcon><Add color="success" /></ListItemIcon>
                <ListItemText primary={`Add ${getCurrentTabLabel()}`} />
              </ListItem>
            )}
            <ListItem button onClick={() => { setMobileDrawer(false); exportCSV(); }}>
              <ListItemIcon><Download /></ListItemIcon>
              <ListItemText primary="Export CSV" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadCurrentTab(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Refresh Data" />
            </ListItem>
            <Divider />
            {HISTORY_TABS.map((tab) => (
              <ListItem 
                key={tab.id} 
                button 
                onClick={() => { 
                  setMobileDrawer(false); 
                  setActiveTab(HISTORY_TABS.indexOf(tab));
                }}
                selected={activeTab === HISTORY_TABS.indexOf(tab)}
              >
                <ListItemIcon sx={{ color: `${tab.color}.main` }}>{tab.icon}</ListItemIcon>
                <ListItemText primary={tab.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* ==================== FAB BUTTON ==================== */}
      {isMobile && can(getCurrentTabType(), 'add') && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }}
          onClick={openAddDialog}
        >
          <Add />
        </Fab>
      )}

      {/* ==================== SNACKBAR ==================== */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 0 }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled" 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}