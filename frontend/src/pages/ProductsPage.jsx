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
  PictureAsPdf, LocalPrintshop, MenuBook
} from '../components/ui/icons';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../database/db';
import api from '../api/apiClient';
import { useNavigate } from 'react-router-dom';
import useSyncListener from '../hooks/useSyncListener';
import UnifiedPagination from '../components/common/UnifiedPagination';
import { getDefaultProductType, getProductTypesForBusiness } from '../config/businessModules';
import ShoeVariantMatrix from '../components/shoes/ShoeVariantMatrix';
import ThaanFabricForm from '../components/garments/ThaanFabricForm';
import ReadymadeMatrix from '../components/garments/ReadymadeMatrix';
import GroceryModeForm from '../components/grocery/GroceryModeForm';
import BatchManager from '../components/grocery/BatchManager';
import PharmacyModeForm from '../components/pharmacy/PharmacyModeForm';
import BulkImeiForm from '../components/mobile/BulkImeiForm';
import ImeiLookupModal from '../components/mobile/ImeiLookupModal';
import { formatShoeStock, formatThaanStock, formatKurtaStock, formatLooseWeightStock, formatPharmacyStock, formatStationeryStock } from '../utils/stockFormat';
import StationeryModeForm from '../components/bookshop/StationeryModeForm';
import UniformSizeMatrix from '../components/bookshop/UniformSizeMatrix';
import BundleManager from '../components/bookshop/BundleManager';
import BarcodePrintModal from '../components/common/BarcodePrintModal';
import { printBarcodeJob } from '../utils/barcodeGenerator';

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
  { value: 'stationery', label: 'Stationery (Carton/Box/Piece)', icon: <Inventory fontSize="small" /> },
  { value: 'uniform', label: 'School Uniform (Size Matrix)', icon: <Checkroom fontSize="small" /> },
  { value: 'books', label: 'Books / Class Sets', icon: <MenuBook fontSize="small" /> },
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
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 2 }).format(amount || 0);
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
const MobileProductCard = ({ product, onEdit, onDelete, getTypeChip, getStockBadge, onAddVariant, onPrintBarcode, canEdit, canDelete, canAdd, renderParentStock }) => {
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
            {renderParentStock ? renderParentStock(product, Number(product.current_stock) || 0) : (
              <Typography variant="subtitle1" fontWeight="bold">
                {product.current_stock || 0}
              </Typography>
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

  // Filter product types by selected business type (from login page)
  const allowedProductTypes = React.useMemo(() => {
    const businessType = localStorage.getItem('raath_selected_business_type') || 'other';
    const allowed = getProductTypesForBusiness(businessType);
    return PRODUCT_TYPES.filter(t => allowed.includes(t.value));
  }, []);
  
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
  const { can, currentUser } = usePermissions();
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

  // ==================== NEW: CARTON > BOX > PIECE PACKAGING STATE ====================
  const [isBoxEntry, setIsBoxEntry] = useState(false);
  const [boxesPerCarton, setBoxesPerCarton] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [cartonQuantity, setCartonQuantity] = useState('');
  const [boxQuantity, setBoxQuantity] = useState('');
  const [loosePieces, setLoosePieces] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [boxPrice, setBoxPrice] = useState('');
  const [boxCostPrice, setBoxCostPrice] = useState('');

  // Box/Carton toggle sirf Wholesale ya Mart (Grocery/Kirana) business type wali shops mein dikhega.
  // Pehle se save ki hui box-product entry edit karte waqt card phir bhi visible rahega taake data orphan na ho.
  const shopBusinessType = String(currentUser?.business_type || 'retail').toLowerCase();
  const showBoxEntryCard = true; // Always show — user requested Unit/Box toggle for Standard products too

  // Shoes vertical: Color x Size matrix se aane wale variants
  const [shoeVariants, setShoeVariants] = useState([]);
  const [shoeCartonInfo, setShoeCartonInfo] = useState(null);
  const handleShoeVariants = useCallback((v, info) => { setShoeVariants(v); setShoeCartonInfo(info || null); }, []);
  // Garments vertical: thaan + readymade
  const [thaanData, setThaanData] = useState(null);
  const handleThaanData = useCallback((d) => setThaanData(d), []);
  const [readymadeVariants, setReadymadeVariants] = useState([]);
  // Bookshop vertical: stationery 3-level + uniforms size matrix + bundles
  const [stationeryData, setStationeryData] = useState(null);
  const handleStationeryData = useCallback((d) => setStationeryData(d), []);
  const [uniformSchool, setUniformSchool] = useState('');
  const [uniformItem, setUniformItem] = useState('Shirt');
  const [uniformVariants, setUniformVariants] = useState([]);
  const [uniformTotalQty, setUniformTotalQty] = useState(0);
  const handleUniformVariants = useCallback((v, total) => { setUniformVariants(v); setUniformTotalQty(total || 0); }, []);
  const [bundleManagerOpen, setBundleManagerOpen] = useState(false);
  const [bookClass, setBookClass] = useState('');
  const [bookSubject, setBookSubject] = useState('');
  const [bookPublisher, setBookPublisher] = useState('');
  const [readymadeBoxInfo, setReadymadeBoxInfo] = useState(null);
  const handleReadymadeVariants = useCallback((v, info) => { setReadymadeVariants(v); setReadymadeBoxInfo(info || null); }, []);
  const handleThaanPrice = useCallback((field, val) => {
    setProductForm(prev => ({ ...prev, [field]: val }));
  }, []);
  // Grocery vertical
  const [groceryData, setGroceryData] = useState(null);
  const handleGroceryData = useCallback((d) => setGroceryData(d), []);
  const [batchProduct, setBatchProduct] = useState(null);
  // Pharmacy vertical
  const [pharmacyData, setPharmacyData] = useState(null);
  const handlePharmacyData = useCallback((d) => setPharmacyData(d), []);
  const [imeiLookupOpen, setImeiLookupOpen] = useState(false);

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
  // type ka default shop ke business_type se aata hai (mobile→imei, kapra→fabric...)
  const [productForm, setProductForm] = useState(() => {
    const defType = getDefaultProductType();
    const defUnits = (typeof UNITS_BY_TYPE !== 'undefined' && UNITS_BY_TYPE[defType]) || DEFAULT_UNITS;
    return {
    name: '', sku: '', type: defType, category_id: '', unit: defUnits[0] || 'Piece',
    costPrice: '', retailPrice: '', wholesalePrice: '', barcode: '',
    article_no: '', season: '', rack_location: '', minSalePrice: '', discount: '',
    stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
    weight: '', expiryDate: '', batchNumber: '', description: '',
    status: 'active', variant_name: 'Default',
    manufacturer: '', generic_name: '', supplier_name: '', shelf_rack: '', remarks: '',
    shoe_size: '', shoe_color: '', shoe_brand: '', shoe_material: '',
    bakery_ingredients: '',
    min_order_qty: '', bulk_discount: '',
    fabric_type: '', fabric_color: '', fabric_size: '', stitch_type: '',
    garment_mode: 'THAAN_FABRIC', thaan_color: '', thaanCostPerM: '', thaanSalePerM: '', thaanMinPerM: '',
    mobile_brand: '', mobile_model: '', mobile_storage: '', mobile_color: '',
    box_qty: '', packs_per_box: '', units_per_pack: '',
    image_url: '',
    image_file: null,
    is_box_product: false,
    units_per_box: '',
    box_quantity: '',
    };
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
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeModalProduct, setBarcodeModalProduct] = useState(null);

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
          name: p.name || p.product_name || '',
          product_name: p.product_name || p.name || '',
          category_name: categoryMap[catId] || p.category_name || '-',
          id: p.id || p.variant_id || p.variantId,
          stock: Number(p.stock !== undefined ? p.stock : p.current_stock) || 0,
          current_stock: Number(p.current_stock !== undefined ? p.current_stock : p.stock) || 0,
          retail_price: Number(p.retail_price || p.sale_price || 0),
          sale_price: Number(p.sale_price || p.retail_price || 0),
          is_box_product: meta.is_box_product || false,
          units_per_box: meta.units_per_box || 0,
          box_qty: meta.box_quantity || 0,
          unit_price: meta.unit_price || 0,
          pairs_per_carton: meta.pairs_per_carton || 0,
          article_no: p.article_no || meta.article_no || '',
          garment_mode: meta.garment_mode || '',
          thaan_suit_meters: meta.thaan_suit_meters || 4,
          rm_pieces_per_box: meta.pieces_per_box || 0,
          grocery_mode: meta.grocery_mode || '',
          grams_per_sack: meta.grams_per_sack || 0,
          units_per_box_or_pet: meta.units_per_box_or_pet || 0,
          pharmacy_mode: meta.pharmacy_mode || '',
          strips_per_box: meta.strips_per_box || 0,
          units_per_strip: meta.units_per_strip || 0,
          cold_chain: !!meta.cold_chain,
          rx_required: !!meta.rx_required,
          stationery_mode: meta.stationery_mode || '',
          boxes_per_carton: meta.boxes_per_carton || 0,
          pieces_per_box: meta.pieces_per_box || meta.units_per_box || 0,
          book_class: meta.book_class || '',
          book_subject: meta.book_subject || '',
          book_publisher: meta.book_publisher || ''
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

  // Vertical stock display: shoes / garments (thaan, box suit, readymade)
  const renderParentStock = (parent, totalStock) => {
    const color = getStockColor(totalStock, parent.stock_alert_quantity);
    const ptype = parent.product_type || parent.type;
    if (parent.is_box_product && parent.units_per_box > 0) {
      return (
        <Box>
          <Typography fontWeight="bold" color={color}>
            {Math.floor(totalStock / parent.units_per_box)} boxes
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({totalStock} {parent.base_unit || parent.unit || 'units'})
          </Typography>
        </Box>
      );
    }
    if (ptype === 'shoes' && parent.pairs_per_carton > 0) {
      return <Typography fontWeight="bold" color={color}>{formatShoeStock(totalStock, parent.pairs_per_carton)}</Typography>;
    }
    if (ptype === 'stationery' && (parent.boxes_per_carton > 0 || parent.pieces_per_box > 0)) {
      const label = (parent.product_name || parent.name || 'Pcs').split(' ').slice(-1)[0] + 's';
      return <Typography fontWeight="bold" color={color}>{formatStationeryStock(totalStock, parent.boxes_per_carton, parent.pieces_per_box, label)}</Typography>;
    }
    if ((ptype === 'fabric' || ptype === 'cloth') && parent.garment_mode === 'THAAN_FABRIC') {
      const fmt = formatThaanStock(totalStock, parent.thaan_suit_meters || 4);
      return (
        <Box>
          <Typography fontWeight="bold" color={color}>{fmt.text}</Typography>
          {fmt.isCutPiece && (
            <Chip size="small" color="warning" label="Cut-Piece" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold', mt: 0.5 }} />
          )}
        </Box>
      );
    }
    if ((ptype === 'fabric' || ptype === 'cloth') && parent.garment_mode === 'BOX_SUIT') {
      return <Typography fontWeight="bold" color={color}>{totalStock} Suits (Boxes)</Typography>;
    }
    if ((ptype === 'fabric' || ptype === 'cloth') && parent.garment_mode === 'READYMADE_STITCHED' && parent.rm_pieces_per_box > 0) {
      return <Typography fontWeight="bold" color={color}>{formatKurtaStock(totalStock, parent.rm_pieces_per_box)}</Typography>;
    }
    if (ptype === 'grocery' && parent.grocery_mode === 'WEIGHT_LOOSE') {
      return <Typography fontWeight="bold" color={color}>{formatLooseWeightStock(totalStock, parent.grams_per_sack)}</Typography>;
    }
    if (ptype === 'grocery' && parent.grocery_mode === 'PACKED_UNIT' && parent.units_per_box_or_pet > 0) {
      const upb = parent.units_per_box_or_pet;
      const boxes = Math.floor(totalStock / upb);
      const loose = totalStock % upb;
      const txt = boxes === 0 ? `${loose} Pcs` : loose === 0 ? `${boxes} Boxes (${totalStock} Pcs)` : `${boxes} Boxes, ${loose} Pcs (${totalStock} Total)`;
      return <Typography fontWeight="bold" color={color}>{txt}</Typography>;
    }
    if (ptype === 'medical' && parent.pharmacy_mode) {
      return (
        <Box>
          <Typography fontWeight="bold" color={color}>
            {formatPharmacyStock(totalStock, parent.pharmacy_mode, parent.strips_per_box, parent.units_per_strip)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {parent.rx_required && <Chip size="small" color="error" label="Rx" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }} />}
            {parent.cold_chain && <Chip size="small" color="info" label="Fridge" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }} />}
          </Box>
        </Box>
      );
    }
    return <Typography fontWeight="bold" color={color}>{totalStock}</Typography>;
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
          `Rs. ${salePrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  // ====== PRINT BARCODE LABEL (ZERO-WASTE MULTI-COLUMN ENGINE) ======
  const handlePrintBarcode = (product, options = {}) => {
    if (!product || !product.barcode) {
      setSnackbar({ open: true, message: 'Is product ka barcode nahi hai! Please product edit karke barcode add ya generate karein.', severity: 'warning' });
      return;
    }

    if (options && options.directPrint) {
      printBarcodeJob(product, options)
        .then(res => {
          if (res?.success) {
            setSnackbar({ open: true, message: `Printed ${res.totalQuantity} barcode label(s) across ${res.totalRows} row(s)!`, severity: 'success' });
          }
        })
        .catch(err => {
          setSnackbar({ open: true, message: err?.message || 'Print failed', severity: 'error' });
        });
      return;
    }

    setBarcodeModalProduct(product);
    setBarcodeModalOpen(true);
  };

  const handleAutoBarcode = () => {
    const newBarcode = generateBarcode();
    setProductForm(prev => ({ ...prev, barcode: newBarcode }));
  };

  const resetProductForm = useCallback(() => {
    const last = JSON.parse(localStorage.getItem('last_product_defaults') || '{}');
    const defType = last.type || getDefaultProductType();
    const defaultUnits = UNITS_BY_TYPE[defType] || DEFAULT_UNITS;
    setProductForm({
      name: '', sku: '', type: defType, category_id: last.category_id || '',
      unit: defaultUnits[0] || 'Piece', costPrice: '', retailPrice: '', wholesalePrice: '',
      barcode: '', article_no: '', season: '', rack_location: '', minSalePrice: '', discount: '',
      stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
      weight: '', expiryDate: '', batchNumber: '', description: '', status: 'active', 
      variant_name: 'Default',
      manufacturer: '', generic_name: '', supplier_name: '', shelf_rack: '', remarks: '',
      shoe_size: '', shoe_color: '', shoe_brand: '', shoe_material: '',
      bakery_ingredients: '',
      min_order_qty: '', bulk_discount: '',
      fabric_type: '', fabric_color: '', fabric_size: '', stitch_type: '',
    garment_mode: 'THAAN_FABRIC', thaan_color: '', thaanCostPerM: '', thaanSalePerM: '', thaanMinPerM: '',
      mobile_brand: '', mobile_model: '', mobile_storage: '', mobile_color: '',
      box_qty: '', packs_per_box: '', units_per_pack: '',
      image_url: '',
      image_file: null,
      is_box_product: false,
      units_per_box: '',
      box_quantity: '',
    });
    setImagePreview(null);
    setDialogProductType(defType);
    setShoeVariants([]);
    setThaanData(null);
    setReadymadeVariants([]);
    setStationeryData(null);
    setUniformSchool(''); setUniformItem('Shirt');
    setUniformVariants([]); setUniformTotalQty(0);
    setBookClass(''); setBookSubject(''); setBookPublisher('');
    setReadymadeBoxInfo(null);
    setGroceryData(null);
    setBatchProduct(null);
    setPharmacyData(null);
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
        units_per_box: meta.units_per_box || meta.pieces_per_box || product.pieces_per_box || '',
        box_quantity: meta.box_quantity || '',
      });
      
      if (isBox) {
        setBoxesPerCarton(meta.boxes_per_carton || product.boxes_per_carton || '');
        setUnitsPerBox(meta.units_per_box || meta.pieces_per_box || product.pieces_per_box || '');
        setCartonQuantity(meta.carton_quantity || product.carton_qty || '');
        setBoxQuantity(meta.box_quantity || '');
        setLoosePieces(meta.loose_pieces || '');
        setCartonPrice(meta.carton_price || product.carton_price || '');
        setBoxPrice(meta.box_price || product.box_price || '');
      } else {
        setBoxesPerCarton('');
        setUnitsPerBox('');
        setCartonQuantity('');
        setBoxQuantity('');
        setLoosePieces('');
        setCartonPrice('');
        setBoxPrice('');
      }
    } else { 
      resetProductForm(); 
      setImagePreview(null);
      setIsBoxEntry(false);
      setBoxesPerCarton('');
      setUnitsPerBox('');
      setCartonQuantity('');
      setBoxQuantity('');
      setLoosePieces('');
      setCartonPrice('');
      setBoxPrice('');
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
      if (name === 'brand') {
        const matched = brands.find(b => b.name === value);
        updated.brand_id = matched ? matched.id : null;
      }
      return updated;
    });
    if (name === 'type') setDialogProductType(value);
  };

  // ==================== CARTON > BOX > PIECE PACKAGING HANDLERS ====================
  const recalculatePackagingStock = (cQty, bpc, ppb, bQty, pQty) => {
    const c = Number(cQty) || 0;
    const bpC = Number(bpc) || 0;
    const ppB = Number(ppb) || 0;
    const b = Number(bQty) || 0;
    const p = Number(pQty) || 0;

    let total = 0;
    if (bpC > 0 && ppB > 0) {
      total = (c * bpC * ppB) + (b * ppB) + p;
    } else if (ppB > 0) {
      total = (b * ppB) + p;
    } else {
      total = p;
    }
    setProductForm(prev => ({ ...prev, stock: total.toString() }));
  };

  const handleBoxEntryToggle = (e) => {
    const checked = e.target.checked;
    setIsBoxEntry(checked);
    setProductForm(prev => ({
      ...prev,
      is_box_product: checked
    }));
    if (!checked) {
      setBoxesPerCarton('');
      setUnitsPerBox('');
      setCartonQuantity('');
      setBoxQuantity('');
      setLoosePieces('');
      setCartonPrice('');
      setBoxPrice('');
    }
  };

  const handleBoxesPerCartonChange = (e) => {
    const val = e.target.value;
    setBoxesPerCarton(val);
    recalculatePackagingStock(cartonQuantity, val, unitsPerBox, boxQuantity, loosePieces);
  };

  const handleUnitsPerBoxChange = (e) => {
    const val = e.target.value;
    setUnitsPerBox(val);
    setProductForm(prev => ({ ...prev, units_per_box: val }));
    recalculatePackagingStock(cartonQuantity, boxesPerCarton, val, boxQuantity, loosePieces);
  };

  const handleCartonQuantityChange = (e) => {
    const val = e.target.value;
    setCartonQuantity(val);
    recalculatePackagingStock(val, boxesPerCarton, unitsPerBox, boxQuantity, loosePieces);
  };

  const handleBoxQuantityChange = (e) => {
    const val = e.target.value;
    setBoxQuantity(val);
    setProductForm(prev => ({ ...prev, box_quantity: val }));
    recalculatePackagingStock(cartonQuantity, boxesPerCarton, unitsPerBox, val, loosePieces);
  };

  const handleLoosePiecesChange = (e) => {
    const val = e.target.value;
    setLoosePieces(val);
    recalculatePackagingStock(cartonQuantity, boxesPerCarton, unitsPerBox, boxQuantity, val);
  };

  const handleRetailPriceChange = (e) => {
    const val = e.target.value;
    setProductForm(prev => ({ ...prev, retailPrice: val }));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    // Whole-handler guard: NOTHING in product save may ever fail silently.
    // Any unexpected error is surfaced in the snackbar (and console).
    try {
    if (editingProduct && !can('inventory', 'edit')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot edit products!', severity: 'error' });
      return;
    }
    if (!editingProduct && !can('inventory', 'add')) {
      setSnackbar({ open: true, message: 'Permission Denied: Cannot add products!', severity: 'error' });
      return;
    }
    const sku = (productForm.sku || '').trim();
    if (!(productForm.name || '').trim() || !sku) {
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
    
    // ====== CARTON > BOX > PIECE ENTRY HANDLING ======
    if (isBoxEntry) {
      const ppB = Number(unitsPerBox) || 0;
      const b = Number(boxQuantity) || 0;
      const boxCost = Number(boxCostPrice) || 0;
      const boxSale = Number(boxPrice) || 0;

      meta.is_box_product = true;
      meta.units_per_box = ppB;
      meta.pieces_per_box = ppB;
      meta.box_quantity = b;
      meta.box_cost_price = boxCost;
      meta.box_price = boxSale;
      // Auto per-unit prices from box prices
      if (ppB > 0) {
        if (boxCost > 0) productForm.costPrice = (boxCost / ppB).toFixed(2);
        if (boxSale > 0) productForm.retailPrice = (boxSale / ppB).toFixed(2);
      }
      meta.piece_price = Number(productForm.retailPrice) || retail;

      // Simple: boxes × units per box = total units
      const calcTotalStock = (b * ppB) || Number(productForm.stock) || 0;
      productForm.stock = calcTotalStock.toString();
    } else {
      meta.is_box_product = false;
      meta.is_carton_product = false;
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
      meta.garment_mode = productForm.garment_mode || 'THAAN_FABRIC';
      if (thaanData) {
        meta.thaan_suit_meters = thaanData.suitMeters;
        meta.thaan_color = thaanData.color || '';
      }
      if (readymadeBoxInfo?.boxMode && readymadeBoxInfo.piecesPerBox > 0) {
        meta.pieces_per_box = readymadeBoxInfo.piecesPerBox;
        meta.master_box = true;
      }
    }
    if (productForm.type === 'grocery' || productForm.type === 'bakery') {
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }
    if (productForm.type === 'grocery' && groceryData) {
      const g = groceryData;
      meta.grocery_mode = g.mode;
      meta.urdu_name = g.urduName || '';
      meta.aisle = g.aisle || '';
      if (g.mode === 'WEIGHT_LOOSE') {
        meta.grams_per_sack = g.gramsPerSack;
        meta.cost_per_sack = g.costPerSack;
      }
      if (g.mode === 'PACKED_UNIT') {
        meta.units_per_box_or_pet = g.unitsPerBox;
        meta.wholesale_box_price = g.wholesaleBoxPrice;
      }
    }
    if (productForm.type === 'medical') {
      meta.manufacturer = productForm.manufacturer || '';
      meta.generic_name = productForm.generic_name || '';
      meta.supplier_name = productForm.supplier_name || '';
      meta.shelf_rack = productForm.shelf_rack || '';
      meta.remarks = productForm.remarks || '';
      if (pharmacyData) {
        const ph = pharmacyData;
        meta.pharmacy_mode = ph.mode;
        meta.generic_name = ph.genericName || meta.generic_name;
        meta.dosage_form = ph.dosageForm || '';
        meta.strength = ph.strength || '';
        meta.manufacturer = ph.manufacturer || meta.manufacturer;
        meta.shelf_rack = ph.rack || meta.shelf_rack;
        meta.cold_chain = !!ph.coldChain;
        meta.rx_required = !!ph.rxRequired;
        meta.boxes_per_carton = ph.boxesPerCarton || 0;
        meta.strips_per_box = ph.stripsPerBox || 0;
        meta.units_per_strip = ph.unitsPerStrip || 0;
        meta.units_per_box = ph.unitsPerBox || 0;
      }
    }
    if (productForm.type === 'shoes') {
      meta.shoe_size = productForm.shoe_size || '';
      meta.shoe_color = productForm.shoe_color || '';
      meta.shoe_brand = productForm.shoe_brand || productForm.brand || '';
      meta.shoe_material = productForm.shoe_material || '';
      meta.discount = productForm.discount || '';
      if (shoeCartonInfo?.cartonMode && shoeCartonInfo.pairsPerCarton > 0) {
        meta.pairs_per_carton = shoeCartonInfo.pairsPerCarton;
        meta.carton_assortment = true;
      }
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

    // Thaan: stock HAMESHA meters (Float) mein
    // (isThaan declared here — BEFORE first use — to avoid TDZ ReferenceError)
    const isThaan = (productForm.type === 'fabric' || productForm.type === 'cloth') && productForm.garment_mode === 'THAAN_FABRIC';
    if (isThaan && thaanData && thaanData.meters > 0) {
      finalStock = +thaanData.meters.toFixed(2);
    }
    // Grocery: mode stock (bakery = 0, batch add karegi)
    // (groceryStock declared BEFORE first use — was a TDZ ReferenceError)
    let groceryUnit = null, groceryStock = null;
    if (groceryStock != null) finalStock = groceryStock;

    // Set variant name for box products
    let variantName = productForm.variant_name || 'Default';
    if (isBoxEntry && productForm.units_per_box && productForm.box_quantity) {
      variantName = `Box: ${productForm.box_quantity} × ${productForm.units_per_box} units`;
    }
    
    // For box products, store UNIT prices (box price / units per box)
    let unitCost = Number(productForm.costPrice) || 0;
    let unitRetail = Number(productForm.retailPrice) || 0;
    let unitWholesale = Number(productForm.wholesalePrice) || 0;

    // Garments: THAAN_FABRIC — prices per meter, stock in meters (Float)
    if (isThaan && thaanData) {
      unitCost = Number(thaanData.costPerMeter) || 0;
      unitRetail = Number(thaanData.salePerMeter) || 0;
      unitWholesale = unitRetail;
    }

    // Pharmacy: per-smallest-unit pricing, stock via batch (FEFO)
    const isPharmacyNew = productForm.type === 'medical' && pharmacyData;
    let pharmacyUnit = null;
    if (isPharmacyNew) {
      const ph = pharmacyData;
      pharmacyUnit = ph.mode === 'THREE_LEVEL' ? 'tablet' : ph.mode === 'TWO_LEVEL' ? 'piece' : 'unit';
      unitCost = ph.costPerUnit || 0;
      unitRetail = ph.salePerUnit || 0;
      unitWholesale = ph.salePerUnit || 0;
    }

    // Grocery: mode-specific unit/pricing/stock (DB: grams Int / packs Int / pieces Int)
    const isGroceryNew = productForm.type === 'grocery' && groceryData;
    if (isGroceryNew) {
      const g = groceryData;
      if (g.mode === 'WEIGHT_LOOSE') {
        groceryUnit = 'gram';
        groceryStock = g.totalGrams;
        unitCost = g.costPerKg; unitRetail = g.retailPerKg;
        unitWholesale = g.wholesalePerKg > 0 ? g.wholesalePerKg : g.retailPerKg;
      } else if (g.mode === 'PACKED_UNIT') {
        groceryUnit = 'pack';
        groceryStock = g.totalUnits;
        unitCost = g.costPerUnit; unitRetail = g.retailPerUnit;
        unitWholesale = (g.wholesaleBoxPrice > 0 && g.unitsPerBox > 0)
          ? +(g.wholesaleBoxPrice / g.unitsPerBox).toFixed(2) : g.retailPerUnit;
      } else if (g.mode === 'FRESH_BAKERY') {
        groceryUnit = 'piece';
        groceryStock = 0; // batch add karegi stock (double-count se bachne ke liye)
      }
    }

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
      unit: pharmacyUnit || groceryUnit || (isThaan ? 'meter' : productForm.unit),
      sku: sku || null,
      barcode: (isGroceryNew && groceryData.barcode) || productForm.barcode || null,
      purchase_price: unitCost,
      sale_price: unitRetail,
      retail_price: unitRetail,
      wholesale_price: unitWholesale,
      min_price: isThaan ? (Number(thaanData?.minPerMeter) || unitRetail) : (Number(productForm.minSalePrice) || unitRetail),
      article_no: productForm.article_no || null,
      season: productForm.season || null,
      rack_location: productForm.rack_location || null,
      stock: finalStock,
      min_stock: Number(productForm.minStock) || 5,
      tax_type: 'inclusive',
      tax_rate: 0,
      description: JSON.stringify(meta),
      status: productForm.status,
      image_url: productForm.image_url || null,
      carton_qty: Number(cartonQuantity) || 0,
      boxes_per_carton: Number(boxesPerCarton) || 0,
      pieces_per_box: Number(unitsPerBox) || 0,
      carton_price: Number(cartonPrice) || 0,
      box_price: Number(boxPrice) || 0,
      expiry_date: productForm.expiryDate || null,
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
      // SHOES: Article + Color/Size matrix → 1 product + N variants (single POST)
      if (!editingProduct && productForm.type === 'shoes' && shoeVariants.length > 0) {
        if (!productForm.article_no || !productForm.article_no.trim()) {
          setSnackbar({ open: true, message: 'Article Number zaroori hai', severity: 'warning' });
          return;
        }
        const totalPairs = shoeVariants.reduce((s, v) => s + (Number(v.qty) || 0), 0);
        const shoePayload = {
          ...productData,
          stock: totalPairs,
          sku: shoeVariants[0].sku,
          variants: shoeVariants.map(v => ({
            variant_name: v.variant_name,
            sku: v.sku,
            barcode: v.barcode || v.sku,
            color: v.color,
            size: v.size,
            article_no: productForm.article_no.trim(),
            purchase_price: v.purchase_price,
            retail_price: v.retail_price,
            sale_price: v.sale_price,
            minimum_retail_price: v.minimum_retail_price,
            stock: v.qty,
            current_stock: v.qty,
            stock_alert_quantity: v.stock_alert_quantity,
          })),
        };
        await db.addProduct(shoePayload);
        setSnackbar({ open: true, message: `Article ${productForm.article_no}: ${shoeVariants.length} variants, ${totalPairs} pairs saved`, severity: 'success' });
        localStorage.setItem('last_product_defaults', JSON.stringify({ type: 'shoes', category_id: productForm.category_id, unit: productForm.unit }));
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        setIsBoxEntry(false);
        setUnitsPerBox('');
        setBoxQuantity('');
        return;
      }
      // GARMENTS READYMADE: Article + Color/Size matrix → 1 product + N variants (single POST)
      const isReadymade = (productForm.type === 'fabric' || productForm.type === 'cloth') && productForm.garment_mode === 'READYMADE_STITCHED';
      if (!editingProduct && isReadymade && readymadeVariants.length > 0) {
        if (!productForm.article_no || !productForm.article_no.trim()) {
          setSnackbar({ open: true, message: 'Article Number zaroori hai', severity: 'warning' });
          return;
        }
        const totalPcs = readymadeVariants.reduce((s, v) => s + (Number(v.qty) || 0), 0);
        const rmPayload = {
          ...productData,
          stock: totalPcs,
          sku: readymadeVariants[0].sku,
          variants: readymadeVariants.map(v => ({
            variant_name: v.variant_name,
            sku: v.sku,
            barcode: v.barcode || v.sku,
            color: v.color,
            size: v.size,
            article_no: productForm.article_no.trim(),
            purchase_price: v.purchase_price,
            retail_price: v.retail_price,
            sale_price: v.sale_price,
            minimum_retail_price: v.minimum_retail_price,
            stock: v.qty,
            current_stock: v.qty,
            stock_alert_quantity: v.stock_alert_quantity,
          })),
        };
        await db.addProduct(rmPayload);
        setSnackbar({ open: true, message: `Article ${productForm.article_no}: ${readymadeVariants.length} variants, ${totalPcs} pieces saved`, severity: 'success' });
        localStorage.setItem('last_product_defaults', JSON.stringify({ type: 'fabric', category_id: productForm.category_id, unit: productForm.unit }));
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        setIsBoxEntry(false);
        setUnitsPerBox('');
        setBoxQuantity('');
        return;
      }
      // BOOKSHOP UNIFORM: School + Item + Size matrix → 1 product + N size variants (single POST)
      if (!editingProduct && productForm.type === 'uniform' && uniformVariants.length > 0) {
        if (!uniformSchool.trim()) {
          setSnackbar({ open: true, message: 'School Name zaroori hai', severity: 'warning' });
          return;
        }
        const uniPayload = {
          ...productData,
          name: `${uniformSchool.trim()} ${uniformItem}`,
          stock: uniformTotalQty,
          sku: uniformVariants[0].sku,
          variants: uniformVariants.map(v => ({
            variant_name: v.variant_name,
            sku: v.sku,
            barcode: v.barcode || v.sku,
            size: v.size,
            purchase_price: v.purchase_price,
            retail_price: v.retail_price,
            sale_price: v.sale_price,
            minimum_retail_price: v.minimum_retail_price,
            stock: v.quantity,
            current_stock: v.quantity,
            stock_alert_quantity: v.low_stock_threshold,
            attributes: v.attributes,
          })),
        };
        await db.addProduct(uniPayload);
        setSnackbar({ open: true, message: `${uniformSchool} ${uniformItem}: ${uniformVariants.length} sizes, ${uniformTotalQty} pcs saved`, severity: 'success' });
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        setUniformSchool(''); setUniformItem('Shirt');
        setUniformVariants([]); setUniformTotalQty(0);
        return;
      }
      // BOOKSHOP STATIONERY: 3-level packing → 1 product, stock in pieces, packaging meta
      if (!editingProduct && productForm.type === 'stationery' && stationeryData) {
        const sd = stationeryData;
        meta.is_stationery = true;
        meta.stationery_mode = 'THREE_LEVEL';
        meta.boxes_per_carton = sd.boxesPerCarton;
        meta.pieces_per_box = sd.piecesPerBox;
        meta.units_per_box = sd.piecesPerBox;
        meta.box_price = sd.boxPrice;
        meta.carton_price = sd.cartonPrice;
        meta.piece_price = sd.piecePrice;
        meta.is_carton_product = sd.boxesPerCarton > 1;
        meta.is_box_product = sd.piecesPerBox > 1;
        productData.description = JSON.stringify(meta);
        productData.stock = sd.stockPieces;
        productData.unit = 'Piece';
        if (sd.piecePrice > 0) productData.retail_price = sd.piecePrice;
        await db.addProduct(productData);
        setSnackbar({ open: true, message: `Stationery saved: ${formatStationeryStock(sd.stockPieces, sd.boxesPerCarton, sd.piecesPerBox, productData.name.split(' ').slice(-1)[0] || 'Pcs')}`, severity: 'success' });
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        setStationeryData(null);
        return;
      }
      // BOOKSHOP BOOKS: class/subject/publisher meta → standard product
      if (productForm.type === 'books' && (bookClass || bookSubject || bookPublisher)) {
        meta.is_book = true;
        meta.book_class = bookClass;
        meta.book_subject = bookSubject;
        meta.book_publisher = bookPublisher;
        productData.description = JSON.stringify(meta);
      }
      // GROCERY PACKED: quick price variants → 1 product + N variants
      if (!editingProduct && isGroceryNew && groceryData.mode === 'PACKED_UNIT' && groceryData.quickVariants.length > 0) {
        const qv = groceryData.quickVariants;
        const totalU = qv.reduce((s, v) => s + (Number(v.qty) || 0), 0);
        const gPayload = {
          ...productData,
          stock: totalU,
          variants: qv.map((v, i) => ({
            variant_name: `${productForm.name} ${v.label}`,
            sku: v.barcode || `${productForm.barcode || 'PK'}-${i + 1}`,
            barcode: v.barcode || null,
            purchase_price: unitCost,
            retail_price: v.price,
            sale_price: v.price,
            minimum_retail_price: v.price,
            stock: Number(v.qty) || 0,
            current_stock: Number(v.qty) || 0,
            stock_alert_quantity: 5,
          })),
        };
        await db.addProduct(gPayload);
        setSnackbar({ open: true, message: `${qv.length} price variants saved (${totalU} units)`, severity: 'success' });
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        return;
      }
      // GROCERY BAKERY: product + variant (0 stock) → batch add (expiry + stock)
      if (!editingProduct && isGroceryNew && groceryData.mode === 'FRESH_BAKERY') {
        const g = groceryData;
        if (!(g.bakeryQty > 0) || !g.expiryDate) {
          setSnackbar({ open: true, message: 'Quantity aur Expiry Date zaroori hai', severity: 'warning' });
          return;
        }
        const prodResult = await db.addProduct({ ...productData, stock: 0 });
        const productId = prodResult?.id || prodResult?.lastInsertRowid || prodResult?.data?.id;
        const varResult = await db.addVariant({ ...variantData, product_id: productId, current_stock: 0, expiry_date: g.expiryDate });
        const variantId = varResult?.id || varResult?.lastInsertRowid || varResult?.data?.id || productId;
        await api.post(`/products/${productId}/batches`, {
          expiry_date: g.expiryDate,
          qty: g.bakeryQty,
          cost_price: unitCost,
          sale_price: unitRetail,
          variant_id: variantId,
        });
        setSnackbar({ open: true, message: `Bakery stock saved: ${g.bakeryQty} pcs (exp ${g.expiryDate})`, severity: 'success' });
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        return;
      }
      // PHARMACY: product + variant (0 stock) → batch add (expiry + FEFO stock)
      if (!editingProduct && isPharmacyNew) {
        const ph = pharmacyData;
        if (!ph.genericName || !ph.genericName.trim()) {
          setSnackbar({ open: true, message: 'Generic / Salt name zaroori hai', severity: 'warning' });
          return;
        }
        if (!(ph.totalUnits > 0)) {
          setSnackbar({ open: true, message: 'Stock quantity zaroori hai', severity: 'warning' });
          return;
        }
        if (!ph.expiry) {
          setSnackbar({ open: true, message: 'Expiry date zaroori hai', severity: 'warning' });
          return;
        }
        const prodResult = await db.addProduct({ ...productData, stock: 0 });
        const productId = prodResult?.id || prodResult?.lastInsertRowid || prodResult?.data?.id;
        const varResult = await db.addVariant({ ...variantData, product_id: productId, current_stock: 0 });
        const variantId = varResult?.id || varResult?.lastInsertRowid || varResult?.data?.id || productId;
        await api.post(`/products/${productId}/batches`, {
          variant_id: variantId,
          batch_no: ph.batchNo || null,
          expiry_date: ph.expiry,
          qty: ph.totalUnits,
          cost_price: ph.costPerUnit || 0,
          sale_price: ph.salePerUnit || 0,
          sync_old_price: !!ph.syncOldPrice,
        });
        setSnackbar({ open: true, message: `${ph.genericName}: ${ph.totalUnits} units, batch ${ph.batchNo || ''} saved`, severity: 'success' });
        await loadData();
        setProductDialog(false);
        setEditingProduct(null);
        resetProductForm();
        return;
      }
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
    } catch (outerErr) {
      // Catches anything thrown before/during form prep (validation, meta building)
      console.error('Save prep error:', outerErr);
      setSnackbar({ open: true, message: 'Error: ' + (outerErr?.message || outerErr), severity: 'error' });
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
          {(shopBusinessType === 'stationery' || shopBusinessType === 'bookshop') && (
          <Button variant="outlined" size="small" startIcon={<MenuBook />} onClick={() => setBundleManagerOpen(true)}
            sx={{ borderColor: '#7c3aed', color: '#7c3aed' }}>
            {isMobile ? 'Bundles' : '📚 Bundles'}
          </Button>
          )}
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
                      {allowedProductTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
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
                      renderParentStock={renderParentStock}
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
                                {renderParentStock(parent, totalStock)}
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
                                {(parent.product_type === 'grocery' || parent.type === 'grocery' || parent.product_type === 'medical' || parent.type === 'medical') && (
                                  <Tooltip title="Batches (stock + expiry)">
                                    <IconButton size="small" sx={{ color: '#d97706' }} onClick={(e) => { e.stopPropagation(); setBatchProduct(parent); }}>
                                      <History />
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
                                  ) : (parent.product_type === 'shoes' || parent.type === 'shoes') ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                        {variant.current_stock || 0} Pairs
                                      </Typography>
                                      {Number(variant.current_stock) <= 0 && (
                                        <Chip size="small" color="error" label="Cut-Size" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold' }} />
                                      )}
                                    </Box>
                                  ) : parent.garment_mode === 'READYMADE_STITCHED' ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                        {variant.current_stock || 0} Pcs
                                      </Typography>
                                      {Number(variant.current_stock) <= 0 && (
                                        <Chip size="small" color="error" label="Cut-Size" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold' }} />
                                      )}
                                    </Box>
                                  ) : parent.garment_mode === 'THAAN_FABRIC' ? (
                                    <Typography color={getStockColor(variant.current_stock, variant.stock_alert_quantity)}>
                                      {variant.current_stock || 0} m
                                    </Typography>
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
                        {allowedProductTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
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

              {/* CARD 3: Packaging & Box Entry Mode — sirf Wholesale / Mart (Grocery) shops ke liye */}
              {showBoxEntryCard && (
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
                        Box Packaging
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Box mein units — box cost/sale se per-unit auto-calculate
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
                        {isBoxEntry ? 'BOX MODE ON' : 'UNIT MODE'}
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
                          helperText="Ek Box mein kitne Units hain (e.g., 10)"
                          required={isBoxEntry}
                          placeholder="10"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Number of Boxes"
                          type="number"
                          value={boxQuantity}
                          onChange={handleBoxQuantityChange}
                          helperText="Kitne Boxes hain"
                          placeholder="5"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Box Cost Price (Rs.)"
                          type="number"
                          value={boxCostPrice}
                          onChange={(e) => setBoxCostPrice(e.target.value)}
                          helperText={unitsPerBox ? `Per unit: Rs. ${(Number(boxCostPrice) / Number(unitsPerBox)).toFixed(2)}` : '1 Box ki cost'}
                          placeholder="1000"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Box Sale Price (Rs.)"
                          type="number"
                          value={boxPrice}
                          onChange={(e) => setBoxPrice(e.target.value)}
                          helperText={unitsPerBox ? `Per unit: Rs. ${(Number(boxPrice) / Number(unitsPerBox)).toFixed(2)}` : '1 Box ki sale price'}
                          placeholder="1200"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ 
                          p: 2, 
                          borderRadius: 2.5, 
                          bgcolor: '#ecfdf5', 
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}>
                          <CheckCircle sx={{ color: '#10b981', fontSize: 24 }} />
                          <Box>
                            <Typography variant="body2" fontWeight="bold" color="#065f46">
                              Total Stock: {Number(boxQuantity) * Number(unitsPerBox) || 0} Units
                            </Typography>
                            <Typography variant="caption" color="#047857" sx={{ display: 'block' }}>
                              {Number(boxQuantity) || 0} Boxes × {Number(unitsPerBox) || 0} Units = {Number(boxQuantity) * Number(unitsPerBox) || 0} Units
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Paper>
              )}

              {/* CARD 4: Pricing & Inventory — hidden when ADDING products of types with specialized pricing (their own forms own the price fields). Edit mode keeps it for all types. Fabric: hidden ONLY for THAAN_FABRIC (Thaan section has its own per-meter price inputs); READYMADE_STITCHED and BOX_SUIT read CARD 4's fields on save, so it stays visible there. */}
              {!((["imei", "medical", "grocery", "stationery"].includes(dialogProductType) || (dialogProductType === "fabric" && productForm.garment_mode === "THAAN_FABRIC")) && !editingProduct) && (
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
              )}

              {/* CARD 5: Type-Specific Details */}
              {dialogProductType === 'imei' && (
                <>
                {!editingProduct ? (
                  <BulkImeiForm
                    productName={productForm.name || ''}
                    brand={productForm.brand || ''}
                    categoryId={productForm.category_id || null}
                    brandId={productForm.brand_id || null}
                    onDone={() => {
                      setProductDialog(false);
                      resetProductForm();
                      setImagePreview(null);
                      loadData();
                    }}
                  />
                ) : (
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="#1e40af" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneAndroid fontSize="small" sx={{ color: '#2563eb' }} />
                      Mobile / IMEI Telemetry
                    </Typography>
                    <Button size="small" variant="outlined" sx={{ ml: 'auto' }} onClick={() => setImeiLookupOpen(true)}>
                      IMEI Lookup
                    </Button>
                  </Box>
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
                </>
              )}

              {dialogProductType === 'medical' && (
                <>
                {!editingProduct && (
                  <PharmacyModeForm onChange={handlePharmacyData} />
                )}
                {editingProduct && (
                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #fecdd3', bgcolor: '#fff1f2' }}>
                    <Typography variant="caption" color="text.secondary">
                      Stock aur batches row ke <b>Batches</b> button se manage karein.
                    </Typography>
                  </Paper>
                )}
                </>
              )}

              {dialogProductType === 'fabric' && (
                <>
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #e9d5ff', bgcolor: '#faf5ff' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#6b21a8" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Straighten fontSize="small" sx={{ color: '#9333ea' }} />
                    Garments — Product Type
                  </Typography>
                  {/* Mode tabs */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {[
                      { v: 'THAAN_FABRIC', l: 'Thaan / Fabric (meter)' },
                      { v: 'BOX_SUIT', l: 'Box Suit (per box)' },
                      { v: 'READYMADE_STITCHED', l: 'Readymade (sizes)' },
                    ].map(m => (
                      <Button key={m.v} size="small"
                        variant={productForm.garment_mode === m.v ? 'contained' : 'outlined'}
                        color="secondary"
                        onClick={() => setProductForm(prev => ({ ...prev, garment_mode: m.v }))}>
                        {m.l}
                      </Button>
                    ))}
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Article Number *" name="article_no" value={productForm.article_no} onChange={handleProductChange} placeholder="GR-104" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Fabric / Material" name="fabric_type" value={productForm.fabric_type} onChange={handleProductChange} placeholder="Wash & Wear, Lawn, Boski" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Season</InputLabel>
                        <Select name="season" value={productForm.season} onChange={handleProductChange} label="Season">
                          <MenuItem value="">—</MenuItem>
                          <MenuItem value="Summer">Summer</MenuItem>
                          <MenuItem value="Winter">Winter</MenuItem>
                          <MenuItem value="Festive">Festive</MenuItem>
                          <MenuItem value="All-Season">All-Season</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Rack / Shelf Location" name="rack_location" value={productForm.rack_location} onChange={handleProductChange} placeholder="Rack A - Shelf 4" />
                    </Grid>
                    {productForm.garment_mode !== 'THAAN_FABRIC' && (
                      <>
                        <Grid item xs={6} sm={3}>
                          <TextField fullWidth size="small" label="Color / Shade" name="fabric_color" value={productForm.fabric_color} onChange={handleProductChange} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField fullWidth size="small" label="Minimum Sale Price (bottom rate)" name="minSalePrice" type="number" value={productForm.minSalePrice} onChange={handleProductChange} />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Paper>

                {productForm.garment_mode === 'THAAN_FABRIC' && !editingProduct && (
                  <ThaanFabricForm
                    color={productForm.thaan_color}
                    onColorChange={(v) => setProductForm(prev => ({ ...prev, thaan_color: v }))}
                    costPerMeter={productForm.thaanCostPerM}
                    salePerMeter={productForm.thaanSalePerM}
                    minPerMeter={productForm.thaanMinPerM}
                    onPriceChange={handleThaanPrice}
                    onChange={handleThaanData}
                  />
                )}

                {productForm.garment_mode === 'READYMADE_STITCHED' && !editingProduct && (
                  <ReadymadeMatrix
                    articleNo={productForm.article_no}
                    purchasePrice={productForm.costPrice}
                    salePrice={productForm.retailPrice}
                    minPrice={productForm.minSalePrice}
                    onChange={handleReadymadeVariants}
                  />
                )}

                {productForm.garment_mode === 'BOX_SUIT' && (
                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e9d5ff', bgcolor: '#faf5ff', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Box Suit: har box = 1 suit. Quantity neeche stock field mein boxes ki tadaad likhein.
                    </Typography>
                  </Paper>
                )}
                </>
              )}

              {dialogProductType === 'grocery' && (
                <>
                {!editingProduct && (
                  <GroceryModeForm onChange={handleGroceryData} />
                )}
                {editingProduct && (
                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #fed7aa', bgcolor: '#fff7ed' }}>
                    <Typography variant="caption" color="text.secondary">
                      Stock aur batches row ke <b>Batches</b> button se manage karein.
                    </Typography>
                  </Paper>
                )}
                </>
              )}

              {dialogProductType === 'shoes' && (
                <>
                <Paper sx={{ p: isMobile ? 2 : 2.5, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Checkroom fontSize="small" sx={{ color: '#64748b' }} />
                    Article Details (Shoes Shop)
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Article Number *" name="article_no" value={productForm.article_no} onChange={handleProductChange} placeholder="ND-502" required />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Season</InputLabel>
                        <Select name="season" value={productForm.season} onChange={handleProductChange} label="Season">
                          <MenuItem value="">—</MenuItem>
                          <MenuItem value="Summer">Summer</MenuItem>
                          <MenuItem value="Winter">Winter</MenuItem>
                          <MenuItem value="Wedding">Wedding</MenuItem>
                          <MenuItem value="All-Season">All-Season</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Rack / Shelf Location" name="rack_location" value={productForm.rack_location} onChange={handleProductChange} placeholder="Rack B - Shelf 3" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Material" name="shoe_material" value={productForm.shoe_material} onChange={handleProductChange} placeholder="Leather, Mesh, Rubber" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Minimum Sale Price (Bottom Rate)" name="minSalePrice" type="number" value={productForm.minSalePrice} onChange={handleProductChange} placeholder="0" helperText="Bargaining lock" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Discount % / Flat" name="discount" value={productForm.discount} onChange={handleProductChange} placeholder="10% or 200" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Size (UK / US / Euro)" name="shoe_size" value={productForm.shoe_size} onChange={handleProductChange} placeholder="40, 41, 42" />
                    </Grid>
                  </Grid>
                </Paper>
                {!editingProduct && (
                  <ShoeVariantMatrix
                    articleNo={productForm.article_no}
                    purchasePrice={productForm.costPrice}
                    salePrice={productForm.retailPrice}
                    minPrice={productForm.minSalePrice}
                    onChange={handleShoeVariants}
                  />
                )}
                </>
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

              {/* ============ BOOKSHOP: STATIONERY 3-LEVEL ============ */}
              {dialogProductType === 'stationery' && !editingProduct && (
                <StationeryModeForm
                  pieceLabel={productForm.name ? `${productForm.name.split(' ').slice(-1)[0]}s` : 'Pieces'}
                  onChange={handleStationeryData}
                />
              )}

              {/* ============ BOOKSHOP: UNIFORM SIZE MATRIX ============ */}
              {dialogProductType === 'uniform' && !editingProduct && (
                <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #7dd3fc', bgcolor: '#f0f9ff' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                    🏫 School Uniform Setup
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 1.5 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="School Name *" value={uniformSchool}
                        onChange={(e) => setUniformSchool(e.target.value)} placeholder="The City School" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Item</InputLabel>
                        <Select value={uniformItem} onChange={(e) => setUniformItem(e.target.value)} label="Item">
                          {['Shirt', 'Trouser', 'Blazer', 'Sweater', 'Tie', 'Belt', 'Socks', 'Frock', 'Dupatta', 'Cap'].map(i => (
                            <MenuItem key={i} value={i}>{i}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <UniformSizeMatrix
                    schoolName={uniformSchool}
                    itemName={uniformItem}
                    purchasePrice={productForm.costPrice}
                    salePrice={productForm.retailPrice}
                    minPrice={productForm.minSalePrice}
                    onChange={handleUniformVariants}
                  />
                </Paper>
              )}

              {/* ============ BOOKSHOP: BOOKS ============ */}
              {dialogProductType === 'books' && (
                <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #c4b5fd', bgcolor: '#faf5ff' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                    📖 Book Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Class" value={bookClass}
                        onChange={(e) => setBookClass(e.target.value)} placeholder="Class 5" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Subject" value={bookSubject}
                        onChange={(e) => setBookSubject(e.target.value)} placeholder="Mathematics" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Publisher" value={bookPublisher}
                        onChange={(e) => setBookPublisher(e.target.value)} placeholder="Oxford" />
                    </Grid>
                  </Grid>
                </Paper>
              )}

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
              {(!editingProduct && dialogProductType === 'imei') ? (
                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 'bold', alignSelf: 'center', px: 1 }}>
                  📱 IMEI product "Bulk IMEI Scan Mode" se save hoga — neeche "Save Units to Stock" dabao
                </Typography>
              ) : (
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
              )}
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

      {/* Batch manager (Grocery / Pharmacy) */}
      <BatchManager
        open={!!batchProduct}
        product={batchProduct}
        onClose={() => setBatchProduct(null)}
        onChanged={() => loadData()}
      />

      {/* IMEI history lookup */}
      <ImeiLookupModal open={imeiLookupOpen} onClose={() => setImeiLookupOpen(false)} />

      {/* Bookshop: class bundles */}
      <BundleManager open={bundleManagerOpen} onClose={() => setBundleManagerOpen(false)} />

      {/* Barcode Label Print Modal (Zero-Waste Multi-Column) */}
      <BarcodePrintModal
        open={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        product={barcodeModalProduct}
        onSuccess={(res) => {
          setSnackbar({
            open: true,
            message: `Printed ${res.totalQuantity} barcode label(s) across ${res.totalRows} row(s) to "${res.printerName}"!`,
            severity: 'success'
          });
        }}
      />

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 8 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}