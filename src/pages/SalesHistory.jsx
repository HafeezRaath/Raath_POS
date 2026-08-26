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
  ShoppingCart,
  Delete,
  DeleteSweep,
  CalendarToday
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
  Zoom,
  Tooltip,
  ButtonGroup
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';  // ✅ Direct import = 100% reliable
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
    if (typeof dateStr === 'string') {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
      if (match) {
        const [, year, month, day, hour, minute] = match;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthName = monthNames[parseInt(month, 10) - 1];
        if (hour !== undefined) {
          return `${day} ${monthName} ${year}, ${hour}:${minute}`;
        }
        return `${day} ${monthName} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const getToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ==================== PDF EXPORT HELPERS ====================
const generateSalesPDF = (sales, stats, filterDateFrom, filterDateTo) => {
  try {
    const doc = new jsPDF('l', 'mm', 'a4');
    const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text(shop.name || 'Sales History Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${filterDateFrom || 'All'} to ${filterDateTo || 'All'}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 33);
    if (shop.phone) doc.text(`Phone: ${shop.phone}`, 14, 38);
    if (shop.address) doc.text(`Address: ${shop.address}`, 14, 43);
    
    const headers = [['#', 'Invoice', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Due', 'Status']];
    const data = sales.map((sale, idx) => [
      idx + 1,
      sale.invoice_no,
      formatDate(sale.date),
      sale.customer_name || 'Walk-in',
      sale.total_items || 1,
      `Rs. ${Number(sale.grand_total).toFixed(2)}`,
      `Rs. ${Number(sale.paid_amount).toFixed(2)}`,
      `Rs. ${Number(sale.due_amount || 0).toFixed(2)}`,
      sale.payment_status?.toUpperCase() || 'N/A'
    ]);
    
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 45 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' },
        7: { cellWidth: 25, halign: 'right' },
        8: { cellWidth: 25, halign: 'center' }
      }
    });
    
    const finalY = (doc.lastAutoTable?.finalY || 50) + 10;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('SUMMARY', 14, finalY);
    doc.setFontSize(10);
    doc.text(`Total Invoices: ${sales.length}`, 14, finalY + 7);
    doc.text(`Grand Total: Rs. ${Number(stats.period.amount).toFixed(2)}`, 80, finalY + 7);
    doc.text(`Total Paid: Rs. ${Number(stats.period.paid).toFixed(2)}`, 160, finalY + 7);
    doc.text(`Total Due: Rs. ${Number(stats.period.due).toFixed(2)}`, 240, finalY + 7);
    doc.text(`Total Discount: Rs. ${Number(stats.period.discount).toFixed(2)}`, 14, finalY + 14);
    
    doc.save(`Sales_History_${filterDateFrom || 'All'}_to_${filterDateTo || 'All'}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF Error:', err);
    return false;
  }
};

const generateInvoicePDF = (sale, items) => {
  try {
    if (!sale) return false;
    const doc = new jsPDF('p', 'mm', 'a4');
    const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text(shop.name || 'SALES INVOICE', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    if (shop.address) doc.text(shop.address, pageWidth / 2, 25, { align: 'center' });
    if (shop.phone) doc.text(`Phone: ${shop.phone}`, pageWidth / 2, 30, { align: 'center' });
    
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 42, 90, 28, 'F');
    doc.text(`Invoice: ${sale.invoice_no}`, 14, 50);
    doc.text(`Date: ${formatDate(sale.date)}`, 14, 57);
    doc.text(`Customer: ${sale.customer_name || 'Walk-in'}`, 14, 64);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(110, 42, 90, 28, 'F');
    doc.text(`Status: ${sale.payment_status?.toUpperCase()}`, 114, 50);
    doc.text(`Payment: ${sale.payment_mode?.toUpperCase()}`, 114, 57);
    doc.text(`Type: ${sale.sale_type?.toUpperCase() || 'RETAIL'}`, 114, 64);
    
    const headers = [['#', 'Product', 'SKU', 'Qty', 'Price', 'Disc', 'Total']];
    const data = (items || []).map((item, idx) => [
      idx + 1,
      (item.product_name || item.name || 'Item').substring(0, 25),
      (item.sku || '-').substring(0, 15),
      item.quantity || item.qty || 0,
      `Rs. ${Number(item.price).toFixed(2)}`,
      `Rs. ${Number(item.discount || 0).toFixed(2)}`,
      `Rs. ${Number(item.total).toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 78,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' }
      }
    });
    
    const finalY = (doc.lastAutoTable?.finalY || 78) + 8;
    doc.setFillColor(240, 253, 244);
    doc.rect(120, finalY, 80, 48, 'F');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Subtotal:', 125, finalY + 10);
    doc.text(`Rs. ${Number(sale.subtotal).toFixed(2)}`, 190, finalY + 10, { align: 'right' });
    doc.text('Item Discount:', 125, finalY + 18);
    doc.text(`-Rs. ${Number(sale.item_discount || 0).toFixed(2)}`, 190, finalY + 18, { align: 'right' });
    doc.text('Bill Discount:', 125, finalY + 26);
    doc.text(`-Rs. ${Number(sale.discount || 0).toFixed(2)}`, 190, finalY + 26, { align: 'right' });
    doc.text(`Tax (${sale.fbr_tax_rate || 0}%):`, 125, finalY + 34);
    doc.text(`Rs. ${Number(sale.tax || 0).toFixed(2)}`, 190, finalY + 34, { align: 'right' });
    
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('GRAND TOTAL:', 125, finalY + 44);
    doc.text(`Rs. ${Number(sale.grand_total).toFixed(2)}`, 190, finalY + 44, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Paid: Rs. ${Number(sale.paid_amount).toFixed(2)}`, 125, finalY + 52);
    doc.text(`Due: Rs. ${Number(sale.due_amount || 0).toFixed(2)}`, 160, finalY + 52);
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Thank you for your business!', pageWidth / 2, 285, { align: 'center' });
    doc.text('This is a computer generated invoice.', pageWidth / 2, 290, { align: 'center' });
    
    doc.save(`Invoice_${sale.invoice_no}.pdf`);
    return true;
  } catch (err) {
    console.error('Invoice PDF Error:', err);
    return false;
  }
};

const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateString = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
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

// ==================== MOBILE SALE CARD ====================
const MobileSaleCard = ({ sale, onView, onPayment, onReturn, onDelete, index, canDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: sale.payment_status === 'paid' ? '4px solid #10b981' : sale.payment_status === 'partial' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              #{index} {sale.invoice_no}
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
const MobileReturnCard = ({ ret, onDelete, canDelete }) => {
  const [expanded, setExpanded] = useState(false);

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
            <Chip 
              size="small" 
              label={ret.payment_mode || 'cash'} 
              color="warning" 
              variant="outlined"
              sx={{ height: 16, fontSize: '0.5rem' }}
            />
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
              <Typography variant="caption" color="text.secondary">Reason</Typography>
              <Typography variant="body2">{ret.reason || 'General'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Notes</Typography>
              <Typography variant="body2">{ret.notes || '-'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<Visibility />} 
            onClick={() => onDelete(ret)}
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

  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(getStartOfMonth());
  const [filterDateTo, setFilterDateTo] = useState(getToday());
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

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

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('sale');
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState('all');

  const [stats, setStats] = useState({
    today: { count: 0, amount: 0 },
    period: { count: 0, amount: 0, paid: 0, due: 0, discount: 0 },
    byMode: [],
    byCustomer: []
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { can } = usePermissions();

  // ==================== DATABASE LOAD ====================
  const loadData = async () => {
    setLoading(true);
    try {
      const rawSales = await db.getSalesHistory();
      const rawReturns = await db.getSaleReturns();
      const customersList = await db.getCustomers();

      const sortedSales = (rawSales || []).sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

      const sortedReturns = (rawReturns || []).sort((a, b) => {
        const dateA = new Date(a.return_date || 0);
        const dateB = new Date(b.return_date || 0);
        return dateB - dateA;
      });

      const filteredSalesRows = sortedSales.filter(sale => {
        const saleDateClean = getLocalDateString(sale.date);
        if (filterDateFrom && saleDateClean < filterDateFrom) return false;
        if (filterDateTo && saleDateClean > filterDateTo) return false;
        if (filterCustomer && Number(sale.customer_id) !== Number(filterCustomer)) return false;
        if (filterPaymentMode && sale.payment_mode !== filterPaymentMode) return false;
        if (filterPaymentStatus && sale.payment_status !== filterPaymentStatus) return false;
        return true;
      });

      setSales(filteredSalesRows);
      setReturns(sortedReturns);
      setCustomers(customersList || []);

      const todayString = getToday();
      const todayRows = sortedSales.filter(x => getLocalDateString(x.date) === todayString);

      setStats({
        today: {
          count: todayRows.length,
          amount: todayRows.reduce((a, b) => a + Number(b.grand_total || 0), 0)
        },
        period: {
          count: filteredSalesRows.length,
          amount: filteredSalesRows.reduce((a, b) => a + Number(b.grand_total || 0), 0),
          paid: filteredSalesRows.reduce((a, b) => a + Number(b.paid_amount || 0), 0),
          due: filteredSalesRows.reduce((a, b) => {
            const dueVal = b.due_amount !== undefined && b.due_amount !== null 
              ? Number(b.due_amount) 
              : Number(b.grand_total || 0) - Number(b.paid_amount || 0);
            return a + Math.max(0, dueVal);
          }, 0),
          discount: filteredSalesRows.reduce((a, b) => a + Number(b.discount || 0) + Number(b.item_discount || 0), 0)
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

  // ==================== DELETE FUNCTIONS ====================
  const handleDeleteSale = async (sale) => {
    if (!sale || !sale.id) {
      setSnackbar({ open: true, message: 'Invalid sale selected!', severity: 'warning' });
      return;
    }
    setDeleteTarget(sale);
    setDeleteType('sale');
    setDeleteDialog(true);
  };

  const handleDeleteReturn = async (ret) => {
    if (!ret || !ret.id) {
      setSnackbar({ open: true, message: 'Invalid return selected!', severity: 'warning' });
      return;
    }
    setDeleteTarget(ret);
    setDeleteType('return');
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!can('sales', 'delete')) {
      setSnackbar({ open: true, message: '🚫 Permission Denied: You cannot delete!', severity: 'error' });
      setDeleteDialog(false);
      return;
    }
    try {
      if (deleteType === 'sale') {
        await db.deleteSale(deleteTarget.id);
        setSnackbar({ open: true, message: `Sale ${deleteTarget.invoice_no} deleted successfully!`, severity: 'success' });
      } else if (deleteType === 'return') {
        const returnItems = await db.getSaleReturnItems(deleteTarget.id);
        for (const item of returnItems) {
          await db.updateVariantStock(item.product_variant_id, -item.quantity);
        }
        await db.deleteSaleReturn(deleteTarget.id);
        setSnackbar({ open: true, message: `Return RET-${deleteTarget.id} deleted successfully!`, severity: 'success' });
      }
      setDeleteDialog(false);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('[SalesHistory] Delete error:', err);
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  const handleBulkDeleteByDate = async () => {
    if (!can('sales', 'delete')) {
      setSnackbar({ open: true, message: '🚫 Permission Denied: Bulk delete not allowed!', severity: 'error' });
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
      console.error('[SalesHistory] Bulk delete by date error:', err);
      setSnackbar({ open: true, message: 'Bulk delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== VIEW SALE DIALOG - FIXED ✅ ====================
  const handleViewSale = async (sale) => {
    if (!sale || !sale.id) {
      setSnackbar({ open: true, message: 'No sale selected!', severity: 'warning' });
      return;
    }
    setSelectedSale(sale);
    try {
      let items = await db.getSaleItems(sale.id);
      
      // 🔥 FIX: Agar items empty aaye toh direct sale_items table se fetch karo
      if (!items || items.length === 0) {
        console.log('⚠️ No items from getSaleItems, trying direct fetch...');
        // Direct IndexedDB se fetch using idbGetAll
        try {
          const allItems = await db.idbGetAll('sale_items');
          items = allItems.filter(item => item.sale_id === sale.id);
          console.log(`✅ Found ${items.length} items from direct fetch`);
        } catch (err) {
          console.log('⚠️ idbGetAll failed, trying getAllSaleItems...');
          // Try alternative method
          if (typeof db.getAllSaleItems === 'function') {
            const allItems = await db.getAllSaleItems();
            items = allItems.filter(item => item.sale_id === sale.id);
            console.log(`✅ Found ${items.length} items from getAllSaleItems`);
          }
        }
      }
      
      setSaleItems(items || []);
      setViewSaleDialog(true);
    } catch (err) {
      console.error('[SalesHistory] View sale error:', err);
      setSnackbar({ open: true, message: 'Item retrieval error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== PAYMENT FUNCTIONS ====================
  const handleOpenPayment = (sale) => {
    if (!sale) return;
    setPaymentSale(sale);
    const dueAmount = Number(sale.grand_total || 0) - Number(sale.paid_amount || 0);
    setPaymentAmount(String(Math.max(0, dueAmount)));
    setPaymentDialog(true);
  };

  const handleUpdatePayment = async () => {
    if (!paymentSale || !paymentAmount) {
      setSnackbar({ open: true, message: 'Please enter payment amount!', severity: 'warning' });
      return;
    }
    try {
      const parsedAddedCash = Number(paymentAmount);
      if (parsedAddedCash <= 0) {
        setSnackbar({ open: true, message: 'Amount must be greater than 0!', severity: 'warning' });
        return;
      }
      const computedTotalPaid = Number(paymentSale.paid_amount || 0) + parsedAddedCash;
      const originalGrandTotal = Number(paymentSale.grand_total || 0);
      
      let revisedStatus = 'due';
      if (computedTotalPaid >= originalGrandTotal) revisedStatus = 'paid';
      else if (computedTotalPaid > 0) revisedStatus = 'partial';

      const revisedDueAmount = Math.max(0, originalGrandTotal - computedTotalPaid);

      await db.updateSale(paymentSale.id, {
        paid_amount: computedTotalPaid,
        due_amount: revisedDueAmount,
        payment_status: revisedStatus
      });

      if (paymentSale.customer_id) {
        await db.updateCustomer(paymentSale.customer_id, {
          current_balance: Number(paymentSale.customer_balance || 0) - parsedAddedCash
        });
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
      console.error('[SalesHistory] Payment error:', err);
      setSnackbar({ open: true, message: 'Payment failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== RETURN FUNCTIONS ====================
  const handleOpenReturn = (sale) => {
    if (!sale) {
      setSnackbar({ open: true, message: 'No sale selected for return!', severity: 'warning' });
      return;
    }
    setReturningSale(sale);
    const items = saleItems.length > 0 ? saleItems : [];
    setReturnItems(items.map(item => ({
      ...item,
      returnQty: 0,
      returnPrice: item.price || 0,
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
      const result = await db.createSaleReturn({
        sale_id: returningSale.id,
        invoice_no: returningSale.invoice_no,
        return_no: generatedReturnNo,
        customer_id: returningSale.customer_id || null,
        return_date: new Date().toISOString(),
        refund_amount: netRefundCalculatedSum,
        payment_mode: returnForm.refund_mode,
        notes: returnForm.notes
      });

      const parentReturnRowId = result.lastInsertRowid;

      for (const row of activeReturnRows) {
        await db.createSaleReturnItem({
          sale_return_id: parentReturnRowId,
          product_variant_id: row.product_variant_id,
          quantity: row.returnQty,
          price: row.returnPrice,
          sub_total: row.returnQty * row.returnPrice,
          reason: returnForm.reason
        });

        await db.updateVariantStock(row.product_variant_id, row.returnQty);
      }

      if (returningSale.customer_id && returningSale.payment_status !== 'paid') {
        await db.updateCustomer(returningSale.customer_id, {
          current_balance: Number(returningSale.customer_balance || 0) - netRefundCalculatedSum
        });
      }

      setSnackbar({ open: true, message: 'Return processed successfully!', severity: 'success' });
      setReturnDialog(false);
      loadData();
    } catch (err) {
      console.error('[SalesHistory] Return error:', err);
      setSnackbar({ open: true, message: 'Return failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== TRACK FUNCTIONS ====================
  const handleTrackLifecycle = async () => {
    if (!trackQuery.trim()) {
      setSnackbar({ open: true, message: 'Please enter SKU or Barcode!', severity: 'warning' });
      return;
    }
    try {
      const variant = await db.getVariantBySKU(trackQuery.trim());
      if (variant) {
        const product = await db.getProductById(variant.product_id);
        setTrackResult({
          ...variant,
          product_name: product?.name || '',
          batch_purchase_invoice: '',
          purchased_on: '',
          supplier_company: '',
          final_sale_invoice: '',
          sold_on: '',
          sold_to_party: ''
        });
      } else {
        setTrackResult(null);
        setSnackbar({ open: true, message: 'Product not found!', severity: 'warning' });
      }
    } catch (err) {
      console.error('[SalesHistory] Track error:', err);
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

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      
      {/* ===== HEADER ===== */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <History sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Sales History' : 'Audit Control Desk: Sales & Returns'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
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
          {can('sales', 'delete') && (
            <Button variant="outlined" color="error" size="small" startIcon={<DeleteSweep />} onClick={() => setBulkDeleteDialog(true)}>
              Bulk Delete
            </Button>
          )}
          <Button 
            variant="contained" 
            size="small" 
            sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }} 
            startIcon={<Receipt />} 
            onClick={() => {
              const success = generateSalesPDF(filteredSales, stats, filterDateFrom, filterDateTo);
              if (success) setSnackbar({ open: true, message: '✅ PDF downloaded successfully!', severity: 'success' });
              else setSnackbar({ open: true, message: '❌ PDF generation failed', severity: 'error' });
            }}
          >
            {isMobile ? 'PDF' : 'Export PDF'}
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
        <Fade in={true}>
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
                    onView={handleViewSale}
                    onPayment={handleOpenPayment}
                    onReturn={() => { 
                      handleViewSale(sale); 
                      setTimeout(() => handleOpenReturn(sale), 300); 
                    }}
                    onDelete={handleDeleteSale}
                    canDelete={can('sales', 'delete')}
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
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>#</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>Invoice</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>Date</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>Customer</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>Items</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }} align="right">Total</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }} align="right">Paid</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>Status</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSales.map((sale, idx) => (
                      <TableRow key={sale.id} hover>
                        <TableCell>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">{sale.invoice_no}</Typography>
                          <Typography variant="caption" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>{sale.sale_type || 'retail'}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(sale.date)}</TableCell>
                        <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                        <TableCell><Chip label={`${sale.total_items || 1} items`} size="small" variant="outlined" sx={{ height: 20 }} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                        <TableCell>{getPaymentStatusChip(sale.payment_status)}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="View">
                              <IconButton size="small" color="primary" onClick={() => handleViewSale(sale)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {sale.payment_status !== 'paid' && (
                              <Tooltip title="Payment">
                                <IconButton size="small" color="success" onClick={() => handleOpenPayment(sale)}>
                                  <Payment fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Return">
                              <IconButton size="small" color="warning" onClick={() => { 
                                handleViewSale(sale); 
                                setTimeout(() => handleOpenReturn(sale), 300); 
                              }}>
                                <AssignmentReturn fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {can('sales', 'delete') && (
                              <Tooltip title="Delete">
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
              <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Showing {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, filteredSales.length)} of {filteredSales.length}
                </Typography>
                <Pagination count={Math.ceil(filteredSales.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
              </Box>
            </Paper>
          )}
        </Fade>
      )}

      {/* ===== TAB 1: RETURNS ===== */}
      {activeTab === 1 && (
        <Fade in={true}>
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
                returns.map((ret) => (
                  <MobileReturnCard 
                    key={ret.id} 
                    ret={ret} 
                    onDelete={handleDeleteReturn}
                    canDelete={can('sales', 'delete')}
                  />
                ))
              )}
            </Box>
          ) : (
            <Paper>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Return ID', 'Invoice', 'Date', 'Reason', 'Refund', 'Mode', 'Actions'].map((h) => (
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
                        <TableCell align="center">
                          {can('sales', 'delete') && (
                            <Tooltip title="Delete Return">
                              <IconButton size="small" color="error" onClick={() => handleDeleteReturn(ret)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {returns.length === 0 && (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No returns found</Typography></TableCell></TableRow>
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
        <Fade in={true}>
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
        <Fade in={true}>
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

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
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
          <Typography variant="caption" color="error.main">
            This action cannot be undone!
          </Typography>
          {deleteType === 'return' && (
            <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 1 }}>
              ⚠️ Stock will be restored automatically.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ===== BULK DELETE DIALOG ===== */}
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
              ⚠️ This will permanently delete all sales in the selected period. This action cannot be undone!
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ===== VIEW SALE DIALOG - FIXED ✅ ===== */}
      <Dialog open={viewSaleDialog} onClose={() => setViewSaleDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          Invoice: {selectedSale?.invoice_no || 'N/A'}
          <Chip 
            size="small" 
            label={String(selectedSale?.payment_status || 'unknown').toUpperCase()} 
            color={selectedSale?.payment_status === 'paid' ? 'success' : 'warning'} 
            sx={{ ml: 2, fontWeight: 'bold' }} 
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedSale ? (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2" fontWeight={500}>{formatDate(selectedSale.date)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedSale.customer_name || 'Walk-in'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Payment Mode</Typography>
                  <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.payment_mode}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Type</Typography>
                  <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{selectedSale.sale_type || 'Retail'}</Typography>
                </Grid>
              </Grid>

              {/* 🔥 FIXED: Items Table - Proper display with fallback */}
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
                    {!saleItems || saleItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            ⚠️ No items found for this sale
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Sale ID: {selectedSale.id}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      saleItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{item.product_name || item.name || 'Item'}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.sku || '-'}</Typography>
                          </TableCell>
                          <TableCell align="right" fontWeight={600}>{item.quantity || item.qty || 0}</TableCell>
                          <TableCell align="right">{formatCurrency(item.price || 0)}</TableCell>
                          <TableCell align="right" color="error.main">-{formatCurrency(item.discount || 0)}</TableCell>
                          <TableCell align="right" fontWeight="bold">{formatCurrency(item.total || (item.quantity * item.price) || 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={isMobile ? 1 : 2} sx={{ textAlign: 'center' }}>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                    <Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.subtotal)}</Typography>
                  </Grid>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="text.secondary">Discount</Typography>
                    <Typography variant="body2" color="error.main" fontWeight={600}>-{formatCurrency(selectedSale.discount)}</Typography>
                  </Grid>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="text.secondary">Tax</Typography>
                    <Typography variant="body2" fontWeight={600}>{formatCurrency(selectedSale.tax)}</Typography>
                  </Grid>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="primary">Grand Total</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary">{formatCurrency(selectedSale.grand_total)}</Typography>
                  </Grid>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="success.main">Paid</Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">{formatCurrency(selectedSale.paid_amount)}</Typography>
                  </Grid>
                  <Grid item xs={4} md={2}>
                    <Typography variant="caption" color="error.main">Due</Typography>
                    <Typography variant="body1" fontWeight="bold" color="error.main">{formatCurrency(selectedSale.due_amount || (selectedSale.grand_total - selectedSale.paid_amount))}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          ) : (
            <Typography align="center" color="text.secondary">No sale selected</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setViewSaleDialog(false)}>Close</Button>
          <Button 
            fullWidth={isMobile} 
            variant="outlined" 
            startIcon={<Receipt />} 
            onClick={() => {
              if (selectedSale) {
                const success = generateInvoicePDF(selectedSale, saleItems);
                if (success) setSnackbar({ open: true, message: '✅ Invoice PDF downloaded!', severity: 'success' });
                else setSnackbar({ open: true, message: '❌ PDF generation failed', severity: 'error' });
              }
            }}
          >
            Download PDF
          </Button>
          <Button 
            fullWidth={isMobile} 
            variant="contained" 
            sx={{ bgcolor: '#f59e0b' }} 
            startIcon={<AssignmentReturn />} 
            onClick={() => { 
              setViewSaleDialog(false); 
              if (selectedSale) handleOpenReturn(selectedSale); 
            }}
          >
            Open Return
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== PAYMENT DIALOG ===== */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Post Payment</DialogTitle>
        <DialogContent>
          {paymentSale ? (
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
              <TextField 
                fullWidth 
                label="Payment Amount" 
                type="number" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)} 
                InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} 
                autoFocus 
              />
            </Stack>
          ) : (
            <Typography align="center" color="text.secondary">No sale selected</Typography>
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
          Process Return — Invoice #{returningSale?.invoice_no || 'N/A'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {returningSale ? (
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
                              updated[idx].returnPrice = Number(e.target.value);
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
          ) : (
            <Typography align="center" color="text.secondary">No sale selected for return</Typography>
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
            {can('sales', 'delete') && (
              <ListItem button onClick={() => { setMobileDrawer(false); setBulkDeleteDialog(true); }}>
                <ListItemIcon><DeleteSweep /></ListItemIcon>
                <ListItemText primary="Bulk Delete Sales" />
              </ListItem>
            )}
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