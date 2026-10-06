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
} from '../components/ui/tailwind-mui';
import {
  Search, FilterList, Visibility, Print, Refresh, Today, DateRange,
  TrendingUp, KeyboardReturn, AssignmentReturn, Phone, History,
  Menu as MenuIcon, Close, ArrowUpward, ArrowDownward, Receipt,
  CheckCircle, Cancel, Warning, Error, ShoppingCart, Delete,
  DeleteSweep, CalendarToday
} from '../components/ui/icons';
import db from '../database/db';
import useSyncListener from '../hooks/useSyncListener';
import { formatCleanId, isHashId } from '../utils/receiptGenerator';
import UnifiedPagination from '../components/common/UnifiedPagination';

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

// ==================== MOBILE SALE CARD WITH DELETE ====================
const MobileSaleCard = ({ sale, onProcessReturn, onDelete, index, canDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: sale.payment_status === 'paid' ? '4px solid #10b981' : sale.payment_status === 'partial' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              #{index} {sale.invoice_no && !isHashId(sale.invoice_no) ? sale.invoice_no : ''}
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

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<KeyboardReturn />} 
            onClick={() => onProcessReturn(sale)}
            sx={{ flex: 1, bgcolor: '#f59e0b', fontSize: '0.6rem', py: 0.5 }}
          >
            Return
          </Button>
          {canDelete && (
            <Tooltip title="Delete Sale">
              <IconButton size="small" color="error" onClick={() => onDelete(sale)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE RETURN CARD WITH DELETE ====================
const MobileReturnCard = ({ ret, onView, onDelete, index, canDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: '4px solid #f59e0b' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              #{index} RET-{ret.return_no || (isHashId(ret.id) ? index : ret.id)}
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

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2">{formatDate(ret.return_date)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Invoice</Typography>
              <Typography variant="body2">{ret.invoice_no || ret.original_invoice}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Reason</Typography>
              <Typography variant="body2">{ret.reason || 'General'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<Visibility />} 
            onClick={() => onView(ret)}
            sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}
          >
            View
          </Button>
          {canDelete && (
            <Tooltip title="Delete Return">
              <IconButton size="small" color="error" onClick={() => onDelete(ret)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
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
  const [returnPage, setReturnPage] = useState(1);
  const [returnRowsPerPage, setReturnRowsPerPage] = useState(isMobile ? 10 : 25);

  // Process Return Dialog
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [returnForm, setReturnForm] = useState({ reason: '', refund_mode: 'cash', account_id: '', notes: '' });
  const [processingReturn, setProcessingReturn] = useState(false);

  // View Return Dialog
  const [viewReturnDialog, setViewReturnDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnItemsView, setReturnItemsView] = useState([]);

  // Delete Dialogs
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('sale');
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState('all');

  // Stats Counters
  const [stats, setStats] = useState({
    todayReturns: 0,
    todayRefund: 0,
    periodReturns: 0,
    periodRefund: 0,
    byMode: []
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { can } = usePermissions();

  // ==================== LOAD DATA ====================
  const loadData = async () => {
    setLoading(true);
    try {
      const [allSales, allReturns, customersList, accountsList] = await Promise.all([
        db.getSalesHistory().catch(() => []),
        db.getSaleReturns().catch(() => []),
        db.getCustomers().catch(() => []),
        db.getAccounts ? db.getAccounts({ status: 'active' }).catch(() => []) : []
      ]);
      setAccounts(Array.isArray(accountsList) ? accountsList : []);

      // Count items efficiently without N+1 db calls
      let saleItemCounts = {};
      try {
        if (typeof db.getAllSaleItems === 'function') {
          const allItems = await db.getAllSaleItems().catch(() => []);
          if (Array.isArray(allItems)) {
            for (const it of allItems) {
              const sId = String(it.sale_id || '');
              if (sId) saleItemCounts[sId] = (saleItemCounts[sId] || 0) + 1;
            }
          }
        }
      } catch (_) {}

      const salesWithCount = (allSales || []).map(s => {
        let total = 0;
        if (Array.isArray(s.items)) {
          total = s.items.length;
        } else if (typeof s.items === 'string' && s.items.startsWith('[')) {
          try { total = JSON.parse(s.items).length; } catch (_) {}
        } else if (s.items_json) {
          try { total = (typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json).length; } catch (_) {}
        }
        if (!total && saleItemCounts[String(s.id)]) total = saleItemCounts[String(s.id)];
        if (!total && s.invoice_no && saleItemCounts[String(s.invoice_no)]) total = saleItemCounts[String(s.invoice_no)];
        return { ...s, total_items: total || 1 };
      });

      const filteredSales = salesWithCount.filter(sale => {
        if (sale.is_deleted) return false;
        const checkDate = String(sale.date || '').substring(0, 10);
        if (filterDateFrom && checkDate < filterDateFrom) return false;
        if (filterDateTo && checkDate > filterDateTo) return false;
        if (filterCustomer && Number(sale.customer_id) !== Number(filterCustomer)) return false;
        return true;
      });

      const sortedSales = filteredSales.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });
      
      const sortedReturns = (allReturns || []).sort((a, b) => {
        const dateA = new Date(a.return_date || 0);
        const dateB = new Date(b.return_date || 0);
        return dateB - dateA;
      });

      setSales(sortedSales);
      setReturns(sortedReturns);
      setCustomers(customersList || []);

      const todayStr = getToday();
      const todayReturns = (allReturns || []).filter(r => String(r.return_date || '').substring(0, 10) === todayStr);
      const todayRefundSum = todayReturns.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
      const periodRefundSum = (allReturns || []).reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

      const modeMap = {};
      (allReturns || []).forEach(r => {
        const mode = r.payment_mode || r.refund_mode || 'cash';
        modeMap[mode] = (modeMap[mode] || 0) + Number(r.refund_amount || 0);
      });
      const byModeArray = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));

      setStats({
        todayReturns: todayReturns.length,
        todayRefund: todayRefundSum,
        periodReturns: (allReturns || []).length,
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
  useSyncListener(loadData);

  // ==================== DELETE FUNCTIONS ====================

  const handleDeleteSale = async (sale) => {
    setDeleteTarget(sale);
    setDeleteType('sale');
    setDeleteDialog(true);
  };

  const handleDeleteReturn = async (ret) => {
    setDeleteTarget(ret);
    setDeleteType('return');
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!can('sales', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: You cannot delete!', severity: 'error' });
      setDeleteDialog(false);
      return;
    }
    try {
      if (deleteType === 'sale') {
        await db.deleteSale(deleteTarget.id);
        setSnackbar({ open: true, message: `Sale ${deleteTarget.invoice_no} deleted successfully!`, severity: 'success' });
      } else if (deleteType === 'return') {
        const items = await db.getSaleReturnItems(deleteTarget.id).catch(() => []);
        for (const item of items) {
          await db.updateVariantStock(item.product_variant_id, -item.quantity);
        }
        await db.deleteSaleReturn(deleteTarget.id);
        setSnackbar({ open: true, message: `Return RET-${deleteTarget.id} deleted successfully! Stock restored.`, severity: 'success' });
      }
      setDeleteDialog(false);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  const handleBulkDeleteByDate = async () => {
    if (!can('sales', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: Bulk delete not allowed!', severity: 'error' });
      setBulkDeleteDialog(false);
      return;
    }
    let targetSales = [];
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (bulkDeleteType === 'all') {
      targetSales = sales.map(s => s.id);
    } else if (bulkDeleteType === 'weekly') {
      targetSales = sales
        .filter(s => new Date(s.date) >= oneWeekAgo)
        .map(s => s.id);
    } else if (bulkDeleteType === 'monthly') {
      targetSales = sales
        .filter(s => new Date(s.date) >= oneMonthAgo)
        .map(s => s.id);
    }

    if (targetSales.length === 0) {
      setSnackbar({ open: true, message: 'No sales found in this period!', severity: 'warning' });
      setBulkDeleteDialog(false);
      return;
    }

    try {
      for (const id of targetSales) {
        await db.deleteSale(id);
      }
      setSnackbar({ open: true, message: `${targetSales.length} sales deleted successfully!`, severity: 'success' });
      setBulkDeleteDialog(false);
      loadData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      setSnackbar({ open: true, message: 'Bulk delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== OPEN PROCESS RETURN ====================
  const handleOpenProcess = async (sale) => {
    setSelectedSale(sale);
    try {
      let items = await db.getSaleItems(sale.id).catch(() => []);
      if (!items || items.length === 0) {
        if (sale.items) {
          let parsed = sale.items;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (_) { parsed = []; }
          }
          if (Array.isArray(parsed) && parsed.length > 0) items = parsed;
        }
      }
      if (!items || items.length === 0) {
        if (sale.invoice_no) {
          items = await db.getSaleItems(sale.invoice_no).catch(() => []);
        }
      }
      const validItems = (Array.isArray(items) ? items : []).map(i => ({
        ...i,
        product_name: i.product_name || i.name || i.item_name || 'Item',
        sku: i.sku || '-',
        quantity: Number(i.quantity || i.qty || 1),
        price: Number(i.price || i.rate || 0)
      }));
      
      setSaleItems(validItems);
      setReturnItems(validItems.map(item => ({
        ...item,
        selected: false,
        returnQty: 0,
        returnPrice: item.price || 0,
        condition: 'good'
      })));
      const defaultAcc = accounts.find(a => 
        sale.payment_mode === 'bank' ? (a.account_type === 'bank' || a.type === 'bank') : (a.account_type === 'cash' || a.type === 'cash')
      ) || accounts[0];
      setReturnForm({ 
        reason: '', 
        refund_mode: sale.payment_mode || 'cash', 
        account_id: defaultAcc?.id || '',
        notes: '' 
      });
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

  // ==================== PROCESS RETURN ====================
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
        account_id: returnForm.account_id || null,
        notes: returnForm.notes || '',
        items: selectedItems.map(item => ({
          product_id: item.product_id || item.productId,
          product_variant_id: item.product_variant_id || item.variant_id,
          quantity: item.returnQty,
          unit_price: item.returnPrice,
          total: item.returnQty * item.returnPrice,
          reason: returnForm.reason
        }))
      };

      await db.createSaleReturn(returnData);

      // ─── 2. SUBTRACT RETURN PRICE FROM ORIGINAL SALE ───
      const curGrandTotal = Number(selectedSale.grand_total || 0);
      const curSubtotal = Number(selectedSale.subtotal || curGrandTotal);
      const curPaid = Number(selectedSale.paid_amount || 0);
      const curDue = Number(selectedSale.due_amount || Math.max(0, curGrandTotal - curPaid));

      const newGrandTotal = Math.max(0, curGrandTotal - totalRefund);
      const newSubtotal = Math.max(0, curSubtotal - totalRefund);

      let newDue = curDue;
      let newPaid = curPaid;

      if (curDue > 0) {
        const dueReduction = Math.min(curDue, totalRefund);
        newDue = Math.max(0, curDue - dueReduction);
        const remainingRefund = totalRefund - dueReduction;
        if (remainingRefund > 0) {
          newPaid = Math.max(0, curPaid - remainingRefund);
        }
      } else {
        newPaid = Math.max(0, curPaid - totalRefund);
      }

      let newStatus = 'paid';
      if (newGrandTotal <= 0) {
        newStatus = 'returned';
      } else if (newDue > 0) {
        newStatus = (newPaid > 0 ? 'partial' : 'due');
      } else {
        newStatus = 'paid';
      }

      await db.updateSale(selectedSale.id, {
        grand_total: newGrandTotal,
        subtotal: newSubtotal,
        paid_amount: newPaid,
        due_amount: newDue,
        payment_status: newStatus
      });

      // ─── 3. CUSTOMER BALANCE & LEDGER ───
      if (selectedSale.customer_id) {
        const customer = await db.getCustomerById(selectedSale.customer_id);
        if (customer && curDue > 0) {
          const currentBalance = Number(customer.current_balance || 0);
          const balReduction = Math.min(curDue, totalRefund);
          const newBalance = Math.max(0, currentBalance - balReduction);
          await db.updateCustomer(selectedSale.customer_id, { 
            ...customer, 
            current_balance: newBalance 
          });
        }
        if (db.addCustomerLedgerEntry) {
          await db.addCustomerLedgerEntry({
            customer_id: selectedSale.customer_id,
            type: 'sale_return',
            amount: -totalRefund,
            description: `Sale Return for Invoice #${selectedSale.invoice_no} (${generatedReturnNo})`,
            payment_mode: returnForm.refund_mode,
            reference_no: generatedReturnNo,
            sale_id: selectedSale.id
          }).catch(() => {});
        }
      }

      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger('return', parentReturnId, 0, totalRefund, `Return for invoice ${selectedSale.invoice_no}`);
      }

      setSnackbar({ open: true, message: `Return processed! Sale total reduced by Rs. ${totalRefund.toLocaleString()}`, severity: 'success' });
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

  const paginatedReturns = useMemo(() => {
    const start = (returnPage - 1) * returnRowsPerPage;
    return returns.slice(start, start + returnRowsPerPage);
  }, [returns, returnPage, returnRowsPerPage]);

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
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
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
          {can('sales', 'delete') && (
            <Button variant="outlined" color="error" size="small" startIcon={<DeleteSweep />} onClick={() => setBulkDeleteDialog(true)}>
              Bulk Delete
            </Button>
          )}
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: "Today's Returns", value: stats.todayReturns, label: `${formatCurrency(stats.todayRefund)} refunded` },
          { title: 'Period Returns', value: stats.periodReturns, label: `${formatCurrency(stats.periodRefund)} total refunded` },
          { title: 'Net Impact', value: formatCurrency(stats.periodRefund), label: 'Total reversals' },
        ].map((stat, idx) => (
          <Grid item xs={12} md={4} key={idx}>
            <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                  {stat.title}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
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
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={6} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Search Invoice" placeholder="Search invoice..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
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

      {/* ==================== TAB 0: SALES WITH DELETE ==================== */}
      {activeTab === 0 && (
        <Fade in>
          {isMobile ? (
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
                paginatedSales.map((sale, idx) => (
                  <MobileSaleCard 
                    key={sale.id} 
                    sale={sale}
                    index={(page - 1) * rowsPerPage + idx + 1}
                    onProcessReturn={handleOpenProcess}
                    onDelete={handleDeleteSale}
                    canDelete={can('sales', 'delete')}
                  />
                ))
              )}
              <UnifiedPagination
                count={filteredSales.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(newR) => {
                  setRowsPerPage(newR);
                  setPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Box>
          ) : (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>#</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Invoice</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Items</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Paid</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSales.map((sale, idx) => (
                      <TableRow key={sale.id} hover>
                        <TableCell>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">{formatCleanId(sale, (page - 1) * rowsPerPage + idx)}</Typography>
                          <Typography variant="caption" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>{sale.sale_type || 'retail'}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(sale.date)}</TableCell>
                        <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                        <TableCell><Chip size="small" label={`${sale.total_items || 1} items`} variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                        <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Process Return">
                              <IconButton size="small" color="warning" onClick={() => handleOpenProcess(sale)}>
                                <KeyboardReturn fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {can('sales', 'delete') && (
                              <Tooltip title="Delete Sale">
                                <IconButton size="small" color="error" onClick={() => handleDeleteSale(sale)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedSales.length === 0 && (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No records found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={filteredSales.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(newR) => {
                  setRowsPerPage(newR);
                  setPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Paper>
          )}
        </Fade>
      )}

      {/* ==================== TAB 1: RETURNS WITH DELETE ==================== */}
      {activeTab === 1 && (
        <Fade in>
          {isMobile ? (
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LinearProgress />
                  <Typography sx={{ mt: 2 }}>Loading...</Typography>
                </Box>
              ) : returns.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <AssignmentReturn sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No returns found</Typography>
                </Paper>
              ) : (
                paginatedReturns.map((ret, idx) => (
                  <MobileReturnCard 
                    key={ret.id} 
                    ret={ret}
                    index={(returnPage - 1) * returnRowsPerPage + idx + 1}
                    onView={handleViewReturn}
                    onDelete={handleDeleteReturn}
                    canDelete={can('sales', 'delete')}
                  />
                ))
              )}
              <UnifiedPagination
                count={returns.length}
                page={returnPage}
                rowsPerPage={returnRowsPerPage}
                onPageChange={setReturnPage}
                onRowsPerPageChange={(newR) => {
                  setReturnRowsPerPage(newR);
                  setReturnPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Box>
          ) : (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>#</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Return ID</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Original Invoice</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Reason</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Refund</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Mode</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedReturns.map((ret, idx) => (
                      <TableRow key={ret.id} hover>
                        <TableCell>{(returnPage - 1) * returnRowsPerPage + idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>RET-{ret.return_no || (isHashId(ret.id) ? idx + 1 : ret.id)}</TableCell>
                        <TableCell sx={{ color: 'primary.main', fontWeight: 500 }}>{formatCleanId(ret.invoice_no || ret.original_invoice, idx)}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(ret.return_date)}</TableCell>
                        <TableCell>{ret.customer_name || 'Walk-in'}</TableCell>
                        <TableCell><Chip size="small" label={ret.reason || 'General'} color="warning" variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>{formatCurrency(ret.refund_amount)}</TableCell>
                        <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{ret.payment_mode || 'cash'}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="View">
                              <IconButton size="small" color="info" onClick={() => handleViewReturn(ret)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {can('sales', 'delete') && (
                              <Tooltip title="Delete Return">
                                <IconButton size="small" color="error" onClick={() => handleDeleteReturn(ret)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {returns.length === 0 && (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No returns found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={returns.length}
                page={returnPage}
                rowsPerPage={returnRowsPerPage}
                onPageChange={setReturnPage}
                onRowsPerPageChange={(newR) => {
                  setReturnRowsPerPage(newR);
                  setReturnPage(1);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
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

      {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ef4444', color: 'white' }}>
          <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>
            {deleteType === 'sale' ? (
              <>Are you sure you want to delete invoice <strong>{deleteTarget?.invoice_no}</strong>?</>
            ) : (
              <>Are you sure you want to delete return <strong>RET-{deleteTarget?.id}</strong>?</>
            )}
          </Typography>
          <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
            This action cannot be undone!
          </Typography>
          {deleteType === 'return' && (
            <Typography variant="caption" color="warning.main" display="block">
              Stock will be restored automatically.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== BULK DELETE DIALOG ==================== */}
      <Dialog open={bulkDeleteDialog} onClose={() => setBulkDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ef4444', color: 'white' }}>
          <DeleteSweep sx={{ verticalAlign: 'middle', mr: 1 }} />
          Bulk Delete Sales
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select the period for which you want to delete all sales:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
            <Button 
              variant="outlined" 
              color="error" 
              fullWidth
              onClick={() => { setBulkDeleteType('weekly'); handleBulkDeleteByDate(); }}
              startIcon={<CalendarToday />}
              sx={{ py: 1.5 }}
            >
              Last 7 Days
            </Button>
            <Button 
              variant="outlined" 
              color="error" 
              fullWidth
              onClick={() => { setBulkDeleteType('monthly'); handleBulkDeleteByDate(); }}
              startIcon={<CalendarToday />}
              sx={{ py: 1.5 }}
            >
              Last 30 Days
            </Button>
            <Button 
              variant="contained" 
              color="error" 
              fullWidth
              onClick={() => { setBulkDeleteType('all'); handleBulkDeleteByDate(); }}
              startIcon={<DeleteSweep />}
              sx={{ py: 1.5 }}
            >
              Delete All
            </Button>
          </Box>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
            <Typography variant="caption" color="error.main">
              This will permanently delete all sales in the selected period. This action cannot be undone!
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== PROCESS RETURN DIALOG ==================== */}
      <Dialog open={processDialog} onClose={() => !processingReturn && setProcessDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5 }}>
          <KeyboardReturn sx={{ verticalAlign: 'middle', mr: 1 }} /> 
          Process Return — Invoice {formatCleanId(selectedSale)}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale && (
            <Box>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell padding="checkbox" sx={{ py: 1.5 }}>
                        <Checkbox 
                          checked={returnItems.length > 0 && returnItems.every(i => i.selected)} 
                          indeterminate={returnItems.some(i => i.selected) && !returnItems.every(i => i.selected)} 
                          onChange={(e) => handleToggleSelectAll(e.target.checked)} 
                          sx={{ color: 'white', '&.Mui-checked': { color: 'white' }, '&.MuiCheckbox-indeterminate': { color: 'white' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Product</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Qty</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Return</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Refund Price</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Total</TableCell>
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
                <Grid item xs={12} md={3}>
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
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Mode</InputLabel>
                    <Select 
                      value={returnForm.refund_mode} 
                      onChange={(e) => {
                        const m = e.target.value;
                        const matchAcc = accounts.find(a => 
                          m === 'bank' ? (a.account_type === 'bank' || a.type === 'bank') : (a.account_type === 'cash' || a.type === 'cash')
                        ) || accounts[0];
                        setReturnForm(p => ({ ...p, refund_mode: m, account_id: matchAcc?.id || p.account_id }));
                      }} 
                      label="Refund Mode"
                    >
                      {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Deduct From Account</InputLabel>
                    <Select 
                      value={returnForm.account_id || ''} 
                      onChange={(e) => setReturnForm(p => ({ ...p, account_id: e.target.value }))} 
                      label="Deduct From Account"
                    >
                      <MenuItem value=""><em>-- No account deduction --</em></MenuItem>
                      {accounts.map(acc => (
                        <MenuItem key={acc.id} value={acc.id}>
                          {acc.name} (Rs. {Number(acc.current_balance || 0).toLocaleString()})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
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
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Product</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Qty</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Refund</TableCell>
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
            {can('sales', 'delete') && (
              <ListItem button onClick={() => { setMobileDrawer(false); setBulkDeleteDialog(true); }}>
                <ListItemIcon><DeleteSweep /></ListItemIcon>
                <ListItemText primary="Bulk Delete Sales" />
              </ListItem>
            )}
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