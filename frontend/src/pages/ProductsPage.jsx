import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box, Tabs, Tab, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress, Autocomplete,
  Alert, Snackbar, useTheme, useMediaQuery,
  Drawer, Collapse, Fab, Badge, Avatar,
  ListItemIcon, Checkbox, FormControlLabel,
  Switch as MuiSwitch, Pagination, LinearProgress
} from '../components/ui/tailwind-mui';
import {
  Add, Edit, Delete, Search, QrCode, PhoneAndroid, Straighten,
  LocalGroceryStore, Save, Category, Scale, Inventory, LocalShipping,
  AddCircle, History, Warning, LocalOffer, Percent, AttachMoney,
  KeyboardArrowDown, KeyboardArrowUp, CheckCircle, CalendarToday,
  UploadFile, TableChart, Close, CloudUpload, CameraAlt, ContentPaste,
  Image as ImageIcon, DocumentScanner, ClearAll, Refresh,
  Menu as MenuIcon, ArrowUpward, ArrowDownward, TrendingUp,
  TrendingDown, Store, Person, Receipt, FileDownload,
  MedicalServices, ShoppingBag, BakeryDining, Agriculture,
  Storefront, Devices, Medication, Branding, Label, Checkroom,
  Inventory2, AutoAwesome, Print, Settings, QrCodeScanner,
  PictureAsPdf, LocalPrintshop
} from '../components/ui/icons';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../database/db';
import { useNavigate } from 'react-router-dom';
import useSyncListener from '../hooks/useSyncListener';
import UnifiedPagination from '../components/common/UnifiedPagination';

// ==================== CONSTANTS ====================
const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard', icon: <Inventory fontSize="small" /> },
  { value: 'imei', label: 'Mobile / IMEI', icon: <PhoneAndroid fontSize="small" /> },
  { value: 'fabric', label: 'Fabric / Cloth', icon: <Straighten fontSize="small" /> },
  { value: 'grocery', label: 'Grocery / Food', icon: <LocalGroceryStore fontSize="small" /> },
  { value: 'medical', label: 'Medical / Pharmacy', icon: <MedicalServices fontSize="small" /> },
  { value: 'shoes', label: 'Shoes / Footwear', icon: <Checkroom fontSize="small" /> },
  { value: 'bakery', label: 'Bakery', icon: <BakeryDining fontSize="small" /> },
  { value: 'wholesale', label: 'Wholesale / Distributor', icon: <Storefront fontSize="small" /> },
];

const UNITS_BY_TYPE = {
  standard: ['Piece', 'Box', 'Pack', 'Set', 'Dozen'],
  imei: ['Piece', 'Unit'],
  fabric: ['Meter', 'Yard', 'Feet', 'Inch'],
  grocery: ['KG', 'Gram', 'Liter', 'Piece', 'Pack', 'Box'],
  medical: ['Piece', 'Box', 'Strip', 'Tablet', 'Capsule', 'Syringe', 'Pack'],
  shoes: ['Pair', 'Piece'],
  bakery: ['Piece', 'Box', 'Dozen', 'Pack'],
  wholesale: ['Box', 'Carton', 'Pack', 'Piece', 'Set'],
};

const DEFAULT_UNITS = ['Piece', 'Pair', 'KG', 'Gram', 'Meter', 'Than', 'Liter', 'Box', 'Dozen', 'Pack', 'Bag', 'Roll', 'Bottle', 'Strip', 'Tablet', 'Capsule', 'Syringe', 'Set'];

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

const getProductImageUrl = (product) => {
  if (!product) return '';
  if (product.image_url) return product.image_url;
  try {
    const meta = JSON.parse(product.description || '{}');
    if (meta.image_url) return meta.image_url;
  } catch { /* ignore */ }
  if (product.variant_image_url) return product.variant_image_url;
  return '';
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

// ==================== MOBILE PRODUCT CARD ====================
const MobileProductCard = ({ product, onEdit, onDelete, getTypeChip, getStockBadge, onAddVariant, onPrintBarcode, canEdit, canDelete, canAdd }) => {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = getProductImageUrl(product);
  const isBoxProduct = product.is_box_product || false;
  const unitsPerBox = product.units_per_box || 0;
  const boxQty = product.box_qty || 0;

  return (
    <Card sx={{ mb: 1.5, borderLeft: product.status === 'active' ? '4px solid #10b981' : '4px solid #94a3b8' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {imageUrl ? (
                <Avatar 
                  src={imageUrl} 
                  variant="rounded" 
                  sx={{ width: 40, height: 40, border: '1px solid #e0e0e0' }}
                >
                  <Inventory />
                </Avatar>
              ) : (
                <Avatar 
                  variant="rounded" 
                  sx={{ width: 40, height: 40, bgcolor: '#f5f5f5' }}
                >
                  <Inventory sx={{ color: '#999' }} />
                </Avatar>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                  {product.product_name || product.name}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                  <Chip label={product.sku} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
                  {getTypeChip(product.product_type || product.type)}
                  {isBoxProduct && (
                    <Chip 
                      label={`${boxQty}×${unitsPerBox}`} 
                      size="small" 
                      color="info" 
                      sx={{ height: 18, fontSize: '0.5rem' }} 
                    />
                  )}
                </Stack>
              </Box>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right', ml: 1 }}>
            {product.is_box_product && product.units_per_box > 0 ? (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" color={Number(product.current_stock) <= 0 ? 'error.main' : 'success.main'}>
                  {Math.floor((product.current_stock || 0) / product.units_per_box)} boxes
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({product.current_stock || 0} {product.base_unit || product.unit || 'units'})
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="subtitle1" fontWeight="bold" color={Number(product.current_stock) <= 0 ? 'error.main' : 'success.main'}>
                  {product.current_stock || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">{product.base_unit || product.unit}</Typography>
              </>
            )}
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
            {isBoxProduct && (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Boxes</Typography>
                  <Typography variant="body2">{boxQty}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Units/Box</Typography>
                  <Typography variant="body2">{unitsPerBox}</Typography>
                </Grid>
              </>
            )}
            {product.barcode && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Barcode</Typography>
                <Typography variant="body2" fontFamily="monospace">{product.barcode}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<QrCode />} 
            onClick={() => onPrintBarcode(product)} 
            sx={{ flex: 1, fontSize: '0.6rem', py: 0.5, color: '#8b5cf6', borderColor: '#8b5cf6' }}
          >
            Barcode
          </Button>
          {canAdd && (
            <Button size="small" variant="outlined" startIcon={<AddCircle />} onClick={() => onAddVariant(product)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
              Variant
            </Button>
          )}
          {canEdit && (
            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => onEdit(product)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(product.id)} sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}>
              Del
            </Button>
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
export default function InventoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
const [labelSize, setLabelSize] = useState('2x1');
const [printerType, setPrinterType] = useState('tsc');
const [copies, setCopies] = useState(1);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
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
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { can } = usePermissions();
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [dialogProductType, setDialogProductType] = useState('standard');
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [unitDialog, setUnitDialog] = useState(false);
  const [brandDialog, setBrandDialog] = useState(false);

  // Controlled states for quick dialog inputs
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  // ==================== NEW: BOX/BULK ENTRY STATE ====================
  const [isBoxEntry, setIsBoxEntry] = useState(false);
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [boxQuantity, setBoxQuantity] = useState('');

  const [variantDialog, setVariantDialog] = useState(false);
  const [variantParent, setVariantParent] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: '', variantName: '', costPrice: '', retailPrice: '',
    wholesalePrice: '', stock: '', barcode: '', imeiList: '',
    image_url: '', image_file: null
  });
  const [variantImagePreview, setVariantImagePreview] = useState(null);
  const variantFileInputRef = useRef(null);

  // ==================== PRODUCT FORM STATE ====================
  const [productForm, setProductForm] = useState({
    name: '', sku: '', type: 'standard', category_id: '', unit: 'Piece',
    costPrice: '', retailPrice: '', wholesalePrice: '', barcode: '',
    stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
    weight: '', expiryDate: '', batchNumber: '', description: '',
    status: 'active', variant_name: 'Default',
    manufacturer: '', generic_name: '', supplier_name: '', shelf_rack: '', remarks: '',
    shoe_size: '', shoe_color: '', shoe_brand: '', shoe_material: '',
    bakery_ingredients: '',
    min_order_qty: '', bulk_discount: '',
    fabric_type: '', fabric_color: '', fabric_size: '', stitch_type: '',
    mobile_brand: '', mobile_model: '', mobile_storage: '', mobile_color: '',
    box_qty: '', packs_per_box: '', units_per_pack: '',
    image_url: '',
    image_file: null,
    is_box_product: false,
    units_per_box: '',
    box_quantity: '',
  });

  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

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
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      if (db._cache) {
        db._cache.clear();
        console.log('[Cache] Cache cleared before loading');
      }
      
      const [prods, cats, brnds, offs] = await Promise.all([
        db.getAllVariants ? db.getAllVariants().catch(() => []) : (db.getProducts ? db.getProducts().catch(() => []) : Promise.resolve([])),
        db.getCategories ? db.getCategories().catch(() => []) : Promise.resolve([]),
        db.getBrands ? db.getBrands().catch(() => []) : Promise.resolve([]),
        db.getOffers ? db.getOffers().catch(() => []) : Promise.resolve([])
      ]);
      
      const categoryMap = {};
      (cats || []).forEach(c => {
        categoryMap[c.id] = c.name;
      });
      
      const productsWithCategory = (prods || []).map(p => {
        const productId = p.product_id || p.productId || p.parent_id || p.id;
        const catId = p.category_id || p.parent_category_id;
        const finalProductId = productId || p.id;
        
        // Parse meta for box info
        let meta = {};
        try {
          meta = JSON.parse(p.description || '{}');
        } catch { /* ignore */ }
        
        return {
          ...p,
          product_id: finalProductId,
          _productId: finalProductId,
          product_name: p.product_name || p.name || '',
          category_name: categoryMap[catId] || p.category_name || '-',
          id: p.id || p.variant_id || p.variantId,
          current_stock: Number(p.current_stock) || 0,
          is_box_product: meta.is_box_product || false,
          units_per_box: meta.units_per_box || 0,
          box_qty: meta.box_quantity || 0,
          unit_price: meta.unit_price || 0
        };
      });
      
      console.log('[Inventory] Loaded products:', productsWithCategory.length);
      
      setProducts(productsWithCategory);
      setCategories(cats || []);
      setBrands(brnds || []);
      setOffers(offs || []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, forceUpdate]);
  useSyncListener(loadData);

  // ==================== REAL-TIME STOCK UPDATES ====================
  useEffect(() => {
    const handleStockUpdate = (event) => {
      console.log('[Stock] Stock update received in ProductsPage:', event.detail);
      
      const { variantId, sku, newStock, oldStock, productName } = event.detail;
      
      setProducts(prevProducts => {
        const updated = prevProducts.map(p => {
          if (String(p.id) === String(variantId)) {
            console.log(`[Stock] Updating stock for ${p.product_name || p.name}: ${p.current_stock} → ${newStock}`);
            return { ...p, current_stock: newStock };
          }
          if (p.sku === sku) {
            console.log(`[Stock] Updating stock for ${p.product_name || p.name}: ${p.current_stock} → ${newStock}`);
            return { ...p, current_stock: newStock };
          }
          return p;
        });
        return updated;
      });
      
      setSnackbar({ 
        open: true, 
        message: `Stock updated: ${productName || 'Product'} → ${newStock}`, 
        severity: 'success' 
      });
      
      setTimeout(() => {
        console.log('[Stock] Reloading products from database after stock update...');
        if (db._cache) {
          db._cache.clear();
          console.log('[Cache] Cache cleared');
        }
        loadData();
      }, 500);
    };
    
    const handleRefresh = () => {
      console.log('[Products] Manual refresh requested');
      if (db._cache) {
        db._cache.clear();
        console.log('[Cache] Cache cleared');
      }
      loadData();
      setSnackbar({ open: true, message: 'Refreshed!', severity: 'success' });
    };
    
    window.addEventListener('stock-updated', handleStockUpdate);
    window.addEventListener('refresh-products', handleRefresh);
    
    return () => {
      window.removeEventListener('stock-updated', handleStockUpdate);
      window.removeEventListener('refresh-products', handleRefresh);
    };
  }, [loadData]);

  // ==================== HELPERS ====================
 const getStockColor = (stock, alertQty) => {
  const s = Number(stock) || 0;
  const min = Number(alertQty) || 5;
  if (s <= 0) return '#e53935';
  if (s <= min) return '#fb8c00';
  return '#43a047';
};

 const getStockBadge = (stock, minStock) => {
  const s = Number(stock) || 0;
  const m = Number(minStock) || 5;
  if (s <= 0) {
    return <Chip size="small" color="error" label="Out of Stock" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 'bold' }} />;
  }
  if (s <= m) {
    return <Chip size="small" color="warning" label={`Low (${s})`} icon={<Warning fontSize="small" />} sx={{ height: 18, fontSize: '0.55rem', fontWeight: 'bold' }} />;
  }
  return <Chip size="small" color="success" label={`In Stock (${s})`} sx={{ height: 18, fontSize: '0.55rem', fontWeight: 'bold' }} />;
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
      const barcode = (p.barcode || '').toLowerCase();
      const q = searchProduct.toLowerCase().trim();
      const matchSearch = !q || name.includes(q) || sku.includes(q) || barcode.includes(q);
      const matchCategory = !filterCategory || (p.category_name === filterCategory) || (String(p.category_id) === String(filterCategory));
      const matchBrand = !filterBrand || (p.brand_name === filterBrand) || (p.brand_id == filterBrand);
      const matchType = !filterType || (p.product_type === filterType) || (p.type === filterType);
      
      const stock = Number(p.current_stock) || 0;
      const minStock = Number(p.stock_alert_quantity) || 5;
      const matchLowStock = !filterLowStock || stock <= minStock;

      return matchSearch && matchCategory && matchBrand && matchType && matchLowStock;
    });
  }, [products, searchProduct, filterCategory, filterBrand, filterType, filterLowStock]);

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
      const pid = p._productId || p.product_id || p.id;
      if (!pid) return;
      if (!groups.has(pid)) {
        groups.set(pid, { parent: p, variants: [] });
      }
      groups.get(pid).variants.push(p);
    });
    
    return Array.from(groups.values()).map(group => ({
      ...group,
      parent: group.variants[0] || group.parent
    }));
  }, [filteredProducts]);

  // ==================== RESET PAGE ON FILTER CHANGE ====================
  useEffect(() => {
    setPage(1);
  }, [searchProduct, filterCategory, filterBrand, filterType, filterLowStock]);

  // ==================== PAGINATED GROUPS ====================
  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return groupedProducts.slice(start, start + rowsPerPage);
  }, [groupedProducts, page, rowsPerPage]);

  // ==================== AUTO-EXPAND (CURRENT PAGE ONLY) ====================
  useEffect(() => {
    if (paginatedGroups.length > 0) {
      const newExpanded = new Set();
      paginatedGroups.forEach(group => {
        if (group.variants.length > 1) {
          newExpanded.add(group.parent.product_id || group.parent.id);
        }
      });
      setExpandedGroups(newExpanded);
    }
  }, [paginatedGroups]);

  // ==================== EXPORT TO EXCEL ====================
  const exportToExcel = () => {
    if (products.length === 0) {
      setSnackbar({ open: true, message: 'No products to export!', severity: 'warning' });
      return;
    }

    try {
      const exportData = products.map(p => ({
        'ID': p.id,
        'Product Name': p.product_name || p.name || '',
        'Variant Name': p.variant_name || 'Default',
        'SKU': p.sku || '',
        'Product Type': p.product_type || p.type || 'standard',
        'Category': p.category_name || '',
        'Unit': p.unit || 'Piece',
        'Stock': Number(p.current_stock) || 0,
        'Cost Price': Number(p.purchase_price) || 0,
        'Retail Price': Number(p.retail_price) || 0,
        'Wholesale Price': Number(p.wholesale_price) || 0,
        'Barcode': p.barcode || '',
        'Min Stock': Number(p.stock_alert_quantity) || 5,
        'Status': p.status || 'active',
        'Brand': p.brand_name || '',
        'Box Product': p.is_box_product ? 'Yes' : 'No',
        'Units/Box': p.units_per_box || 0,
        'Box Qty': p.box_qty || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setSnackbar({ open: true, message: `Exported ${exportData.length} products!`, severity: 'success' });
    } catch (err) {
      console.error('Export error:', err);
      setSnackbar({ open: true, message: 'Export failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== EXPORT TO PDF ====================
  const exportToPDF = () => {
    const listToExport = filteredProducts && filteredProducts.length > 0 ? filteredProducts : products;
    if (!listToExport || listToExport.length === 0) {
      setSnackbar({ open: true, message: 'No products to export!', severity: 'warning' });
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let shop = {};
      try {
        shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
      } catch (e) {}

      const totalProductsCount = listToExport.length;
      const totalStockCount = listToExport.reduce((sum, p) => sum + (Number(p.current_stock) || 0), 0);

      // Top Navy Header Band
      doc.setFillColor(28, 37, 128); // #1c2580
      doc.rect(0, 0, pageWidth, 28, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shop.name || 'RAATH POS', 14, 12);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const subInfo = [
        shop.phone ? `Phone: ${shop.phone}` : null,
        shop.address ? `Address: ${shop.address}` : null
      ].filter(Boolean).join(' | ') || 'RETAIL INVENTORY & PRICE LIST';
      doc.text(subInfo, 14, 19);

      // Section Title & Generation Date
      doc.setTextColor(28, 37, 128);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PRODUCTS LIST', 14, 37);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const todayFormatted = new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Date: ${todayFormatted}`, pageWidth - 14, 37, { align: 'right' });

      // Summary Box (Total Products & Total Qty)
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 42, pageWidth - 28, 14, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Products: ${totalProductsCount}`, 20, 51);
      doc.text(`Total Stock Quantity: ${totalStockCount.toLocaleString()}`, 110, 51);

      // Table: #, Product Name, Qty, Sale Price
      const head = [['#', 'Product Name', 'Qty', 'Sale Price']];
      const body = listToExport.map((p, idx) => {
        const pName = p.product_name || p.name || 'Product';
        const vName = p.variant_name && p.variant_name !== 'Default' ? ` (${p.variant_name})` : '';
        const qty = Number(p.current_stock) || 0;
        const salePrice = Number(p.retail_price) || 0;
        return [
          idx + 1,
          `${pName}${vName}`,
          qty.toLocaleString(),
          `Rs. ${salePrice.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        head,
        body,
        startY: 61,
        theme: 'grid',
        styles: { 
          fontSize: 9, 
          cellPadding: 3, 
          textColor: [15, 23, 42],
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [28, 37, 128], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          fontSize: 9.5
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 'auto', fontStyle: 'bold' },
          2: { cellWidth: 32, halign: 'center' },
          3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      // Bottom Page Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages} • Total Products: ${totalProductsCount}`, 
          pageWidth / 2, 
          pageHeight - 8, 
          { align: 'center' }
        );
      }

      const fileDate = new Date().toISOString().split('T')[0];
      doc.save(`products_list_${fileDate}.pdf`);
      setSnackbar({ open: true, message: `PDF downloaded successfully (${totalProductsCount} products)!`, severity: 'success' });
    } catch (err) {
      console.error('PDF export error:', err);
      setSnackbar({ open: true, message: 'PDF export failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DOWNLOAD TEMPLATE ====================
  const downloadTemplate = () => {
    try {
      const headers = [
        'Product Name', 'SKU', 'Variant Name', 'Product Type', 'Category', 
        'Unit', 'Stock', 'Cost Price', 'Retail Price', 'Wholesale Price', 
        'Barcode', 'Min Stock', 'Status', 'Description', 'Brand',
        'Box Product (Yes/No)', 'Units per Box', 'Box Quantity'
      ];
      
      const sampleData = [
        ['Pencil Box', 'PENCIL-01', 'Pack of 10', 'standard', 'Stationery', 'Box', 50, 250, 300, 280, '123456789', 5, 'active', '10 pencils per box', 'Stationery Co', 'Yes', 10, 5],
        ['iPhone 14', 'IPH14-01', '128GB Blue', 'imei', 'Mobile', 'Piece', 10, 800, 1000, 950, '456789012', 3, 'active', 'Latest model', 'Apple', 'No', 0, 0],
        ['Cotton Shirt', 'SHIRT-01', 'M Red', 'fabric', 'Clothing', 'Piece', 20, 150, 250, 200, '789012345', 5, 'active', 'Pure cotton', 'Nike', 'No', 0, 0],
      ];
      
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }
      ];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, 'inventory_import_template.xlsx');
      
      setSnackbar({ open: true, message: 'Template downloaded!', severity: 'success' });
    } catch (err) {
      console.error('Template error:', err);
      setSnackbar({ open: true, message: 'Failed to download template: ' + err.message, severity: 'error' });
    }
  };

  // ==================== IMPORT FROM EXCEL ====================
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

          const requiredColumns = ['Product Name', 'SKU'];
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

          let importedCount = 0, updatedCount = 0, errorCount = 0;
          const errors = [];

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowNum = i + 2;
            try {
              const productName = row['Product Name']?.trim();
              const sku = row['SKU']?.trim();
              
              if (!productName || !sku) {
                errors.push(`Row ${rowNum}: Product Name and SKU are required`);
                errorCount++;
                continue;
              }

              const isBoxProduct = row['Box Product (Yes/No)']?.toString().toLowerCase() === 'yes';
              const unitsPerBox = Number(row['Units per Box']) || 0;
              const boxQuantity = Number(row['Box Quantity']) || 0;
              
              // Calculate stock: If box product, stock = boxes × units per box
              let stock = Number(row['Stock']) || 0;
              if (isBoxProduct && unitsPerBox > 0 && boxQuantity > 0) {
                stock = boxQuantity * unitsPerBox;
              }

              const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
              
              if (existingVariant) {
                const costPrice = Number(row['Cost Price']) || 0;
                const retailPrice = Number(row['Retail Price']) || 0;
                const wholesalePrice = Number(row['Wholesale Price']) || 0;
                const minStock = Number(row['Min Stock']) || 5;
                const status = row['Status']?.trim()?.toLowerCase() === 'inactive' ? 'inactive' : 'active';
                
                const updateData = {};
                if (costPrice > 0) updateData.purchase_price = costPrice;
                if (retailPrice > 0) updateData.retail_price = retailPrice;
                if (wholesalePrice > 0) updateData.wholesale_price = wholesalePrice;
                if (minStock !== 5) updateData.stock_alert_quantity = minStock;
                if (row['Variant Name']) updateData.variant_name = row['Variant Name']?.trim();
                if (row['Barcode']) updateData.barcode = row['Barcode']?.trim();
                
                // Save box info in description
                let meta = {};
                try {
                  meta = JSON.parse(existingVariant.description || '{}');
                } catch { /* ignore */ }
                meta.is_box_product = isBoxProduct;
                meta.units_per_box = unitsPerBox;
                meta.box_quantity = boxQuantity;
                if (isBoxProduct && unitsPerBox > 0) {
                  meta.unit_price = retailPrice / unitsPerBox;
                }
                updateData.description = JSON.stringify(meta);
                
                if (Object.keys(updateData).length > 0) {
                  await db.updateVariant(existingVariant.id, updateData);
                }
                
                if (stock > 0) {
                  await db.updateVariantStock(existingVariant.id, stock);
                }
                
                updatedCount++;
                continue;
              }

              let categoryId = null;
              const categoryName = row['Category']?.trim();
              if (categoryName) {
                const existingCategories = await db.getCategories();
                let category = existingCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
                if (!category) {
                  const newCategory = await db.createCategory({
                    name: categoryName,
                    slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
                    status: 'active'
                  });
                  categoryId = newCategory.lastInsertRowid;
                } else {
                  categoryId = category.id;
                }
              }

              let brandId = null;
              const brandName = row['Brand']?.trim();
              if (brandName) {
                const existingBrands = await db.getBrands();
                let brand = existingBrands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                if (!brand) {
                  const newBrand = await db.createBrand({ name: brandName, status: 'active' });
                  brandId = newBrand.lastInsertRowid;
                } else {
                  brandId = brand.id;
                }
              }

              const productType = row['Product Type']?.trim() || 'standard';
              const unit = row['Unit']?.trim() || (isBoxProduct ? 'Box' : 'Piece');
              const costPrice = Number(row['Cost Price']) || 0;
              const retailPrice = Number(row['Retail Price']) || 0;
              const wholesalePrice = Number(row['Wholesale Price']) || 0;
              const minStock = Number(row['Min Stock']) || 5;
              const status = row['Status']?.trim()?.toLowerCase() === 'inactive' ? 'inactive' : 'active';
              const description = row['Description'] || '';
              const variantName = row['Variant Name']?.trim() || 'Default';
              const barcode = row['Barcode']?.trim() || null;

              // Build meta for box info
              const meta = {
                is_box_product: isBoxProduct,
                units_per_box: unitsPerBox,
                box_quantity: boxQuantity,
                unit_price: isBoxProduct && unitsPerBox > 0 ? retailPrice / unitsPerBox : 0,
                user_description: description
              };

              const productData = {
                name: productName,
                brand_id: brandId,
                category_id: categoryId,
                type: productType,
                unit: unit,
                sku: sku || null,
                barcode: barcode || null,
                purchase_price: costPrice,
                sale_price: retailPrice,
                retail_price: retailPrice,
                wholesale_price: wholesalePrice,
                min_price: retailPrice,
                stock: stock,
                min_stock: minStock,
                tax_type: 'inclusive',
                tax_rate: 0,
                description: JSON.stringify(meta),
                status: status,
                image_url: null,
              };

              const prodResult = await db.addProduct(productData);
              const productId = prodResult?.id || prodResult?.lastInsertRowid || prodResult?.data?.id;

              const variantData = {
                product_id: productId,
                sku: sku,
                barcode: barcode,
                variant_name: variantName,
                purchase_price: costPrice,
                retail_price: retailPrice,
                wholesale_price: wholesalePrice,
                minimum_retail_price: retailPrice,
                stock_alert_quantity: minStock,
                current_stock: stock,
                image_url: null,
                description: JSON.stringify(meta)
              };

              await db.addVariant(variantData);
              importedCount++;

            } catch (err) {
              console.error('Row error:', err);
              errors.push(`Row ${rowNum}: ${err.message}`);
              errorCount++;
            }
          }

          let message = `Import complete!`;
          if (importedCount > 0) message += ` New: ${importedCount}`;
          if (updatedCount > 0) message += ` Updated: ${updatedCount}`;
          if (errorCount > 0) message += ` Failed: ${errorCount}`;
          
          setSnackbar({ 
            open: true, 
            message: message, 
            severity: errorCount > 0 ? 'warning' : 'success' 
          });

          await loadData();

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

  // ==================== RESET FUNCTIONS ====================
  // ====== AUTO BARCODE GENERATOR ======
  const generateBarcode = () => {
    const prefix = 'RTH';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  };

  // ====== PRINT BARCODE LABEL ======
  // ====== PRINT BARCODE LABEL (DYNAMIC SETTINGS + ELECTRON PRINTER SUPPORT) ======
  const handlePrintBarcode = async (product, options = {}) => {
    if (!product || !product.barcode) {
      setSnackbar({ open: true, message: 'Is product ka barcode nahi hai! Please product edit karke barcode add ya generate karein.', severity: 'warning' });
      return;
    }

    let savedBarcodeSettings = {};
    try {
      const raw = localStorage.getItem('barcode_settings');
      if (raw) savedBarcodeSettings = JSON.parse(raw);
    } catch (e) {}

    let shopProfile = {};
    try {
      const rawShop = localStorage.getItem('shop_profile');
      if (rawShop) shopProfile = JSON.parse(rawShop);
    } catch (e) {}

    const cfg = {
      printerName: options.printerName || savedBarcodeSettings.printerName || '',
      labelSize: options.labelSize || savedBarcodeSettings.labelSize || '50x30mm',
      labelWidth: options.labelWidth || savedBarcodeSettings.labelWidth || 50,
      labelHeight: options.labelHeight || savedBarcodeSettings.labelHeight || 30,
      columns: options.columns || savedBarcodeSettings.columns || 1,
      showShopName: options.showShopName !== undefined ? options.showShopName : (savedBarcodeSettings.showShopName !== false),
      shopName: options.shopName || savedBarcodeSettings.shopName || shopProfile.name || 'My Store',
      showProductName: options.showProductName !== undefined ? options.showProductName : (savedBarcodeSettings.showProductName !== false),
      showPrice: options.showPrice !== undefined ? options.showPrice : (savedBarcodeSettings.showPrice !== false),
      currencySymbol: savedBarcodeSettings.currencySymbol || 'Rs.',
      showBarcode: options.showBarcode !== undefined ? options.showBarcode : (savedBarcodeSettings.showBarcode !== false),
      showBarcodeText: options.showBarcodeText !== undefined ? options.showBarcodeText : (savedBarcodeSettings.showBarcodeText !== false),
      showSku: options.showSku !== undefined ? options.showSku : (savedBarcodeSettings.showSku !== false),
      barcodeType: options.barcodeType || savedBarcodeSettings.barcodeType || 'CODE128',
      copies: options.copies || savedBarcodeSettings.copies || 1,
      marginMm: savedBarcodeSettings.marginMm || 2,
      ...options
    };

    // Calculate dimensions in mm
    let widthMm = cfg.labelWidth;
    let heightMm = cfg.labelHeight;
    if (cfg.labelSize === '50x30mm') { widthMm = 50; heightMm = 30; }
    else if (cfg.labelSize === '40x25mm') { widthMm = 40; heightMm = 25; }
    else if (cfg.labelSize === '38x28mm') { widthMm = 38; heightMm = 28; }
    else if (cfg.labelSize === '50x25mm') { widthMm = 50; heightMm = 25; }
    else if (cfg.labelSize === '2x1') { widthMm = 50.8; heightMm = 25.4; }
    else if (cfg.labelSize === '3x2') { widthMm = 76.2; heightMm = 50.8; }
    else if (cfg.labelSize === '4x3') { widthMm = 101.6; heightMm = 76.2; }

    const barcodeText = product.barcode;
    const productName = product.product_name || product.name || 'Product';
    const retailPrice = Number(product.retail_price || 0).toLocaleString();
    const copiesCount = Math.max(1, cfg.copies || 1);

    const singleLabelHtml = (idx) => `
      <div class="label-item" style="
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        padding: ${cfg.marginMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
        background: #ffffff;
        overflow: hidden;
        page-break-inside: avoid;
      ">
        ${cfg.showShopName ? `<div style="font-size: 8px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 1px; line-height: 1;">${cfg.shopName}</div>` : ''}
        ${cfg.showProductName ? `<div style="font-size: 9px; font-weight: bold; color: #000; line-height: 1.1; max-height: 20px; overflow: hidden; margin-top: 1px;">${productName}</div>` : ''}
        ${cfg.showBarcode ? `
          <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin: 1px 0;">
            <svg id="bc-${idx}" style="max-width: 95%; height: ${Math.max(24, heightMm * 0.9)}px;"></svg>
            ${cfg.showBarcodeText ? `<div style="font-family: monospace; font-size: 9px; font-weight: bold; letter-spacing: 2px; margin-top: 1px; color: #000;">${barcodeText}</div>` : ''}
          </div>
        ` : ''}
        ${cfg.showPrice ? `<div style="font-size: 13px; font-weight: 900; color: #000; line-height: 1;">${cfg.currencySymbol} ${retailPrice}</div>` : ''}
        ${cfg.showSku && product.sku ? `<div style="font-size: 7px; color: #666; line-height: 1;">SKU: ${product.sku}</div>` : ''}
      </div>
    `;

    const labelsListHtml = Array.from({ length: copiesCount }, (_, i) => singleLabelHtml(i)).join('');

    const printPageHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Barcode — ${productName}</title>
          <style>
            @page {
              size: ${widthMm}mm ${heightMm}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            .labels-container {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .label-item { page-break-after: always; }
              .label-item:last-child { page-break-after: avoid; }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        </head>
        <body>
          <div class="labels-container">
            ${labelsListHtml}
          </div>
          <script>
            window.onload = function() {
              ${Array.from({ length: copiesCount }, (_, c) => `
                try {
                  JsBarcode("#bc-${c}", "${barcodeText}", {
                    format: "${cfg.barcodeType || 'CODE128'}",
                    lineColor: "#000000",
                    width: ${widthMm < 45 ? 1.2 : 1.5},
                    height: ${Math.max(22, Math.round(heightMm * 0.9))},
                    displayValue: false,
                    margin: 0
                  });
                } catch (e) {
                  console.warn("JsBarcode error:", e);
                }
              `).join('')}
              setTimeout(function() {
                window.print();
              }, 400);
            };
          <\/script>
        </body>
      </html>
    `;

    // Try Electron direct print first
    if (window.electronAPI && window.electronAPI.printReceipt) {
      try {
        const pName = cfg.printerName || '';
        setSnackbar({ open: true, message: `Printing ${copiesCount} label(s) to ${pName || 'Default Printer'}...`, severity: 'info' });
        await window.electronAPI.printReceipt(printPageHtml, {
          printerName: pName,
          pageSize: { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) },
          copies: 1
        });
        setSnackbar({ open: true, message: `Printed ${copiesCount} barcode label(s) successfully!`, severity: 'success' });
        return;
      } catch (err) {
        console.error('Electron barcode print error:', err);
      }
    }

    // Fallback: Browser Popup Print
    const printWindow = window.open('', '_blank', `width=${Math.max(360, widthMm * 4)},height=${Math.max(400, heightMm * 4)}`);
    if (!printWindow) {
      setSnackbar({ open: true, message: 'Popup blocked! Please allow popups for barcode printing.', severity: 'error' });
      return;
    }
    printWindow.document.write(printPageHtml);
    printWindow.document.close();
    setSnackbar({ open: true, message: `Barcode print dialog opened for ${copiesCount} label(s)`, severity: 'success' });
  };

  const handleAutoBarcode = () => {
    const newBarcode = generateBarcode();
    setProductForm(prev => ({ ...prev, barcode: newBarcode }));
  };

  const resetProductForm = useCallback(() => {
    const last = JSON.parse(localStorage.getItem('last_product_defaults') || '{}');
    const defaultUnits = UNITS_BY_TYPE[last.type || 'standard'] || DEFAULT_UNITS;
    setProductForm({
      name: '', sku: '', type: last.type || 'standard', category_id: last.category_id || '',
      unit: defaultUnits[0] || 'Piece', costPrice: '', retailPrice: '', wholesalePrice: '',
      barcode: '', stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
      weight: '', expiryDate: '', batchNumber: '', description: '', status: 'active', 
      variant_name: 'Default',
      manufacturer: '', generic_name: '', supplier_name: '', shelf_rack: '', remarks: '',
      shoe_size: '', shoe_color: '', shoe_brand: '', shoe_material: '',
      bakery_ingredients: '',
      min_order_qty: '', bulk_discount: '',
      fabric_type: '', fabric_color: '', fabric_size: '', stitch_type: '',
      mobile_brand: '', mobile_model: '', mobile_storage: '', mobile_color: '',
      box_qty: '', packs_per_box: '', units_per_pack: '',
      image_url: '',
      image_file: null,
      is_box_product: false,
      units_per_box: '',
      box_quantity: '',
    });
    setImagePreview(null);
    setDialogProductType(last.type || 'standard');
    setIsBoxEntry(false);
    setUnitsPerBox('');
    setBoxQuantity('');
  }, []);

  const resetOfferForm = useCallback(() => {
    setOfferForm({ name: '', description: '', discount_type: 'percentage', discount_value: '0',
      start_date: new Date().toISOString().split('T')[0], end_date: '', status: 'active' });
    setOfferItems([]); setOfferCategoryFilter(''); setSelectedOfferProduct(null);
    setSelectedOfferVariant(null); setOfferVariantPrice(''); setEditingOffer(null);
  }, []);

  // ==================== IMAGE HANDLING ====================
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Image size should be less than 2MB!', severity: 'error' });
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Please upload a valid image file!', severity: 'error' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
      setProductForm(prev => ({
        ...prev,
        image_url: event.target.result,
        image_file: file
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setProductForm(prev => ({
      ...prev,
      image_url: '',
      image_file: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ==================== VARIANT IMAGE HANDLING ====================
  const handleVariantImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Image size should be less than 2MB!', severity: 'error' });
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Please upload a valid image file!', severity: 'error' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setVariantImagePreview(event.target.result);
      setVariantForm(prev => ({
        ...prev,
        image_url: event.target.result,
        image_file: file
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeVariantImage = () => {
    setVariantImagePreview(null);
    setVariantForm(prev => ({
      ...prev,
      image_url: '',
      image_file: null
    }));
    if (variantFileInputRef.current) {
      variantFileInputRef.current.value = '';
    }
  };

  // ==================== PRODUCT FUNCTIONS ====================
  const handleOpenProduct = useCallback((product = null) => {
    setEditingProduct(product);
    if (product) {
      const meta = parseMeta(product.description);
      const type = product.product_type || product.type || 'standard';
      setDialogProductType(type);
      
      const imageUrl = getProductImageUrl(product);
      setImagePreview(imageUrl);
      
      const typeUnits = UNITS_BY_TYPE[type] || DEFAULT_UNITS;
      
      // Check if this is a box product
      const isBox = meta.is_box_product || false;
      setIsBoxEntry(isBox);
      
      setProductForm({
        name: product.product_name || product.name || '', sku: product.sku || '',
        type: type,
        category_id: product.category_id || '', unit: product.base_unit || product.unit || typeUnits[0] || 'Piece',
        costPrice: product.purchase_price || '', retailPrice: product.retail_price || '',
        wholesalePrice: product.wholesale_price || '', barcode: product.barcode || '',
        stock: product.current_stock || '', minStock: product.stock_alert_quantity || '5', tax: '0',
        imeiList: meta.imeiList?.join('\n') || '', fabricLength: meta.fabricLength || '',
        weight: meta.weight || '', expiryDate: meta.expiryDate || '',
        batchNumber: meta.batchNumber || '',
        description: (meta.user_description) || '',
        status: product.status || 'active', variant_name: product.variant_name || 'Default',
        manufacturer: meta.manufacturer || '', generic_name: meta.generic_name || '',
        supplier_name: meta.supplier_name || '', shelf_rack: meta.shelf_rack || '',
        remarks: meta.remarks || '',
        shoe_size: meta.shoe_size || '', shoe_color: meta.shoe_color || '',
        shoe_brand: meta.shoe_brand || '', shoe_material: meta.shoe_material || '',
        bakery_ingredients: meta.bakery_ingredients || '',
        min_order_qty: meta.min_order_qty || '', bulk_discount: meta.bulk_discount || '',
        fabric_type: meta.fabric_type || '', fabric_color: meta.fabric_color || '',
        fabric_size: meta.fabric_size || '', stitch_type: meta.stitch_type || '',
        mobile_brand: meta.mobile_brand || '', mobile_model: meta.mobile_model || '',
        mobile_storage: meta.mobile_storage || '', mobile_color: meta.mobile_color || '',
        box_qty: meta.box_qty || '', packs_per_box: meta.packs_per_box || '',
        units_per_pack: meta.units_per_pack || '',
        image_url: imageUrl,
        image_file: null,
        is_box_product: isBox,
        units_per_box: meta.units_per_box || '',
        box_quantity: meta.box_quantity || '',
      });
      
      if (isBox) {
        setUnitsPerBox(meta.units_per_box || '');
        setBoxQuantity(meta.box_quantity || '');
      }
    } else { 
      resetProductForm(); 
      setImagePreview(null);
      setIsBoxEntry(false);
      setUnitsPerBox('');
      setBoxQuantity('');
    }
    setProductDialog(true);
  }, [resetProductForm]);

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'type') {
        const typeUnits = UNITS_BY_TYPE[value] || DEFAULT_UNITS;
        updated.unit = typeUnits[0] || 'Piece';
      }
      return updated;
    });
    if (name === 'type') setDialogProductType(value);
  };

  // ==================== BOX ENTRY HANDLERS ====================
  const handleBoxEntryToggle = (e) => {
    const checked = e.target.checked;
    setIsBoxEntry(checked);
    setProductForm(prev => ({
      ...prev,
      is_box_product: checked
    }));
    if (!checked) {
      setUnitsPerBox('');
      setBoxQuantity('');
      setProductForm(prev => ({
        ...prev,
        units_per_box: '',
        box_quantity: '',
        stock: ''
      }));
    }
  };

  const handleUnitsPerBoxChange = (e) => {
    const val = e.target.value;
    setUnitsPerBox(val);
    setProductForm(prev => ({ ...prev, units_per_box: val }));
    
    // Auto-calculate stock
    if (val && boxQuantity) {
      const totalStock = Number(val) * Number(boxQuantity);
      setProductForm(prev => ({ ...prev, stock: totalStock.toString() }));
    }
  };

  const handleBoxQuantityChange = (e) => {
    const val = e.target.value;
    setBoxQuantity(val);
    setProductForm(prev => ({ ...prev, box_quantity: val }));
    
    // Auto-calculate stock
    if (val && unitsPerBox) {
      const totalStock = Number(val) * Number(unitsPerBox);
      setProductForm(prev => ({ ...prev, stock: totalStock.toString() }));
    }
  };

  const handleRetailPriceChange = (e) => {
    const val = e.target.value;
    setProductForm(prev => ({ ...prev, retailPrice: val }));
    
    // Auto-calculate unit price for box products
    if (isBoxEntry && unitsPerBox && val) {
      const unitPrice = Number(val) / Number(unitsPerBox);
      // Show in description or just store
      setProductForm(prev => ({ 
        ...prev, 
        description: `${boxQuantity || '?'} boxes × ${unitsPerBox} units/box = ${Number(boxQuantity || 0) * Number(unitsPerBox || 0)} units | Unit Price: Rs. ${Math.round(unitPrice)}` 
      }));
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (editingProduct && !can('inventory', 'edit')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot edit products!', severity: 'error' });
      return;
    }
    if (!editingProduct && !can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add products!', severity: 'error' });
      return;
    }
    const sku = productForm.sku.trim();
    if (!productForm.name.trim() || !sku) { 
      setSnackbar({ open: true, message: 'Name and SKU required!', severity: 'error' });
      return; 
    }

    // ====== PRICE VALIDATION ======
    const cost = Number(productForm.costPrice) || 0;
    const retail = Number(productForm.retailPrice) || 0;
    const wholesale = Number(productForm.wholesalePrice) || 0;

    if (cost > 0 && retail > 0 && cost >= retail) {
      setSnackbar({ open: true, message: 'Cost price must be LESS than Retail price!', severity: 'error' });
      return;
    }
    if (cost > 0 && wholesale > 0 && cost >= wholesale) {
      setSnackbar({ open: true, message: 'Cost price must be LESS than Wholesale price!', severity: 'error' });
      return;
    }
    if (retail > 0 && wholesale > 0 && wholesale > retail) {
      setSnackbar({ open: true, message: 'Wholesale price should not be more than Retail price!', severity: 'warning' });
      // Don't block, just warn
    }

    const meta = {};
    
    // ====== BOX ENTRY HANDLING ======
    if (isBoxEntry && productForm.units_per_box && productForm.box_quantity) {
      meta.is_box_product = true;
      meta.units_per_box = Number(productForm.units_per_box);
      meta.box_quantity = Number(productForm.box_quantity);
      meta.original_box_cost = Number(productForm.costPrice) || 0;
      meta.original_box_retail = Number(productForm.retailPrice) || 0;
      meta.original_box_wholesale = Number(productForm.wholesalePrice) || 0;

      // UNIT prices = Box price / units per box
      if (meta.units_per_box > 0) {
        meta.unit_cost_price = meta.original_box_cost / meta.units_per_box;
        meta.unit_retail_price = meta.original_box_retail / meta.units_per_box;
        meta.unit_wholesale_price = meta.original_box_wholesale / meta.units_per_box;
      }

      // Stock = boxes × units per box
      const totalUnits = meta.box_quantity * meta.units_per_box;
      productForm.stock = totalUnits.toString();
    } else {
      meta.is_box_product = false;
    }
    
    // Rest of meta handling...
    if (productForm.type === 'imei' && productForm.imeiList) {
      meta.imeiList = productForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    if (productForm.type === 'fabric' || productForm.type === 'cloth') {
      meta.fabricLength = Number(productForm.fabricLength) || 0;
      meta.fabric_type = productForm.fabric_type || '';
      meta.fabric_color = productForm.fabric_color || '';
      meta.fabric_size = productForm.fabric_size || '';
      meta.stitch_type = productForm.stitch_type || '';
    }
    if (productForm.type === 'grocery' || productForm.type === 'bakery') {
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }
    if (productForm.type === 'medical') {
      meta.manufacturer = productForm.manufacturer || '';
      meta.generic_name = productForm.generic_name || '';
      meta.supplier_name = productForm.supplier_name || '';
      meta.shelf_rack = productForm.shelf_rack || '';
      meta.remarks = productForm.remarks || '';
    }
    if (productForm.type === 'shoes') {
      meta.shoe_size = productForm.shoe_size || '';
      meta.shoe_color = productForm.shoe_color || '';
      meta.shoe_brand = productForm.shoe_brand || '';
      meta.shoe_material = productForm.shoe_material || '';
    }
    if (productForm.type === 'bakery') {
      meta.bakery_ingredients = productForm.bakery_ingredients || '';
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }
    if (productForm.type === 'wholesale') {
      meta.min_order_qty = Number(productForm.min_order_qty) || 0;
      meta.bulk_discount = Number(productForm.bulk_discount) || 0;
    }
    if (productForm.type === 'imei') {
      meta.mobile_brand = productForm.mobile_brand || '';
      meta.mobile_model = productForm.mobile_model || '';
      meta.mobile_storage = productForm.mobile_storage || '';
      meta.mobile_color = productForm.mobile_color || '';
    }
    if (productForm.type === 'medical' || productForm.type === 'wholesale') {
      meta.box_qty = Number(productForm.box_qty) || 0;
      meta.packs_per_box = Number(productForm.packs_per_box) || 0;
      meta.units_per_pack = Number(productForm.units_per_pack) || 0;
    }
    
    if (productForm.description && productForm.description.trim()) {
      meta.user_description = productForm.description.trim();
    }
    
    if (productForm.image_url) {
      meta.image_url = productForm.image_url;
    }

    let finalStock = Number(productForm.stock) || 0;
    const boxQty = Number(productForm.box_qty) || 0;
    const packsPerBox = Number(productForm.packs_per_box) || 0;
    const unitsPerPack = Number(productForm.units_per_pack) || 0;
    
    if (boxQty > 0 && packsPerBox > 0) {
      const totalPacks = boxQty * packsPerBox;
      if (productForm.type === 'medical' && unitsPerPack > 0) {
        finalStock = totalPacks * unitsPerPack;
      } else {
        finalStock = totalPacks;
      }
    } else if (finalStock === 0 && productForm.stock) {
      finalStock = Number(productForm.stock) || 0;
    }

    // Set variant name for box products
    let variantName = productForm.variant_name || 'Default';
    if (isBoxEntry && productForm.units_per_box && productForm.box_quantity) {
      variantName = `Box: ${productForm.box_quantity} × ${productForm.units_per_box} units`;
    }
    
    // For box products, store UNIT prices (box price / units per box)
    let unitCost = Number(productForm.costPrice) || 0;
    let unitRetail = Number(productForm.retailPrice) || 0;
    let unitWholesale = Number(productForm.wholesalePrice) || 0;

    if (isBoxEntry && meta.units_per_box > 0) {
      unitCost = unitCost / meta.units_per_box;
      unitRetail = unitRetail / meta.units_per_box;
      unitWholesale = unitWholesale / meta.units_per_box;
    }

    const productData = {
      name: productForm.name,
      brand_id: productForm.brand_id || null,
      category_id: productForm.category_id ? String(productForm.category_id) : null,
      type: productForm.type,
      unit: productForm.unit,
      sku: sku || null,
      barcode: productForm.barcode || null,
      purchase_price: unitCost,
      sale_price: unitRetail,
      retail_price: unitRetail,
      wholesale_price: unitWholesale,
      min_price: unitRetail,
      stock: finalStock,
      min_stock: Number(productForm.minStock) || 5,
      tax_type: 'inclusive',
      tax_rate: 0,
      description: JSON.stringify(meta),
      status: productForm.status,
      image_url: productForm.image_url || null,
    };

    const variantData = {
      sku: sku, barcode: productForm.barcode || null,
      variant_name: variantName,
      purchase_price: unitCost, 
      retail_price: unitRetail,
      wholesale_price: unitWholesale,
      minimum_retail_price: unitRetail,
      stock_alert_quantity: Number(productForm.minStock) || 5,
      current_stock: finalStock,
      image_url: productForm.image_url || null,
      description: JSON.stringify(meta)
    };
    
    try {
      const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
      if (editingProduct) {
        await db.updateProduct(editingProduct.product_id || editingProduct.id, productData);
        await db.updateVariant(editingProduct.id, variantData);
        setSnackbar({ open: true, message: 'Product updated successfully!', severity: 'success' });
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
          const productId = prodResult?.id || prodResult?.lastInsertRowid || prodResult?.data?.id;
          variantData.product_id = productId;
          const varResult = await db.addVariant(variantData);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            const varId = varResult?.id || varResult?.lastInsertRowid || varResult?.data?.id || productId;
            await db.addMultipleSerializedItems(varId, meta.imeiList);
          }
          setSnackbar({ open: true, message: 'Product created successfully!', severity: 'success' });
        }
      }
      localStorage.setItem('last_product_defaults', JSON.stringify({
        type: productForm.type, category_id: productForm.category_id, unit: productForm.unit
      }));
      await loadData(); 
      setProductDialog(false); 
      setEditingProduct(null); 
      resetProductForm();
      setIsBoxEntry(false);
      setUnitsPerBox('');
      setBoxQuantity('');
    } catch (err) {
      console.error('Save error:', err);
      setSnackbar({ open: true, message: 'Error saving product: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!id) return;
    if (!can('inventory', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot delete products!', severity: 'error' });
      return;
    }
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
      wholesalePrice: parentProduct.wholesale_price || '', stock: '', barcode: '', imeiList: '',
      image_url: '', image_file: null
    });
    setVariantImagePreview(null);
    setVariantDialog(true);
  };

  const handleVariantChange = (e) => {
    const { name, value } = e.target;
    setVariantForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveVariant = async (e) => {
    e.preventDefault();
    if (!can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add variants!', severity: 'error' });
      return;
    }
    const sku = variantForm.sku.trim();
    if (!sku) { setSnackbar({ open: true, message: 'SKU required!', severity: 'error' }); return; }
    try {
      const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
      const addedStock = Number(variantForm.stock) || 0;
      
      const meta = {};
      if (variantForm.image_url) {
        meta.image_url = variantForm.image_url;
      }
      if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && variantForm.imeiList?.trim()) {
        meta.imeiList = variantForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      }
      
      const variantData = {
        product_id: variantParent.product_id || variantParent.id,
        sku: sku,
        barcode: variantForm.barcode || null,
        variant_name: variantForm.variantName || 'Default',
        purchase_price: Number(variantForm.costPrice) || 0,
        retail_price: Number(variantForm.retailPrice) || 0,
        wholesale_price: Number(variantForm.wholesalePrice) || 0,
        minimum_retail_price: Number(variantForm.retailPrice) || 0,
        stock_alert_quantity: variantParent.stock_alert_quantity || 5,
        current_stock: addedStock,
        image_url: variantForm.image_url || null,
        description: Object.keys(meta).length > 0 ? JSON.stringify(meta) : variantParent.description
      };
      
      if (existingVariant) {
        await db.updateVariantStock(existingVariant.id, addedStock);
        if (variantForm.image_url) {
          await db.updateVariantImage(existingVariant.id, variantForm.image_url);
        }
        if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && meta.imeiList?.length > 0) {
          await db.addMultipleSerializedItems(existingVariant.id, meta.imeiList);
        }
        setSnackbar({ open: true, message: `Stock updated for "${sku}"`, severity: 'success' });
      } else {
        const varResult = await db.addVariant(variantData);
        if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && meta.imeiList?.length > 0) {
          await db.addMultipleSerializedItems(varResult.lastInsertRowid, meta.imeiList);
        }
        setSnackbar({ open: true, message: 'Variant created!', severity: 'success' });
      }
      await loadData(); setVariantDialog(false); setVariantParent(null);
    } catch (err) { 
      console.error('Variant save error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== CATEGORY FUNCTIONS ====================
  const handleAddCategory = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = (newCategoryName || form.categoryName?.value || '').trim();
    const parentId = newCategoryParent || form.parent_id?.value || null;
    if (!name) {
      setSnackbar({ open: true, message: 'Please enter category name!', severity: 'warning' });
      return;
    }
    try {
      await db.createCategory({
        name: name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        parent_id: parentId ? String(parentId) : null,
        status: 'active'
      });
      await loadData();
      setNewCategoryName('');
      setNewCategoryParent('');
      if (form.reset) form.reset();
      setSnackbar({ open: true, message: 'Category added successfully!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!can('inventory', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot delete categories!', severity: 'error' });
      return;
    }
    if (!window.confirm('Delete this category?')) return;
    try { 
      await db.deleteCategory(id); 
      await loadData();
      setSnackbar({ open: true, message: 'Category deleted!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== BRAND FUNCTIONS ====================
  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add brands!', severity: 'error' });
      return;
    }
    const form = e.target;
    const name = (newBrandName || form.brandName?.value || '').trim();
    if (!name) {
      setSnackbar({ open: true, message: 'Please enter brand name!', severity: 'warning' });
      return;
    }
    try {
      if (db.createBrand) {
        await db.createBrand({ name, status: 'active' });
      }
      await loadData();
      setNewBrandName('');
      if (form.reset) form.reset();
      setSnackbar({ open: true, message: 'Brand added successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!can('inventory', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot delete brands!', severity: 'error' });
      return;
    }
    if (!window.confirm('Delete this brand?')) return;
    try {
      if (db.deleteBrand) {
        await db.deleteBrand(brandId);
      }
      await loadData();
      setSnackbar({ open: true, message: 'Brand deleted!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== UNIT FUNCTIONS ====================
  const handleAddUnit = (e) => {
    e.preventDefault();
    if (!can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add units!', severity: 'error' });
      return;
    }
    const form = e.target;
    const newUnit = (newUnitName || form.unitName?.value || '').trim();
    if (newUnit && !units.includes(newUnit)) {
      const updated = [...units, newUnit];
      setUnits(updated);
      localStorage.setItem('custom_units', JSON.stringify(updated));
      setSnackbar({ open: true, message: 'Unit added!', severity: 'success' });
    }
    setNewUnitName('');
    if (form.reset) form.reset();
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
    if (editingOffer && !can('inventory', 'edit')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot edit offers!', severity: 'error' });
      return;
    }
    if (!editingOffer && !can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add offers!', severity: 'error' });
      return;
    }
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
    if (!can('inventory', 'delete')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot delete offers!', severity: 'error' });
      return;
    }
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
      variant_id: selectedOfferVariant.id, 
      product_id: selectedOfferProduct?.product_id || selectedOfferProduct?.id,
      product_name: selectedOfferProduct?.product_name || selectedOfferProduct?.name || '',
      variant_name: selectedOfferVariant.variant_name || 'Default', 
      sku: selectedOfferVariant.sku,
      original_price: originalPrice, 
      offer_price: customPrice, 
      category_id: selectedOfferProduct?.category_id
    }]);
    setSelectedOfferVariant(null); setOfferVariantPrice('');
    setSnackbar({ open: true, message: 'Added to offer!', severity: 'success' });
  };

  const handleRemoveOfferItem = (variantId) => {
    setOfferItems(prev => prev.filter(i => i.variant_id !== variantId));
  };

  // ==================== FORCE REFRESH ====================
  const handleForceRefresh = () => {
    console.log('[Products] Force refresh clicked');
    if (db._cache) {
      db._cache.clear();
      console.log('[Cache] Cache cleared');
    }
    setForceUpdate(prev => prev + 1);
    setSnackbar({ open: true, message: 'Refreshed!', severity: 'success' });
  };

  // ==================== RENDER ====================
  if (loading && products.length === 0) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3 }}>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
          <Inventory sx={{ mr: 1, verticalAlign: 'middle', fontSize: isMobile ? 28 : 32 }} />
          {isMobile ? 'Inventory' : 'Inventory Management'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            size="small" 
            color="warning"
            startIcon={<Refresh />} 
            onClick={handleForceRefresh}
          >
            {isMobile ? 'Refresh' : 'Refresh'}
          </Button>
          
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<TableChart />} 
            onClick={downloadTemplate}
          >
            {isMobile ? 'Template' : 'Template'}
          </Button>
          
          <Button 
            variant="outlined" 
            size="small" 
            component="label"
            startIcon={<UploadFile />}
          >
            {isMobile ? 'Import' : 'Import Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleImportExcel}
            />
          </Button>
          
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<FileDownload />} 
            onClick={exportToExcel}
          >
            {isMobile ? 'Export' : 'Export Excel'}
          </Button>

          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<PictureAsPdf />} 
            onClick={exportToPDF}
            sx={{ 
              color: '#dc2626', 
              borderColor: '#fca5a5', 
              fontWeight: 600,
              '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' } 
            }}
          >
            {isMobile ? 'PDF' : 'Download PDF'}
          </Button>
          
          <Button variant="outlined" size="small" startIcon={<Category />} onClick={() => setCategoryDialog(true)}>
            {isMobile ? 'Cats' : 'Categories'}
          </Button>
          <Button variant="outlined" size="small" startIcon={<Branding />} onClick={() => setBrandDialog(true)}>
  {isMobile ? 'Brands' : 'Brands'}
</Button>
          <Button variant="outlined" size="small" startIcon={<Scale />} onClick={() => setUnitDialog(true)}>
            {isMobile ? 'Units' : 'Units'}
          </Button>
          {can('inventory', 'add') && (
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => handleOpenProduct()}>
              {isMobile ? 'Product' : 'Add Product'}
            </Button>
          )}
        
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: 'Products', value: inventorySummary.totalProducts, label: 'Catalog Items' },
          { title: 'Variants', value: inventorySummary.totalVariants, label: 'SKU Variants' },
          { title: 'Stock Qty', value: inventorySummary.totalStockQty.toLocaleString(), label: 'Total Units' },
          { title: 'Cost Value', value: formatCurrency(inventorySummary.totalCostValue), label: 'Total Cost' },
          { title: 'Retail Value', value: formatCurrency(inventorySummary.totalRetailValue), label: 'Total Retail' },
          { title: 'Wholesale Value', value: formatCurrency(inventorySummary.totalWholesaleValue), label: 'Total Wholesale' },
        ].map((stat, idx) => (
          <Grid item xs={6} md={2} key={idx}>
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
            icon={<Inventory fontSize="small" />} 
            label={isMobile ? 'Products' : 'Products'} 
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
            <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Grid container spacing={isMobile ? 1.5 : 2} sx={{ alignItems: 'center' }}>
                <Grid item xs={12} sm={12} md={3} lg={3}>
                  <TextField 
                    fullWidth 
                    size="small"
                    label="Search Products"
                    placeholder="Search products by name, SKU or barcode..." 
                    value={searchProduct} 
                    onChange={(e) => setSearchProduct(e.target.value)} 
                    InputLabelProps={{ shrink: true }}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start"><Search sx={{ mr: 0.5, color: '#10b981' }} /></InputAdornment>
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2} lg={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={4} md={2} lg={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Brand</InputLabel>
                    <Select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} label="Brand">
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => <MenuItem key={b.id} value={String(b.id)}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={4} md={2} lg={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Product Type</InputLabel>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Product Type">
                      <MenuItem value="">All Types</MenuItem>
                      {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={12} md={3} lg={3} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={filterLowStock} 
                        onChange={(e) => setFilterLowStock(e.target.checked)} 
                        color="warning"
                        size="small"
                      />
                    }
                    label={<Typography variant="body2" sx={{ fontWeight: 500, color: filterLowStock ? '#d97706' : 'text.secondary' }}>Low Stock Only</Typography>}
                  />
                  {(searchProduct || filterCategory || filterBrand || filterType || filterLowStock) && (
                    <Button 
                      size="small" 
                      variant="text" 
                      onClick={() => {
                        setSearchProduct('');
                        setFilterCategory('');
                        setFilterBrand('');
                        setFilterType('');
                        setFilterLowStock(false);
                      }}
                      sx={{ fontSize: '0.7rem', color: '#ef4444', minWidth: 'auto', p: 0.5 }}
                    >
                      Clear
                    </Button>
                  )}
                </Grid>
              </Grid>
            </Paper>

            {isMobile ? (
              // Mobile Cards View
              <Box>
                {paginatedGroups.map((group) => {
                  const parent = group.parent;
                  return (
                    <MobileProductCard
                      key={parent.product_id || parent.id}
                      product={parent}
                      onEdit={handleOpenProduct}
                      onDelete={handleDeleteProduct}
                      onAddVariant={handleOpenVariant}
                      onPrintBarcode={handlePrintBarcode}
                      getTypeChip={getTypeChip}
                      getStockBadge={getStockBadge}
                      canEdit={can('inventory', 'edit')}
                      canDelete={can('inventory', 'delete')}
                      canAdd={can('inventory', 'add')}
                    />
                  );
                })}
                {groupedProducts.length === 0 && (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Inventory sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No products found</Typography>
                  </Paper>
                )}
                <UnifiedPagination
                  count={groupedProducts.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={(newR) => {
                    setRowsPerPage(newR);
                    setPage(1);
                  }}
                  rowsPerPageOptions={[15, 25, 50, 100]}
                />
              </Box>
            ) : (
              // Desktop Table View
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Image</TableCell>
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
                        <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No products found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {paginatedGroups.map((group) => {
                      const parent = group.parent;
                      const variants = group.variants;
                      const isExpanded = expandedGroups.has(parent.product_id || parent.id);
                      const totalStock = variants.reduce((sum, v) => sum + (Number(v.current_stock) || 0), 0);
                      const parentImage = getProductImageUrl(parent);
                      
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
                              {parentImage ? (
                                <Avatar 
                                  src={parentImage} 
                                  variant="rounded" 
                                  sx={{ width: 36, height: 36, border: '1px solid #e0e0e0' }}
                                />
                              ) : (
                                <Avatar 
                                  variant="rounded" 
                                  sx={{ width: 36, height: 36, bgcolor: '#f5f5f5' }}
                                >
                                  <Inventory sx={{ fontSize: 20, color: '#999' }} />
                                </Avatar>
                              )}
                            </TableCell>
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
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                {parent.is_box_product && parent.units_per_box > 0 ? (
                                  <Box>
                                    <Typography fontWeight="bold" color={getStockColor(totalStock, parent.stock_alert_quantity)}>
                                      {Math.floor(totalStock / parent.units_per_box)} boxes
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      ({totalStock} {parent.base_unit || parent.unit || 'units'})
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography fontWeight="bold" color={getStockColor(totalStock, parent.stock_alert_quantity)}>
                                    {totalStock}
                                  </Typography>
                                )}
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
                              <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                <Tooltip title="Print Barcode">
                                  <IconButton size="small" sx={{ color: '#8b5cf6' }} onClick={(e) => { e.stopPropagation(); handlePrintBarcode(parent); }}>
                                    <QrCode />
                                  </IconButton>
                                </Tooltip>
                                {can('inventory', 'add') && (
                                  <Tooltip title="Add Variant">
                                    <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenVariant(parent); }}>
                                      <AddCircle />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {can('inventory', 'edit') && (
                                  <Tooltip title="Edit">
                                    <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); handleOpenProduct(parent); }}>
                                      <Edit />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {can('inventory', 'delete') && (
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(parent.product_id || parent.id); }}>
                                      <Delete />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                          
                          {/* Variant Dropdown Rows */}
                          {isExpanded && variants.map((variant) => {
                            const variantImage = getProductImageUrl(variant);
                            return (
                              <TableRow key={variant.id} sx={{ bgcolor: 'action.hover' }}>
                                <TableCell>
                                  {variantImage ? (
                                    <Avatar 
                                      src={variantImage} 
                                      variant="rounded" 
                                      sx={{ width: 28, height: 28, border: '1px solid #e0e0e0' }}
                                    />
                                  ) : (
                                    <Avatar 
                                      variant="rounded" 
                                      sx={{ width: 28, height: 28, bgcolor: '#f5f5f5' }}
                                    >
                                      <Inventory sx={{ fontSize: 16, color: '#999' }} />
                                    </Avatar>
                                  )}
                                </TableCell>
                                <TableCell sx={{ pl: 6 }}>
                                  <Typography variant="body2">{variant.variant_name || 'Default'}</Typography>
                                </TableCell>
                                <TableCell>{variant.sku}</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>
                                  {variant.is_box_product && variant.units_per_box > 0 ? (
                                    <Box>
                                      <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                        {Math.floor((variant.current_stock || 0) / variant.units_per_box)} boxes
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        ({variant.current_stock || 0} {variant.base_unit || variant.unit || 'units'})
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                      {variant.current_stock || 0}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>{formatCurrency(variant.purchase_price)}</TableCell>
                                <TableCell>{formatCurrency(variant.retail_price)}</TableCell>
                                <TableCell>{formatCurrency(variant.wholesale_price)}</TableCell>
                                <TableCell>
                                  <Chip size="small" color={variant.status === 'active' ? 'success' : 'default'} label={variant.status} />
                                </TableCell>
                                <TableCell align="right">
                                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                    <Tooltip title="Print Barcode">
                                      <IconButton size="small" sx={{ color: '#8b5cf6' }} onClick={() => handlePrintBarcode(variant)}>
                                        <QrCode />
                                      </IconButton>
                                    </Tooltip>
                                    {can('inventory', 'edit') && (
                                      <Tooltip title="Edit">
                                        <IconButton size="small" color="info" onClick={() => handleOpenProduct(variant)}>
                                          <Edit />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {can('inventory', 'delete') && (
                                      <Tooltip title="Delete">
                                        <IconButton size="small" color="error" onClick={() => handleDeleteProduct(variant.id)}>
                                          <Delete />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                <UnifiedPagination
                  count={groupedProducts.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={(newR) => {
                    setRowsPerPage(newR);
                    setPage(1);
                  }}
                  rowsPerPageOptions={[15, 25, 50, 100]}
                />
              </TableContainer>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: OFFERS ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            {can('inventory', 'add') && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenOffer()} size={isMobile ? 'small' : 'medium'}>
                  {isMobile ? 'New' : 'Add Offer'}
                </Button>
              </Box>
            )}

            {isMobile ? (
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
                        {can('inventory', 'edit') && (
                          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => handleOpenOffer(offer)} sx={{ flex: 1, fontSize: '0.6rem' }}>
                            Edit
                          </Button>
                        )}
                        {can('inventory', 'delete') && (
                          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => handleDeleteOffer(offer.id)} sx={{ flex: 1, fontSize: '0.6rem' }}>
                            Delete
                          </Button>
                        )}
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
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                            {can('inventory', 'edit') && (
                              <Tooltip title="Edit">
                                <IconButton size="small" color="info" onClick={() => handleOpenOffer(offer)}>
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                            )}
                            {can('inventory', 'delete') && (
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteOffer(offer.id)}>
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            )}
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

      {/* PRODUCT DIALOG WITH BOX ENTRY */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        {/* Custom Header */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
          color: 'white', 
          px: isMobile ? 2 : 3, 
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.15)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: '12px', 
              bgcolor: 'rgba(255, 255, 255, 0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}>
              <Inventory2 sx={{ fontSize: 22, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ color: 'white', lineHeight: 1.2, fontSize: isMobile ? '1rem' : '1.15rem' }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.85)', display: 'block', mt: 0.2 }}>
                {editingProduct ? 'Modify details, barcode and pricing for this item' : 'Enter product information, pricing, barcodes, and stock levels'}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setProductDialog(false)}
            sx={{ 
              color: 'white', 
              bgcolor: 'rgba(255, 255, 255, 0.15)', 
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' } 
            }}
            size="small"
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DialogContent sx={{ p: isMobile ? 1.5 : 3, bgcolor: '#f8fafc', overflowY: 'auto' }}>
            <Stack spacing={2.5}>

              {/* CARD 1: Basic Information & Photo */}
              <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ShoppingBag fontSize="small" sx={{ color: '#10b981' }} />
                  Basic Information & Photo
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2.5, alignItems: 'flex-start' }}>
                  {/* Image Upload Area */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0, width: isMobile ? '100%' : 140 }}>
                    {imagePreview ? (
                      <Box sx={{ position: 'relative', width: 130, height: 130 }}>
                        <img 
                          src={imagePreview} 
                          alt="Product Preview"
                          style={{ 
                            width: 130, 
                            height: 130, 
                            borderRadius: 12, 
                            objectFit: 'cover', 
                            border: '2px solid #10b981', 
                            boxShadow: '0 2px 8px rgba(16,185,129,0.2)' 
                          }}
                        />
                        <IconButton 
                          size="small" 
                          sx={{ 
                            position: 'absolute', top: -8, right: -8, 
                            bgcolor: '#ef4444', color: 'white', 
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            '&:hover': { bgcolor: '#dc2626' } 
                          }}
                          onClick={removeImage}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box 
                        sx={{ 
                          width: isMobile ? '100%' : 130, 
                          height: 130, 
                          border: '2px dashed #cbd5e1', 
                          borderRadius: 3, 
                          bgcolor: '#f1f5f9',
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: '#10b981', bgcolor: '#ecfdf5' }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <CloudUpload sx={{ fontSize: 32, color: '#10b981' }} />
                        <Typography variant="caption" fontWeight="bold" sx={{ color: '#64748b' }}>
                          Upload Photo
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          Max 2MB
                        </Typography>
                      </Box>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      hidden 
                      ref={fileInputRef}
                      onChange={handleImageUpload} 
                    />
                    {imagePreview && (
                      <Button 
                        size="small" 
                        variant="text" 
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ fontSize: '0.7rem', color: '#10b981', p: 0 }}
                      >
                        Change Photo
                      </Button>
                    )}
                  </Box>

                  {/* Core Details (Name, SKU, Barcode) */}
                  <Box sx={{ flex: 1, width: '100%' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="Product Name" 
                          name="name" 
                          value={productForm.name} 
                          onChange={handleProductChange} 
                          required 
                          placeholder="e.g., Lipton Yellow Label Tea 200g, Men's Polo Shirt"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="SKU" 
                          name="sku" 
                          value={productForm.sku} 
                          onChange={handleProductChange} 
                          required 
                          disabled={!!editingProduct}
                          placeholder="e.g., PRD-001"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField 
                          fullWidth 
                          size="small" 
                          label={editingProduct ? "Barcode (Cannot Edit)" : "Barcode"} 
                          name="barcode" 
                          value={productForm.barcode} 
                          onChange={editingProduct ? undefined : handleProductChange}
                          InputProps={{ readOnly: !!editingProduct }}
                          placeholder="Scan or auto-generate"
                          helperText={editingProduct ? "Barcode edit nahi ho sakta" : "Custom barcode likhein ya Auto generate karein"}
                          slotProps={{
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  {!editingProduct && (
                                    <Button 
                                      size="small" 
                                      variant="text" 
                                      onClick={handleAutoBarcode}
                                      startIcon={<AutoAwesome sx={{ fontSize: '14px !important' }} />}
                                      sx={{ 
                                        minWidth: 'auto', 
                                        px: 1, 
                                        py: 0.2, 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold',
                                        color: '#10b981',
                                        bgcolor: '#ecfdf5',
                                        borderRadius: 1.5,
                                        '&:hover': { bgcolor: '#d1fae5' }
                                      }}
                                    >
                                      Auto
                                    </Button>
                                  )}
                                </InputAdornment>
                              )
                            }
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Paper>

              {/* CARD 2: Classification & Units */}
              <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Category fontSize="small" sx={{ color: '#10b981' }} />
                  Classification & Units
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Product Type</InputLabel>
                      <Select name="type" value={productForm.type} onChange={handleProductChange} label="Product Type">
                        {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select name="category_id" value={productForm.category_id} onChange={handleProductChange} label="Category">
                        <MenuItem value="">None / Unassigned</MenuItem>
                        {categories.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Brand</InputLabel>
                      <Select name="brand" value={productForm.brand || ''} onChange={handleProductChange} label="Brand">
                        <MenuItem value="">No Brand</MenuItem>
                        {brands.map(b => <MenuItem key={b.id} value={b.name}>{b.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Base Unit</InputLabel>
                      <Select name="unit" value={productForm.unit} onChange={handleProductChange} label="Base Unit">
                        {(UNITS_BY_TYPE[productForm.type] || DEFAULT_UNITS).map(u => (
                          <MenuItem key={u} value={u}>{u}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>

              {/* CARD 3: Packaging & Box Entry Mode */}
              <Paper sx={{ 
                p: isMobile ? 2 : 2.5, 
                borderRadius: 3, 
                border: isBoxEntry ? '1.5px solid #10b981' : '1px solid #e2e8f0', 
                bgcolor: isBoxEntry ? '#f0fdf4' : 'white',
                boxShadow: isBoxEntry ? '0 4px 12px rgba(16,185,129,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ 
                      width: 38, 
                      height: 38, 
                      borderRadius: 2, 
                      bgcolor: isBoxEntry ? '#d1fae5' : '#f1f5f9', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Inventory2 sx={{ fontSize: 20, color: isBoxEntry ? '#059669' : '#64748b' }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" color={isBoxEntry ? '#065f46' : 'text.primary'}>
                        Packaging / Box Entry Mode
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Carton ya box ke hisaab se inventory aur unit prices auto-calculate karein
                      </Typography>
                    </Box>
                  </Box>
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={isBoxEntry}
                        onChange={handleBoxEntryToggle}
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="caption" fontWeight="bold" sx={{ color: isBoxEntry ? '#059669' : '#64748b', ml: 0.5 }}>
                        {isBoxEntry ? 'BOX MODE ON' : 'NORMAL ENTRY'}
                      </Typography>
                    }
                  />
                </Box>

                {isBoxEntry && (
                  <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px dashed #a7f3d0' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Units per Box *"
                          type="number"
                          value={unitsPerBox}
                          onChange={handleUnitsPerBoxChange}
                          helperText="Ek box / dabbe mein kitne pieces hain (e.g., 10)"
                          required={isBoxEntry}
                          placeholder="10"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Box Quantity *"
                          type="number"
                          value={boxQuantity}
                          onChange={handleBoxQuantityChange}
                          helperText="Total kitne boxes hain (e.g., 5)"
                          required={isBoxEntry}
                          placeholder="5"
                        />
                      </Grid>
                      {unitsPerBox && boxQuantity && (
                        <Grid item xs={12}>
                          <Box sx={{ 
                            p: 2, 
                            borderRadius: 2.5, 
                            bgcolor: '#ecfdf5', 
                            border: '1px solid #a7f3d0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.5
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CheckCircle sx={{ color: '#10b981', fontSize: 22 }} />
                              <Box>
                                <Typography variant="body2" fontWeight="bold" color="#065f46">
                                  Total Calculated Units: {Number(unitsPerBox) * Number(boxQuantity)} {productForm.unit || 'units'}
                                </Typography>
                                <Typography variant="caption" color="#047857">
                                  Formula: {unitsPerBox} units/box × {boxQuantity} boxes
                                </Typography>
                              </Box>
                            </Box>
                            {productForm.retailPrice && (
                              <Chip 
                                size="small" 
                                label={`Per Unit Price: Rs. ${Math.round(Number(productForm.retailPrice) / Number(unitsPerBox))}`}
                                sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}
                              />
                            )}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}
              </Paper>

              {/* CARD 4: Pricing & Inventory */}
              <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoney fontSize="small" sx={{ color: '#10b981' }} />
                    Pricing & Stock Levels
                  </Typography>
                  {/* Live Profit Margin Badge */}
                  {Number(productForm.costPrice) > 0 && Number(productForm.retailPrice) > 0 && (
                    <Chip 
                      size="small"
                      icon={<TrendingUp sx={{ fontSize: '14px !important', color: '#047857 !important' }} />}
                      label={`Profit: +Rs. ${Number(productForm.retailPrice) - Number(productForm.costPrice)} (${Math.round(((Number(productForm.retailPrice) - Number(productForm.costPrice)) / Number(productForm.costPrice)) * 100)}% margin)`}
                      sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 'bold', border: '1px solid #a7f3d0' }}
                    />
                  )}
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label={isBoxEntry ? "Box Cost Price" : "Cost Price"} 
                      name="costPrice" 
                      type="number" 
                      value={productForm.costPrice} 
                      onChange={handleProductChange} 
                      slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} 
                      placeholder="0.00"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label={isBoxEntry ? "Box Retail Price" : "Retail Price"} 
                      name="retailPrice" 
                      type="number" 
                      value={productForm.retailPrice} 
                      onChange={handleRetailPriceChange} 
                      slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} 
                      placeholder="0.00"
                      helperText={isBoxEntry && unitsPerBox ? `Per Unit: Rs. ${Math.round(Number(productForm.retailPrice) / Number(unitsPerBox) || 0)}` : ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label={isBoxEntry ? "Box Wholesale Price" : "Wholesale Price"} 
                      name="wholesalePrice" 
                      type="number" 
                      value={productForm.wholesalePrice} 
                      onChange={handleProductChange} 
                      slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} 
                      placeholder="0.00"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label={isBoxEntry ? "Total Stock (Auto-calculated)" : "Stock Quantity"} 
                      name="stock" 
                      type="number" 
                      value={productForm.stock} 
                      onChange={handleProductChange} 
                      disabled={isBoxEntry}
                      placeholder="0"
                      helperText={isBoxEntry ? `Auto: ${unitsPerBox || 0} × ${boxQuantity || 0} = ${Number(unitsPerBox || 0) * Number(boxQuantity || 0)} units` : 'Units currently available'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Min Stock Alert" 
                      name="minStock" 
                      type="number" 
                      value={productForm.minStock} 
                      onChange={handleProductChange} 
                      placeholder="5"
                      helperText="Alert trigger on low inventory"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Variant Name" 
                      name="variant_name" 
                      value={productForm.variant_name} 
                      onChange={handleProductChange} 
                      placeholder="Default" 
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* CARD 5: Type-Specific Details */}
              {dialogProductType === 'imei' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#1e40af" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PhoneAndroid fontSize="small" sx={{ color: '#2563eb' }} />
                    Mobile / IMEI Telemetry
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        multiline 
                        rows={3} 
                        label="IMEI Numbers (One per line)" 
                        name="imeiList" 
                        value={productForm.imeiList} 
                        onChange={handleProductChange} 
                        placeholder="358492091234567&#10;358492097654321"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Brand" name="mobile_brand" value={productForm.mobile_brand} onChange={handleProductChange} placeholder="Samsung, Apple" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Model" name="mobile_model" value={productForm.mobile_model} onChange={handleProductChange} placeholder="Galaxy S23, iPhone 14" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Storage" name="mobile_storage" value={productForm.mobile_storage} onChange={handleProductChange} placeholder="128GB, 256GB" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Color" name="mobile_color" value={productForm.mobile_color} onChange={handleProductChange} placeholder="Phantom Black" />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'medical' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #fecdd3', bgcolor: '#fff1f2' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#9f1239" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MedicalServices fontSize="small" sx={{ color: '#e11d48' }} />
                    Pharmacy / Medical Specifications
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Manufacturer / Lab" name="manufacturer" value={productForm.manufacturer} onChange={handleProductChange} placeholder="GSK, Abbott, Searle" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Generic / Chemical Name" name="generic_name" value={productForm.generic_name} onChange={handleProductChange} placeholder="Paracetamol, Omeprazole" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Supplier / Distributor" name="supplier_name" value={productForm.supplier_name} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Shelf / Rack Location" name="shelf_rack" value={productForm.shelf_rack} onChange={handleProductChange} placeholder="Rack A-4, Box 2" />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" multiline rows={2} label="Clinical Remarks / Instructions" name="remarks" value={productForm.remarks} onChange={handleProductChange} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'fabric' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e9d5ff', bgcolor: '#faf5ff' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#6b21a8" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Straighten fontSize="small" sx={{ color: '#9333ea' }} />
                    Fabric & Garment Specifications
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Fabric Length (Meters)" name="fabricLength" type="number" value={productForm.fabricLength} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Fabric Type" name="fabric_type" value={productForm.fabric_type} onChange={handleProductChange} placeholder="Cotton, Lawn, Silk, Wool" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Color / Shade" name="fabric_color" value={productForm.fabric_color} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Size (S, M, L, XL, Free Size)" name="fabric_size" value={productForm.fabric_size} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Stitch Type</InputLabel>
                        <Select name="stitch_type" value={productForm.stitch_type} onChange={handleProductChange} label="Stitch Type">
                          <MenuItem value="">None</MenuItem>
                          <MenuItem value="stitch">Stitched</MenuItem>
                          <MenuItem value="unstitch">Unstitched</MenuItem>
                          <MenuItem value="both">Both</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'grocery' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #fed7aa', bgcolor: '#fff7ed' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#9a3412" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LocalGroceryStore fontSize="small" sx={{ color: '#ea580c' }} />
                    Grocery & Food Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Weight (kg / grams)" name="weight" type="number" value={productForm.weight} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Expiry Date" name="expiryDate" type="date" value={productForm.expiryDate} onChange={handleProductChange} slotProps={{ inputLabel: { shrink: true } }} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Batch / Lot Number" name="batchNumber" value={productForm.batchNumber} onChange={handleProductChange} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'shoes' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Checkroom fontSize="small" sx={{ color: '#64748b' }} />
                    Footwear & Shoes Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Size (UK / US / Euro)" name="shoe_size" value={productForm.shoe_size} onChange={handleProductChange} placeholder="40, 41, 42, 9, 10" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Color" name="shoe_color" value={productForm.shoe_color} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Brand" name="shoe_brand" value={productForm.shoe_brand} onChange={handleProductChange} placeholder="Nike, Service, Bata" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Material" name="shoe_material" value={productForm.shoe_material} onChange={handleProductChange} placeholder="Leather, Mesh, Rubber" />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'bakery' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#92400e" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BakeryDining fontSize="small" sx={{ color: '#d97706' }} />
                    Bakery & Confectionery
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Weight (kg / grams)" name="weight" type="number" value={productForm.weight} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Expiry Date" name="expiryDate" type="date" value={productForm.expiryDate} onChange={handleProductChange} slotProps={{ inputLabel: { shrink: true } }} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Batch Number" name="batchNumber" value={productForm.batchNumber} onChange={handleProductChange} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" multiline rows={2} label="Ingredients" name="bakery_ingredients" value={productForm.bakery_ingredients} onChange={handleProductChange} placeholder="Flour, Sugar, Eggs, Chocolate..." />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {dialogProductType === 'wholesale' && (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Storefront fontSize="small" sx={{ color: '#10b981' }} />
                    Wholesale & Distribution Tiers
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Minimum Order Quantity (MOQ)" name="min_order_qty" type="number" value={productForm.min_order_qty} onChange={handleProductChange} placeholder="10" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Bulk Discount (%)" name="bulk_discount" type="number" value={productForm.bulk_discount} onChange={handleProductChange} slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} placeholder="5" />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* CARD 6: Description & Status */}
              <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      multiline 
                      rows={2} 
                      label="Product Notes & Description" 
                      name="description" 
                      value={productForm.description} 
                      onChange={handleProductChange} 
                      placeholder="Add any extra product details, warranty, or internal notes..."
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Product Status</InputLabel>
                      <Select name="status" value={productForm.status} onChange={handleProductChange} label="Product Status">
                        <MenuItem value="active">Active (Available for Sale)</MenuItem>
                        <MenuItem value="inactive">Inactive (Hidden from POS)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>

            </Stack>
          </DialogContent>

          {/* Sticky Modal Actions Footer */}
          <DialogActions sx={{ 
            px: isMobile ? 2 : 3, 
            py: 2, 
            bgcolor: '#ffffff', 
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            {!isMobile ? (
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                * Required fields must be completed before saving
              </Typography>
            ) : null}

            <Box sx={{ display: 'flex', gap: 1.5, width: isMobile ? '100%' : 'auto', justifyContent: 'flex-end' }}>
              <Button 
                fullWidth={isMobile} 
                variant="outlined" 
                onClick={() => setProductDialog(false)}
                sx={{ 
                  borderRadius: 2, 
                  px: 2.5, 
                  color: '#64748b', 
                  borderColor: '#cbd5e1',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' } 
                }}
              >
                Cancel
              </Button>
              <Button 
                fullWidth={isMobile} 
                type="submit" 
                variant="contained" 
                startIcon={<Save />} 
                sx={{ 
                  borderRadius: 2, 
                  px: 3.5, 
                  bgcolor: '#10b981', 
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                  '&:hover': { bgcolor: '#059669' } 
                }}
              >
                {editingProduct ? 'Update Product' : 'Save Product'}
              </Button>
            </Box>
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
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {variantImagePreview ? (
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Avatar 
                        src={variantImagePreview} 
                        variant="rounded" 
                        sx={{ width: 80, height: 80, border: '2px solid #10b981' }}
                      />
                      <IconButton 
                        size="small" 
                        sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
                        onClick={removeVariantImage}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box 
                      sx={{ 
                        width: 80, 
                        height: 80, 
                        border: '2px dashed #ccc', 
                        borderRadius: 2, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                        '&:hover': { borderColor: '#10b981' }
                      }}
                      onClick={() => variantFileInputRef.current?.click()}
                    >
                      <CloudUpload color="action" />
                    </Box>
                  )}
                  <Box>
                    <Button 
                      variant="outlined" 
                      component="label" 
                      startIcon={<CloudUpload />}
                      size="small"
                    >
                      Upload Variant Image
                      <input 
                        type="file" 
                        accept="image/*" 
                        hidden 
                        ref={variantFileInputRef}
                        onChange={handleVariantImageUpload} 
                      />
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      Max size: 2MB (JPG, PNG, GIF)
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="SKU" name="sku" value={variantForm.sku} onChange={handleVariantChange} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Variant Name" name="variantName" value={variantForm.variantName} onChange={handleVariantChange} placeholder="Red, XL, 128GB" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Cost Price" name="costPrice" type="number" value={variantForm.costPrice} onChange={handleVariantChange} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Retail Price" name="retailPrice" type="number" value={variantForm.retailPrice} onChange={handleVariantChange} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Wholesale Price" name="wholesalePrice" type="number" value={variantForm.wholesalePrice} onChange={handleVariantChange} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Stock" name="stock" type="number" value={variantForm.stock} onChange={handleVariantChange} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Barcode" name="barcode" value={variantForm.barcode} onChange={handleVariantChange} />
              </Grid>
              {(variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && (
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline rows={4} label="IMEI Numbers" name="imeiList" value={variantForm.imeiList} onChange={handleVariantChange} />
                </Grid>
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
      <Dialog 
        open={categoryDialog} 
        onClose={() => setCategoryDialog(false)} 
        maxWidth="sm" 
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Manage Categories</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box 
            component="form" 
            onSubmit={handleAddCategory} 
            sx={{ mb: 3, mt: 1 }}
            noValidate
            autoComplete="off"
          >
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} md={5}>
                <TextField 
                  fullWidth 
                  size="small" 
                  name="categoryName" 
                  label="Category Name" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  required 
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Parent</InputLabel>
                  <Select 
                    name="parent_id" 
                    value={newCategoryParent} 
                    onChange={(e) => setNewCategoryParent(e.target.value)} 
                    label="Parent"
                  >
                    <MenuItem value="">None</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth sx={{ bgcolor: '#10b981', height: '40px', fontWeight: 'bold' }}>Add</Button>
              </Grid>
            </Grid>
          </Box>
          <List dense sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {categories.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No categories found</Typography>
            )}
            {categories.map((cat) => (
              <ListItem key={cat.id} secondaryAction={
                can('inventory', 'delete') && (
                  <IconButton edge="end" color="error" onClick={() => handleDeleteCategory(cat.id)}>
                    <Delete />
                  </IconButton>
                )
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

      {/* BRAND DIALOG */}
      <Dialog 
        open={brandDialog} 
        onClose={() => setBrandDialog(false)} 
        maxWidth="sm" 
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle sx={{ bgcolor: '#1c2580', color: 'white' }}>Manage Brands</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box 
            component="form" 
            onSubmit={handleAddBrand} 
            sx={{ mb: 3, mt: 1 }}
            noValidate
            autoComplete="off"
          >
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} md={9}>
                <TextField 
                  fullWidth 
                  size="small" 
                  name="brandName" 
                  label="Brand Name" 
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Enter brand name"
                  required 
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth sx={{ bgcolor: '#10b981', height: '40px', fontWeight: 'bold' }}>Add</Button>
              </Grid>
            </Grid>
          </Box>
          <List dense sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {brands.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No brands added yet</Typography>
            )}
            {brands.map((brand) => (
              <ListItem key={brand.id} secondaryAction={
                can('inventory', 'delete') && (
                  <IconButton edge="end" color="error" onClick={() => handleDeleteBrand(brand.id)}>
                    <Delete />
                  </IconButton>
                )
              }>
                <ListItemText primary={brand.name} secondary={brand.status || 'Active'} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrandDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* UNIT DIALOG */}
      <Dialog open={unitDialog} onClose={() => setUnitDialog(false)} maxWidth="sm" fullWidth disableRestoreFocus>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>Manage Units</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box component="form" onSubmit={handleAddUnit} sx={{ mb: 3, mt: 1 }}>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} md={10}>
                <TextField 
                  fullWidth 
                  size="small" 
                  name="unitName" 
                  label="Unit Name" 
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Enter unit name (e.g. Kg, Box, Pcs)"
                  required 
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth sx={{ bgcolor: '#10b981', height: '40px', fontWeight: 'bold' }}>Add</Button>
              </Grid>
            </Grid>
          </Box>
          <List dense sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {units.map((unit) => (
              <ListItem key={unit} secondaryAction={
                can('inventory', 'delete') && (
                  <IconButton edge="end" color="error" onClick={() => {
                    const updated = units.filter(u => u !== unit);
                    setUnits(updated);
                    localStorage.setItem('custom_units', JSON.stringify(updated));
                    setSnackbar({ open: true, message: 'Unit removed!', severity: 'success' });
                  }}>
                    <Delete />
                  </IconButton>
                )
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

      {/* OFFER DIALOG */}
      <Dialog open={offerDialog} onClose={() => setOfferDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          {editingOffer ? 'Edit Offer' : 'Add New Offer'}
        </DialogTitle>
        <form onSubmit={handleSaveOffer}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={isMobile ? 1.5 : 2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Offer Name" value={offerForm.name} onChange={(e) => setOfferForm(prev => ({ ...prev, name: e.target.value }))} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Description" value={offerForm.description} onChange={(e) => setOfferForm(prev => ({ ...prev, description: e.target.value }))} />
              </Grid>
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
                <TextField fullWidth size="small" label="Discount Value" type="number" value={offerForm.discount_value} onChange={(e) => setOfferForm(prev => ({ ...prev, discount_value: e.target.value }))} slotProps={{ input: { startAdornment: <InputAdornment position="start">{offerForm.discount_type === 'percentage' ? '%' : 'Rs.'}</InputAdornment> } }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="Start Date" type="date" value={offerForm.start_date} onChange={(e) => setOfferForm(prev => ({ ...prev, start_date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} required />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="End Date" type="date" value={offerForm.end_date} onChange={(e) => setOfferForm(prev => ({ ...prev, end_date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
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

            <Grid container spacing={isMobile ? 1 : 2} sx={{ alignItems: 'flex-end' }}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select value={offerCategoryFilter} onChange={(e) => { setOfferCategoryFilter(e.target.value); setSelectedOfferProduct(null); setSelectedOfferVariant(null); }} label="Category">
                    <MenuItem value="">All</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
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
              <TextField fullWidth size="small" label="Custom Offer Price" type="number" value={offerVariantPrice} onChange={(e) => setOfferVariantPrice(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start">Rs.</InputAdornment> } }} sx={{ mt: 1 }} />
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1c2580' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Product</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Variant</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>SKU</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Original</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Offer Price</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Action</TableCell>
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

      {/* MOBILE DRAWER */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            {can('inventory', 'add') && (
              <ListItem button onClick={() => { setMobileDrawer(false); handleOpenProduct(); }}>
                <ListItemIcon><Add /></ListItemIcon>
                <ListItemText primary="Add Product" />
              </ListItem>
            )}
            <ListItem button onClick={() => { setMobileDrawer(false); setCategoryDialog(true); }}>
              <ListItemIcon><Category /></ListItemIcon>
              <ListItemText primary="Categories" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setBrandDialog(true); }}>
              <ListItemIcon><Branding /></ListItemIcon>
              <ListItemText primary="Brands" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setUnitDialog(true); }}>
              <ListItemIcon><Scale /></ListItemIcon>
              <ListItemText primary="Units" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* FAB BUTTONS - Mobile */}
      {isMobile && activeTab === 0 && can('inventory', 'add') && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16, bgcolor: '#10b981' }} onClick={() => handleOpenProduct()}>
          <Add />
        </Fab>
      )}
      {isMobile && activeTab === 1 && can('inventory', 'add') && (
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