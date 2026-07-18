import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Divider, Card, CardContent, Fade, Zoom,
  Tooltip, Badge, List, ListItem, ListItemText, ListItemButton,
  ListItemIcon,  // ✅ ADDED
  InputAdornment, Autocomplete, ToggleButton, ToggleButtonGroup,
  Pagination, Snackbar, Alert, Fab, useTheme, alpha, Avatar,
  CircularProgress, useMediaQuery, Collapse, SwipeableDrawer,
  Drawer
} from '@mui/material';
import {
  Add, Edit, Delete, Search, FilterList, Category, CalendarToday,
  AttachMoney, Payment, CreditCard, AccountBalance, LocalAtm,
  Receipt, Print, Download, Refresh, Close, Save, ArrowUpward,
  ArrowDownward, TrendingUp, TrendingDown, Today, DateRange,
  Keyboard, Visibility, PictureAsPdf, MoreVert, CheckCircle,
  Warning, Info, Menu as MenuIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import db from '../database/db';

const EXPENSE_PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: <LocalAtm fontSize="small" /> },
  { value: 'bank', label: 'Bank Transfer', icon: <AccountBalance fontSize="small" /> },
  { value: 'cheque', label: 'Cheque', icon: <CreditCard fontSize="small" /> },
  { value: 'card', label: 'Card', icon: <Payment fontSize="small" /> },
  { value: 'easypaisa', label: 'EasyPaisa', icon: <Payment fontSize="small" /> },
  { value: 'jazzcash', label: 'JazzCash', icon: <Payment fontSize="small" /> },
];

const CATEGORY_COLORS = [
  '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab',
  '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047',
  '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00',
  '#f4511e', '#6d4c41', '#757575', '#546e7a', '#263238'
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ==================== MOBILE EXPENSE CARD ====================
const MobileExpenseCard = ({ expense, category, onView, onEdit, onDelete, getPaymentIcon }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: expense.status === 'cancelled' ? '4px solid #ef4444' : 
                   expense.status === 'pending' ? '4px solid #f59e0b' : 
                   '4px solid #10b981',
      overflow: 'hidden'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {expense.title}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              {category && (
                <Chip 
                  size="small" 
                  label={category.name}
                  sx={{ 
                    height: 18, 
                    fontSize: '0.55rem',
                    bgcolor: alpha(category.color || '#757575', 0.15),
                    color: category.color || '#757575'
                  }}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDate(expense.date)}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="error.main">
              {formatCurrency(expense.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {expense.receipt_no || '-'}
            </Typography>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Payment</Typography>
              <Typography variant="body2">{getPaymentIcon(expense.payment_mode)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Chip 
                size="small" 
                label={expense.status || 'active'}
                color={expense.status === 'cancelled' ? 'error' : expense.status === 'pending' ? 'warning' : 'success'}
                sx={{ height: 18, fontSize: '0.55rem' }}
              />
            </Grid>
            {expense.description && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Description</Typography>
                <Typography variant="body2" color="text.secondary">{expense.description}</Typography>
              </Grid>
            )}
            {expense.reference_no && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Ref #</Typography>
                <Typography variant="body2" fontFamily="monospace">{expense.reference_no}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => onView(expense)} sx={{ flex: 1 }}>
            View
          </Button>
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(expense)} sx={{ flex: 1 }}>
            Edit
          </Button>
          <IconButton size="small" color="error" onClick={() => onDelete(expense)}>
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

// ==================== MAIN COMPONENT ====================
export default function ExpensesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dateTo, setDateTo] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

  // Dialogs
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category_id: '',
    payment_mode: 'cash',
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference_no: '',
    status: 'active',
    receipt_no: ''
  });

  // Category form
  const [newCategory, setNewCategory] = useState({ name: '', color: CATEGORY_COLORS[0], description: '' });

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Refs
  const searchRef = useRef(null);

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let exps = [];
      let cats = [];

      if (db.getExpenses) {
        exps = await db.getExpenses();
      }
      if (db.getExpenseCategories) {
        cats = await db.getExpenseCategories();
      }

      setExpenses(Array.isArray(exps) ? exps : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== KEYBOARD SHORTCUTS ====================
  const handleOpenExpense = useCallback((expense = null) => {
    setEditingExpense(expense);
    if (expense) {
      setFormData({
        title: expense.title || '',
        amount: String(expense.amount || ''),
        category_id: String(expense.category_id || ''),
        payment_mode: expense.payment_mode || 'cash',
        date: expense.date ? (expense.date.includes('T') ? expense.date.split('T')[0] : expense.date) : new Date().toISOString().split('T')[0],
        description: expense.description || '',
        reference_no: expense.reference_no || '',
        status: expense.status || 'active',
        receipt_no: expense.receipt_no || `EXP-${Date.now()}`
      });
    } else {
      setFormData({
        title: '',
        amount: '',
        category_id: categories[0]?.id ? String(categories[0].id) : '',
        payment_mode: 'cash',
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference_no: '',
        status: 'active',
        receipt_no: `EXP-${Date.now()}`
      });
    }
    setExpenseDialog(true);
  }, [categories]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        setShowFilters(true);
      }
      if (e.key === 'F2' && !expenseDialog && !categoryDialog) {
        e.preventDefault();
        handleOpenExpense();
      }
      if (e.key === 'F3' && !expenseDialog && !categoryDialog) {
        e.preventDefault();
        setCategoryDialog(true);
      }
      if (e.key === 'F4' && !expenseDialog && !categoryDialog) {
        e.preventDefault();
        setShowFilters(prev => !prev);
      }
      if (e.key === 'F5' && !expenseDialog && !categoryDialog) {
        e.preventDefault();
        loadData();
        setSnackbar({ open: true, message: 'Data refreshed!', severity: 'info' });
      }
      if (e.key === 'Escape') {
        setExpenseDialog(false);
        setCategoryDialog(false);
        setDeleteConfirm(null);
        setViewExpense(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expenseDialog, categoryDialog, handleOpenExpense, loadData]);

  // ==================== CALCULATIONS ====================
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const todayTotal = expenses.filter(e => {
      const d = e.date?.split('T')[0] || e.date;
      return d === today;
    }).reduce((s, e) => s + Number(e.amount || 0), 0);

    const weekTotal = expenses.filter(e => new Date(e.date) >= startOfWeek).reduce((s, e) => s + Number(e.amount || 0), 0);
    const monthTotal = expenses.filter(e => new Date(e.date) >= startOfMonth).reduce((s, e) => s + Number(e.amount || 0), 0);
    const yearTotal = expenses.filter(e => new Date(e.date) >= startOfYear).reduce((s, e) => s + Number(e.amount || 0), 0);
    const grandTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];
    const yestTotal = expenses.filter(e => {
      const d = e.date?.split('T')[0] || e.date;
      return d === yestStr;
    }).reduce((s, e) => s + Number(e.amount || 0), 0);
    const trend = todayTotal - yestTotal;
    const trendPercent = yestTotal > 0 ? ((trend / yestTotal) * 100).toFixed(1) : 0;

    return { todayTotal, weekTotal, monthTotal, yearTotal, grandTotal, trend, trendPercent, count: expenses.length };
  }, [expenses]);

  // ==================== FILTERING ====================
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = !searchQuery || 
        (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.reference_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.receipt_no || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = !filterCategory || String(e.category_id) === String(filterCategory);
      const matchPayment = !filterPayment || e.payment_mode === filterPayment;
      const matchStatus = !filterStatus || e.status === filterStatus;

      const d = new Date(e.date);
      const matchDate = (!dateFrom || d >= dateFrom) && (!dateTo || d <= new Date(dateTo.getTime() + 86400000));

      return matchSearch && matchCategory && matchPayment && matchStatus && matchDate;
    }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
  }, [expenses, searchQuery, filterCategory, filterPayment, filterStatus, dateFrom, dateTo]);

  const paginatedExpenses = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredExpenses.slice(start, start + rowsPerPage);
  }, [filteredExpenses, page, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / rowsPerPage));

  // ==================== CRUD OPERATIONS ====================
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.amount || Number(formData.amount) <= 0) {
      setSnackbar({ open: true, message: 'Title and valid amount required!', severity: 'error' });
      return;
    }

    const payload = {
      ...formData,
      amount: Number(formData.amount),
      category_id: formData.category_id ? Number(formData.category_id) : null
    };

    try {
      if (editingExpense) {
        await db.updateExpense(editingExpense.id, payload);
        setSnackbar({ open: true, message: 'Expense updated!', severity: 'success' });
      } else {
        await db.createExpense(payload);
        setSnackbar({ open: true, message: 'Expense added!', severity: 'success' });
      }
      setExpenseDialog(false);
      setEditingExpense(null);
      await loadData();
    } catch (err) {
      console.error('Save error:', err);
      setSnackbar({ open: true, message: 'Error: ' + (err.message || 'Failed to save'), severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteExpense(id);
      setSnackbar({ open: true, message: 'Deleted!', severity: 'success' });
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: 'Error: ' + (err.message || 'Failed to delete'), severity: 'error' });
    }
  };

  // ==================== CATEGORY MANAGEMENT ====================
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    try {
      const payload = {
        name: newCategory.name.trim(),
        color: newCategory.color,
        description: newCategory.description
      };

      await db.createExpenseCategory(payload);

      setNewCategory({ name: '', color: CATEGORY_COLORS[(categories.length) % CATEGORY_COLORS.length], description: '' });
      await loadData();
      setSnackbar({ open: true, message: 'Category added!', severity: 'success' });
    } catch (err) {
      console.error('Category add error:', err);
      setSnackbar({ open: true, message: 'Error: ' + (err.message || 'Failed to add category'), severity: 'error' });
    }
  };

  const handleDeleteCategory = async (id) => {
    const inUse = expenses.some(e => String(e.category_id) === String(id));
    if (inUse) {
      setSnackbar({ open: true, message: 'Cannot delete! Category is in use.', severity: 'warning' });
      return;
    }
    try {
      await db.deleteExpenseCategory(id);
      await loadData();
      setSnackbar({ open: true, message: 'Category deleted!', severity: 'success' });
    } catch (err) {
      console.error('Category delete error:', err);
      setSnackbar({ open: true, message: 'Error: ' + (err.message || 'Failed to delete'), severity: 'error' });
    }
  };

  // ==================== EXPORT ====================
  const handleExport = () => {
    const headers = ['Date', 'Title', 'Category', 'Amount', 'Payment Mode', 'Reference', 'Description'];
    const rows = filteredExpenses.map(e => [
      formatDate(e.date),
      e.title,
      categories.find(c => String(c.id) === String(e.category_id))?.name || '-',
      e.amount,
      e.payment_mode,
      e.reference_no || '-',
      e.description || '-'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: 'Exported to CSV!', severity: 'success' });
  };

  const getCategoryChip = (catId) => {
    const cat = categories.find(c => String(c.id) === String(catId));
    if (!cat) return <Chip size="small" label="Uncategorized" variant="outlined" />;
    return (
      <Chip 
        size="small" 
        label={cat.name}
        sx={{ 
          bgcolor: alpha(cat.color || '#757575', 0.15),
          color: cat.color || '#757575',
          borderColor: cat.color || '#757575',
          fontWeight: 600,
          border: '1px solid'
        }}
      />
    );
  };

  const getPaymentIcon = (mode) => {
    const m = EXPENSE_PAYMENT_MODES.find(p => p.value === mode);
    return m ? (
      <Tooltip title={m.label}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {m.icon}
          <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'inline' } }}>{m.label}</Typography>
        </Box>
      </Tooltip>
    ) : mode;
  };

  // ==================== RENDER ====================
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>

        {/* ===== HEADER ===== */}
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
            <AttachMoney sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} />
            {isMobile ? 'Expenses' : 'Expense Management'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
            {isMobile && (
              <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
                Menu
              </Button>
            )}
            {!isMobile && (
              <>
                <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
                  Filters (F4)
                </Button>
              </>
            )}
            <Button variant="outlined" size="small" startIcon={<Category />} onClick={() => setCategoryDialog(true)}>
              Categories (F3)
            </Button>
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => handleOpenExpense()}>
              {isMobile ? 'Add' : 'Add Expense (F2)'}
            </Button>
          </Stack>
        </Box>

        {/* ===== STATS CARDS ===== */}
        <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
          {[
            { 
              title: "Today's", 
              value: stats.todayTotal, 
              icon: <Today color="error" />, 
              color: 'error',
              subtitle: stats.trend > 0 ? `+${stats.trendPercent}%` : `${stats.trendPercent}%`,
              trend: stats.trend
            },
            { 
              title: 'This Week', 
              value: stats.weekTotal, 
              icon: <DateRange color="warning" />, 
              color: 'warning'
            },
            { 
              title: 'This Month', 
              value: stats.monthTotal, 
              icon: <CalendarToday color="info" />, 
              color: 'info'
            },
            { 
              title: 'Total', 
              value: stats.grandTotal, 
              icon: <TrendingUp color="success" />, 
              color: 'success'
            },
          ].map((stat, idx) => (
            <Grid item xs={6} md={3} key={idx}>
              <Zoom in={true}>
                <Card sx={{ 
                  bgcolor: alpha(theme.palette[stat.color].main, 0.08),
                  border: `1px solid ${alpha(theme.palette[stat.color].main, 0.2)}`,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                }}>
                  <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          {stat.title}
                        </Typography>
                        <Typography variant={isMobile ? 'subtitle1' : 'h5'} fontWeight="bold" color={`${stat.color}.main`} sx={{ my: 0.5 }}>
                          {formatCurrency(stat.value)}
                        </Typography>
                        {stat.subtitle && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                            {stat.subtitle}
                          </Typography>
                        )}
                      </Box>
                      <Avatar sx={{ 
                        bgcolor: alpha(theme.palette[stat.color].main, 0.15), 
                        color: `${stat.color}.main`,
                        width: isMobile ? 32 : 40,
                        height: isMobile ? 32 : 40
                      }}>
                        {stat.icon}
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          ))}
        </Grid>

        {/* ===== FILTERS BAR ===== */}
        {showFilters && (
          <Fade in={true}>
            <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
              <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputRef={searchRef}
                    InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <DatePicker
                    label="From"
                    value={dateFrom}
                    onChange={setDateFrom}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <DatePicker
                    label="To"
                    value={dateTo}
                    onChange={setDateTo}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All</MenuItem>
                      {categories.map(c => (
                        <MenuItem key={c.id} value={c.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color }} />
                            {c.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment</InputLabel>
                    <Select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} label="Payment">
                      <MenuItem value="">All</MenuItem>
                      {EXPENSE_PAYMENT_MODES.map(m => (
                        <MenuItem key={m.value} value={m.value}>{m.icon} {m.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    color="error" 
                    size="small"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('');
                      setFilterPayment('');
                      setFilterStatus('');
                      setDateFrom(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                      setDateTo(new Date());
                    }}
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Fade>
        )}

        {/* ===== DATA TABLE / CARDS ===== */}
        {isMobile ? (
          // Mobile Cards View
          <Box>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={40} />
                <Typography sx={{ mt: 2 }}>Loading...</Typography>
              </Box>
            ) : paginatedExpenses.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Receipt sx={{ fontSize: 48, color: '#d1d5db' }} />
                <Typography color="text.secondary">No expenses found</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenExpense()} sx={{ mt: 2, bgcolor: '#10b981' }}>
                  Add First Expense
                </Button>
              </Paper>
            ) : (
              paginatedExpenses.map((expense) => {
                const category = categories.find(c => String(c.id) === String(expense.category_id));
                return (
                  <MobileExpenseCard
                    key={expense.id}
                    expense={expense}
                    category={category}
                    onView={setViewExpense}
                    onEdit={handleOpenExpense}
                    onDelete={setDeleteConfirm}
                    getPaymentIcon={getPaymentIcon}
                  />
                );
              })
            )}
            {filteredExpenses.length > rowsPerPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination 
                  count={totalPages} 
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
          <Paper sx={{ overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', width: 50 }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Receipt #</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Title</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Amount</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                        <CircularProgress size={40} />
                        <Typography color="text.secondary" sx={{ mt: 2 }}>Loading expenses...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : paginatedExpenses.map((expense, idx) => (
                    <TableRow 
                      key={expense.id} 
                      hover
                      sx={{ 
                        bgcolor: expense.status === 'cancelled' ? alpha(theme.palette.error.main, 0.05) : 'inherit',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                          {expense.receipt_no || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{expense.title}</Typography>
                        {expense.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {expense.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{getCategoryChip(expense.category_id)}</TableCell>
                      <TableCell>{getPaymentIcon(expense.payment_mode)}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color={expense.status === 'cancelled' ? 'text.disabled' : 'error.main'}>
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          size="small" 
                          label={expense.status || 'active'}
                          color={expense.status === 'cancelled' ? 'error' : expense.status === 'pending' ? 'warning' : 'success'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton size="small" color="info" onClick={() => setViewExpense(expense)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" color="primary" onClick={() => handleOpenExpense(expense)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(expense)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && paginatedExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                        <Typography color="text.secondary">No expenses found</Typography>
                        <Button variant="outlined" sx={{ mt: 1 }} onClick={() => handleOpenExpense()}>
                          Add First Expense
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Table Footer */}
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}>
                Showing {paginatedExpenses.length} of {filteredExpenses.length} | Total: {formatCurrency(filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
              </Typography>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={(e, p) => setPage(p)} 
                color="primary" 
                size="small"
                showFirstButton 
                showLastButton
              />
            </Box>
          </Paper>
        )}

        {/* ===== ADD/EDIT EXPENSE DIALOG ===== */}
        <Dialog open={expenseDialog} onClose={() => setExpenseDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
          <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            {!isMobile && (
              <Typography variant="caption" color="white" sx={{ display: 'block', opacity: 0.8 }}>
                Press Ctrl+Enter to save, Esc to cancel
              </Typography>
            )}
          </DialogTitle>
          <form onSubmit={handleSaveExpense}>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={isMobile ? 1.5 : 2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Expense Title *"
                    name="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                    autoFocus
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Amount (PKR) *"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category *</InputLabel>
                    <Select
                      value={formData.category_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                      label="Category *"
                      required
                    >
                      <MenuItem value=""><em>Select Category</em></MenuItem>
                      {categories.map(c => (
                        <MenuItem key={c.id} value={String(c.id)}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color }} />
                            {c.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={formData.payment_mode}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_mode: e.target.value }))}
                      label="Payment Mode"
                    >
                      {EXPENSE_PAYMENT_MODES.map(m => (
                        <MenuItem key={m.value} value={m.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {m.icon}
                            {m.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Receipt / Reference #"
                    value={formData.receipt_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, receipt_no: e.target.value }))}
                    placeholder="Auto-generated if empty"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional notes about this expense..."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      label="Status"
                    >
                      <MenuItem value="active">Active / Paid</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
              <Button fullWidth={isMobile} onClick={() => setExpenseDialog(false)} startIcon={<Close />}>
                Cancel (Esc)
              </Button>
              <Button fullWidth={isMobile} type="submit" variant="contained" startIcon={<Save />} sx={{ bgcolor: '#10b981' }} disabled={loading}>
                {loading ? 'Saving...' : editingExpense ? 'Update' : 'Save'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* ===== CATEGORY MANAGEMENT DIALOG ===== */}
        <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
            Expense Categories
          </DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleAddCategory} sx={{ mb: 3 }}>
              <Grid container spacing={isMobile ? 1 : 2}>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Category Name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Color</InputLabel>
                    <Select
                      value={newCategory.color}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                      label="Color"
                      renderValue={(val) => (
                        <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: val, border: '1px solid #ddd' }} />
                      )}
                    >
                      {CATEGORY_COLORS.map((c, i) => (
                        <MenuItem key={i} value={c}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c }} />
                            <Typography variant="caption">{c}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={1}>
                  <Button type="submit" variant="contained" size="small" fullWidth sx={{ height: '100%', bgcolor: '#10b981' }}>
                    <Add />
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Color</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Description</TableCell>
                    <TableCell align="right">Used</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map(cat => {
                    const usageCount = expenses.filter(e => String(e.category_id) === String(cat.id)).length;
                    return (
                      <TableRow key={cat.id}>
                        <TableCell>
                          <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: cat.color, border: '2px solid white', boxShadow: 1 }} />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="bold">{cat.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{cat.description || '-'}</TableCell>
                        <TableCell align="right">
                          <Badge badgeContent={usageCount} color="primary" />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleDeleteCategory(cat.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No categories yet</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCategoryDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* ===== VIEW EXPENSE DIALOG ===== */}
        <Dialog open={!!viewExpense} onClose={() => setViewExpense(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
            Expense Details
          </DialogTitle>
          <DialogContent>
            {viewExpense && (
              <Stack spacing={isMobile ? 1.5 : 2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant={isMobile ? 'h5' : 'h4'} color="error" fontWeight="bold">
                    {formatCurrency(viewExpense.amount)}
                  </Typography>
                  {getCategoryChip(viewExpense.category_id)}
                </Box>
                <Divider />
                <Grid container spacing={isMobile ? 1 : 2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Title</Typography>
                    <Typography fontWeight="bold">{viewExpense.title}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography>{formatDate(viewExpense.date)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Payment Mode</Typography>
                    <Typography>{getPaymentIcon(viewExpense.payment_mode)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip 
                      size="small" 
                      label={viewExpense.status || 'active'}
                      color={viewExpense.status === 'cancelled' ? 'error' : viewExpense.status === 'pending' ? 'warning' : 'success'}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Receipt #</Typography>
                    <Typography fontFamily="monospace">{viewExpense.receipt_no || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Reference #</Typography>
                    <Typography fontFamily="monospace">{viewExpense.reference_no || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Description</Typography>
                    <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'background.default' }}>
                      <Typography variant="body2">{viewExpense.description || 'No description provided.'}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button fullWidth={isMobile} onClick={() => setViewExpense(null)}>Close</Button>
            <Button 
              fullWidth={isMobile}
              variant="contained" 
              startIcon={<Edit />} 
              onClick={() => {
                const ve = viewExpense;
                setViewExpense(null);
                handleOpenExpense(ve);
              }}
              sx={{ bgcolor: '#10b981' }}
            >
              Edit
            </Button>
          </DialogActions>
        </Dialog>

        {/* ===== DELETE CONFIRM ===== */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
          <DialogTitle sx={{ color: 'error.main' }}>
            <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{deleteConfirm?.title}</strong> worth {formatCurrency(deleteConfirm?.amount)}?
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              color="error" 
              variant="contained" 
              startIcon={<Delete />}
              onClick={() => handleDelete(deleteConfirm.id)}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* ===== MOBILE DRAWER ===== */}
        <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
          <Box sx={{ p: 2, pb: 4 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
            <List>
              <ListItem button onClick={() => { setMobileDrawer(false); handleOpenExpense(); }}>
                <ListItemIcon><Add /></ListItemIcon>
                <ListItemText primary="Add Expense" />
              </ListItem>
              <ListItem button onClick={() => { setMobileDrawer(false); setCategoryDialog(true); }}>
                <ListItemIcon><Category /></ListItemIcon>
                <ListItemText primary="Manage Categories" />
              </ListItem>
              <ListItem button onClick={() => { setMobileDrawer(false); setShowFilters(!showFilters); }}>
                <ListItemIcon><FilterList /></ListItemIcon>
                <ListItemText primary={showFilters ? 'Hide Filters' : 'Show Filters'} />
              </ListItem>
              <ListItem button onClick={() => { setMobileDrawer(false); handleExport(); }}>
                <ListItemIcon><Download /></ListItemIcon>
                <ListItemText primary="Export Data" />
              </ListItem>
              <ListItem button onClick={() => { setMobileDrawer(false); loadData(); }}>
                <ListItemIcon><Refresh /></ListItemIcon>
                <ListItemText primary="Refresh Data" />
              </ListItem>
            </List>
          </Box>
        </Drawer>

        {/* ===== SNACKBAR ===== */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
          sx={{ mb: isMobile ? 8 : 0 }}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* ===== FLOATING ACTION BUTTON (Mobile) ===== */}
        {isMobile && (
          <Fab
            color="primary"
            sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }}
            onClick={() => handleOpenExpense()}
          >
            <Add />
          </Fab>
        )}
      </Box>
    </LocalizationProvider>
  );
}