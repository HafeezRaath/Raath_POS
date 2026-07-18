import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Tabs, Tab, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress, Autocomplete,
  Switch, FormControlLabel, Alert, Snackbar, RadioGroup, Radio,
  FormLabel, AppBar, Toolbar, Checkbox, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Badge, Avatar,
  ListItemIcon  // ✅ ADDED
} from '@mui/material';
import {
  Add, Edit, Delete, Search, QrCode, PhoneAndroid, Straighten,
  LocalGroceryStore, Save, Category, Scale, Inventory, LocalShipping,
  AddCircle, History, Warning, LocalOffer, Percent, AttachMoney,
  KeyboardArrowDown, KeyboardArrowUp, CheckCircle, CalendarToday,
  UploadFile, TableChart, Close, CloudUpload, CameraAlt, ContentPaste,
  Image as ImageIcon, DocumentScanner, ClearAll, Refresh,
  Menu as MenuIcon, ArrowUpward, ArrowDownward, TrendingUp,
  TrendingDown, Store, Person, Receipt
} from '@mui/icons-material';
import { createWorker } from 'tesseract.js';
import db from '../database/db';

// ==================== CONSTANTS ====================
const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard', icon: <Inventory fontSize="small" /> },
  { value: 'imei', label: 'IMEI Product', icon: <PhoneAndroid fontSize="small" /> },
  { value: 'fabric', label: 'Fabric/Cloth', icon: <Straighten fontSize="small" /> },
  { value: 'grocery', label: 'Grocery/Food', icon: <LocalGroceryStore fontSize="small" /> },
];

const DEFAULT_UNITS = ['Piece', 'Pair', 'KG', 'Gram', 'Meter', 'Than', 'Liter', 'Box', 'Dozen', 'Pack', 'Bag', 'Roll'];

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

// ==================== MOBILE PRODUCT CARD ====================
const MobileProductCard = ({ product, onEdit, onDelete, getTypeChip, getStockBadge, onAddVariant }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: product.status === 'active' ? '4px solid #10b981' : '4px solid #94a3b8' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {product.product_name || product.name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip label={product.sku} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
              {getTypeChip(product.product_type || product.type)}
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={Number(product.current_stock) <= 0 ? 'error.main' : 'success.main'}>
              {product.current_stock || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">{product.base_unit || product.unit}</Typography>
          </Box>
        </Box>

        {getStockBadge(product.current_stock, product.stock_alert_quantity)}

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body2">{product.category_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Chip size="small" color={product.status === 'active' ? 'success' : 'default'} label={product.status} sx={{ height: 18, fontSize: '0.55rem' }} />
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Cost</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(product.purchase_price)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Retail</Typography>
              <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(product.retail_price)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Wholesale</Typography>
              <Typography variant="body2" fontWeight="bold" color="secondary.main">{formatCurrency(product.wholesale_price)}</Typography>
            </Grid>
            {product.barcode && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Barcode</Typography>
                <Typography variant="body2" fontFamily="monospace">{product.barcode}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<AddCircle />} onClick={() => onAddVariant(product)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
            Variant
          </Button>
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(product)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
            Edit
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(product.id)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
            Del
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE PURCHASE CARD ====================
const MobilePurchaseCard = ({ purchase, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ mb: 1.5, borderLeft: purchase.status === 'received' ? '4px solid #10b981' : '4px solid #f59e0b' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {purchase.purchase_no}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {purchase.supplier_name || 'Unknown Supplier'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
              {formatCurrency(purchase.grand_total)}
            </Typography>
            <Chip 
              size="small" 
              label={purchase.payment_status?.toUpperCase() || 'DUE'} 
              color={purchase.payment_status === 'paid' ? 'success' : purchase.payment_status === 'partial' ? 'warning' : 'error'}
              sx={{ height: 18, fontSize: '0.55rem' }}
            />
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2">{formatDate(purchase.purchase_date)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Chip size="small" color={purchase.status === 'received' ? 'success' : 'warning'} label={purchase.status} sx={{ height: 18, fontSize: '0.55rem' }} />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Paid</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(purchase.paid_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Due</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(purchase.grand_total - purchase.paid_amount)}</Typography>
            </Grid>
            {purchase.supplier_invoice_no && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Supplier Invoice</Typography>
                <Typography variant="body2">{purchase.supplier_invoice_no}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(purchase)} sx={{ flex: 1, fontSize: '0.6rem' }}>
            Edit
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(purchase.id)} sx={{ flex: 1, fontSize: '0.6rem' }}>
            Delete
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function InventoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [units, setUnits] = useState(() => {
    const saved = localStorage.getItem('custom_units');
    return saved ? JSON.parse(saved) : DEFAULT_UNITS;
  });
  const [loading, setLoading] = useState(true);
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterType, setFilterType] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [dialogProductType, setDialogProductType] = useState('standard');
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [unitDialog, setUnitDialog] = useState(false);

  const [variantDialog, setVariantDialog] = useState(false);
  const [variantParent, setVariantParent] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: '', variantName: '', costPrice: '', retailPrice: '',
    wholesalePrice: '', stock: '', barcode: '', imeiList: ''
  });

  const [productForm, setProductForm] = useState({
    name: '', sku: '', type: 'standard', category_id: '', unit: 'Piece',
    costPrice: '', retailPrice: '', wholesalePrice: '', barcode: '',
    stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
    weight: '', expiryDate: '', batchNumber: '', description: '',
    status: 'active', variant_name: 'Default'
  });

  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '', supplier_name: '', purchase_no: `PUR-${Date.now()}`,
    supplier_invoice_no: '', purchase_date: new Date().toISOString().split('T')[0],
    due_date: '', status: 'received', discount_amount: '0', tax_amount: '0',
    shipping_charges: '0', notes: '', paid_amount: '0', payment_mode: 'cash'
  });
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_variant_id: '', product_name: '', sku: '', quantity: '1',
    purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: ''
  });
  const [priceHistory, setPriceHistory] = useState([]);

  // Bulk Import
  const [bulkImportDialog, setBulkImportDialog] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkDelimiter, setBulkDelimiter] = useState('tab');
  const [bulkImportMode, setBulkImportMode] = useState('purchase');
  const [bulkImportTarget, setBulkImportTarget] = useState('purchase');
  const [bulkHasHeaders, setBulkHasHeaders] = useState(true);
  const [bulkColumnMap, setBulkColumnMap] = useState({ name: 0, sku: 1, qty: 2, price: 3 });

  // OCR
  const [ocrDialog, setOcrDialog] = useState(false);
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrParsedItems, setOcrParsedItems] = useState([]);
  const [ocrConfidence, setOcrConfidence] = useState(0);

  // Offers
  const [offerDialog, setOfferDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({
    name: '', description: '', discount_type: 'percentage',
    discount_value: '0', start_date: new Date().toISOString().split('T')[0],
    end_date: '', status: 'active'
  });
  const [offerItems, setOfferItems] = useState([]);
  const [offerCategoryFilter, setOfferCategoryFilter] = useState('');
  const [selectedOfferProduct, setSelectedOfferProduct] = useState(null);
  const [selectedOfferVariant, setSelectedOfferVariant] = useState(null);
  const [offerVariantPrice, setOfferVariantPrice] = useState('');

  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroup = (productId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, brnds, purchs, supps, offs] = await Promise.all([
        db.getAllVariants ? db.getAllVariants() : (db.getProducts ? db.getProducts() : Promise.resolve([])),
        db.getCategories ? db.getCategories() : Promise.resolve([]),
        db.getBrands ? db.getBrands() : Promise.resolve([]),
        db.getPurchases ? db.getPurchases() : Promise.resolve([]),
        db.getSuppliers ? db.getSuppliers() : Promise.resolve([]),
        db.getOffers ? db.getOffers() : Promise.resolve([])
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      setBrands(brnds || []);
      setPurchases(purchs || []);
      setSuppliers(supps || []);
      setOffers(offs || []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ==================== HELPERS ====================
  const getStockColor = (stock, alertQty) => {
    if (stock <= 0) return '#e53935';
    if (stock <= (alertQty || 5)) return '#fb8c00';
    return '#43a047';
  };

  const getStockBadge = (stock, minStock) => {
    const s = Number(stock) || 0;
    const m = Number(minStock) || 0;
    if (s <= 0) return <Chip size="small" color="error" label="Out" sx={{ height: 18, fontSize: '0.55rem' }} />;
    if (s <= m) return <Chip size="small" color="warning" label="Low" icon={<Warning fontSize="small" />} sx={{ height: 18, fontSize: '0.55rem' }} />;
    return <Chip size="small" color="success" label="In Stock" sx={{ height: 18, fontSize: '0.55rem' }} />;
  };

  const getTypeChip = (type) => {
    const t = PRODUCT_TYPES.find(p => p.value === type);
    return <Chip size="small" icon={t?.icon} label={t?.label} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />;
  };

  const parseMeta = (desc) => {
    try { return JSON.parse(desc || '{}'); } catch { return {}; }
  };

  // ==================== FILTERS ====================
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const name = (p.product_name || p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const matchSearch = name.includes(searchProduct.toLowerCase()) || sku.includes(searchProduct.toLowerCase());
      const matchCategory = !filterCategory || (p.category_name === filterCategory) || (String(p.category_id) === String(filterCategory));
      const matchBrand = !filterBrand || (p.brand_name === filterBrand) || (p.brand_id == filterBrand);
      const matchType = !filterType || (p.product_type === filterType) || (p.type === filterType);
      return matchSearch && matchCategory && matchBrand && matchType;
    });
  }, [products, searchProduct, filterCategory, filterBrand, filterType]);

  // ==================== INVENTORY SUMMARY ====================
  const inventorySummary = useMemo(() => {
    const uniqueProductIds = new Set(products.map(p => p.product_id || p.id));
    let totalStockQty = 0, totalCostValue = 0, totalRetailValue = 0, totalWholesaleValue = 0;
    products.forEach(p => {
      const stock = Number(p.current_stock) || 0;
      totalStockQty += stock;
      totalCostValue += stock * (Number(p.purchase_price) || 0);
      totalRetailValue += stock * (Number(p.retail_price) || 0);
      totalWholesaleValue += stock * (Number(p.wholesale_price) || 0);
    });
    return {
      totalProducts: uniqueProductIds.size,
      totalVariants: products.length,
      totalStockQty, totalCostValue, totalRetailValue, totalWholesaleValue
    };
  }, [products]);

  // ==================== GROUPED PRODUCTS ====================
  const groupedProducts = useMemo(() => {
    const groups = new Map();
    filteredProducts.forEach(p => {
      const pid = p.product_id || p.id;
      if (!groups.has(pid)) groups.set(pid, { parent: p, variants: [] });
      groups.get(pid).variants.push(p);
    });
    return Array.from(groups.values());
  }, [filteredProducts]);

  // ==================== RESET FUNCTIONS ====================
  const resetProductForm = useCallback(() => {
    const last = JSON.parse(localStorage.getItem('last_product_defaults') || '{}');
    setProductForm({
      name: '', sku: '', type: last.type || 'standard', category_id: last.category_id || '',
      unit: last.unit || 'Piece', costPrice: '', retailPrice: '', wholesalePrice: '',
      barcode: '', stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
      weight: '', expiryDate: '', batchNumber: '', description: '', status: 'active', variant_name: 'Default'
    });
    setDialogProductType(last.type || 'standard');
  }, []);

  const resetOfferForm = useCallback(() => {
    setOfferForm({ name: '', description: '', discount_type: 'percentage', discount_value: '0',
      start_date: new Date().toISOString().split('T')[0], end_date: '', status: 'active' });
    setOfferItems([]); setOfferCategoryFilter(''); setSelectedOfferProduct(null);
    setSelectedOfferVariant(null); setOfferVariantPrice(''); setEditingOffer(null);
  }, []);

  // ==================== PRODUCT FUNCTIONS ====================
  const handleOpenProduct = useCallback((product = null) => {
    setEditingProduct(product);
    if (product) {
      const meta = parseMeta(product.description);
      setDialogProductType(product.product_type || product.type || 'standard');
      setProductForm({
        name: product.product_name || product.name || '', sku: product.sku || '',
        type: product.product_type || product.type || 'standard',
        category_id: product.category_id || '', unit: product.base_unit || product.unit || 'Piece',
        costPrice: product.purchase_price || '', retailPrice: product.retail_price || '',
        wholesalePrice: product.wholesale_price || '', barcode: product.barcode || '',
        stock: product.current_stock || '', minStock: product.stock_alert_quantity || '5', tax: '0',
        imeiList: meta.imeiList?.join('\n') || '', fabricLength: meta.fabricLength || '',
        weight: meta.weight || '', expiryDate: meta.expiryDate || '',
        batchNumber: meta.batchNumber || '',
        description: product.description && !meta.batchNumber ? product.description : '',
        status: product.status || 'active', variant_name: product.variant_name || 'Default'
      });
    } else { resetProductForm(); }
    setProductDialog(true);
  }, [resetProductForm]);

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));
    if (name === 'type') setDialogProductType(value);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const sku = productForm.sku.trim();
    if (!productForm.name.trim() || !sku) { 
      setSnackbar({ open: true, message: 'Name and SKU required!', severity: 'error' });
      return; 
    }
    const meta = {};
    if (productForm.type === 'imei' && productForm.imeiList) {
      meta.imeiList = productForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    if (productForm.type === 'fabric') meta.fabricLength = Number(productForm.fabricLength) || 0;
    if (productForm.type === 'grocery') {
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }
    const productData = {
      name: productForm.name, brand_id: null,
      category_id: Number(productForm.category_id) || null, type: productForm.type,
      unit: productForm.unit, tax_type: 'inclusive',
      description: JSON.stringify(meta), status: productForm.status
    };
    const variantData = {
      sku: sku, barcode: productForm.barcode || null,
      variant_name: productForm.variant_name || (productForm.type === 'fabric' ? `${productForm.fabricLength || 0}m per than` : 'Default'),
      purchase_price: Number(productForm.costPrice) || 0, retail_price: Number(productForm.retailPrice) || 0,
      wholesale_price: Number(productForm.wholesalePrice) || 0,
      minimum_retail_price: Number(productForm.retailPrice) || 0,
      stock_alert_quantity: Number(productForm.minStock) || 5,
      current_stock: Number(productForm.stock) || 0
    };
    try {
      const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
      if (editingProduct) {
        await db.updateProduct(editingProduct.product_id || editingProduct.id, productData);
        await db.updateVariant(editingProduct.id, variantData);
      } else {
        if (existingVariant) {
          const addedStock = Number(productForm.stock) || 0;
          await db.updateVariantStock(existingVariant.id, addedStock);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            await db.addMultipleSerializedItems(existingVariant.id, meta.imeiList);
          }
          setSnackbar({ open: true, message: `Stock updated for "${sku}"`, severity: 'success' });
        } else {
          const prodResult = await db.addProduct(productData);
          const productId = prodResult.lastInsertRowid;
          variantData.product_id = productId;
          const varResult = await db.addVariant(variantData);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            await db.addMultipleSerializedItems(varResult.lastInsertRowid, meta.imeiList);
          }
          setSnackbar({ open: true, message: 'Product created successfully!', severity: 'success' });
        }
      }
      localStorage.setItem('last_product_defaults', JSON.stringify({
        type: productForm.type, category_id: productForm.category_id, unit: productForm.unit
      }));
      await loadData(); setProductDialog(false); setEditingProduct(null); resetProductForm();
    } catch (err) {
      console.error('Save error:', err);
      setSnackbar({ open: true, message: 'Error saving product: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this product permanently? This cannot be undone!')) return;
    try {
      const variant = products.find(p => p.id == id);
      if (variant) {
        const productId = variant.product_id;
        const siblingVariants = products.filter(p => p.product_id === productId);
        await db.deleteVariant(id);
        if (siblingVariants.length <= 1) await db.deleteProduct(productId);
      } else {
        const productVariants = products.filter(p => p.product_id == id);
        if (productVariants.length > 0) {
          for (const v of productVariants) {
            await db.deleteVariant(v.id);
          }
          await db.deleteProduct(id);
        }
      }
      await loadData();
      setSnackbar({ open: true, message: 'Product deleted!', severity: 'success' });
    } catch (err) { 
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== VARIANT FUNCTIONS ====================
  const handleOpenVariant = (parentProduct) => {
    setVariantParent(parentProduct);
    setVariantForm({
      sku: parentProduct.sku || '', variantName: '',
      costPrice: parentProduct.purchase_price || '', retailPrice: parentProduct.retail_price || '',
      wholesalePrice: parentProduct.wholesale_price || '', stock: '', barcode: '', imeiList: ''
    });
    setVariantDialog(true);
  };

  const handleVariantChange = (e) => {
    const { name, value } = e.target;
    setVariantForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveVariant = async (e) => {
    e.preventDefault();
    const sku = variantForm.sku.trim();
    if (!sku) { setSnackbar({ open: true, message: 'SKU required!', severity: 'error' }); return; }
    try {
      const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
      const addedStock = Number(variantForm.stock) || 0;
      if (existingVariant) {
        await db.updateVariantStock(existingVariant.id, addedStock);
        if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && variantForm.imeiList?.trim()) {
          const imeis = variantForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (imeis.length > 0) await db.addMultipleSerializedItems(existingVariant.id, imeis);
        }
        setSnackbar({ open: true, message: `Stock updated for "${sku}"`, severity: 'success' });
      } else {
        const variantData = {
          product_id: variantParent.product_id, sku: sku,
          barcode: variantForm.barcode || null,
          variant_name: variantForm.variantName || 'Default',
          purchase_price: Number(variantForm.costPrice) || 0,
          retail_price: Number(variantForm.retailPrice) || 0,
          wholesale_price: Number(variantForm.wholesalePrice) || 0,
          minimum_retail_price: Number(variantForm.retailPrice) || 0,
          stock_alert_quantity: variantParent.stock_alert_quantity || 5,
          current_stock: addedStock
        };
        const varResult = await db.addVariant(variantData);
        if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && variantForm.imeiList?.trim()) {
          const imeis = variantForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (imeis.length > 0) await db.addMultipleSerializedItems(varResult.lastInsertRowid, imeis);
        }
        setSnackbar({ open: true, message: 'Variant created!', severity: 'success' });
      }
      await loadData(); setVariantDialog(false); setVariantParent(null);
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== CATEGORY FUNCTIONS ====================
  const handleAddCategory = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await db.createCategory({
        name: form.categoryName.value,
        slug: form.categoryName.value.toLowerCase().replace(/\s+/g, '-'),
        parent_id: form.parent_id.value ? Number(form.parent_id.value) : null, status: 'active'
      });
      await loadData(); form.reset();
      setSnackbar({ open: true, message: 'Category added!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try { 
      await db.deleteCategory(id); 
      await loadData();
      setSnackbar({ open: true, message: 'Category deleted!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== UNIT FUNCTIONS ====================
  const handleAddUnit = (e) => {
    e.preventDefault();
    const newUnit = e.target.unitName.value.trim();
    if (newUnit && !units.includes(newUnit)) {
      const updated = [...units, newUnit];
      setUnits(updated);
      localStorage.setItem('custom_units', JSON.stringify(updated));
      setSnackbar({ open: true, message: 'Unit added!', severity: 'success' });
    }
    e.target.reset();
  };

  // ==================== PURCHASE FUNCTIONS ====================
  const handleOpenPurchase = (purchase = null) => {
    setEditingPurchase(purchase);
    if (purchase) {
      setPurchaseForm({
        supplier_id: purchase.supplier_id || '', supplier_name: purchase.supplier_name || '',
        purchase_no: purchase.purchase_no || `PUR-${Date.now()}`,
        supplier_invoice_no: purchase.supplier_invoice_no || '',
        purchase_date: purchase.purchase_date ? purchase.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        due_date: purchase.due_date ? purchase.due_date.split('T')[0] : '',
        status: purchase.status || 'received',
        discount_amount: String(purchase.discount_amount || 0),
        tax_amount: String(purchase.tax_amount || 0),
        shipping_charges: String(purchase.shipping_charges || 0),
        notes: purchase.notes || '', paid_amount: String(purchase.paid_amount || 0),
        payment_mode: purchase.payment_mode || 'cash'
      });
    } else {
      setPurchaseForm({
        supplier_id: '', supplier_name: '', purchase_no: `PUR-${Date.now()}`,
        supplier_invoice_no: '', purchase_date: new Date().toISOString().split('T')[0],
        due_date: '', status: 'received', discount_amount: '0', tax_amount: '0',
        shipping_charges: '0', notes: '', paid_amount: '0', payment_mode: 'cash'
      });
      setItems([]);
    }
    setCurrentItem({
      product_variant_id: '', product_name: '', sku: '', quantity: '1',
      purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: ''
    });
    setPriceHistory([]); setPurchaseDialog(true);
  };

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value;
    const supplier = suppliers.find(s => s.id == supplierId);
    setPurchaseForm(prev => ({ ...prev, supplier_id: supplierId, supplier_name: supplier?.name || '' }));
  };

  const handleProductSelect = async (e) => {
    const variantId = e.target.value;
    if (!variantId) return;
    const product = products.find(p => p.id == variantId);
    if (!product) return;
    try {
      const history = await db.getPriceHistory ? await db.getPriceHistory(variantId, 3) : [];
      setPriceHistory(history || []);
    } catch { setPriceHistory([]); }
    setCurrentItem(prev => ({
      ...prev, product_variant_id: variantId,
      product_name: product.product_name || product.name, sku: product.sku,
      purchase_price: product.purchase_price || '', quantity: '1', imeiList: ''
    }));
  };

  const addItem = () => {
    if (!currentItem.product_variant_id || !currentItem.purchase_price) {
      setSnackbar({ open: true, message: 'Select product and enter price!', severity: 'warning' });
      return;
    }
    const selectedProduct = products.find(p => p.id == currentItem.product_variant_id);
    const qty = parseFloat(currentItem.quantity) || 1;
    if ((selectedProduct?.product_type === 'imei' || selectedProduct?.type === 'imei') && currentItem.imeiList) {
      const imeis = (currentItem.imeiList || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (imeis.length !== qty) { 
        setSnackbar({ open: true, message: `IMEI count mismatch! Expected ${qty}, got ${imeis.length}.`, severity: 'error' });
        return; 
      }
    }
    const price = parseFloat(currentItem.purchase_price) || 0;
    const tax = parseFloat(currentItem.tax_percentage) || 0;
    const subTotal = qty * price;
    const taxAmount = subTotal * (tax / 100);
    setItems(prev => [...prev, {
      ...currentItem, quantity: qty, purchase_price: price,
      tax_percentage: tax, sub_total: subTotal + taxAmount,
      expiry_date: currentItem.expiry_date, imeiList: currentItem.imeiList
    }]);
    setCurrentItem({
      product_variant_id: '', product_name: '', sku: '', quantity: '1',
      purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: ''
    });
    setPriceHistory([]);
    setSnackbar({ open: true, message: 'Item added!', severity: 'success' });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ==================== CALCULATIONS ====================
  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.purchase_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.purchase_price * (item.tax_percentage / 100)), 0);
  const discount = parseFloat(purchaseForm.discount_amount) || 0;
  const shipping = parseFloat(purchaseForm.shipping_charges) || 0;
  const grandTotal = subTotal + totalTax - discount + shipping;
  const paid = parseFloat(purchaseForm.paid_amount) || 0;
  const due = grandTotal - paid;

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplier_id) { setSnackbar({ open: true, message: 'Select supplier!', severity: 'warning' }); return; }
    if (items.length === 0 && !editingPurchase) { setSnackbar({ open: true, message: 'Add at least one item!', severity: 'warning' }); return; }
    try {
      const purchaseData = {
        supplier_id: parseInt(purchaseForm.supplier_id), purchase_no: purchaseForm.purchase_no,
        supplier_invoice_no: purchaseForm.supplier_invoice_no,
        purchase_date: purchaseForm.purchase_date, due_date: purchaseForm.due_date || null,
        status: purchaseForm.status, total_amount: subTotal, discount_amount: discount,
        tax_amount: totalTax, shipping_charges: shipping, grand_total: grandTotal,
        paid_amount: paid, payment_status: paid >= grandTotal ? 'paid' : paid > 0 ? 'partial' : 'due',
        notes: purchaseForm.notes, created_by: 1
      };
      let purchaseId;
      if (editingPurchase) {
        await db.updatePurchase(editingPurchase.id, purchaseData);
        purchaseId = editingPurchase.id;
      } else {
        const res = await db.addPurchase(purchaseData);
        purchaseId = res.lastInsertRowid;
      }
      if (!editingPurchase) {
        for (const item of items) {
          await db.addPurchaseItem({
            purchase_id: purchaseId, product_variant_id: item.product_variant_id,
            quantity: item.quantity, purchase_price: item.purchase_price,
            tax_percentage: item.tax_percentage, sub_total: item.sub_total,
            expiry_date: item.expiry_date || null
          });
          await db.updateVariantStock(item.product_variant_id, item.quantity);
          if (item.imeiList?.trim()) {
            const imeis = item.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (imeis.length > 0) await db.addMultipleSerializedItems(item.product_variant_id, imeis);
          }
        }
        if (due > 0) {
          await db.updateSupplierBalance(purchaseForm.supplier_id, due);
          if (db.addLedgerEntry) {
            await db.addLedgerEntry({
              supplier_id: purchaseForm.supplier_id, type: 'purchase',
              amount: due, description: `Purchase ${purchaseForm.purchase_no}`
            });
          }
        }
        if (db.logToGeneralLedger) {
          await db.logToGeneralLedger('purchase', purchaseId, 0, grandTotal, `Purchase ${purchaseForm.purchase_no}`);
        }
      }
      setSnackbar({ open: true, message: 'Purchase saved!', severity: 'success' });
      setPurchaseDialog(false); setEditingPurchase(null); setItems([]); loadData();
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm('Delete this purchase record?')) return;
    try { 
      await db.deletePurchase(id); 
      await loadData();
      setSnackbar({ open: true, message: 'Purchase deleted!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== OFFER FUNCTIONS ====================
  const handleOpenOffer = (offer = null) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferForm({
        name: offer.name || '', description: offer.description || '',
        discount_type: offer.discount_type || 'percentage',
        discount_value: String(offer.discount_value || 0),
        start_date: offer.start_date ? offer.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: offer.end_date ? offer.end_date.split('T')[0] : '',
        status: offer.status || 'active'
      });
      setOfferItems(offer.items || []);
    } else { resetOfferForm(); }
    setOfferDialog(true);
  };

  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (!offerForm.name.trim()) { setSnackbar({ open: true, message: 'Offer name required!', severity: 'warning' }); return; }
    if (offerItems.length < 2) { setSnackbar({ open: true, message: 'At least 2 products required!', severity: 'warning' }); return; }
    const offerOriginalTotal = offerItems.reduce((sum, i) => sum + (Number(i.original_price) || 0), 0);
    const offerDiscountTotal = offerItems.reduce((sum, i) => sum + (Number(i.offer_price) || 0), 0);
    const calculatedDiscount = offerForm.discount_type === 'percentage'
      ? (offerOriginalTotal * (Number(offerForm.discount_value) || 0) / 100)
      : (Number(offerForm.discount_value) || 0);
    const offerFinalTotal = Math.max(0, offerDiscountTotal - calculatedDiscount);
    
    const offerData = {
      name: offerForm.name, description: offerForm.description,
      discount_type: offerForm.discount_type, discount_value: Number(offerForm.discount_value) || 0,
      start_date: offerForm.start_date, end_date: offerForm.end_date || null,
      status: offerForm.status, original_total: offerOriginalTotal,
      final_total: offerFinalTotal, items_count: offerItems.length
    };
    try {
      if (editingOffer) {
        await db.updateOffer(editingOffer.id, offerData);
        if (db.deleteOfferItems) await db.deleteOfferItems(editingOffer.id);
        for (const item of offerItems) await db.addOfferItem({ ...item, offer_id: editingOffer.id });
      } else {
        const res = await db.addOffer(offerData);
        const offerId = res.lastInsertRowid;
        for (const item of offerItems) await db.addOfferItem({ ...item, offer_id: offerId });
      }
      await loadData(); setOfferDialog(false); resetOfferForm();
      setSnackbar({ open: true, message: 'Offer saved!', severity: 'success' });
    } catch (err) {
      console.error('Offer save error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteOffer = async (id) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      if (db.deleteOfferItems) await db.deleteOfferItems(id);
      await db.deleteOffer(id); await loadData();
      setSnackbar({ open: true, message: 'Offer deleted!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleAddToOffer = () => {
    if (!selectedOfferVariant) return;
    const alreadyExists = offerItems.find(i => i.variant_id === selectedOfferVariant.id);
    if (alreadyExists) { 
      setSnackbar({ open: true, message: 'Variant already in offer!', severity: 'warning' });
      return; 
    }
    const originalPrice = Number(selectedOfferVariant.retail_price) || 0;
    const customPrice = offerVariantPrice ? Number(offerVariantPrice) : originalPrice;
    setOfferItems(prev => [...prev, {
      variant_id: selectedOfferVariant.id, product_id: selectedOfferProduct.product_id,
      product_name: selectedOfferProduct.product_name || selectedOfferProduct.name,
      variant_name: selectedOfferVariant.variant_name || 'Default', sku: selectedOfferVariant.sku,
      original_price: originalPrice, offer_price: customPrice, category_id: selectedOfferProduct.category_id
    }]);
    setSelectedOfferVariant(null); setOfferVariantPrice('');
    setSnackbar({ open: true, message: 'Added to offer!', severity: 'success' });
  };

  const handleRemoveOfferItem = (variantId) => {
    setOfferItems(prev => prev.filter(i => i.variant_id !== variantId));
  };

  // ==================== BULK IMPORT FUNCTIONS ====================
  const openBulkImport = (mode = 'purchase') => {
    setBulkImportMode(mode); setBulkImportTarget(mode);
    setBulkText(''); setBulkPreview([]); setBulkDelimiter('tab');
    setBulkHasHeaders(true);
    setBulkColumnMap({ name: 0, sku: 1, qty: 2, price: 3 });
    setBulkImportDialog(true);
  };

  const getDelimiterChar = (type) => {
    switch(type) {
      case 'tab': return '\t';
      case 'comma': return ',';
      case 'pipe': return '|';
      case 'semicolon': return ';';
      default: return '\t';
    }
  };

  const parseBulkText = () => {
    if (!bulkText.trim()) {
      setBulkPreview([]);
      return;
    }
    
    let delimiter = bulkDelimiter;
    const sep = getDelimiterChar(delimiter);
    const lines = bulkText.trim().split(/\r?\n/).filter(line => line.trim());
    
    let startIndex = 0;
    if (bulkHasHeaders) startIndex = 1;
    
    const parsed = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      let parts;
      
      if (sep === '\t') {
        parts = line.split('\t');
      } else {
        parts = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === sep && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else current += char;
        }
        parts.push(current.trim());
      }
      
      parts = parts.map(p => p.replace(/^"|"$/g, '').trim());
      
      const nameIdx = bulkColumnMap.name || 0;
      const skuIdx = bulkColumnMap.sku || 1;
      const qtyIdx = bulkColumnMap.qty !== undefined ? bulkColumnMap.qty : 2;
      const priceIdx = bulkColumnMap.price !== undefined ? bulkColumnMap.price : 3;
      
      const name = parts[nameIdx] || '';
      const sku = parts[skuIdx] || '';
      const qty = parseFloat(parts[qtyIdx]?.replace(/[^0-9.]/g, '')) || 1;
      const price = parseFloat(parts[priceIdx]?.replace(/[^0-9.]/g, '')) || 0;
      
      if (name && sku) {
        parsed.push({ name, sku, quantity: qty, purchase_price: price, line, raw: parts });
      }
    }
    
    setBulkPreview(parsed);
    if (parsed.length === 0 && lines.length > 0) {
      setSnackbar({ open: true, message: 'No valid rows parsed. Check delimiter and column mapping.', severity: 'warning' });
    }
  };

  const applyBulkToPurchase = () => {
    if (bulkPreview.length === 0) return;
    const newItems = bulkPreview.map(item => {
      const existingProduct = products.find(p => p.sku?.toLowerCase() === item.sku.toLowerCase());
      const qty = item.quantity || 1; 
      const price = item.purchase_price || 0;
      const subTotal = qty * price;
      return {
        product_variant_id: existingProduct?.id || '',
        product_name: existingProduct?.product_name || item.name, 
        sku: item.sku,
        quantity: qty, 
        purchase_price: price, 
        tax_percentage: 0,
        sub_total: subTotal, 
        expiry_date: '', 
        imeiList: '', 
        isNewProduct: !existingProduct
      };
    });
    setItems(prev => [...prev, ...newItems]);
    setBulkImportDialog(false); 
    setBulkText(''); 
    setBulkPreview([]);
    setSnackbar({ open: true, message: `${newItems.length} items added to purchase!`, severity: 'success' });
  };

  const applyBulkToProducts = async () => {
    if (bulkPreview.length === 0) return;
    let created = 0; 
    let updated = 0;
    try {
      for (const item of bulkPreview) {
        const existingProduct = products.find(p => p.sku?.toLowerCase() === item.sku.toLowerCase());
        if (existingProduct) {
          await db.updateVariantStock(existingProduct.id, item.quantity || 0); 
          updated++;
        } else {
          const productData = {
            name: item.name, 
            brand_id: null,
            category_id: Number(productForm.category_id) || null,
            type: productForm.type || 'standard', 
            unit: productForm.unit || 'Piece',
            tax_type: 'inclusive', 
            description: '{}', 
            status: 'active'
          };
          const prodResult = await db.addProduct(productData);
          const productId = prodResult.lastInsertRowid;
          const variantData = {
            product_id: productId, 
            sku: item.sku, 
            barcode: null, 
            variant_name: 'Default',
            purchase_price: item.purchase_price || 0,
            retail_price: Math.round((item.purchase_price || 0) * 1.3),
            wholesale_price: Math.round((item.purchase_price || 0) * 1.2),
            minimum_retail_price: Math.round((item.purchase_price || 0) * 1.3),
            stock_alert_quantity: 5, 
            current_stock: item.quantity || 0
          };
          await db.addVariant(variantData); 
          created++;
        }
      }
      await loadData(); 
      setBulkImportDialog(false); 
      setBulkText(''); 
      setBulkPreview([]);
      setSnackbar({ open: true, message: `${created} products created, ${updated} updated!`, severity: 'success' });
    } catch (err) {
      console.error('Bulk product error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== OCR FUNCTIONS ====================
  const handleOcrImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setOcrImage(event.target.result);
      setOcrResult(''); 
      setOcrParsedItems([]);
      setOcrConfidence(0);
    };
    reader.readAsDataURL(file);
  };

  const processOcrImage = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    setOcrResult('');
    setOcrParsedItems([]);
    setOcrConfidence(0);

    let worker = null;
    try {
      const img = new Image();
      img.src = ocrImage;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/png');
      
      worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/-$%&()[]{}:;@#+=*!?\'"|~`<> \t\n',
        preserve_interword_spaces: '1',
      });
      
      const result = await worker.recognize(imageData);
      await worker.terminate();
      worker = null;

      setOcrResult(result.data.text);
      setOcrConfidence(result.data.confidence || 0);

      const parsed = parseOcrTextToItems(result.data.text);
      setOcrParsedItems(parsed);

      if (parsed.length === 0 && result.data.text.trim()) {
        setSnackbar({ open: true, message: 'Text found but no items detected. Add manually.', severity: 'warning' });
      } else {
        setSnackbar({ open: true, message: `OCR complete! ${parsed.length} items detected.`, severity: 'success' });
      }
    } catch (err) {
      console.error('OCR error:', err);
      setSnackbar({ open: true, message: 'OCR failed: ' + err.message, severity: 'error' });
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (_) {}
      }
      setOcrLoading(false);
    }
  };

  const parseOcrTextToItems = (text) => {
    if (!text || !text.trim()) return [];
    const rawLines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2);
    const items = [];
    const usedSkus = new Set();

    const skipPatterns = [
      /PURCHASE INVOICE|DOCUMENT NO|SUPPLIER|TERM|CURRENCY|PAGE\s*\d|Sub\s*-?\s*Total|Grand\s*Total|Total\s*Amount|One Hundred|Company Chop|GST Reg/i,
      /^\s*INVOICE|BILL TO|SHIP TO|^\s*ORDER|QUANTITY|DESCRIPTION|UNIT PRICE|^\s*AMOUNT\s*$|^\s*TOTAL\s*$|SUBTOTAL|^\s*TAX\s*$|DISCOUNT/i,
      /Thank you|Please pay|Due date|^\s*Account|^\s*Phone|^\s*Email|^\s*Website|^\s*Address|GST|NTN|VAT/i,
      /^\s*Rs?\.?\s*[\d,]+\s*$/, /^\s*PKR\s*[\d,]+\s*$/i,
      /^\s*Date\s*[:\-]?\s*\d/i, /^\s*Qty\s*$/i, /^\s*Price\s*$/i, /^\s*Rate\s*$/i,
    ];

    const genSku = (name) => {
      let base = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 15);
      if (!base) base = 'ITEM';
      let sku = base, n = 1;
      while (usedSkus.has(sku)) sku = `${base}-${n++}`;
      usedSkus.add(sku);
      return sku;
    };

    for (const rawLine of rawLines) {
      const cleanLine = rawLine.replace(/[|_~`]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanLine.length < 3) continue;
      if (skipPatterns.some(p => p.test(cleanLine))) continue;

      const withoutSerial = cleanLine.replace(/^\d{1,3}[.)]\s+/, '');
      const numberMatches = [...withoutSerial.matchAll(/[\d,]+\.?\d*/g)];
      if (numberMatches.length === 0) continue;

      const firstNumberIndex = numberMatches[0].index;
      let name = withoutSerial.slice(0, firstNumberIndex)
        .replace(/[^a-zA-Z0-9\s\-&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name) continue;

      const nums = numberMatches.map(m => parseFloat(m[0].replace(/,/g, ''))).filter(n => isFinite(n));
      let qty = 1, price = 0;

      if (nums.length >= 3) {
        const [q, p, amt] = nums.slice(-3);
        const expected = q * p;
        if (Math.abs(expected - amt) <= Math.max(1, amt * 0.1)) {
          qty = q; price = p;
        } else {
          qty = 1; price = nums[nums.length - 1];
        }
      } else if (nums.length === 2) {
        const [a, b] = nums;
        if (a > 0 && b > a && b / a < 1000) {
          const calcQty = Math.round(b / a);
          if (calcQty > 0 && Math.abs(calcQty * a - b) <= Math.max(1, b * 0.1)) {
            qty = calcQty; price = a;
          } else {
            qty = a; price = b;
          }
        } else {
          qty = a; price = b;
        }
      } else {
        price = nums[0];
        qty = 1;
      }

      if (!name || !(price > 0) || !isFinite(price) || price > 10000000) continue;
      if (!(qty > 0) || qty > 100000) continue;

      items.push({
        name: name.substring(0, 60),
        sku: genSku(name),
        quantity: qty,
        purchase_price: price,
        line: cleanLine,
      });
    }
    return items;
  };

  const updateOcrItem = (index, field, value) => {
    setOcrParsedItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'quantity' || field === 'purchase_price') {
        return { ...item, [field]: value === '' ? '' : Number(value) };
      }
      return { ...item, [field]: value };
    }));
  };

  const removeOcrItem = (index) => {
    setOcrParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const addManualOcrItem = () => {
    const name = `Item ${ocrParsedItems.length + 1}`;
    const sku = name.toUpperCase().replace(/[^A-Z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);
    setOcrParsedItems(prev => [...prev, { name, sku, quantity: 1, purchase_price: 0, line: '' }]);
  };

  const applyOcrToPurchase = () => {
    if (ocrParsedItems.length === 0) return;
    const newItems = ocrParsedItems.map(item => {
      const existingProduct = products.find(p => p.sku?.toLowerCase() === item.sku.toLowerCase());
      const qty = item.quantity || 1; 
      const price = item.purchase_price || 0;
      return {
        product_variant_id: existingProduct?.id || '',
        product_name: existingProduct?.product_name || item.name, 
        sku: item.sku,
        quantity: qty, 
        purchase_price: price, 
        tax_percentage: 0,
        sub_total: qty * price, 
        expiry_date: '', 
        imeiList: '',
        isNewProduct: !existingProduct
      };
    });
    setItems(prev => [...prev, ...newItems]);
    setOcrDialog(false); 
    setOcrImage(null); 
    setOcrResult(''); 
    setOcrParsedItems([]);
    setSnackbar({ open: true, message: `${newItems.length} items added from bill scan!`, severity: 'success' });
  };

  const applyOcrToProducts = async () => {
    if (ocrParsedItems.length === 0) return;
    let created = 0;
    try {
      for (const item of ocrParsedItems) {
        const existingProduct = products.find(p => p.sku?.toLowerCase() === item.sku.toLowerCase());
        if (!existingProduct) {
          const productData = {
            name: item.name, 
            brand_id: null,
            category_id: Number(productForm.category_id) || null,
            type: productForm.type || 'standard', 
            unit: productForm.unit || 'Piece',
            tax_type: 'inclusive', 
            description: '{}', 
            status: 'active'
          };
          const prodResult = await db.addProduct(productData);
          const productId = prodResult.lastInsertRowid;
          const variantData = {
            product_id: productId, 
            sku: item.sku, 
            barcode: null, 
            variant_name: 'Default',
            purchase_price: item.purchase_price || 0,
            retail_price: Math.round((item.purchase_price || 0) * 1.3),
            wholesale_price: Math.round((item.purchase_price || 0) * 1.2),
            minimum_retail_price: Math.round((item.purchase_price || 0) * 1.3),
            stock_alert_quantity: 5, 
            current_stock: item.quantity || 0
          };
          await db.addVariant(variantData); 
          created++;
        }
      }
      await loadData();
      setOcrDialog(false); 
      setOcrImage(null); 
      setOcrResult(''); 
      setOcrParsedItems([]);
      setSnackbar({ open: true, message: `${created} new products created from bill!`, severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
  };

  const openOcrFromProduct = () => {
    setProductDialog(false);
    setOcrDialog(true);
    setOcrImage(null);
    setOcrResult('');
    setOcrParsedItems([]);
    setOcrConfidence(0);
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
          <Inventory sx={{ mr: 1, verticalAlign: 'middle', fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'Inventory' : 'Inventory Management'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<Category />} onClick={() => setCategoryDialog(true)}>
            {isMobile ? 'Cats' : 'Categories'}
          </Button>
          <Button variant="outlined" size="small" startIcon={<Scale />} onClick={() => setUnitDialog(true)}>
            {isMobile ? 'Units' : 'Units'}
          </Button>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => handleOpenProduct()}>
            {isMobile ? 'Product' : 'Add Product'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Products</Typography>
              <Typography variant="h6" fontWeight="bold">{inventorySummary.totalProducts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Variants</Typography>
              <Typography variant="h6" fontWeight="bold">{inventorySummary.totalVariants}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Stock Qty</Typography>
              <Typography variant="h6" fontWeight="bold">{inventorySummary.totalStockQty.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Cost Value</Typography>
              <Typography variant="h6" fontWeight="bold">{formatCurrency(inventorySummary.totalCostValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Retail Value</Typography>
              <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(inventorySummary.totalRetailValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent sx={{ py: isMobile ? 1 : 1.5 }}>
              <Typography variant="caption" color="text.secondary">Wholesale Value</Typography>
              <Typography variant="h6" fontWeight="bold" color="info.main">{formatCurrency(inventorySummary.totalWholesaleValue)}</Typography>
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
            icon={<Inventory fontSize="small" />} 
            label={isMobile ? 'Products' : 'Products'} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<LocalShipping fontSize="small" />} 
            label={isMobile ? 'Purchases' : 'Purchases'} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<LocalOffer fontSize="small" />} 
            label={isMobile ? 'Offers' : 'Offers'} 
            sx={{ fontSize: isMobile ? '0.65rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: PRODUCTS ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
              <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField 
                    fullWidth 
                    size="small"
                    placeholder="Search products..." 
                    value={searchProduct} 
                    onChange={(e) => setSearchProduct(e.target.value)} 
                    InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} 
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All</MenuItem>
                      {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Brand</InputLabel>
                    <Select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} label="Brand">
                      <MenuItem value="">All</MenuItem>
                      {brands.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button fullWidth variant="contained" startIcon={<Add />} onClick={() => handleOpenProduct()} size={isMobile ? 'small' : 'medium'}>
                    {isMobile ? 'Add' : 'Add Product'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {isMobile ? (
              // Mobile Cards View
              <Box>
                {groupedProducts.map((group) => {
                  const parent = group.parent;
                  return (
                    <MobileProductCard
                      key={parent.product_id || parent.id}
                      product={parent}
                      onEdit={handleOpenProduct}
                      onDelete={handleDeleteProduct}
                      onAddVariant={handleOpenVariant}
                      getTypeChip={getTypeChip}
                      getStockBadge={getStockBadge}
                    />
                  );
                })}
                {groupedProducts.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Inventory sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No products found</Typography>
                  </Paper>
                )}
              </Box>
            ) : (
              // Desktop Table View
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name / Variant</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>SKU</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Stock</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Cost</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Retail</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Wholesale</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupedProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No products found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {groupedProducts.map((group) => {
                      const parent = group.parent;
                      const variants = group.variants;
                      const isExpanded = expandedGroups.has(parent.product_id || parent.id);
                      const totalStock = variants.reduce((sum, v) => sum + (Number(v.current_stock) || 0), 0);
                      
                      return (
                        <React.Fragment key={parent.product_id || parent.id}>
                          <TableRow 
                            hover 
                            sx={{ 
                              cursor: variants.length > 1 ? 'pointer' : 'default',
                              bgcolor: isExpanded ? 'action.hover' : 'inherit'
                            }}
                            onClick={() => { if (variants.length > 1) toggleGroup(parent.product_id || parent.id); }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {variants.length > 1 && (
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleGroup(parent.product_id || parent.id); }}>
                                    {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                                  </IconButton>
                                )}
                                <Box>
                                  <Typography fontWeight="bold">{parent.product_name || parent.name}</Typography>
                                  {variants.length > 1 && (
                                    <Typography variant="caption" color="text.secondary">
                                      {variants.length} variants
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>{parent.sku}</TableCell>
                            <TableCell>{getTypeChip(parent.product_type || parent.type)}</TableCell>
                            <TableCell>{parent.category_name || '-'}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography fontWeight="bold" color={getStockColor(totalStock, parent.stock_alert_quantity)}>
                                  {totalStock}
                                </Typography>
                                {getStockBadge(totalStock, parent.stock_alert_quantity)}
                              </Box>
                            </TableCell>
                            <TableCell>{formatCurrency(parent.purchase_price)}</TableCell>
                            <TableCell>{formatCurrency(parent.retail_price)}</TableCell>
                            <TableCell>{formatCurrency(parent.wholesale_price)}</TableCell>
                            <TableCell>
                              <Chip size="small" color={parent.status === 'active' ? 'success' : 'default'} label={parent.status} />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Tooltip title="Add Variant">
                                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenVariant(parent); }}>
                                    <AddCircle />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); handleOpenProduct(parent); }}>
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(parent.product_id || parent.id); }}>
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                          
                          {isExpanded && variants.map((variant) => (
                            <TableRow key={variant.id} sx={{ bgcolor: 'action.hover' }}>
                              <TableCell sx={{ pl: 6 }}>
                                <Typography variant="body2">{variant.variant_name || 'Default'}</Typography>
                              </TableCell>
                              <TableCell>{variant.sku}</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                  {variant.current_stock || 0}
                                </Typography>
                              </TableCell>
                              <TableCell>{formatCurrency(variant.purchase_price)}</TableCell>
                              <TableCell>{formatCurrency(variant.retail_price)}</TableCell>
                              <TableCell>{formatCurrency(variant.wholesale_price)}</TableCell>
                              <TableCell>
                                <Chip size="small" color={variant.status === 'active' ? 'success' : 'default'} label={variant.status} />
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  <Tooltip title="Edit">
                                    <IconButton size="small" color="info" onClick={() => handleOpenProduct(variant)}>
                                      <Edit />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={() => handleDeleteProduct(variant.id)}>
                                      <Delete />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: PURCHASES ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenPurchase()} size={isMobile ? 'small' : 'medium'}>
                {isMobile ? 'New' : 'Add Purchase'}
              </Button>
            </Box>

            {isMobile ? (
              // Mobile Purchase Cards
              <Box>
                {purchases.map((purchase) => (
                  <MobilePurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onEdit={handleOpenPurchase}
                    onDelete={handleDeletePurchase}
                  />
                ))}
                {purchases.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <LocalShipping sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No purchases found</Typography>
                  </Paper>
                )}
              </Box>
            ) : (
              // Desktop Table View
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Purchase #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Supplier</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Items</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Total</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Paid</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Due</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No purchases found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {purchases.map((purchase) => (
                      <TableRow key={purchase.id} hover>
                        <TableCell>{purchase.purchase_no}</TableCell>
                        <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                        <TableCell>{purchase.supplier_name || '-'}</TableCell>
                        <TableCell>{purchase.items_count || '-'}</TableCell>
                        <TableCell>{formatCurrency(purchase.grand_total)}</TableCell>
                        <TableCell>
                          <Chip size="small" color={purchase.status === 'received' ? 'success' : 'warning'} label={purchase.status} />
                        </TableCell>
                        <TableCell>{formatCurrency(purchase.paid_amount)}</TableCell>
                        <TableCell sx={{ color: (purchase.grand_total - purchase.paid_amount) > 0 ? 'error.main' : 'success.main' }}>
                          {formatCurrency((purchase.grand_total || 0) - (purchase.paid_amount || 0))}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton size="small" color="info" onClick={() => handleOpenPurchase(purchase)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDeletePurchase(purchase.id)}>
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 2: OFFERS ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenOffer()} size={isMobile ? 'small' : 'medium'}>
                {isMobile ? 'New' : 'Add Offer'}
              </Button>
            </Box>

            {isMobile ? (
              // Mobile Offer Cards
              <Box>
                {offers.map((offer) => (
                  <Card key={offer.id} sx={{ mb: 1.5, borderLeft: offer.status === 'active' ? '4px solid #10b981' : '4px solid #94a3b8' }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight="bold">{offer.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{offer.description}</Typography>
                        </Box>
                        <Chip size="small" color={offer.status === 'active' ? 'success' : 'default'} label={offer.status} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">Discount: {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : formatCurrency(offer.discount_value)}</Typography>
                        <Typography variant="caption" color="text.secondary">Items: {offer.items_count}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => handleOpenOffer(offer)} sx={{ flex: 1, fontSize: '0.6rem' }}>
                          Edit
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => handleDeleteOffer(offer.id)} sx={{ flex: 1, fontSize: '0.6rem' }}>
                          Delete
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                {offers.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <LocalOffer sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No offers found</Typography>
                  </Paper>
                )}
              </Box>
            ) : (
              // Desktop Table View
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Offer Name</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Discount</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Period</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Items</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {offers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No offers found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {offers.map((offer) => (
                      <TableRow key={offer.id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{offer.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{offer.description}</Typography>
                        </TableCell>
                        <TableCell>
                          {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : formatCurrency(offer.discount_value)}
                        </TableCell>
                        <TableCell>
                          {formatDate(offer.start_date)} - {formatDate(offer.end_date) || 'No end'}
                        </TableCell>
                        <TableCell>{offer.items_count || 0} products</TableCell>
                        <TableCell>
                          <Chip size="small" color={offer.status === 'active' ? 'success' : 'default'} label={offer.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton size="small" color="info" onClick={() => handleOpenOffer(offer)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDeleteOffer(offer.id)}>
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== DIALOGS ==================== */}

      {/* PRODUCT DIALOG */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <form onSubmit={handleSaveProduct}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={isMobile ? 1.5 : 2}>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Product Name" name="name" value={productForm.name} onChange={handleProductChange} required /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="SKU" name="sku" value={productForm.sku} onChange={handleProductChange} required disabled={!!editingProduct} /></Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select name="type" value={productForm.type} onChange={handleProductChange} label="Type">
                    {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select name="category_id" value={productForm.category_id} onChange={handleProductChange} label="Category">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Unit</InputLabel>
                  <Select name="unit" value={productForm.unit} onChange={handleProductChange} label="Unit">
                    {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Cost Price" name="costPrice" type="number" value={productForm.costPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Retail Price" name="retailPrice" type="number" value={productForm.retailPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Wholesale Price" name="wholesalePrice" type="number" value={productForm.wholesalePrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Barcode" name="barcode" value={productForm.barcode} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Stock" name="stock" type="number" value={productForm.stock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Min Stock" name="minStock" type="number" value={productForm.minStock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Variant Name" name="variant_name" value={productForm.variant_name} onChange={handleProductChange} placeholder="Default" /></Grid>

              {dialogProductType === 'imei' && (
                <Grid item xs={12}><TextField fullWidth size="small" multiline rows={4} label="IMEI Numbers (one per line)" name="imeiList" value={productForm.imeiList} onChange={handleProductChange} /></Grid>
              )}
              {dialogProductType === 'fabric' && (
                <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Fabric Length" name="fabricLength" type="number" value={productForm.fabricLength} onChange={handleProductChange} /></Grid>
              )}
              {dialogProductType === 'grocery' && (
                <>
                  <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Weight (kg)" name="weight" type="number" value={productForm.weight} onChange={handleProductChange} /></Grid>
                  <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Expiry Date" name="expiryDate" type="date" value={productForm.expiryDate} onChange={handleProductChange} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Batch Number" name="batchNumber" value={productForm.batchNumber} onChange={handleProductChange} /></Grid>
                </>
              )}
              <Grid item xs={12}><TextField fullWidth size="small" multiline rows={2} label="Description" name="description" value={productForm.description} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select name="status" value={productForm.status} onChange={handleProductChange} label="Status">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button fullWidth={isMobile} onClick={() => setProductDialog(false)}>Cancel</Button>
            <Button fullWidth={isMobile} variant="outlined" startIcon={<CameraAlt />} onClick={openOcrFromProduct}>Scan Bill</Button>
            <Button fullWidth={isMobile} type="submit" variant="contained" startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* VARIANT DIALOG */}
      <Dialog open={variantDialog} onClose={() => setVariantDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          Add Variant to "{variantParent?.product_name || variantParent?.name}"
        </DialogTitle>
        <form onSubmit={handleSaveVariant}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={isMobile ? 1.5 : 2}>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="SKU" name="sku" value={variantForm.sku} onChange={handleVariantChange} required /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Variant Name" name="variantName" value={variantForm.variantName} onChange={handleVariantChange} placeholder="Red, XL, 128GB" /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Cost Price" name="costPrice" type="number" value={variantForm.costPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Retail Price" name="retailPrice" type="number" value={variantForm.retailPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Wholesale Price" name="wholesalePrice" type="number" value={variantForm.wholesalePrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Stock" name="stock" type="number" value={variantForm.stock} onChange={handleVariantChange} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Barcode" name="barcode" value={variantForm.barcode} onChange={handleVariantChange} /></Grid>
              {(variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && (
                <Grid item xs={12}><TextField fullWidth size="small" multiline rows={4} label="IMEI Numbers" name="imeiList" value={variantForm.imeiList} onChange={handleVariantChange} /></Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button fullWidth={isMobile} onClick={() => setVariantDialog(false)}>Cancel</Button>
            <Button fullWidth={isMobile} type="submit" variant="contained" startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CATEGORY DIALOG */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Manage Categories</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box component="form" onSubmit={handleAddCategory} sx={{ mb: 3 }}>
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={12} md={5}><TextField fullWidth size="small" name="categoryName" label="Category Name" required /></Grid>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Parent</InputLabel>
                  <Select name="parent_id" defaultValue="" label="Parent">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth sx={{ bgcolor: '#10b981' }}>Add</Button>
              </Grid>
            </Grid>
          </Box>
          <List dense>
            {categories.map((cat) => (
              <ListItem key={cat.id} secondaryAction={
                <IconButton edge="end" color="error" onClick={() => handleDeleteCategory(cat.id)}>
                  <Delete />
                </IconButton>
              }>
                <ListItemText primary={cat.name} secondary={cat.parent_id ? `Parent: ${categories.find(c => c.id === cat.parent_id)?.name || cat.parent_id}` : 'Top Level'} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* UNIT DIALOG */}
      <Dialog open={unitDialog} onClose={() => setUnitDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Manage Units</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box component="form" onSubmit={handleAddUnit} sx={{ mb: 3 }}>
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={12} md={10}><TextField fullWidth size="small" name="unitName" label="Unit Name" required /></Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth sx={{ bgcolor: '#10b981' }}>Add</Button>
              </Grid>
            </Grid>
          </Box>
          <List dense>
            {units.map((unit) => (
              <ListItem key={unit} secondaryAction={
                <IconButton edge="end" color="error" onClick={() => {
                  const updated = units.filter(u => u !== unit);
                  setUnits(updated);
                  localStorage.setItem('custom_units', JSON.stringify(updated));
                  setSnackbar({ open: true, message: 'Unit removed!', severity: 'success' });
                }}>
                  <Delete />
                </IconButton>
              }>
                <ListItemText primary={unit} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnitDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* PURCHASE DIALOG */}
      <Dialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} maxWidth="lg" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingPurchase ? 'Edit Purchase' : 'Add New Purchase'}
        </DialogTitle>
        <form onSubmit={handleSavePurchase}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Supplier</InputLabel>
                  <Select value={purchaseForm.supplier_id} onChange={handleSupplierChange} label="Supplier">
                    <MenuItem value="">Select Supplier</MenuItem>
                    {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Purchase No" value={purchaseForm.purchase_no} onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_no: e.target.value }))} required />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Supplier Invoice" value={purchaseForm.supplier_invoice_no} onChange={(e) => setPurchaseForm(prev => ({ ...prev, supplier_invoice_no: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Purchase Date" type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_date: e.target.value }))} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Due Date" type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm(prev => ({ ...prev, due_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={purchaseForm.status} onChange={(e) => setPurchaseForm(prev => ({ ...prev, status: e.target.value }))} label="Status">
                    <MenuItem value="received">Received</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="ordered">Ordered</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select value={purchaseForm.payment_mode} onChange={(e) => setPurchaseForm(prev => ({ ...prev, payment_mode: e.target.value }))} label="Payment Mode">
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank">Bank Transfer</MenuItem>
                    <MenuItem value="credit">Credit</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Add Items</Typography>
            
            <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Product</InputLabel>
                  <Select value={currentItem.product_variant_id} onChange={handleProductSelect} label="Product">
                    <MenuItem value="">Select Product</MenuItem>
                    {products.map(p => <MenuItem key={p.id} value={p.id}>{p.product_name || p.name} - {p.sku}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth size="small" label="Qty" type="number" value={currentItem.quantity} onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth size="small" label="Price" type="number" value={currentItem.purchase_price} onChange={(e) => setCurrentItem(prev => ({ ...prev, purchase_price: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth size="small" label="Tax %" type="number" value={currentItem.tax_percentage} onChange={(e) => setCurrentItem(prev => ({ ...prev, tax_percentage: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth size="small" label="Expiry" type="date" value={currentItem.expiry_date} onChange={(e) => setCurrentItem(prev => ({ ...prev, expiry_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={1}>
                <Button variant="contained" onClick={addItem} fullWidth sx={{ bgcolor: '#10b981' }}><Add /></Button>
              </Grid>
            </Grid>

            {currentItem.product_variant_id && (products.find(p => p.id == currentItem.product_variant_id)?.product_type === 'imei' || products.find(p => p.id == currentItem.product_variant_id)?.type === 'imei') && (
              <Grid item xs={12} sx={{ mt: 1 }}>
                <TextField fullWidth size="small" multiline rows={3} label="IMEI Numbers (one per line)" value={currentItem.imeiList} onChange={(e) => setCurrentItem(prev => ({ ...prev, imeiList: e.target.value }))} />
              </Grid>
            )}

            {priceHistory.length > 0 && (
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Recent Prices:</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  {priceHistory.map((h, i) => (
                    <Chip key={i} size="small" label={`Rs. ${h.purchase_price} (${formatDate(h.purchase_date)})`} variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={{ mt: 2, mb: 2, display: 'flex', gap: isMobile ? 1 : 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<UploadFile />} onClick={() => openBulkImport('purchase')} size={isMobile ? 'small' : 'medium'}>
                Bulk Import
              </Button>
              <Button variant="outlined" startIcon={<CameraAlt />} onClick={() => { setPurchaseDialog(false); setOcrDialog(true); }} size={isMobile ? 'small' : 'medium'}>
                Scan Bill
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Tax %</TableCell>
                    <TableCell>Subtotal</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No items added</TableCell>
                    </TableRow>
                  )}
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.purchase_price)}</TableCell>
                      <TableCell>{item.tax_percentage}%</TableCell>
                      <TableCell>{formatCurrency(item.sub_total)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Grid container spacing={isMobile ? 1 : 2} justifyContent="flex-end">
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Discount" type="number" value={purchaseForm.discount_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, discount_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Tax" type="number" value={purchaseForm.tax_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, tax_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Shipping" type="number" value={purchaseForm.shipping_charges} onChange={(e) => setPurchaseForm(prev => ({ ...prev, shipping_charges: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="body2">Subtotal: {formatCurrency(subTotal)}</Typography>
              <Typography variant="body2">Tax: {formatCurrency(totalTax)}</Typography>
              <Typography variant="body2">Discount: {formatCurrency(discount)}</Typography>
              <Typography variant="body2">Shipping: {formatCurrency(shipping)}</Typography>
              <Typography variant="h6" fontWeight="bold">Grand Total: {formatCurrency(grandTotal)}</Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={isMobile ? 1 : 2} justifyContent="flex-end" sx={{ mt: 1 }}>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth size="small" label="Paid" type="number" value={purchaseForm.paid_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, paid_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
                </Grid>
              </Grid>
              <Typography variant="body1" sx={{ mt: 1, color: due > 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                Due Amount: {formatCurrency(due)}
              </Typography>
            </Box>

            <TextField fullWidth size="small" multiline rows={2} label="Notes" value={purchaseForm.notes} onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))} sx={{ mt: 2 }} />
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button fullWidth={isMobile} onClick={() => setPurchaseDialog(false)}>Cancel</Button>
            <Button fullWidth={isMobile} type="submit" variant="contained" startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* OFFER DIALOG */}
      <Dialog open={offerDialog} onClose={() => setOfferDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingOffer ? 'Edit Offer' : 'Add New Offer'}
        </DialogTitle>
        <form onSubmit={handleSaveOffer}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={isMobile ? 1.5 : 2}>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Offer Name" value={offerForm.name} onChange={(e) => setOfferForm(prev => ({ ...prev, name: e.target.value }))} required /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Description" value={offerForm.description} onChange={(e) => setOfferForm(prev => ({ ...prev, description: e.target.value }))} /></Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Discount Type</InputLabel>
                  <Select value={offerForm.discount_type} onChange={(e) => setOfferForm(prev => ({ ...prev, discount_type: e.target.value }))} label="Discount Type">
                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                    <MenuItem value="fixed">Fixed Amount</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Discount Value" type="number" value={offerForm.discount_value} onChange={(e) => setOfferForm(prev => ({ ...prev, discount_value: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">{offerForm.discount_type === 'percentage' ? '%' : 'Rs.'}</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Start Date" type="date" value={offerForm.start_date} onChange={(e) => setOfferForm(prev => ({ ...prev, start_date: e.target.value }))} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="End Date" type="date" value={offerForm.end_date} onChange={(e) => setOfferForm(prev => ({ ...prev, end_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={offerForm.status} onChange={(e) => setOfferForm(prev => ({ ...prev, status: e.target.value }))} label="Status">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Add Products</Typography>

            <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select value={offerCategoryFilter} onChange={(e) => { setOfferCategoryFilter(e.target.value); setSelectedOfferProduct(null); setSelectedOfferVariant(null); }} label="Category">
                    <MenuItem value="">All</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={products.filter(p => !offerCategoryFilter || String(p.category_id) === String(offerCategoryFilter))}
                  getOptionLabel={(option) => `${option.product_name || option.name} - ${option.sku}`}
                  value={selectedOfferProduct}
                  onChange={(e, newValue) => { setSelectedOfferProduct(newValue); setSelectedOfferVariant(null); }}
                  renderInput={(params) => <TextField {...params} label="Select Product" />}
                  disabled={!offerCategoryFilter}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" disabled={!selectedOfferProduct}>
                  <InputLabel>Variant</InputLabel>
                  <Select value={selectedOfferVariant?.id || ''} onChange={(e) => {
                    const variant = products.find(v => v.id == e.target.value);
                    setSelectedOfferVariant(variant);
                    setOfferVariantPrice(variant?.retail_price || '');
                  }} label="Variant">
                    {products.filter(p => p.product_id === selectedOfferProduct?.product_id).map(v => (
                      <MenuItem key={v.id} value={v.id}>{v.variant_name || 'Default'} - Stock: {v.current_stock}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" onClick={handleAddToOffer} fullWidth disabled={!selectedOfferVariant} startIcon={<Add />} sx={{ bgcolor: '#10b981' }}>
                  Add
                </Button>
              </Grid>
            </Grid>

            {selectedOfferVariant && (
              <TextField fullWidth size="small" label="Custom Offer Price" type="number" value={offerVariantPrice} onChange={(e) => setOfferVariantPrice(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} sx={{ mt: 1 }} />
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Variant</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Original</TableCell>
                    <TableCell>Offer Price</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {offerItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No items added</TableCell>
                    </TableRow>
                  )}
                  {offerItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.variant_name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{formatCurrency(item.original_price)}</TableCell>
                      <TableCell>{formatCurrency(item.offer_price)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => handleRemoveOfferItem(item.variant_id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="body2">Original Total: {formatCurrency(offerItems.reduce((s, i) => s + (Number(i.original_price) || 0), 0))}</Typography>
              <Typography variant="body2">Discount: {formatCurrency(offerItems.reduce((s, i) => s + (Number(i.offer_price) || 0), 0) - offerItems.reduce((s, i) => s + (Number(i.original_price) || 0), 0))}</Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">Final Total: {formatCurrency(offerItems.reduce((s, i) => s + (Number(i.offer_price) || 0), 0))}</Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button fullWidth={isMobile} onClick={() => setOfferDialog(false)}>Cancel</Button>
            <Button fullWidth={isMobile} type="submit" variant="contained" startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* BULK IMPORT DIALOG */}
      <Dialog open={bulkImportDialog} onClose={() => setBulkImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Bulk Import</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Mode</InputLabel>
                <Select value={bulkImportMode} onChange={(e) => setBulkImportMode(e.target.value)} label="Mode">
                  <MenuItem value="purchase">Add to Purchase</MenuItem>
                  <MenuItem value="products">Create Products</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Delimiter</InputLabel>
                <Select value={bulkDelimiter} onChange={(e) => setBulkDelimiter(e.target.value)} label="Delimiter">
                  <MenuItem value="tab">Tab</MenuItem>
                  <MenuItem value="comma">Comma</MenuItem>
                  <MenuItem value="pipe">Pipe |</MenuItem>
                  <MenuItem value="semicolon">Semicolon ;</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Checkbox checked={bulkHasHeaders} onChange={(e) => setBulkHasHeaders(e.target.checked)} />} label="Has Headers" />
            </Grid>
          </Grid>

          <TextField fullWidth multiline rows={6} label="Paste data (Name, SKU, Qty, Price)" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Product Name&#9;SKU&#9;10&#9;500" sx={{ mb: 2 }} />

          <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Name Col" type="number" value={bulkColumnMap.name} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, name: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="SKU Col" type="number" value={bulkColumnMap.sku} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, sku: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Qty Col" type="number" value={bulkColumnMap.qty} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, qty: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Price Col" type="number" value={bulkColumnMap.price} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </Grid>
          </Grid>

          <Button variant="outlined" onClick={parseBulkText} startIcon={<TableChart />} sx={{ mb: 2 }}>Preview</Button>

          {bulkPreview.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkPreview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{formatCurrency(row.purchase_price)}</TableCell>
                      <TableCell>
                        {products.find(p => p.sku?.toLowerCase() === row.sku.toLowerCase()) 
                          ? <Chip size="small" color="info" label="Exists" /> 
                          : <Chip size="small" color="warning" label="New" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setBulkImportDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="outlined" onClick={parseBulkText}>Preview</Button>
          {bulkImportMode === 'purchase' && (
            <Button fullWidth={isMobile} variant="contained" onClick={applyBulkToPurchase} disabled={bulkPreview.length === 0} startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>
              Add to Purchase
            </Button>
          )}
          {bulkImportMode === 'products' && (
            <Button fullWidth={isMobile} variant="contained" onClick={applyBulkToProducts} disabled={bulkPreview.length === 0} startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>
              Create Products
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* OCR DIALOG */}
      <Dialog open={ocrDialog} onClose={() => setOcrDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Scan Bill (OCR)</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', gap: isMobile ? 1 : 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" component="label" startIcon={<CameraAlt />} size={isMobile ? 'small' : 'medium'}>
              Upload Image
              <input type="file" accept="image/*" hidden onChange={handleOcrImageUpload} />
            </Button>
            {ocrImage && (
              <Button variant="outlined" color="error" startIcon={<Delete />} size={isMobile ? 'small' : 'medium'} onClick={() => { setOcrImage(null); setOcrResult(''); setOcrParsedItems([]); setOcrConfidence(0); }}>
                Clear
              </Button>
            )}
          </Box>

          {ocrImage && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img src={ocrImage} alt="Bill" style={{ maxWidth: '100%', maxHeight: 300, border: '1px solid #ccc', borderRadius: 4 }} />
            </Box>
          )}

          {ocrImage && (
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={processOcrImage} disabled={ocrLoading} startIcon={ocrLoading ? <CircularProgress size={20} /> : <DocumentScanner />} sx={{ bgcolor: '#10b981' }}>
                {ocrLoading ? 'Processing...' : 'Process Image'}
              </Button>
            </Box>
          )}

          {ocrConfidence > 0 && (
            <Alert severity={ocrConfidence > 60 ? 'success' : 'warning'} sx={{ mb: 2 }}>
              Confidence: {Math.round(ocrConfidence)}%
            </Alert>
          )}

          {ocrResult && (
            <TextField fullWidth multiline rows={4} label="Extracted Text" value={ocrResult} InputProps={{ readOnly: true }} sx={{ mb: 2 }} />
          )}

          {ocrParsedItems.length > 0 && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>Edit items below if needed:</Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ocrParsedItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <TextField size="small" variant="standard" fullWidth value={item.name} onChange={(e) => updateOcrItem(i, 'name', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" variant="standard" fullWidth value={item.sku} onChange={(e) => updateOcrItem(i, 'sku', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" variant="standard" type="number" fullWidth value={item.quantity} onChange={(e) => updateOcrItem(i, 'quantity', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" variant="standard" type="number" fullWidth value={item.purchase_price} onChange={(e) => updateOcrItem(i, 'purchase_price', e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => removeOcrItem(i)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button size="small" startIcon={<Add />} onClick={addManualOcrItem} sx={{ mt: 1 }}>Add Row</Button>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setOcrDialog(false)}>Cancel</Button>
          <Button fullWidth={isMobile} variant="outlined" onClick={applyOcrToPurchase} disabled={ocrParsedItems.length === 0} startIcon={<LocalShipping />}>
            Add to Purchase
          </Button>
          <Button fullWidth={isMobile} variant="contained" onClick={applyOcrToProducts} disabled={ocrParsedItems.length === 0} startIcon={<Inventory />} sx={{ bgcolor: '#10b981' }}>
            Create Products
          </Button>
        </DialogActions>
      </Dialog>

      {/* MOBILE DRAWER */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); handleOpenProduct(); }}>
              <ListItemIcon><Add /></ListItemIcon>
              <ListItemText primary="Add Product" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); handleOpenPurchase(); }}>
              <ListItemIcon><LocalShipping /></ListItemIcon>
              <ListItemText primary="New Purchase" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); handleOpenOffer(); }}>
              <ListItemIcon><LocalOffer /></ListItemIcon>
              <ListItemText primary="New Offer" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setCategoryDialog(true); }}>
              <ListItemIcon><Category /></ListItemIcon>
              <ListItemText primary="Categories" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setUnitDialog(true); }}>
              <ListItemIcon><Scale /></ListItemIcon>
              <ListItemText primary="Units" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* FAB BUTTONS - Mobile */}
      {isMobile && activeTab === 0 && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }} onClick={() => handleOpenProduct()}>
          <Add />
        </Fab>
      )}
      {isMobile && activeTab === 1 && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }} onClick={() => handleOpenPurchase()}>
          <LocalShipping />
        </Fab>
      )}
      {isMobile && activeTab === 2 && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }} onClick={() => handleOpenOffer()}>
          <LocalOffer />
        </Fab>
      )}

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 8 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}