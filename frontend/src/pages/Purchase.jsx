import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress, Autocomplete,
  Alert, Snackbar, useTheme, useMediaQuery,
  Avatar, Tab, Tabs, Badge, Collapse, Fab,
  Accordion, AccordionSummary, AccordionDetails
} from '../components/ui/tailwind-mui';
import {
  Add, Edit, Delete, Search, LocalShipping, Save, Person,
  Receipt, FileDownload, UploadFile, CameraAlt, Close,
  CheckCircle, Cancel, Payment, History, Refresh,
  ArrowUpward, ArrowDownward, Store, TrendingUp,
  TrendingDown, Warning, AttachMoney, CalendarToday,
  Description, Print, CloudUpload, DocumentScanner,
  Inventory, AccountBalance, CreditCard, Undo,
  ShoppingCart, AssignmentReturn, QrCodeScanner, Visibility,
  ExpandMore, FilterList, ClearAll, TableChart, Category
} from '../components/ui/icons';
import * as XLSX from 'xlsx';
import db from '../database/db';
import { useNavigate } from 'react-router-dom';
import useSyncListener from '../hooks/useSyncListener';
import UnifiedPagination from '../components/common/UnifiedPagination';

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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

// ==================== MOBILE PURCHASE CARD ====================
const MobilePurchaseCard = ({ purchase, onEdit, onDelete, onReturn, onPayment, onViewSupplier }) => {
  const [expanded, setExpanded] = useState(false);
  const due = (purchase.grand_total || 0) - (purchase.paid_amount || 0);

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: purchase.status === 'received' ? '4px solid #10b981' : '4px solid #f59e0b',
      borderRadius: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {purchase.purchase_no}
            </Typography>
            <Button 
              variant="text" 
              size="small" 
              onClick={() => onViewSupplier(purchase.supplier_id)}
              sx={{ textTransform: 'none', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent' } }}
            >
              <Typography variant="caption" color="primary" noWrap>
                {purchase.supplier_name || 'Unknown Supplier'}
              </Typography>
            </Button>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" gap={0.5}>
              <Chip 
                size="small" 
                label={purchase.status?.toUpperCase() || 'PENDING'} 
                color={purchase.status === 'received' ? 'success' : 'warning'}
                sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500 }}
              />
              <Chip 
                size="small" 
                label={purchase.payment_status?.toUpperCase() || 'DUE'} 
                color={purchase.payment_status === 'paid' ? 'success' : purchase.payment_status === 'partial' ? 'warning' : 'error'}
                sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500 }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
              {formatCurrency(purchase.grand_total)}
            </Typography>
            {due > 0 ? (
              <Typography variant="caption" color="error.main">Due: {formatCurrency(due)}</Typography>
            ) : (
              <Typography variant="caption" color="success.main">Paid</Typography>
            )}
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Date</Typography>
              <Typography variant="body2">{formatDate(purchase.purchase_date)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Items</Typography>
              <Typography variant="body2">{purchase.items_count || 0}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">Subtotal</Typography>
              <Typography variant="body2">{formatCurrency(purchase.total_amount)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">Discount</Typography>
              <Typography variant="body2">-{formatCurrency(purchase.discount_amount)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">Tax</Typography>
              <Typography variant="body2">{formatCurrency(purchase.tax_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Paid</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(purchase.paid_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Due</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(due)}</Typography>
            </Grid>
            {purchase.notes && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{purchase.notes}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<Payment />} onClick={() => onPayment(purchase)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Pay
          </Button>
          <Button size="small" variant="outlined" color="warning" startIcon={<AssignmentReturn />} onClick={() => onReturn(purchase)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Return
          </Button>
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(purchase)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Edit
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(purchase.id)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Del
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.5 }}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE RETURN CARD ====================
const MobileReturnCard = ({ returnItem, onView }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: '4px solid #f59e0b',
      borderRadius: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {returnItem.return_no}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {returnItem.supplier_name || 'Unknown Supplier'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              Purchase: {returnItem.purchase_no}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="error.main">
              {formatCurrency(returnItem.grand_total)}
            </Typography>
            <Chip 
              size="small" 
              label={returnItem.status?.toUpperCase() || 'PROCESSED'} 
              color={returnItem.status === 'processed' ? 'success' : 'warning'}
              sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500 }}
            />
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Date</Typography>
              <Typography variant="body2">{formatDate(returnItem.return_date)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Items</Typography>
              <Typography variant="body2">{returnItem.items_count || 0}</Typography>
            </Grid>
            {returnItem.notes && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{returnItem.notes}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => onView(returnItem)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
            View
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.5 }}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE SUPPLIER CARD ====================
const MobileSupplierCard = ({ supplier, onEdit, onDelete, onView, onPayment }) => {
  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: supplier.status === 'active' ? '4px solid #10b981' : '4px solid #94a3b8',
      borderRadius: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {supplier.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {supplier.phone || 'No phone'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Balance: {formatCurrency(supplier.current_balance)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip 
              size="small" 
              color={supplier.status === 'active' ? 'success' : 'default'} 
              label={supplier.status}
              sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500 }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {supplier.current_balance > 0 && (
            <Button 
              size="small" 
              variant="contained" 
              color="success" 
              startIcon={<Payment />} 
              onClick={() => onPayment(supplier)}
              sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}
            >
              Pay
            </Button>
          )}
          <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => onView(supplier)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            View
          </Button>
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(supplier)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Edit
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(supplier.id)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, minWidth: 0 }}>
            Del
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function PurchasePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Filters
  const [searchPurchase, setSearchPurchase] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Pagination states
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseRowsPerPage, setPurchaseRowsPerPage] = useState(25);
  const [returnPage, setReturnPage] = useState(1);
  const [returnRowsPerPage, setReturnRowsPerPage] = useState(25);
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierRowsPerPage, setSupplierRowsPerPage] = useState(25);

  // Purchase Dialog
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '', supplier_name: '', purchase_no: `PUR-${Date.now()}`,
    supplier_invoice_no: '', purchase_date: new Date().toISOString().split('T')[0],
    due_date: '', status: 'received', discount_amount: '0', tax_amount: '0',
    shipping_charges: '0', notes: '', paid_amount: '0', payment_mode: 'cash',
    payment_status: 'due'
  });
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_variant_id: '', product_name: '', sku: '', quantity: '1',
    purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: ''
  });
  const [priceHistory, setPriceHistory] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [productSearchInput, setProductSearchInput] = useState('');

  // Payment Dialog
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState(null);

  // Return Dialog
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNote, setReturnNote] = useState('');
  const [returnDiscount, setReturnDiscount] = useState('0');
  const [returnTax, setReturnTax] = useState('0');
  const [returnNo, setReturnNo] = useState(`RET-${Date.now()}`);
  const [returnPaymentMode, setReturnPaymentMode] = useState('cash');
  const [returnPaymentAccount, setReturnPaymentAccount] = useState(null);
  const [processingReturn, setProcessingReturn] = useState(false);

  // View Return Dialog
  const [viewReturnDialog, setViewReturnDialog] = useState(false);
  const [viewReturnData, setViewReturnData] = useState(null);

  // Supplier Dialog
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '', email: '', phone: '', address: '', company: '',
    tax_id: '', balance: '0', status: 'active'
  });

  // Supplier Details Dialog
  const [supplierDetailsDialog, setSupplierDetailsDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [supplierLedger, setSupplierLedger] = useState([]);
    // Supplier Payment Dialog
  const [supplierPaymentDialog, setSupplierPaymentDialog] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState('');
  const [supplierPaymentMode, setSupplierPaymentMode] = useState('cash');
  const [supplierPaymentAccount, setSupplierPaymentAccount] = useState(null);

  // Delete Confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [savingPurchase, setSavingPurchase] = useState(false);  // FIX: Prevent double submit

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [purchs, supps, prods, returns, cats] = await Promise.all([
        db.getPurchases ? db.getPurchases() : Promise.resolve([]),
        db.getSuppliers ? db.getSuppliers() : Promise.resolve([]),
        db.getAllVariants ? db.getAllVariants() : Promise.resolve([]),
        db.getPurchaseReturns ? db.getPurchaseReturns() : Promise.resolve([]),
        db.getCategories ? db.getCategories() : Promise.resolve([])
      ]);
      
          const purchasesWithCount = await Promise.all((purchs || []).map(async (p) => {
        const items = await db.getPurchaseItems(p.id);
        const supplier = (supps || []).find(s => String(s.id) === String(p.supplier_id));
        return { 
          ...p, 
          items_count: items?.length || 0,
          supplier_name: p.supplier_name || supplier?.name || 'Unknown Supplier'
        };
      }));
      
      // FIX: Deduplicate by id — agar backend mein duplicate aa bhi jaye toh UI pe ek hi dikhayega
      const uniquePurchases = [];
      const seenIds = new Set();
      for (const p of purchasesWithCount) {
        if (!seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          uniquePurchases.push(p);
        }
      }
      setPurchases(uniquePurchases);
      setSuppliers(supps || []);
      setProducts(prods || []);
      setCategories(cats || []);
      setPurchaseReturns(returns?.success ? returns.data : (returns || []));
      setFilteredProducts(prods || []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useSyncListener(loadData);

  // ==================== FILTERS ====================
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = p.purchase_no?.toLowerCase().includes(searchPurchase.toLowerCase()) ||
        (p.supplier_name || '').toLowerCase().includes(searchPurchase.toLowerCase());
      const matchSupplier = !filterSupplier || String(p.supplier_id) === String(filterSupplier);
      const matchStatus = !filterStatus || p.status === filterStatus;
      const matchPayment = !filterPaymentStatus || p.payment_status === filterPaymentStatus;
      const matchDateFrom = !filterDateFrom || new Date(p.purchase_date) >= new Date(filterDateFrom);
      const matchDateTo = !filterDateTo || new Date(p.purchase_date) <= new Date(filterDateTo);
      return matchSearch && matchSupplier && matchStatus && matchPayment && matchDateFrom && matchDateTo;
    });
  }, [purchases, searchPurchase, filterSupplier, filterStatus, filterPaymentStatus, filterDateFrom, filterDateTo]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      return s.name?.toLowerCase().includes(searchPurchase.toLowerCase()) ||
        s.phone?.includes(searchPurchase) ||
        s.email?.toLowerCase().includes(searchPurchase.toLowerCase());
    });
  }, [suppliers, searchPurchase]);

  const filteredReturns = useMemo(() => {
    return purchaseReturns.filter(r => {
      return !searchPurchase || 
        r.return_no?.toLowerCase().includes(searchPurchase.toLowerCase()) ||
        (r.supplier_name || '').toLowerCase().includes(searchPurchase.toLowerCase()) ||
        (r.purchase_no || '').toLowerCase().includes(searchPurchase.toLowerCase());
    });
  }, [purchaseReturns, searchPurchase]);

  const paginatedPurchases = useMemo(() => {
    const start = (purchasePage - 1) * purchaseRowsPerPage;
    return filteredPurchases.slice(start, start + purchaseRowsPerPage);
  }, [filteredPurchases, purchasePage, purchaseRowsPerPage]);

  const paginatedReturns = useMemo(() => {
    const start = (returnPage - 1) * returnRowsPerPage;
    return filteredReturns.slice(start, start + returnRowsPerPage);
  }, [filteredReturns, returnPage, returnRowsPerPage]);

  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * supplierRowsPerPage;
    return filteredSuppliers.slice(start, start + supplierRowsPerPage);
  }, [filteredSuppliers, supplierPage, supplierRowsPerPage]);

  // ==================== PURCHASE FUNCTIONS ====================
  const handleOpenPurchase = (purchase = null) => {
    setEditingPurchase(purchase);
    if (purchase) {
      setPurchaseForm({
        supplier_id: purchase.supplier_id || '', supplier_name: purchase.supplier_name || suppliers.find(s => s.id == purchase.supplier_id)?.name || '',
        purchase_no: purchase.purchase_no || `PUR-${Date.now()}`,
        supplier_invoice_no: purchase.supplier_invoice_no || '',
        purchase_date: purchase.purchase_date ? purchase.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        due_date: purchase.due_date ? purchase.due_date.split('T')[0] : '',
        status: purchase.status || 'received',
        discount_amount: String(purchase.discount_amount || 0),
        tax_amount: String(purchase.tax_amount || 0),
        shipping_charges: String(purchase.shipping_charges || 0),
        notes: purchase.notes || '', paid_amount: String(purchase.paid_amount || 0),
        payment_mode: purchase.payment_mode || 'cash',
        payment_status: purchase.payment_status || 'due'
      });
      loadPurchaseItems(purchase.id);
    } else {
      setPurchaseForm({
        supplier_id: '', supplier_name: '', purchase_no: `PUR-${Date.now()}`,
        supplier_invoice_no: '', purchase_date: new Date().toISOString().split('T')[0],
        due_date: '', status: 'received', discount_amount: '0', tax_amount: '0',
        shipping_charges: '0', notes: '', paid_amount: '0', payment_mode: 'cash',
        payment_status: 'due'
      });
      setItems([]);
    }
       setCurrentItem({
      product_variant_id: '', product_name: '', sku: '',
      quantity: '1', purchase_price: '', tax_percentage: '0',
      expiry_date: '', imeiList: ''
    });
    setPriceHistory([]);
    setSelectedVariant(null);
    setSelectedCategory('');
    setFilteredProducts(products);
    setProductSearchInput('');
    setPaymentMode(purchase?.payment_mode || 'cash');
    loadPaymentAccounts();
    setPurchaseDialog(true);
  };

  const loadPurchaseItems = async (purchaseId) => {
    try {
      const items = await db.getPurchaseItems(purchaseId);
      setItems(items || []);
    } catch (err) {
      console.error('Error loading items:', err);
    }
  };

  const handleCategoryFilter = (categoryId) => {
    setSelectedCategory(categoryId);
    if (categoryId) {
      const filtered = products.filter(p => p.category_id == categoryId);
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  };

  const handleVariantSelect = async (variantId) => {
    const variant = products.find(p => p.id == variantId);
    setSelectedVariant(variant);
    if (variant) {
      setCurrentItem(prev => ({
        ...prev,
        product_variant_id: variant.id,
        product_name: variant.product_name || variant.name || '',
        sku: variant.sku || '',
        purchase_price: variant.purchase_price || variant.cost_price || ''
      }));
      
      try {
        const history = await db.getPriceHistory(variantId, 5);
        setPriceHistory(history || []);
      } catch (err) {
        console.error('Error loading price history:', err);
      }
    }
  };

   const handleAddItem = () => {
    let variantId = currentItem.product_variant_id;
    let matchedProduct = selectedVariant;
    
    // Agar dropdown se select nahi kiya, toh search text se match try karo
    if ((!variantId || variantId === '' || variantId == 0) && productSearchInput.trim()) {
      const searchText = productSearchInput.toLowerCase().trim();
      
      // METHOD 1: SKU nikaalo parentheses se — "pencial (sa2) - Rs.100" → "sa2"
      const skuMatch = searchText.match(/\(([^)]+)\)/);
      if (skuMatch) {
        const extractedSku = skuMatch[1].trim();
        matchedProduct = products.find(p => (p.sku || '').toLowerCase().trim() === extractedSku);
      }
      
      // METHOD 2: Exact name match (pehle '(' se pehle ka text)
      if (!matchedProduct) {
        const inputName = searchText.split('(')[0].trim();
        matchedProduct = products.find(p => {
          const name = (p.product_name || p.name || '').toLowerCase().trim();
          return name === inputName;
        });
      }
      
      // METHOD 3: Partial match fallback
      if (!matchedProduct) {
        matchedProduct = products.find(p => {
          const name = (p.product_name || p.name || '').toLowerCase().trim();
          const sku = (p.sku || '').toLowerCase().trim();
          return searchText.includes(name) || searchText.includes(sku);
        });
      }
      
      if (matchedProduct) {
        variantId = matchedProduct.id;
        // IMPORTANT: State update async hota hai, isliye direct values use karo
        setCurrentItem(prev => ({
          ...prev,
          product_variant_id: matchedProduct.id,
          product_name: matchedProduct.product_name || matchedProduct.name || '',
          sku: matchedProduct.sku || '',
          purchase_price: prev.purchase_price || matchedProduct.purchase_price || matchedProduct.cost_price || ''
        }));
      }
    }
    
    if (!variantId || variantId === '' || variantId == 0) {
      setSnackbar({ open: true, message: 'Dropdown se product select karein!', severity: 'warning' });
      return;
    }
    const qty = Number(currentItem.quantity) || 0;
    if (qty <= 0) {
      setSnackbar({ open: true, message: 'Quantity must be greater than 0!', severity: 'warning' });
      return;
    }
    const price = Number(currentItem.purchase_price) || Number(matchedProduct?.purchase_price) || Number(matchedProduct?.cost_price) || 0;
    if (price <= 0) {
      setSnackbar({ open: true, message: 'Price must be greater than 0!', severity: 'warning' });
      return;
    }
    
    const subtotal = qty * price;
    const tax = subtotal * (Number(currentItem.tax_percentage) || 0) / 100;
    const total = subtotal + tax;
    
    setItems(prev => [...prev, {
      ...currentItem,
      product_variant_id: variantId,
      product_name: matchedProduct?.product_name || matchedProduct?.name || currentItem.product_name || '',
      sku: matchedProduct?.sku || currentItem.sku || '',
      quantity: qty,
      purchase_price: price,
      total: total,
      sub_total: subtotal,
      tax_amount: tax
    }]);
    
    setCurrentItem({
      product_variant_id: '', product_name: '', sku: '', quantity: '1',
      purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: ''
    });
    setSelectedVariant(null);
    setProductSearchInput('');
    setPriceHistory([]);
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.sub_total || 0), 0);
    const discount = Number(purchaseForm.discount_amount) || 0;
    const tax = Number(purchaseForm.tax_amount) || 0;
    const shipping = Number(purchaseForm.shipping_charges) || 0;
    const grandTotal = subtotal - discount + tax + shipping;
    return { subtotal, discount, tax, shipping, grandTotal };
  }, [items, purchaseForm.discount_amount, purchaseForm.tax_amount, purchaseForm.shipping_charges]);

  const handleSavePurchase = async () => {
    if (savingPurchase) return;  // FIX: Agar already save ho raha hai toh block karo
    if (!purchaseForm.supplier_id) {
      setSnackbar({ open: true, message: 'Select a supplier!', severity: 'warning' });
      return;
    }
    if (items.length === 0) {
      setSnackbar({ open: true, message: 'Add at least one item!', severity: 'warning' });
      return;
    }
    setSavingPurchase(true);

    const totals = calculateTotals;
    const paidAmount = Math.min(Number(purchaseForm.paid_amount) || 0, totals.grandTotal);
    
    // Balance validation for non-credit payments (only on new purchases)
    if (!editingPurchase && paidAmount > 0 && purchaseForm.payment_mode !== 'credit') {
      const acc = paymentAccounts.find(a => a.type === purchaseForm.payment_mode);
      if (!acc) {
        setSnackbar({ open: true, message: 'No active account found for ' + purchaseForm.payment_mode.toUpperCase(), severity: 'error' });
        setSavingPurchase(false);
        return;
      }
      if (Number(acc.current_balance) < paidAmount) {
        setSnackbar({ open: true, message: `Insufficient balance in ${acc.name}. Available: Rs. ${Number(acc.current_balance).toLocaleString()}, Required: Rs. ${paidAmount.toLocaleString()}`, severity: 'error' });
        setSavingPurchase(false);
        return;
      }
    }
    
    const paymentStatus = paidAmount >= totals.grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'due';

    for (const item of items) {
      const variantId = item.product_variant_id;
      if (!variantId || variantId === '' || variantId == 0) {
        setSnackbar({ 
          open: true, 
          message: `Invalid product variant for item: ${item.product_name || 'Unknown'}`, 
          severity: 'error' 
        });
        return;
      }
    }

    const supplierObj = suppliers.find(s => s.id == purchaseForm.supplier_id);
    const purchaseData = {
      supplier_id: purchaseForm.supplier_id,  // FIX: Keep as-is, don't force Number. Remove supplier_name — backend mein ye field nahi hai.
      purchase_no: purchaseForm.purchase_no,
      supplier_invoice_no: purchaseForm.supplier_invoice_no,
      purchase_date: purchaseForm.purchase_date,
      due_date: purchaseForm.due_date || null,
      status: purchaseForm.status,
      total_amount: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      shipping_charges: totals.shipping,
      grand_total: totals.grandTotal,
      paid_amount: paidAmount,
      payment_status: paymentStatus,
      payment_mode: purchaseForm.payment_mode,
      notes: purchaseForm.notes,
      items: items.map(item => ({
        product_variant_id: item.product_variant_id,
        quantity: Number(item.quantity),
        purchase_price: Number(item.purchase_price),
        tax_percentage: Number(item.tax_percentage),
        sub_total: Number(item.sub_total || (item.quantity * item.purchase_price)),
        expiry_date: item.expiry_date || null
      }))
    };

    console.log('Saving purchase data:', purchaseData);

    try {
      if (editingPurchase) {
        await db.updatePurchase(editingPurchase.id, purchaseData);
        setSnackbar({ open: true, message: 'Purchase updated!', severity: 'success' });
      } else {
        // FIX: Fresh unique purchase_no generate karo save ke waqt — double click pe bhi alag hoga
        purchaseData.purchase_no = `PUR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const result = await db.createPurchase(purchaseData);
        setSnackbar({ open: true, message: 'Purchase created!', severity: 'success' });
      }
      setPurchaseDialog(false);
      loadData();
    } catch (err) {
      console.error('Save error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setSavingPurchase(false);  // FIX: Button wapis enable karo
    }
  };

  // ==================== DELETE PURCHASE ====================
  const handleDeletePurchase = async (id) => {
    setDeleteId(id);
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const result = await db.deletePurchase(deleteId);
      if (result?.success !== false) {
        setSnackbar({ open: true, message: 'Purchase deleted successfully!', severity: 'success' });
        loadData();
      } else {
        throw new Error(result?.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
    setDeleteDialog(false);
    setDeleteId(null);
  };


 // ==================== PAYMENT FUNCTIONS ====================
  const loadPaymentAccounts = useCallback(async () => {
    try {
      const accs = db.getAccounts ? await db.getAccounts({ status: 'active' }) : [];
      setPaymentAccounts(accs || []);
      // Default first active cash/bank account select kar lo
      if (accs && accs.length > 0) {
        const defaultAcc = accs.find(a => (a.type || '').toLowerCase() === paymentMode.toLowerCase()) || accs[0];
        setSelectedPaymentAccount(defaultAcc || null);
      }
    } catch (err) {
      console.error('Load accounts error:', err);
    }
  }, [paymentMode]);

  const handleOpenPayment = (purchase) => {
    setPaymentPurchase(purchase);
    const due = (purchase.grand_total || 0) - (purchase.paid_amount || 0);
    setPaymentAmount(String(due));
    const mode = purchase.payment_mode || 'cash';
    setPaymentMode(mode);
    loadPaymentAccounts();
    setPaymentDialog(true);
  };

  // Jab paymentMode change ho toh matching account auto-select ho jaye
  useEffect(() => {
    if (paymentAccounts.length > 0) {
      const matchedAcc = paymentAccounts.find(a => 
        (a.type || '').toLowerCase() === paymentMode.toLowerCase() ||
        (a.name || '').toLowerCase().includes(paymentMode.toLowerCase())
      );
      setSelectedPaymentAccount(matchedAcc || null);
    }
  }, [paymentMode, paymentAccounts]);

  useEffect(() => {
    const acc = paymentAccounts.find(a => a.type === paymentMode);
    setSelectedPaymentAccount(acc || null);
  }, [paymentAccounts, paymentMode]);

  useEffect(() => {
    if (purchaseDialog) {
      setPaymentMode(purchaseForm.payment_mode);
    }
  }, [purchaseForm.payment_mode, purchaseDialog]);

   const handleProcessPayment = async () => {
    if (!paymentPurchase) return;
    
    if (!paymentPurchase.supplier_id && paymentPurchase.supplier_id !== 0) {  // FIX: Catches null, undefined, empty string, NaN
      setSnackbar({ 
        open: true, 
        message: 'Supplier data missing! Cannot process payment.', 
        severity: 'error' 
      });
      return;
    }

    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      setSnackbar({ open: true, message: 'Enter valid amount!', severity: 'warning' });
      return;
    }

    const due = (paymentPurchase.grand_total || 0) - (paymentPurchase.paid_amount || 0);
    if (amount > due) {
      setSnackbar({ open: true, message: `Amount exceeds due balance! Max allowed: ${formatCurrency(due)}`, severity: 'warning' });
      return;
    }
    
    if (paymentMode !== 'credit') {
      const acc = paymentAccounts.find(a => a.type === paymentMode);
      if (!acc) {
        setSnackbar({ open: true, message: 'No active account found for ' + paymentMode.toUpperCase(), severity: 'error' });
        return;
      }
      if (Number(acc.current_balance) < amount) {
        setSnackbar({ open: true, message: 'Insufficient balance in ' + acc.name + '. Available: Rs. ' + Number(acc.current_balance).toLocaleString(), severity: 'error' });
        return;
      }
    }

    try {
      // FIX: Account se paisa explicitly deduct karo — taake account_balance + account_transactions dono update hon
      if (paymentMode !== 'credit') {
        await db.deductFromAccount(
          paymentMode,
          amount,
          `Payment for ${paymentPurchase.purchase_no}`,
          'purchase_payment',
          paymentPurchase.id,
          selectedPaymentAccount?.id
        );
      }

      await db.addSupplierPayment({
        supplier_id: paymentPurchase.supplier_id,
        purchase_id: paymentPurchase.id,
        amount: amount,
        payment_mode: paymentMode,
        note: `Payment for ${paymentPurchase.purchase_no}`,
        date: new Date().toISOString().split('T')[0]
      });
      
      setSnackbar({ open: true, message: `Payment of ${formatCurrency(amount)} processed via ${paymentMode.toUpperCase()}!`, severity: 'success' });
      setPaymentDialog(false);
      setPaymentPurchase(null);
      setPaymentAmount('');
      setSelectedPaymentAccount(null);
      loadData();
    } catch (err) {
      console.error('Payment error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== RETURN FUNCTIONS ====================
const handleOpenReturn = async (purchase) => {
  console.log('[handleOpenReturn] Opening return for purchase:', purchase);
  
  if (!purchase) {
    console.error('[handleOpenReturn] purchase is null or undefined!');
    setSnackbar({ 
      open: true, 
      message: 'No purchase selected for return!', 
      severity: 'error' 
    });
    return;
  }

  // CRITICAL: Check if purchase has an id
  if (!purchase.id) {
    console.error('[handleOpenReturn] purchase has no id!', purchase);
    setSnackbar({ 
      open: true, 
      message: 'Invalid purchase data!', 
      severity: 'error' 
    });
    return;
  }

  // FIX: Keep ID as string, don't convert to number!
  const purchaseId = purchase.id; // Keep as is - string or number
  console.log('[handleOpenReturn] purchaseId:', purchaseId);
  console.log('[handleOpenReturn] purchaseId type:', typeof purchaseId);
  
  // Just check if it exists and is not empty
  if (!purchaseId || purchaseId === '') {
    console.error('[handleOpenReturn] Invalid purchase id:', purchaseId);
    setSnackbar({ 
      open: true, 
      message: 'Invalid purchase ID!', 
      severity: 'error' 
    });
    return;
  }

  // Store the purchase object with original id
  setReturnPurchase(purchase);
  
  setReturnNote('');
  setReturnDiscount('0');
  setReturnTax('0');
  setReturnNo(`RET-${Date.now()}`);
  setReturnPaymentMode('cash');
  setReturnPaymentAccount(null);
  loadPaymentAccounts();  // FIX: Accounts load karo return ke liye bhi
  
  try {
    let itemsData = [];
    
    try {
      const result = await db.getPurchaseItemsForReturn(purchaseId);
      if (result?.success && result.data) {
        itemsData = result.data;
        console.log('Items from getPurchaseItemsForReturn:', itemsData);
      }
    } catch (e) {
      console.log('getPurchaseItemsForReturn failed, falling back to getPurchaseItems', e);
    }
    
    if (itemsData.length === 0) {
      const items = await db.getPurchaseItems(purchaseId);
      itemsData = items || [];
      console.log('Items from getPurchaseItems:', itemsData);
    }
    
    const itemsWithReturn = itemsData
      .map(item => {
        const itemId = item.id || item.purchase_item_id || item.purchaseItemId;
        
        if (!itemId) {
          console.warn('Item missing ID, skipping:', item);
          return null;
        }
        
        return {
          ...item,
          id: itemId,
          purchase_item_id: itemId,
          return_quantity: 0,
          return_price: item.purchase_price || 0,
          available_quantity: Math.max(0, (item.quantity || 0) - (item.returned_quantity || 0)),
          reason: '',
          sub_total: 0
        };
      })
      .filter(item => item !== null && item.available_quantity > 0);
    
    console.log('Return items prepared:', itemsWithReturn);
    setReturnItems(itemsWithReturn);
    
    if (itemsWithReturn.length === 0) {
      setSnackbar({ 
        open: true, 
        message: 'No items available for return. All items have been returned.', 
        severity: 'info' 
      });
    }
    
  } catch (err) {
    console.error('Error loading items for return:', err);
    setSnackbar({ 
      open: true, 
      message: 'Error loading items: ' + err.message, 
      severity: 'error' 
    });
    setReturnItems([]);
  }
  
  setReturnDialog(true);
};

  const updateReturnItem = (index, field, value) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item };
      
      if (field === 'return_quantity') {
        const qty = Math.min(Number(value) || 0, item.available_quantity || 0);
        updated.return_quantity = qty;
        updated.sub_total = qty * (updated.return_price || item.purchase_price || 0);
      } else if (field === 'return_price') {
        const price = Number(value) || 0;
        updated.return_price = price;
        updated.sub_total = (updated.return_quantity || 0) * price;
      } else {
        updated[field] = value;
      }
      return updated;
    }));
  };

  const calculateReturnTotal = useMemo(() => {
    const subtotal = returnItems.reduce((sum, item) => sum + (item.sub_total || 0), 0);
    const discount = parseFloat(returnDiscount) || 0;
    const tax = parseFloat(returnTax) || 0;
    const taxAmount = (subtotal - discount) * (tax / 100);
    return {
      subtotal,
      discount,
      tax,
      taxAmount,
      grandTotal: subtotal - discount + taxAmount
    };
  }, [returnItems, returnDiscount, returnTax]);

const handleProcessReturn = async () => {
   if (processingReturn) return;  
  setProcessingReturn(true);  
  console.log('[handleProcessReturn] Starting...');
  console.log('[handleProcessReturn] returnPurchase:', returnPurchase);
  
  if (!returnPurchase) {
    console.error('[handleProcessReturn] returnPurchase is null!');
    setSnackbar({ 
      open: true, 
      message: 'Purchase information missing! Please close and reopen the return dialog.', 
      severity: 'error' 
    });
    return;
  }

  if (!returnPurchase.id) {
    console.error('[handleProcessReturn] returnPurchase has no id!', returnPurchase);
    setSnackbar({ 
      open: true, 
      message: 'Invalid purchase data!', 
      severity: 'error' 
    });
    return;
  }

  // FIX: Keep ID as is - don't convert to number!
  const purchaseId = returnPurchase.id;
  console.log('[handleProcessReturn] purchaseId:', purchaseId);
  console.log('[handleProcessReturn] purchaseId type:', typeof purchaseId);
  
  if (!purchaseId || purchaseId === '') {
    console.error('[handleProcessReturn] Invalid purchaseId:', purchaseId);
    setSnackbar({ 
      open: true, 
      message: 'Invalid purchase ID! Please close and reopen the return dialog.', 
      severity: 'error' 
    });
    return;
  }

  const itemsToReturn = returnItems.filter(item => (item.return_quantity || 0) > 0);
  
  if (itemsToReturn.length === 0) {
    setSnackbar({ open: true, message: 'Select items and quantities to return!', severity: 'warning' });
    return;
  }

  const totals = calculateReturnTotal;
  
  const returnItemsData = itemsToReturn.map((item) => {
    // CRITICAL FIX: DON'T convert to Number! Keep as string
    const purchaseItemId = item.purchase_item_id || item.id;
    
    console.log('[handleProcessReturn] Item:', item);
    console.log('[handleProcessReturn] purchaseItemId:', purchaseItemId);
    console.log('[handleProcessReturn] purchaseItemId type:', typeof purchaseItemId);
    
    if (!purchaseItemId) {
      console.error('Missing purchase_item_id for item:', item);
      throw new Error(`Missing purchase_item_id for item: ${item.product_name || 'unknown'}`);
    }
    
    return {
      purchase_item_id: purchaseItemId,  // <-- YAHAN FIX: Number() HATAYA!
      product_variant_id: item.product_variant_id || 0,
      quantity: Number(item.return_quantity) || 0,
      return_price: Number(item.return_price || item.purchase_price || 0),
      tax_percentage: Number(item.tax_percentage || 0),
      sub_total: Number(item.sub_total || (item.return_quantity || 0) * (item.return_price || item.purchase_price || 0)),
      reason: item.reason || ''
    };
  });

  console.log('Return items data being sent:', returnItemsData);

  const returnData = {
    purchase_id: purchaseId,
    return_no: returnNo || `RET-${Date.now()}`,
    return_date: new Date().toISOString().split('T')[0],
    supplier_id: returnPurchase.supplier_id,
    payment_mode: returnPaymentMode,
    account_id: returnPaymentAccount?.id || null,  // FIX: Don't convert to Number — keep original ID (string or number)
    total_amount: Number(totals.subtotal) || 0,
    discount_amount: Number(totals.discount) || 0,
    tax_amount: Number(totals.taxAmount) || 0,
    grand_total: Number(totals.grandTotal) || 0,
    notes: returnNote || '',
    status: 'processed',
    created_by: 1,
    items: returnItemsData
  };

  console.log('Full return data being sent to db:', returnData);

  if (!returnData.purchase_id || returnData.purchase_id === '') {
    console.error('[handleProcessReturn] Invalid purchase_id in returnData:', returnData.purchase_id);
    setSnackbar({ 
      open: true, 
      message: 'Invalid purchase ID! Please try again.', 
      severity: 'error' 
    });
    return;
  }

  try {
    console.log('Sending return data with purchase_id:', returnData.purchase_id);
    
    const result = await db.createPurchaseReturn(returnData);
    console.log('Return result:', result);
    
    if (result?.success) {
      setSnackbar({ 
        open: true, 
        message: `Return processed! Amount: ${formatCurrency(totals.grandTotal)}`, 
        severity: 'success' 
      });
      setReturnDialog(false);
      setReturnPurchase(null);
      setReturnItems([]);
      loadData();
    } else {
      throw new Error(result?.error || 'Failed to process return');
    }
  } catch (err) {
    console.error('Return error details:', err);
    console.error('Error stack:', err.stack);
    setSnackbar({ 
      open: true, 
      message: 'Error: ' + err.message, 
      severity: 'error' 
    });
  }
  finally {
      setProcessingReturn(false);  // ADD YEH LINE
    }
};
  // ==================== VIEW RETURN ====================
  const handleViewReturn = async (returnItem) => {
    try {
      const result = await db.getPurchaseReturnById(returnItem.id);
      if (result?.success) {
        setViewReturnData(result.data);
        setViewReturnDialog(true);
      } else {
        setViewReturnData(returnItem);
        setViewReturnDialog(true);
      }
    } catch (err) {
      console.error('View return error:', err);
      setViewReturnData(returnItem);
      setViewReturnDialog(true);
    }
  };

  // ==================== SUPPLIER FUNCTIONS ====================
  const handleOpenSupplier = (supplier = null) => {
    setEditingSupplier(supplier);
    if (supplier) {
      setSupplierForm({
        name: supplier.name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        company: supplier.company_name || '',
        tax_id: supplier.vat_ntn_number || '',
        balance: String(supplier.current_balance || 0),
        status: supplier.status || 'active'
      });
    } else {
      setSupplierForm({
        name: '', email: '', phone: '', address: '', company: '',
        tax_id: '', balance: '0', status: 'active'
      });
    }
    setSupplierDialog(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      setSnackbar({ open: true, message: 'Supplier name required!', severity: 'warning' });
      return;
    }

    const data = {
      name: supplierForm.name,
      email: supplierForm.email,
      phone: supplierForm.phone,
      address: supplierForm.address,
      company_name: supplierForm.company,
      vat_ntn_number: supplierForm.tax_id,
      opening_balance: Number(supplierForm.balance) || 0,
      current_balance: Number(supplierForm.balance) || 0,
      status: supplierForm.status
    };

    try {
      if (editingSupplier) {
        await db.updateSupplier(editingSupplier.id, data);
        setSnackbar({ open: true, message: 'Supplier updated!', severity: 'success' });
      } else {
        await db.createSupplier(data);
        setSnackbar({ open: true, message: 'Supplier added!', severity: 'success' });
      }
      setSupplierDialog(false);
      loadData();
    } catch (err) {
      console.error('Supplier save error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Delete this supplier? This will also delete all related purchases!')) return;
    try {
      await db.deleteSupplier(id);
      setSnackbar({ open: true, message: 'Supplier deleted!', severity: 'success' });
      loadData();
    } catch (err) {
      console.error('Delete supplier error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };
  // ==================== SUPPLIER PAYMENT FUNCTIONS ====================
  const handleOpenSupplierPayment = (supplier) => {
    console.log('[handleOpenSupplierPayment] Opening payment for supplier:', supplier);
    
    if (!supplier || !supplier.id) {
      setSnackbar({ 
        open: true, 
        message: 'Invalid supplier selected!', 
        severity: 'error' 
      });
      return;
    }
    
    setPaymentSupplier(supplier);
    setSupplierPaymentAmount(String(Math.abs(supplier.current_balance || 0)));
    setSupplierPaymentMode('cash');
    loadPaymentAccounts();
    setSupplierPaymentDialog(true);
  };

 const handleProcessSupplierPayment = async () => {
  if (!paymentSupplier) {
    setSnackbar({ open: true, message: 'No supplier selected!', severity: 'error' });
    return;
  }
  
  const amount = Number(supplierPaymentAmount) || 0;
  if (amount <= 0) {
    setSnackbar({ open: true, message: 'Enter valid amount!', severity: 'warning' });
    return;
  }
  
  const maxDue = Math.abs(paymentSupplier.current_balance || 0);
  if (amount > maxDue) {
    setSnackbar({ 
      open: true, 
      message: `Amount exceeds balance! Max allowed: ${formatCurrency(maxDue)}`, 
      severity: 'warning' 
    });
    return;
  }
  
  // Account balance check (ONLY VALIDATION, NO DEDUCTION)
  if (supplierPaymentMode !== 'credit') {
    const acc = paymentAccounts.find(a => a.type === supplierPaymentMode);
    if (!acc) {
      setSnackbar({ 
        open: true, 
        message: `No active account found for ${supplierPaymentMode.toUpperCase()}`, 
        severity: 'error' 
      });
      return;
    }
    if (Number(acc.current_balance) < amount) {
      setSnackbar({ 
        open: true, 
        message: `Insufficient balance in ${acc.name}. Available: Rs. ${Number(acc.current_balance).toLocaleString()}`, 
        severity: 'error' 
      });
      return;
    }
  }
  
  try {
    // SIRF EK CALL - addSupplierPayment sab handle karega!
    // Isme already include hai:
    // 1. addPayment (payment record)
    // 2. updateSupplierBalance (supplier balance)
    // 3. addLedgerEntry (ledger)
    // 4. deductFromAccount (account deduction)
    await db.addSupplierPayment({
      supplier_id: paymentSupplier.id,
      purchase_id: null,
      amount: amount,
      payment_mode: supplierPaymentMode,
      account_id: supplierPaymentAccount?.id || null,
      note: `Direct payment to supplier: ${paymentSupplier.name}`,
      date: new Date().toISOString().split('T')[0]
    });
    
    setSnackbar({ 
      open: true, 
      message: `Payment of ${formatCurrency(amount)} processed to ${paymentSupplier.name}!`, 
      severity: 'success' 
    });
    
    setSupplierPaymentDialog(false);
    setPaymentSupplier(null);
    setSupplierPaymentAmount('');
    setSupplierPaymentAccount(null);
    loadData();
    
  } catch (err) {
    console.error('Supplier payment error:', err);
    setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
  }
};

  const handleViewSupplier = async (supplierId) => {
  const supplier = suppliers.find(s => String(s.id) === String(supplierId));
  if (!supplier) return;
  
  setSelectedSupplier(supplier);
  
  const suppPurchases = purchases.filter(p => String(p.supplier_id) === String(supplierId));
  setSupplierPurchases(suppPurchases);
  
  try {
    // CRITICAL: getSupplierPurchaseLedger se complete ledger load karo
    const suppLedger = await db.getSupplierPurchaseLedger(supplierId);
    
    // Agar result object hai toh data extract karo, nahi toh direct array
    let ledgerData = [];
    if (suppLedger && typeof suppLedger === 'object' && suppLedger.success === true) {
      ledgerData = suppLedger.data || [];
    } else if (Array.isArray(suppLedger)) {
      ledgerData = suppLedger;
    }
    
    console.log('[handleViewSupplier] Supplier Ledger loaded:', ledgerData);
    setSupplierLedger(ledgerData);
  } catch (err) {
    console.error('[handleViewSupplier] Error loading ledger:', err);
    setSupplierLedger([]);
  }
  
  setSupplierDetailsDialog(true);
};

  // ==================== EXPORT ====================
  const exportPurchases = () => {
    if (purchases.length === 0) {
      setSnackbar({ open: true, message: 'No purchases to export!', severity: 'warning' });
      return;
    }
    
    try {
      const exportData = purchases.map(p => ({
        'Purchase #': p.purchase_no,
        'Date': formatDate(p.purchase_date),
        'Supplier': p.supplier_name || '',
        'Total': p.grand_total || 0,
        'Paid': p.paid_amount || 0,
        'Due': (p.grand_total || 0) - (p.paid_amount || 0),
        'Status': p.status || 'pending',
        'Payment Status': p.payment_status || 'due',
        'Items': p.items_count || 0
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
      XLSX.writeFile(wb, `purchases_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setSnackbar({ open: true, message: `Exported ${exportData.length} purchases!`, severity: 'success' });
    } catch (err) {
      console.error('Export error:', err);
      setSnackbar({ open: true, message: 'Export failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== EXPORT RETURNS ====================
  const exportReturns = () => {
    if (purchaseReturns.length === 0) {
      setSnackbar({ open: true, message: 'No returns to export!', severity: 'warning' });
      return;
    }
    
    try {
      const exportData = purchaseReturns.map(r => ({
        'Return #': r.return_no,
        'Date': formatDate(r.return_date),
        'Purchase': r.purchase_no || '',
        'Supplier': r.supplier_name || '',
        'Total': r.grand_total || 0,
        'Status': r.status || 'processed',
        'Items': r.items_count || 0
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Returns');
      XLSX.writeFile(wb, `returns_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setSnackbar({ open: true, message: `Exported ${exportData.length} returns!`, severity: 'success' });
    } catch (err) {
      console.error('Export returns error:', err);
      setSnackbar({ open: true, message: 'Export failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== IMPORT PURCHASES ====================
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          if (jsonData.length === 0) {
            setSnackbar({ open: true, message: 'Excel file is empty!', severity: 'warning' });
            setLoading(false);
            return;
          }

          const requiredColumns = ['Supplier', 'Product Name', 'SKU', 'Quantity', 'Price'];
          const headers = Object.keys(jsonData[0]);
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          
          if (missingColumns.length > 0) {
            setSnackbar({ 
              open: true, 
              message: `Missing required columns: ${missingColumns.join(', ')}`, 
              severity: 'error' 
            });
            setLoading(false);
            return;
          }

          let importedCount = 0;
          let errorCount = 0;
          const errors = [];

          const purchaseGroups = {};
          for (const row of jsonData) {
            const supplierName = row['Supplier']?.trim();
            const purchaseNo = row['Purchase #']?.trim() || `PUR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const key = `${supplierName}_${purchaseNo}`;
            
            if (!purchaseGroups[key]) {
              purchaseGroups[key] = {
                supplierName,
                purchaseNo,
                date: row['Date'] || new Date().toISOString().split('T')[0],
                status: row['Status'] || 'received',
                notes: row['Notes'] || '',
                supplierInvoice: row['Supplier Invoice'] || '',
                discount: Number(row['Discount']) || 0,
                shipping: Number(row['Shipping']) || 0,
                paid: Number(row['Paid']) || 0,
                paymentMode: row['Payment Mode'] || 'cash',
                dueDate: row['Due Date'] || null,
                items: []
              };
            }
            
            purchaseGroups[key].items.push(row);
          }

          for (const groupKey of Object.keys(purchaseGroups)) {
            const group = purchaseGroups[groupKey];
            
            let supplierId = null;
            const existingSuppliers = await db.getSuppliers();
            let supplier = existingSuppliers.find(s => s.name.toLowerCase() === group.supplierName.toLowerCase());
            
            if (!supplier) {
              const newSupplier = await db.createSupplier({ 
                name: group.supplierName, 
                status: 'active' 
              });
              supplierId = newSupplier.lastInsertRowid;
            } else {
              supplierId = supplier.id;
            }

            const items = [];
            let totalAmount = 0;
            
            for (const row of group.items) {
              const productName = row['Product Name']?.trim();
              const sku = row['SKU']?.trim();
              const quantity = Number(row['Quantity']) || 0;
              const price = Number(row['Price']) || 0;
              
              if (!productName || !sku || quantity <= 0 || price <= 0) {
                errors.push(`Invalid item: ${productName} - ${sku}`);
                errorCount++;
                continue;
              }

              let variant = await db.getVariantBySKU(sku);
              if (!variant) {
                const productData = {
                  name: productName,
                  type: row['Product Type'] || 'standard',
                  unit: row['Unit'] || 'Piece',
                  status: 'active'
                };
                const prodResult = await db.addProduct(productData);
                
                variant = await db.createVariant({
                  product_id: prodResult.lastInsertRowid,
                  sku: sku,
                  variant_name: row['Variant Name'] || 'Default',
                  purchase_price: price,
                  retail_price: price * 1.2,
                  wholesale_price: price * 1.1,
                  current_stock: quantity,
                  stock_alert_quantity: 5
                });
              } else {
                await db.updateVariantStock(variant.id, quantity);
              }

              const subtotal = quantity * price;
              totalAmount += subtotal;
              
              items.push({
                product_variant_id: variant.id,
                quantity: quantity,
                purchase_price: price,
                tax_percentage: Number(row['Tax %']) || 0,
                sub_total: subtotal,
                expiry_date: row['Expiry Date'] || null
              });
            }

            if (items.length === 0) continue;

            const purchaseData = {
              supplier_id: supplierId,
              purchase_no: group.purchaseNo,
              supplier_invoice_no: group.supplierInvoice,
              purchase_date: group.date,
              due_date: group.dueDate,
              status: group.status,
              total_amount: totalAmount,
              discount_amount: group.discount,
              tax_amount: 0,
              shipping_charges: group.shipping,
              grand_total: totalAmount - group.discount + group.shipping,
              paid_amount: group.paid,
              payment_status: group.paid >= (totalAmount - group.discount + group.shipping) ? 'paid' : group.paid > 0 ? 'partial' : 'due',
              payment_mode: group.paymentMode,
              notes: group.notes,
              items: items
            };

            try {
              await db.createPurchase(purchaseData);
              importedCount++;
            } catch (err) {
              errors.push(`Failed to create purchase ${group.purchaseNo}: ${err.message}`);
              errorCount++;
            }
          }

          let message = `Import complete!`;
          if (importedCount > 0) message += ` Created: ${importedCount} purchases`;
          if (errorCount > 0) message += ` Failed: ${errorCount}`;
          
          setSnackbar({ open: true, message: message, severity: errorCount > 0 ? 'warning' : 'success' });
          if (errors.length > 0) {
            console.log('Import errors:', errors);
          }
          loadData();

        } catch (err) {
          console.error('Parse error:', err);
          setSnackbar({ open: true, message: 'Error reading file: ' + err.message, severity: 'error' });
        } finally {
          setLoading(false);
          event.target.value = '';
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (err) {
      console.error('Import error:', err);
      setSnackbar({ open: true, message: 'Import failed: ' + err.message, severity: 'error' });
      setLoading(false);
    }
  };

  // ==================== SUMMARY STATS ====================
  const summaryStats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalItems = 0;
    let totalReturns = 0;
    let totalReturnAmount = 0;
    
    purchases.forEach(p => {
      totalPurchases += p.grand_total || 0;
      totalPaid += p.paid_amount || 0;
      totalDue += (p.grand_total || 0) - (p.paid_amount || 0);
      totalItems += p.items_count || 0;
    });
    
    purchaseReturns.forEach(r => {
      totalReturns += 1;
      totalReturnAmount += r.grand_total || 0;
    });
    
    return { 
      totalPurchases, totalPaid, totalDue, totalItems, 
      count: purchases.length,
      totalReturns,
      totalReturnAmount
    };
  }, [purchases, purchaseReturns]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3, maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="secondary">
          <LocalShipping sx={{ mr: 1, verticalAlign: 'middle', fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'Purchases' : 'Purchase Management'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap', gap: 0.5 }}>
          <Button 
            variant="outlined" 
            size="small" 
            component="label"
            startIcon={<UploadFile />}
            sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}
          >
            {isMobile ? 'Import' : 'Import Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleImportExcel}
            />
          </Button>
          
          <Button variant="outlined" size="small" startIcon={<Person />} onClick={() => handleOpenSupplier()} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
            {isMobile ? 'Supplier' : 'Add Supplier'}
          </Button>
          <Button variant="outlined" size="small" startIcon={<FileDownload />} onClick={exportPurchases} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
            {isMobile ? 'Export' : 'Export CSV'}
          </Button>
          <Button variant="contained" size="small" color="secondary" startIcon={<Add />} onClick={() => handleOpenPurchase()} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
            {isMobile ? 'New' : 'Add Purchase'}
          </Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/inventory')} startIcon={<Inventory />} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
            {isMobile ? 'Products' : 'Products'}
          </Button>
        </Stack>
      </Box>

      {/* SUMMARY CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: 'Total Purchases', value: summaryStats.count, isCurrency: false },
          { title: 'Total Amount', value: summaryStats.totalPurchases, isCurrency: true },
          { title: 'Total Paid', value: summaryStats.totalPaid, isCurrency: true },
          { title: 'Total Due', value: summaryStats.totalDue, isCurrency: true },
          { title: 'Returns', value: summaryStats.totalReturns, isCurrency: false },
          { title: 'Return Amount', value: summaryStats.totalReturnAmount, isCurrency: true },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
            <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                  {stat.title}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>
                  {stat.isCurrency ? formatCurrency(stat.value) : stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* FILTERS */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, borderRadius: 1 }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField 
              fullWidth 
              size="small"
              label="Search Purchases"
              placeholder="Search purchases by invoice, supplier..." 
              value={searchPurchase} 
              onChange={(e) => setSearchPurchase(e.target.value)} 
              InputLabelProps={{ shrink: true }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Search sx={{ mr: 1, color: 'text.secondary' }} /></InputAdornment>
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Supplier</InputLabel>
              <Select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} label="Supplier">
                <MenuItem value="">All Suppliers</MenuItem>
                {suppliers.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField 
              fullWidth 
              size="small" 
              label="Date From" 
              type="date" 
              value={filterDateFrom} 
              onChange={(e) => setFilterDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField 
              fullWidth 
              size="small" 
              label="Date To" 
              type="date" 
              value={filterDateTo} 
              onChange={(e) => setFilterDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="received">Received</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="ordered">Ordered</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment</InputLabel>
              <Select value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} label="Payment">
                <MenuItem value="">All Payments</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="due">Due</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} md={6} sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={loadData} sx={{ height: 40, px: 2, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
              Refresh
            </Button>
            <Button variant="outlined" color="error" size="small" startIcon={<ClearAll />} onClick={() => {
              setSearchPurchase('');
              setFilterSupplier('');
              setFilterStatus('');
              setFilterPaymentStatus('');
              setFilterDateFrom('');
              setFilterDateTo('');
            }} sx={{ height: 40, px: 2, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto', borderRadius: 1 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<LocalShipping fontSize="small" />} 
            label={isMobile ? 'All' : 'All Purchases'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', minWidth: isMobile ? 'auto' : undefined }} 
          />
          <Tab 
            icon={<Payment fontSize="small" />} 
            label={isMobile ? 'Due' : 'Due Payments'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', minWidth: isMobile ? 'auto' : undefined }} 
          />
          <Tab 
            icon={<AssignmentReturn fontSize="small" />} 
            label={isMobile ? 'Returns' : 'Returns'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', minWidth: isMobile ? 'auto' : undefined }} 
          />
          <Tab 
            icon={<Person fontSize="small" />} 
            label={isMobile ? 'Suppliers' : 'Suppliers'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', minWidth: isMobile ? 'auto' : undefined }} 
          />
        </Tabs>
      </Paper>

      {/* TAB 0: ALL PURCHASES */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            {isMobile ? (
              <Box>
                {filteredPurchases.map((purchase) => (
                  <MobilePurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onEdit={handleOpenPurchase}
                    onDelete={handleDeletePurchase}
                    onReturn={handleOpenReturn}
                    onPayment={handleOpenPayment}
                    onViewSupplier={handleViewSupplier}
                  />
                ))}
                {filteredPurchases.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 1 }}>
                    <LocalShipping sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No purchases found</Typography>
                  </Paper>
                )}
                <UnifiedPagination
                  count={filteredPurchases.length}
                  page={purchasePage}
                  rowsPerPage={purchaseRowsPerPage}
                  onPageChange={setPurchasePage}
                  onRowsPerPageChange={(newR) => {
                    setPurchaseRowsPerPage(newR);
                    setPurchasePage(1);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </Box>
            ) : (
              <Box>
                <TableContainer component={Paper} sx={{ borderRadius: 1, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Purchase #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Supplier</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Items</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Paid</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Due</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPurchases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No purchases found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {paginatedPurchases.map((purchase) => {
                      const due = (purchase.grand_total || 0) - (purchase.paid_amount || 0);
                      return (
                        <TableRow key={purchase.id} hover>
                          <TableCell>
                            <Typography fontWeight="bold">{purchase.purchase_no}</Typography>
                          </TableCell>
                          <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="text" 
                              size="small" 
                              onClick={() => handleViewSupplier(purchase.supplier_id)}
                              sx={{ textTransform: 'none', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent' } }}
                            >
                              <Typography variant="body2" color="primary">
                                {purchase.supplier_name || '-'}
                              </Typography>
                            </Button>
                          </TableCell>
                          <TableCell>{purchase.items_count || 0}</TableCell>
                          <TableCell fontWeight="bold">{formatCurrency(purchase.grand_total)}</TableCell>
                          <TableCell>{formatCurrency(purchase.paid_amount)}</TableCell>
                          <TableCell sx={{ color: due > 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                            {formatCurrency(due)}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Chip 
                                size="small" 
                                color={purchase.status === 'received' ? 'success' : 'warning'} 
                                label={purchase.status?.toUpperCase() || 'PENDING'} 
                                sx={{ height: 20, fontSize: '0.6rem' }}
                              />
                              <Chip 
                                size="small" 
                                color={purchase.payment_status === 'paid' ? 'success' : purchase.payment_status === 'partial' ? 'warning' : 'error'} 
                                label={purchase.payment_status?.toUpperCase() || 'DUE'} 
                                sx={{ height: 20, fontSize: '0.6rem' }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Payment">
                                <IconButton size="small" color="success" onClick={() => handleOpenPayment(purchase)}>
                                  <Payment fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Return">
                                <IconButton size="small" color="warning" onClick={() => handleOpenReturn(purchase)}>
                                  <AssignmentReturn fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" color="info" onClick={() => handleOpenPurchase(purchase)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeletePurchase(purchase.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
                <UnifiedPagination
                  count={filteredPurchases.length}
                  page={purchasePage}
                  rowsPerPage={purchaseRowsPerPage}
                  onPageChange={setPurchasePage}
                  onRowsPerPageChange={(newR) => {
                    setPurchaseRowsPerPage(newR);
                    setPurchasePage(1);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </Box>
            )}
          </Box>
        </Fade>
      )}

      {/* TAB 1: DUE PAYMENTS */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            {isMobile ? (
              <Box>
                {filteredPurchases.filter(p => (p.grand_total || 0) - (p.paid_amount || 0) > 0).map((purchase) => (
                  <MobilePurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onEdit={handleOpenPurchase}
                    onDelete={handleDeletePurchase}
                    onReturn={handleOpenReturn}
                    onPayment={handleOpenPayment}
                    onViewSupplier={handleViewSupplier}
                  />
                ))}
                {filteredPurchases.filter(p => (p.grand_total || 0) - (p.paid_amount || 0) > 0).length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 1 }}>
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
                    <Typography color="text.secondary">All payments are up to date!</Typography>
                  </Paper>
                )}
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ borderRadius: 1, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Purchase #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Supplier</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Paid</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Due</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPurchases.filter(p => (p.grand_total || 0) - (p.paid_amount || 0) > 0).map((purchase) => {
                      const due = (purchase.grand_total || 0) - (purchase.paid_amount || 0);
                      return (
                        <TableRow key={purchase.id} hover>
                          <TableCell>{purchase.purchase_no}</TableCell>
                          <TableCell>{purchase.supplier_name || '-'}</TableCell>
                          <TableCell>{formatCurrency(purchase.grand_total)}</TableCell>
                          <TableCell>{formatCurrency(purchase.paid_amount)}</TableCell>
                          <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            {formatCurrency(due)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={purchase.payment_status === 'partial' ? 'warning' : 'error'} 
                              label={purchase.payment_status?.toUpperCase() || 'DUE'} 
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button 
                              variant="contained" 
                              color="success" 
                              size="small" 
                              startIcon={<Payment />}
                              onClick={() => handleOpenPayment(purchase)}
                              sx={{ fontSize: '0.65rem' }}
                            >
                              Pay Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredPurchases.filter(p => (p.grand_total || 0) - (p.paid_amount || 0) > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">All payments are up to date!</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Fade>
      )}

      {/* TAB 2: RETURNS */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="outlined" size="small" startIcon={<FileDownload />} onClick={exportReturns} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
                Export Returns
              </Button>
            </Box>

            {isMobile ? (
              <Box>
                {paginatedReturns.map((returnItem) => (
                  <MobileReturnCard
                    key={returnItem.id}
                    returnItem={returnItem}
                    onView={handleViewReturn}
                  />
                ))}
                {filteredReturns.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 1 }}>
                    <AssignmentReturn sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No returns found</Typography>
                  </Paper>
                )}
                <UnifiedPagination
                  count={filteredReturns.length}
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
              <Box>
                <TableContainer component={Paper} sx={{ borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Return #</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Purchase</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Supplier</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Items</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Total</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Status</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredReturns.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No returns found</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {paginatedReturns.map((returnItem) => (
                        <TableRow key={returnItem.id} hover>
                          <TableCell>
                            <Typography fontWeight="bold">{returnItem.return_no}</Typography>
                          </TableCell>
                          <TableCell>{formatDate(returnItem.return_date)}</TableCell>
                          <TableCell>{returnItem.purchase_no || '-'}</TableCell>
                          <TableCell>{returnItem.supplier_name || '-'}</TableCell>
                          <TableCell>{returnItem.items_count || 0}</TableCell>
                          <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            {formatCurrency(returnItem.grand_total)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={returnItem.status === 'processed' ? 'success' : 'warning'} 
                              label={returnItem.status?.toUpperCase() || 'PROCESSED'} 
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Details">
                              <IconButton size="small" color="info" onClick={() => handleViewReturn(returnItem)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <UnifiedPagination
                  count={filteredReturns.length}
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
            )}
          </Box>
        </Fade>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 3 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenSupplier()} size={isMobile ? 'small' : 'medium'} sx={{ fontSize: isMobile ? '0.6rem' : '0.75rem', py: isMobile ? 0.5 : 1 }}>
                {isMobile ? 'Add' : 'Add Supplier'}
              </Button>
            </Box>

            {isMobile ? (
              <Box>
                {paginatedSuppliers.map((supplier) => (
                  <MobileSupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onEdit={handleOpenSupplier}
                    onDelete={handleDeleteSupplier}
                    onView={handleViewSupplier}
                    onPayment={handleOpenSupplierPayment}
                  />
                ))}
                {filteredSuppliers.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 1 }}>
                    <Person sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No suppliers found</Typography>
                  </Paper>
                )}
                <UnifiedPagination
                  count={filteredSuppliers.length}
                  page={supplierPage}
                  rowsPerPage={supplierRowsPerPage}
                  onPageChange={setSupplierPage}
                  onRowsPerPageChange={(newR) => {
                    setSupplierRowsPerPage(newR);
                    setSupplierPage(1);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </Box>
            ) : (
              <Box>
                <TableContainer component={Paper} sx={{ borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Phone</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Email</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Balance</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Status</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSuppliers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No suppliers found</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {paginatedSuppliers.map((supplier) => (
                        <TableRow key={supplier.id} hover>
                          <TableCell>
                            <Typography fontWeight="bold">{supplier.name}</Typography>
                            {supplier.company_name && (
                              <Typography variant="caption" color="text.secondary" display="block">{supplier.company_name}</Typography>
                            )}
                          </TableCell>
                          <TableCell>{supplier.phone || '-'}</TableCell>
                          <TableCell>{supplier.email || '-'}</TableCell>
                          <TableCell sx={{ 
                            color: supplier.current_balance > 0 ? 'error.main' : 'success.main',
                            fontWeight: 'bold'
                          }}>
                            {formatCurrency(supplier.current_balance || 0)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={supplier.status === 'active' ? 'success' : 'default'} 
                              label={supplier.status?.toUpperCase() || 'ACTIVE'} 
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {supplier.current_balance > 0 && (
                                <Tooltip title="Make Payment">
                                  <IconButton 
                                    size="small" 
                                    color="success" 
                                    onClick={() => handleOpenSupplierPayment(supplier)}
                                  >
                                    <Payment fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="View Details">
                                <IconButton size="small" color="info" onClick={() => handleViewSupplier(supplier.id)}>
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" color="info" onClick={() => handleOpenSupplier(supplier)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteSupplier(supplier.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <UnifiedPagination
                  count={filteredSuppliers.length}
                  page={supplierPage}
                  rowsPerPage={supplierRowsPerPage}
                  onPageChange={setSupplierPage}
                  onRowsPerPageChange={(newR) => {
                    setSupplierRowsPerPage(newR);
                    setSupplierPage(1);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </Box>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== PURCHASE DIALOG ==================== */}
      <Dialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white', py: isMobile ? 1.5 : 2 }}>
          {editingPurchase ? 'Edit Purchase' : 'New Purchase'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                size="small"
                options={suppliers}
                getOptionLabel={(option) => option.name}
                value={suppliers.find(s => s.id == purchaseForm.supplier_id) || null}
                onChange={(e, newValue) => {
                  setPurchaseForm(prev => ({
                    ...prev,
                    supplier_id: newValue?.id || '',
                    supplier_name: newValue?.name || ''
                  }));
                }}
                renderInput={(params) => <TextField {...params} label="Supplier" required />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Purchase No" 
                value={purchaseForm.purchase_no} 
                onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_no: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth 
                size="small" 
                label="Purchase Date" 
                type="date" 
                value={purchaseForm.purchase_date} 
                onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth 
                size="small" 
                label="Supplier Invoice #" 
                value={purchaseForm.supplier_invoice_no} 
                onChange={(e) => setPurchaseForm(prev => ({ ...prev, supplier_invoice_no: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select 
                  value={purchaseForm.status} 
                  onChange={(e) => setPurchaseForm(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="received">Received</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="ordered">Ordered</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Add Items Section - FIXED LAYOUT */}
          <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
            <Category sx={{ mr: 1, verticalAlign: 'middle' }} />
            Items
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
            <Box sx={{ flex: '0 0 200px', minWidth: '150px' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select 
                  value={selectedCategory} 
                  onChange={(e) => handleCategoryFilter(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(cat => (
                    <MenuItem key={cat.id} value={String(cat.id)}>{cat.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
              <Autocomplete
                size="small"
                options={filteredProducts}
                getOptionLabel={(option) => {
                  const name = option.product_name || option.name || 'Unknown';
                  const sku = option.sku || '';
                  const price = option.purchase_price || option.retail_price || 0;
                  return `${name} (${sku}) - Rs.${price}`;
                }}
                inputValue={productSearchInput}
                onInputChange={(e, newInputValue) => setProductSearchInput(newInputValue)}
                value={selectedVariant}
                onChange={(e, newValue) => {
                  if (newValue) {
                    handleVariantSelect(newValue.id);
                  } else {
                    setSelectedVariant(null);
                    setCurrentItem({
                      product_variant_id: '', product_name: '', sku: '',
                      quantity: '1', purchase_price: '', tax_percentage: '0',
                      expiry_date: '', imeiList: ''
                    });
                  }
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Search Product" 
                    fullWidth
                    size="small"
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} style={{ 
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      width: '100%',
                      gap: 0.5
                    }}>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1
                      }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }}>
                          {option.product_name || option.name || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight="bold">
                          Rs. {option.purchase_price || option.retail_price || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center'
                      }}>
                        <Typography variant="caption" color="text.secondary">
                          <strong>SKU:</strong> {option.sku || '-'}
                        </Typography>
                        {option.variant_name && option.variant_name !== 'Default' && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>Variant:</strong> {option.variant_name}
                          </Typography>
                        )}
                        {option.current_stock !== undefined && (
                          <Typography 
                            variant="caption" 
                            color={option.current_stock > 0 ? 'success.main' : 'error.main'}
                          >
                            <strong>Stock:</strong> {option.current_stock}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </li>
                )}
                sx={{
                  width: '100%',
                  '& .MuiAutocomplete-popper': {
                    width: 'auto !important',
                    minWidth: '400px !important',
                    maxWidth: '600px !important',
                  }
                }}
                PopperProps={{
                  style: {
                    width: 'auto',
                    minWidth: '400px',
                    maxWidth: '600px',
                  },
                  placement: 'bottom-start'
                }}
              />
            </Box>
            <Box sx={{ flex: '0 0 70px', minWidth: '60px' }}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Qty" 
                value={currentItem.quantity} 
                onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                sx={{ 
                  '& .MuiInputBase-root': { 
                    fontSize: '0.7rem',
                    padding: '2px 4px',
                    height: '36px'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '0.65rem'
                  }
                }}
              />
            </Box>
            <Box sx={{ flex: '0 0 90px', minWidth: '80px' }}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Price" 
                value={currentItem.purchase_price} 
                onChange={(e) => setCurrentItem(prev => ({ ...prev, purchase_price: e.target.value }))}
                slotProps={{ 
                  input: { 
                    startAdornment: <InputAdornment position="start" sx={{ fontSize: '0.6rem', mr: 0.3 }}>Rs.</InputAdornment>,
                    sx: { height: '36px', padding: '2px 4px' }
                  } 
                }}
                sx={{ 
                  '& .MuiInputBase-root': { 
                    fontSize: '0.7rem',
                    height: '36px'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '0.65rem'
                  }
                }}
              />
            </Box>
            <Box sx={{ flex: '0 0 70px', minWidth: '60px' }}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Tax %" 
                value={currentItem.tax_percentage} 
                onChange={(e) => setCurrentItem(prev => ({ ...prev, tax_percentage: e.target.value }))}
                sx={{ 
                  '& .MuiInputBase-root': { 
                    fontSize: '0.7rem',
                    padding: '2px 4px',
                    height: '36px'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '0.65rem'
                  }
                }}
              />
            </Box>
            <Box sx={{ flex: '0 0 80px', minWidth: '70px' }}>
              <Button 
                variant="contained" 
                color="secondary" 
                startIcon={<Add />} 
                onClick={handleAddItem}
                fullWidth
                sx={{ 
                  height: '36px',
                  fontSize: '0.65rem',
                  minWidth: '70px',
                  padding: '2px 6px',
                  '& .MuiButton-startIcon': {
                    marginRight: '2px'
                  }
                }}
              >
                ADD
              </Button>
            </Box>
          </Box>

          {priceHistory.length > 0 && (
            <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">Price History:</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                {priceHistory.map((h, idx) => (
                  <Chip 
                    key={idx} 
                    size="small" 
                    label={`${formatCurrency(h.purchase_price)} - ${formatDate(h.purchase_date)}`} 
                    variant="outlined"
                    onClick={() => setCurrentItem(prev => ({ ...prev, purchase_price: h.purchase_price }))}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 1 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#1c2580' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Qty</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Price</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Subtotal</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No items added</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>
                      {item.product_name}
                      {item.sku && <Typography variant="caption" display="block" color="text.secondary">{item.sku}</Typography>}
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.purchase_price)}</TableCell>
                    <TableCell align="right">{formatCurrency(item.sub_total || (item.quantity * item.purchase_price))}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Notes" 
                multiline 
                rows={2} 
                value={purchaseForm.notes} 
                onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2">Subtotal:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2">{formatCurrency(calculateTotals.subtotal)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Discount:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <TextField 
                      size="small" 
                      type="number" 
                      value={purchaseForm.discount_amount} 
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, discount_amount: e.target.value }))}
                      sx={{ width: 100 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Tax:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <TextField 
                      size="small" 
                      type="number" 
                      value={purchaseForm.tax_amount} 
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, tax_amount: e.target.value }))}
                      sx={{ width: 100 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Shipping:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <TextField 
                      size="small" 
                      type="number" 
                      value={purchaseForm.shipping_charges} 
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, shipping_charges: e.target.value }))}
                      sx={{ width: 100 }}
                    />
                  </Grid>
                  <Divider sx={{ my: 1, width: '100%' }} />
                  <Grid item xs={6}>
                    <Typography variant="h6" fontWeight="bold">Grand Total:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" fontWeight="bold" color="secondary.main">
                      {formatCurrency(calculateTotals.grandTotal)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Paid Amount:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <TextField 
                      size="small" 
                      type="number" 
                      value={purchaseForm.paid_amount} 
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, paid_amount: e.target.value }))}
                      sx={{ width: 100 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Payment Mode:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <FormControl size="small" sx={{ width: 100 }}>
                      <Select 
                        value={purchaseForm.payment_mode} 
                        onChange={(e) => setPurchaseForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                      >
                        <MenuItem value="cash"> Cash</MenuItem>
                        <MenuItem value="bank"> Bank</MenuItem>
                        <MenuItem value="easypaisa"> EasyPaisa</MenuItem>
                        <MenuItem value="jazzcash"> JazzCash</MenuItem>
                        <MenuItem value="cheque"> Cheque</MenuItem>
                        <MenuItem value="credit"> Credit</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {selectedPaymentAccount && purchaseForm.payment_mode !== 'credit' && (
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: 'grey.50' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight="bold">{selectedPaymentAccount.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{selectedPaymentAccount.type?.toUpperCase()} ACCOUNT</Typography>
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="caption" color="text.secondary" display="block">Available Balance</Typography>
                            <Typography variant="body2" fontWeight="bold" color={Number(selectedPaymentAccount.current_balance) >= Number(purchaseForm.paid_amount || 0) ? 'success.main' : 'error.main'}>
                              Rs. {Number(selectedPaymentAccount.current_balance).toLocaleString()}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  )}
                  {!selectedPaymentAccount && purchaseForm.payment_mode !== 'credit' && (
                    <Grid item xs={12}>
                      <Alert severity="warning" sx={{ borderRadius: 1, py: 0.5 }}>
                        No active account found for {purchaseForm.payment_mode.toUpperCase()}.
                      </Alert>
                    </Grid>
                  )}

                  {/* REMAINING / DUE DISPLAY */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="bold">Remaining / Due:</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold" 
                      color={calculateTotals.grandTotal - Number(purchaseForm.paid_amount || 0) > 0 ? 'error.main' : 'success.main'}
                    >
                      {formatCurrency(Math.max(0, calculateTotals.grandTotal - Number(purchaseForm.paid_amount || 0)))}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sx={{ textAlign: 'right', mt: 0.5 }}>
                    <Chip 
                      size="small" 
                      color={
                        Number(purchaseForm.paid_amount || 0) >= calculateTotals.grandTotal 
                          ? 'success' 
                          : Number(purchaseForm.paid_amount || 0) > 0 
                            ? 'warning' 
                            : 'error'
                      } 
                      label={
                        Number(purchaseForm.paid_amount || 0) >= calculateTotals.grandTotal 
                          ? 'PAID' 
                          : Number(purchaseForm.paid_amount || 0) > 0 
                            ? 'PARTIAL' 
                            : 'DUE'
                      } 
                      sx={{ height: 24, fontSize: '0.7rem', fontWeight: 'bold' }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button fullWidth={isMobile} onClick={() => setPurchaseDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Cancel</Button>
          <Button fullWidth={isMobile} variant="contained" color="secondary" startIcon={<Save />} onClick={handleSavePurchase} disabled={savingPurchase} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            {savingPurchase ? 'Saving...' : 'Save Purchase'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== PAYMENT DIALOG ==================== */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white', py: 1.5 }}>
          <Payment sx={{ mr: 1, verticalAlign: 'middle' }} />
          Make Payment - {paymentPurchase?.purchase_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          {paymentPurchase && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Supplier</Typography>
                  <Typography variant="body2">{paymentPurchase.supplier_name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(paymentPurchase.grand_total)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Paid</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {formatCurrency(paymentPurchase.paid_amount)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Due</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {formatCurrency((paymentPurchase.grand_total || 0) - (paymentPurchase.paid_amount || 0))}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <TextField 
                fullWidth 
                label="Amount" 
                type="number" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select value={paymentMode} onChange={(e) => {
                  const mode = e.target.value;
                  setPaymentMode(mode);
                  const acc = paymentAccounts.find(a => a.type === mode);
                  setSelectedPaymentAccount(acc || null);
                }} label="Payment Mode">
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="credit">Credit</MenuItem>
                </Select>
              </FormControl>
              
              {selectedPaymentAccount && paymentMode !== 'credit' && (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 1, bgcolor: 'grey.50' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{selectedPaymentAccount.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{selectedPaymentAccount.type?.toUpperCase()} ACCOUNT</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary" display="block">Available Balance</Typography>
                      <Typography variant="body1" fontWeight="bold" color={Number(selectedPaymentAccount.current_balance) >= Number(paymentAmount || 0) ? 'success.main' : 'error.main'}>
                        Rs. {Number(selectedPaymentAccount.current_balance).toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}
              {!selectedPaymentAccount && paymentMode !== 'credit' && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 1 }}>
                  No active account found for {paymentMode.toUpperCase()}. Please create one in Accounts page.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button onClick={() => setPaymentDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Cancel</Button>
          <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={handleProcessPayment} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            Process Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== RETURN DIALOG ==================== */}
      <Dialog open={returnDialog} onClose={() => setReturnDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white', py: isMobile ? 1.5 : 2 }}>
          <AssignmentReturn sx={{ mr: 1, verticalAlign: 'middle' }} />
          Process Return - {returnPurchase?.purchase_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          {returnPurchase && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Return No" 
                    value={returnNo} 
                    onChange={(e) => setReturnNo(e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Supplier" 
                    value={returnPurchase.supplier_name || ''} 
                    disabled
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Purchase Date" 
                    value={formatDate(returnPurchase.purchase_date)} 
                    disabled
                  />
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
                Select items to return. Stock will be deducted and supplier balance will be updated.
              </Alert>

              {/* FIX: Return refund account selection */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Refund Account</InputLabel>
                    <Select 
                      value={returnPaymentMode} 
                      onChange={(e) => {
                        const mode = e.target.value;
                        setReturnPaymentMode(mode);
                        const acc = paymentAccounts.find(a => a.type === mode);
                        setReturnPaymentAccount(acc || null);
                      }}
                      label="Refund Account"
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="bank">Bank</MenuItem>
                      <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                      <MenuItem value="jazzcash">JazzCash</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  {returnPaymentAccount ? (
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, bgcolor: 'grey.50' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{returnPaymentAccount.name}</Typography>
                          <Typography variant="caption" color="text.secondary">Balance: Rs. {Number(returnPaymentAccount.current_balance).toLocaleString()}</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ) : (
                    <Alert severity="warning" sx={{ borderRadius: 1 }}>
                      No active account found for {returnPaymentMode.toUpperCase()}.
                    </Alert>
                  )}
                </Grid>
              </Grid>

              {returnItems.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
                  No items available for return. All items have already been returned or no items exist in this purchase.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Purchased</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Already Returned</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Available</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Return Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Return Price</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnItems.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>
                            {item.product_name}
                            {item.variant_name && item.variant_name !== 'Default' && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {item.variant_name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="center">{item.returned_quantity || 0}</TableCell>
                          <TableCell align="center">
                            <Typography fontWeight="bold" color={item.available_quantity > 0 ? 'success.main' : 'error.main'}>
                              {item.available_quantity || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <TextField 
                              size="small" 
                              type="number" 
                              value={item.return_quantity || 0} 
                              onChange={(e) => updateReturnItem(idx, 'return_quantity', e.target.value)}
                              slotProps={{ htmlInput: { min: 0, max: item.available_quantity || 0 } }}
                              sx={{ width: 70 }}
                              disabled={!item.available_quantity || item.available_quantity <= 0}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField 
                              size="small" 
                              type="number" 
                              value={item.return_price || 0} 
                              onChange={(e) => updateReturnItem(idx, 'return_price', e.target.value)}
                              slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField 
                              size="small" 
                              value={item.reason || ''} 
                              onChange={(e) => updateReturnItem(idx, 'reason', e.target.value)}
                              placeholder="Reason"
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Discount" 
                    type="number" 
                    value={returnDiscount} 
                    onChange={(e) => setReturnDiscount(e.target.value)}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Tax %" 
                    type="number" 
                    value={returnTax} 
                    onChange={(e) => setReturnTax(e.target.value)}
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Notes" 
                    value={returnNote} 
                    onChange={(e) => setReturnNote(e.target.value)}
                    multiline
                    rows={1}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'right' }}>
                <Typography variant="body2">Subtotal: {formatCurrency(calculateReturnTotal.subtotal)}</Typography>
                <Typography variant="body2" color="success.main">
                  Discount: -{formatCurrency(calculateReturnTotal.discount)}
                </Typography>
                <Typography variant="body2" color="primary.main">
                  Tax: {formatCurrency(calculateReturnTotal.taxAmount)}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="error.main">
                  Grand Total: {formatCurrency(calculateReturnTotal.grandTotal)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button fullWidth={isMobile} onClick={() => setReturnDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Cancel</Button>
          <Button 
            fullWidth={isMobile} 
            variant="contained" 
            color="warning" 
            startIcon={<AssignmentReturn />} 
            onClick={handleProcessReturn}
            disabled={processingReturn || returnItems.filter(i => (i.return_quantity || 0) > 0).length === 0}
            sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}
          >
            {processingReturn ? 'Processing...' : 'Process Return'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== VIEW RETURN DIALOG ==================== */}
      <Dialog open={viewReturnDialog} onClose={() => setViewReturnDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white', py: 1.5 }}>
          <AssignmentReturn sx={{ mr: 1, verticalAlign: 'middle' }} />
          Return Details - {viewReturnData?.return_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          {viewReturnData && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Return No</Typography>
                  <Typography variant="body2" fontWeight="bold">{viewReturnData.return_no}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Date</Typography>
                  <Typography variant="body2">{formatDate(viewReturnData.return_date)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Purchase</Typography>
                  <Typography variant="body2">{viewReturnData.purchase_no || viewReturnData.purchase_id || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Supplier</Typography>
                  <Typography variant="body2">{viewReturnData.supplier_name || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
                Returned Items ({viewReturnData.items?.length || 0})
              </Typography>

              {(!viewReturnData.items || viewReturnData.items.length === 0) ? (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
                  No items found for this return.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Price</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Subtotal</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewReturnData.items.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>
                            {item.product_name || 'Unknown Product'}
                            {item.variant_name && item.variant_name !== 'Default' && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {item.variant_name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{item.sku || '-'}</TableCell>
                          <TableCell align="center">{item.quantity || 0}</TableCell>
                          <TableCell align="center">{formatCurrency(item.return_price || item.price || 0)}</TableCell>
                          <TableCell align="center">{formatCurrency(item.sub_total || (item.quantity * (item.return_price || item.price || 0)))}</TableCell>
                          <TableCell>{item.reason || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'right' }}>
                <Typography variant="body2">Subtotal: {formatCurrency(viewReturnData.total_amount || 0)}</Typography>
                <Typography variant="body2" color="success.main">
                  Discount: -{formatCurrency(viewReturnData.discount_amount || 0)}
                </Typography>
                <Typography variant="body2" color="primary.main">
                  Tax: {formatCurrency(viewReturnData.tax_amount || 0)}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="error.main">
                  Grand Total: {formatCurrency(viewReturnData.grand_total || 0)}
                </Typography>
              </Box>

              {viewReturnData.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                  <Typography variant="body2">{viewReturnData.notes}</Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button onClick={() => setViewReturnDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== SUPPLIER DIALOG ==================== */}
      <Dialog open={supplierDialog} onClose={() => setSupplierDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', py: 1.5 }}>
          {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                size="small" 
                label="Supplier Name *" 
                value={supplierForm.name} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Phone" 
                value={supplierForm.phone} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Email" 
                type="email" 
                value={supplierForm.email} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                size="small" 
                label="Company Name" 
                value={supplierForm.company} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, company: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                size="small" 
                label="Tax ID / NTN" 
                value={supplierForm.tax_id} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, tax_id: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                size="small" 
                label="Address" 
                multiline 
                rows={2} 
                value={supplierForm.address} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Opening Balance" 
                type="number" 
                value={supplierForm.balance} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, balance: e.target.value }))}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select 
                  value={supplierForm.status} 
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5, pt: 1 }}>
          <Button onClick={() => setSupplierDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Cancel</Button>
          <Button variant="contained" color="primary" startIcon={<Save />} onClick={handleSaveSupplier} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            Save Supplier
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== SUPPLIER DETAILS DIALOG ==================== */}
      <Dialog open={supplierDetailsDialog} onClose={() => setSupplierDetailsDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', py: isMobile ? 1.5 : 2 }}>
          <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
          Supplier Details - {selectedSupplier?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          {selectedSupplier && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Phone</Typography>
                  <Typography variant="body2">{selectedSupplier.phone || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
  <Typography variant="caption" color="text.secondary" display="block">Total Purchases</Typography>
  <Typography variant="body2" fontWeight="bold">{supplierPurchases.length}</Typography>
</Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Email</Typography>
                  <Typography variant="body2">{selectedSupplier.email || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Balance</Typography>
                  <Typography variant="body2" fontWeight="bold" color={selectedSupplier.current_balance > 0 ? 'error.main' : 'success.main'}>
                    {formatCurrency(selectedSupplier.current_balance || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                  <Chip 
                    size="small" 
                    color={selectedSupplier.status === 'active' ? 'success' : 'default'} 
                    label={selectedSupplier.status?.toUpperCase() || 'ACTIVE'} 
                    sx={{ height: 20, fontSize: '0.6rem' }}
                  />
                </Grid>
                {selectedSupplier.address && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">Address</Typography>
                    <Typography variant="body2">{selectedSupplier.address}</Typography>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
                Purchase History
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, borderRadius: 1, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#1c2580' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Purchase #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Paid</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Due</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {supplierPurchases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">No purchases for this supplier</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {supplierPurchases.map((p) => {
                      const due = (p.grand_total || 0) - (p.paid_amount || 0);
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>{p.purchase_no}</TableCell>
                          <TableCell>{formatDate(p.purchase_date)}</TableCell>
                          <TableCell align="right">{formatCurrency(p.grand_total)}</TableCell>
                          <TableCell align="right">{formatCurrency(p.paid_amount)}</TableCell>
                          <TableCell align="right" sx={{ color: due > 0 ? 'error.main' : 'success.main' }}>
                            {formatCurrency(due)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={p.payment_status === 'paid' ? 'success' : p.payment_status === 'partial' ? 'warning' : 'error'} 
                              label={p.payment_status?.toUpperCase() || 'DUE'} 
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

            {supplierLedger.length > 0 && (
  <>
    <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
      <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
      Ledger
    </Typography>
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead sx={{ bgcolor: '#1c2580' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }} align="right">Balance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {supplierLedger.map((entry, idx) => (
            <TableRow key={idx} hover>
              <TableCell>{formatDate(entry.date)}</TableCell>
              <TableCell>
                <Chip 
                  size="small" 
                  color={
                    entry.type === 'payment' ? 'success' : 
                    entry.type === 'purchase_return' ? 'info' : 
                    entry.type === 'purchase' ? 'error' : 'warning'
                  } 
                  label={
                    entry.type === 'payment' ? 'PAYMENT' : 
                    entry.type === 'purchase_return' ? 'RETURN' : 
                    entry.type === 'purchase' ? 'PURCHASE' : 
                    (entry.type?.toUpperCase() || 'TRANSACTION')
                  } 
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              </TableCell>
              <TableCell align="right" sx={{ 
                color: (entry.type === 'payment' || entry.type === 'purchase_return') ? 'success.main' : 'error.main',
                fontWeight: 'bold'
              }}>
                {formatCurrency(Math.abs(entry.amount))}
              </TableCell>
              <TableCell>
                {entry.description || '-'}
                {entry.payment_mode && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Mode: {entry.payment_mode.toUpperCase()}
                  </Typography>
                )}
                {entry.purchase_no && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {entry.purchase_no}
                  </Typography>
                )}
                {entry.return_no && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {entry.return_no}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(entry.balance_after || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </>
)}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button onClick={() => setSupplierDetailsDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* ==================== SUPPLIER PAYMENT DIALOG ==================== */}
      <Dialog open={supplierPaymentDialog} onClose={() => setSupplierPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white', py: 1.5 }}>
          <Payment sx={{ mr: 1, verticalAlign: 'middle' }} />
          Make Payment - {paymentSupplier?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          {paymentSupplier && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Supplier</Typography>
                  <Typography variant="body2" fontWeight="bold">{paymentSupplier.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Current Balance</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {formatCurrency(paymentSupplier.current_balance || 0)}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <TextField 
                fullWidth 
                label="Amount" 
                type="number" 
                value={supplierPaymentAmount} 
                onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                slotProps={{ 
                  input: { 
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button 
                          size="small" 
                          onClick={() => setSupplierPaymentAmount(String(Math.abs(paymentSupplier.current_balance || 0)))}
                        >
                          Max
                        </Button>
                      </InputAdornment>
                    )
                  } 
                }}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select 
                  value={supplierPaymentMode} 
                  onChange={(e) => {
                    const mode = e.target.value;
                    setSupplierPaymentMode(mode);
                    const acc = paymentAccounts.find(a => a.type === mode);
                    setSupplierPaymentAccount(acc || null);
                  }} 
                  label="Payment Mode"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="credit">Credit</MenuItem>
                </Select>
              </FormControl>
              
              {supplierPaymentAccount && supplierPaymentMode !== 'credit' && (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 1, bgcolor: 'grey.50' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{supplierPaymentAccount.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{supplierPaymentAccount.type?.toUpperCase()} ACCOUNT</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary" display="block">Available Balance</Typography>
                      <Typography variant="body1" fontWeight="bold" color={Number(supplierPaymentAccount.current_balance) >= Number(supplierPaymentAmount || 0) ? 'success.main' : 'error.main'}>
                        Rs. {Number(supplierPaymentAccount.current_balance).toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}
              {!supplierPaymentAccount && supplierPaymentMode !== 'credit' && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 1 }}>
                  No active account found for {supplierPaymentMode.toUpperCase()}.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button onClick={() => setSupplierPaymentDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<CheckCircle />} 
            onClick={handleProcessSupplierPayment}
          >
            Process Payment
          </Button>
        </DialogActions>
      </Dialog>
      {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', py: 1.5 }}>
          <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: isMobile ? 1.5 : 3 }}>
          <Typography sx={{ mt: 1 }}>
            Are you sure you want to delete this purchase? This action cannot be undone.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 1 }}>
            This will also restore the stock for all items in this purchase.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1.5 : 3, pb: isMobile ? 2 : 1.5 }}>
          <Button onClick={() => setDeleteDialog(false)} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<Delete />} onClick={confirmDelete} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== FAB BUTTON ==================== */}
      {isMobile && (
        <Fab color="secondary" sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }} onClick={() => handleOpenPurchase()}>
          <Add />
        </Fab>
      )}
      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 8 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}