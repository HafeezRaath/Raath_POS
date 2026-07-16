import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Tabs, Tab, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress, Autocomplete,
  Switch, FormControlLabel, Alert, Snackbar, RadioGroup, Radio,
  FormLabel, AppBar, Toolbar, Checkbox
} from '@mui/material';
import {
  Add, Edit, Delete, Search, QrCode, PhoneAndroid, Straighten,
  LocalGroceryStore, Save, Category, Scale, Inventory, LocalShipping,
  AddCircle, History, Warning, LocalOffer, Percent, AttachMoney,
  KeyboardArrowDown, KeyboardArrowUp, CheckCircle, CalendarToday,
  UploadFile, TableChart, Close, CloudUpload, CameraAlt, ContentPaste,
  Image as ImageIcon, DocumentScanner, ClearAll
} from '@mui/icons-material';
import { createWorker } from 'tesseract.js';
import db from '../database/db';

const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard (Shoes/General)', icon: <Inventory fontSize="small" /> },
  { value: 'imei', label: 'IMEI Product (Mobile/Electronics)', icon: <PhoneAndroid fontSize="small" /> },
  { value: 'fabric', label: 'Fabric/Cloth (Material)', icon: <Straighten fontSize="small" /> },
  { value: 'grocery', label: 'Grocery/Food (Medicine)', icon: <LocalGroceryStore fontSize="small" /> },
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

export default function InventoryPage() {
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

  // ==================== BULK IMPORT STATES ====================
  const [bulkImportDialog, setBulkImportDialog] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkDelimiter, setBulkDelimiter] = useState('tab');
  const [bulkImportMode, setBulkImportMode] = useState('purchase');
  const [bulkImportTarget, setBulkImportTarget] = useState('purchase');
  const [bulkHasHeaders, setBulkHasHeaders] = useState(true);
  const [bulkColumnMap, setBulkColumnMap] = useState({ name: 0, sku: 1, qty: 2, price: 3 });

  // ==================== OCR STATES ====================
  const [ocrDialog, setOcrDialog] = useState(false);
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrParsedItems, setOcrParsedItems] = useState([]);
  const [ocrConfidence, setOcrConfidence] = useState(0);

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

  const getStockColor = (stock, alertQty) => {
    if (stock <= 0) return '#e53935';
    if (stock <= (alertQty || 5)) return '#fb8c00';
    return '#43a047';
  };

  const getStockBadge = (stock, minStock) => {
    const s = Number(stock) || 0;
    const m = Number(minStock) || 0;
    if (s <= 0) return <Chip size="small" color="error" label="Out of Stock" />;
    if (s <= m) return <Chip size="small" color="warning" label="Low Stock" icon={<Warning fontSize="small" />} />;
    return <Chip size="small" color="success" label="In Stock" />;
  };

  const getTypeChip = (type) => {
    const t = PRODUCT_TYPES.find(p => p.value === type);
    return <Chip size="small" icon={t?.icon} label={t?.label} variant="outlined" />;
  };

  const parseMeta = (desc) => {
    try { return JSON.parse(desc || '{}'); } catch { return {}; }
  };

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

  const groupedProducts = useMemo(() => {
    const groups = new Map();
    filteredProducts.forEach(p => {
      const pid = p.product_id || p.id;
      if (!groups.has(pid)) groups.set(pid, { parent: p, variants: [] });
      groups.get(pid).variants.push(p);
    });
    return Array.from(groups.values());
  }, [filteredProducts]);

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

  const productsByCategory = useMemo(() => {
    if (!offerCategoryFilter) return [];
    return products.filter(p => String(p.category_id) === String(offerCategoryFilter));
  }, [products, offerCategoryFilter]);

  const variantsOfSelectedProduct = useMemo(() => {
    if (!selectedOfferProduct) return [];
    return products.filter(p => p.product_id === selectedOfferProduct.product_id);
  }, [products, selectedOfferProduct]);

  const handleAddToOffer = () => {
    if (!selectedOfferVariant) return;
    const alreadyExists = offerItems.find(i => i.variant_id === selectedOfferVariant.id);
    if (alreadyExists) { alert('Ye variant already offer mein add hai!'); return; }
    const originalPrice = Number(selectedOfferVariant.retail_price) || 0;
    const customPrice = offerVariantPrice ? Number(offerVariantPrice) : originalPrice;
    setOfferItems(prev => [...prev, {
      variant_id: selectedOfferVariant.id, product_id: selectedOfferProduct.product_id,
      product_name: selectedOfferProduct.product_name || selectedOfferProduct.name,
      variant_name: selectedOfferVariant.variant_name || 'Default', sku: selectedOfferVariant.sku,
      original_price: originalPrice, offer_price: customPrice, category_id: selectedOfferProduct.category_id
    }]);
    setSelectedOfferVariant(null); setOfferVariantPrice('');
  };

  const handleRemoveOfferItem = (variantId) => {
    setOfferItems(prev => prev.filter(i => i.variant_id !== variantId));
  };

  const offerOriginalTotal = offerItems.reduce((sum, i) => sum + (Number(i.original_price) || 0), 0);
  const offerDiscountTotal = offerItems.reduce((sum, i) => sum + (Number(i.offer_price) || 0), 0);
  const calculatedDiscount = offerForm.discount_type === 'percentage'
    ? (offerOriginalTotal * (Number(offerForm.discount_value) || 0) / 100)
    : (Number(offerForm.discount_value) || 0);
  const offerFinalTotal = Math.max(0, offerDiscountTotal - calculatedDiscount);

  const resetOfferForm = useCallback(() => {
    setOfferForm({ name: '', description: '', discount_type: 'percentage', discount_value: '0',
      start_date: new Date().toISOString().split('T')[0], end_date: '', status: 'active' });
    setOfferItems([]); setOfferCategoryFilter(''); setSelectedOfferProduct(null);
    setSelectedOfferVariant(null); setOfferVariantPrice(''); setEditingOffer(null);
  }, []);

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
    if (!offerForm.name.trim()) return alert('Offer name required!');
    if (offerItems.length < 2) return alert('Kam az kam 2 products add karein offer mein!');
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
    } catch (err) {
      console.error('Offer save error:', err);
      alert('Error saving offer: ' + err.message);
    }
  };

  const handleDeleteOffer = async (id) => {
    if (window.confirm('Delete this offer?')) {
      try {
        if (db.deleteOfferItems) await db.deleteOfferItems(id);
        await db.deleteOffer(id); await loadData();
      } catch (err) { alert('Error: ' + err.message); }
    }
  };

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
    if (!productForm.name.trim() || !sku) { alert('Name and SKU required!'); return; }
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
      const existingVariant = await db.getVariantBySKU(sku);
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
          alert(`Product found! "${sku}" mein stock update aur IMEIs attach ho gaye hain.`);
        } else {
          const prodResult = await db.addProduct(productData);
          const productId = prodResult.lastInsertRowid;
          variantData.product_id = productId;
          const varResult = await db.addVariant(variantData);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            await db.addMultipleSerializedItems(varResult.lastInsertRowid, meta.imeiList);
          }
        }
      }
      localStorage.setItem('last_product_defaults', JSON.stringify({
        type: productForm.type, category_id: productForm.category_id, unit: productForm.unit
      }));
      await loadData(); setProductDialog(false); setEditingProduct(null); resetProductForm();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving product: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!id) return;
    if (window.confirm('Delete this product permanently? This cannot be undone!')) {
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
      } catch (err) { 
        console.error('Delete error:', err);
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    }
  };

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
    if (!sku) return alert('SKU required!');
    try {
      const existingVariant = await db.getVariantBySKU(sku);
      const addedStock = Number(variantForm.stock) || 0;
      if (existingVariant) {
        await db.updateVariantStock(existingVariant.id, addedStock);
        if ((variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && variantForm.imeiList?.trim()) {
          const imeis = variantForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (imeis.length > 0) await db.addMultipleSerializedItems(existingVariant.id, imeis);
        }
        alert(`Stock appended to existing item "${sku}".`);
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
      }
      await loadData(); setVariantDialog(false); setVariantParent(null);
    } catch (err) { alert('Error: ' + err.message); }
  };

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
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Delete this category?')) {
      try { await db.deleteCategory(id); await loadData(); }
      catch (err) { alert('Error: ' + err.message); }
    }
  };

  const handleAddUnit = (e) => {
    e.preventDefault();
    const newUnit = e.target.unitName.value.trim();
    if (newUnit && !units.includes(newUnit)) {
      const updated = [...units, newUnit];
      setUnits(updated);
      localStorage.setItem('custom_units', JSON.stringify(updated));
    }
    e.target.reset();
  };

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
      const history = await db.getPriceHistory(variantId, 3);
      setPriceHistory(history || []);
    } catch { setPriceHistory([]); }
    setCurrentItem(prev => ({
      ...prev, product_variant_id: variantId,
      product_name: product.product_name || product.name, sku: product.sku,
      purchase_price: product.purchase_price || '', quantity: '1', imeiList: ''
    }));
  };

  const addItem = () => {
    if (!currentItem.product_variant_id || !currentItem.purchase_price) return;
    const selectedProduct = products.find(p => p.id == currentItem.product_variant_id);
    const qty = parseFloat(currentItem.quantity) || 1;
    if (selectedProduct?.product_type === 'imei' || selectedProduct?.type === 'imei') {
      const imeis = (currentItem.imeiList || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (imeis.length !== qty) { alert(`IMEI count mismatch! Expected ${qty}, got ${imeis.length}.`); return; }
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
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.purchase_price), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.purchase_price * (item.tax_percentage / 100)), 0);
  const discount = parseFloat(purchaseForm.discount_amount) || 0;
  const shipping = parseFloat(purchaseForm.shipping_charges) || 0;
  const grandTotal = subTotal + totalTax - discount + shipping;
  const paid = parseFloat(purchaseForm.paid_amount) || 0;
  const due = grandTotal - paid;

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplier_id) return alert('Select supplier!');
    if (items.length === 0 && !editingPurchase) return alert('Add at least one item!');
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
          await db.addLedgerEntry({
            supplier_id: purchaseForm.supplier_id, type: 'purchase',
            amount: due, description: `Purchase ${purchaseForm.purchase_no} - Stock Added`
          });
        }
        if (db.logToGeneralLedger) {
          await db.logToGeneralLedger('purchase', purchaseId, 0, grandTotal, `Purchase Bill ${purchaseForm.purchase_no}`);
        }
      }
      alert('Purchase saved!');
      setPurchaseDialog(false); setEditingPurchase(null); setItems([]); loadData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeletePurchase = async (id) => {
    if (window.confirm('Delete this purchase record?')) {
      try { await db.deletePurchase(id); await loadData(); }
      catch (err) { alert('Error: ' + err.message); }
    }
  };

  // ==================== BULK IMPORT FUNCTIONS ====================
  const openBulkImport = (mode = 'purchase') => {
    setBulkImportMode(mode); setBulkImportTarget(mode);
    setBulkText(''); setBulkPreview([]); setBulkDelimiter('tab');
    setBulkHasHeaders(true);
    setBulkColumnMap({ name: 0, sku: 1, qty: 2, price: 3 });
    setBulkImportDialog(true);
  };

  const detectDelimiter = (text) => {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    const counts = [
      { type: 'tab', count: tabCount },
      { type: 'comma', count: commaCount },
      { type: 'pipe', count: pipeCount },
      { type: 'semicolon', count: semicolonCount }
    ];
    
    const best = counts.sort((a, b) => b.count - a.count)[0];
    return best.count > 0 ? best.type : 'tab';
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
    
    // Auto-detect delimiter if not set
    let delimiter = bulkDelimiter;
    if (delimiter === 'auto') {
      delimiter = detectDelimiter(bulkText);
      setBulkDelimiter(delimiter);
    }
    
    const sep = getDelimiterChar(delimiter);
    const lines = bulkText.trim().split(/\r?\n/).filter(line => line.trim());
    
    let startIndex = 0;
    if (bulkHasHeaders) {
      startIndex = 1; // Skip first line as header
    }
    
    const parsed = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      let parts;
      
      if (sep === '\t') {
        parts = line.split('\t');
      } else {
        // Handle quoted values for CSV
        parts = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === sep && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
      }
      
      // Clean up quoted values
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
        parsed.push({ 
          name, 
          sku, 
          quantity: qty, 
          purchase_price: price, 
          line,
          raw: parts
        });
      }
    }
    
    setBulkPreview(parsed);
    
    if (parsed.length === 0 && lines.length > 0) {
      setSnackbar({ 
        open: true, 
        message: 'No valid rows parsed. Check delimiter and column mapping.', 
        severity: 'warning' 
      });
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

  const autoCreateProductsFromBulk = async () => {
    const newProducts = bulkPreview.filter(item => !products.find(p => p.sku?.toLowerCase() === item.sku.toLowerCase()));
    if (newProducts.length === 0) { 
      applyBulkToPurchase(); 
      return; 
    }
    if (!window.confirm(`${newProducts.length} products don't exist. Create them automatically?`)) return;
    try {
      for (const item of newProducts) {
        const productData = {
          name: item.name, 
          brand_id: null,
          category_id: Number(purchaseForm.supplier_id) || null,
          type: 'standard', 
          unit: 'Piece', 
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
      }
      await loadData(); 
      applyBulkToPurchase();
    } catch (err) { 
      alert('Error creating products: ' + err.message); 
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

  const preprocessImage = (imageSrc) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not load image for preprocessing'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Upscale small images (min width 1800px — receipts read much better OCR'd bigger)
      let width = img.width;
      let height = img.height;
      const minWidth = 1800;
      const maxWidth = 2600;
      if (width < minWidth) {
        const scale = minWidth / width;
        width = minWidth;
        height = img.height * scale;
      } else if (width > maxWidth) {
        const scale = maxWidth / width;
        width = maxWidth;
        height = height * scale;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const frame = ctx.getImageData(0, 0, width, height);
      const data = frame.data;
      const len = data.length;

      // Step 1: Grayscale
      const gray = new Float32Array(len / 4);
      for (let i = 0, j = 0; i < len; i += 4, j++) {
        gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Step 2: Light unsharp-mask style sharpening (helps blurry phone photos)
      // (3x3 kernel approximation, skipping borders for speed/simplicity)
      const sharpened = new Float32Array(gray.length);
      const w = width;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const center = gray[idx];
          const sum =
            gray[idx - 1] + gray[idx + 1] + gray[idx - w] + gray[idx + w];
          // amount=0.6 keeps it subtle so text edges pop without adding noise
          sharpened[idx] = center + 0.6 * (center * 4 - sum) / 4;
        }
      }
      // copy borders unchanged
      for (let x = 0; x < w; x++) {
        sharpened[x] = gray[x];
        sharpened[(height - 1) * w + x] = gray[(height - 1) * w + x];
      }
      for (let y = 0; y < height; y++) {
        sharpened[y * w] = gray[y * w];
        sharpened[y * w + w - 1] = gray[y * w + w - 1];
      }

      // Step 3: Contrast boost
      const contrast = 1.4;
      const intercept = 128 * (1 - contrast);
      for (let j = 0; j < sharpened.length; j++) {
        sharpened[j] = Math.min(255, Math.max(0, sharpened[j] * contrast + intercept));
      }

      // Step 4: Otsu's method — auto threshold instead of a fixed guess.
      const histogram = new Array(256).fill(0);
      for (let j = 0; j < sharpened.length; j++) histogram[Math.round(sharpened[j])]++;
      const total = sharpened.length;
      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * histogram[t];
      let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > maxVar) { maxVar = between; threshold = t; }
      }

      // Step 5: Write back as black/white
      for (let i = 0, j = 0; i < len; i += 4, j++) {
        const val = sharpened[j] < threshold ? 0 : 255;
        data[i] = val; data[i + 1] = val; data[i + 2] = val;
      }
      ctx.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  });
};

 const runOcrPass = async (worker, imageSrc, psmMode) => {
  await worker.setParameters({
    tessedit_char_whitelist:
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/-$%&()[]{}:;@#+=*!?\'"|~`<> \t\n',
    preserve_interword_spaces: '1',
    tessedit_pageseg_mode: psmMode,
  });
  const result = await worker.recognize(imageSrc);
  return {
    text: result.data.text || '',
    confidence: result.data.confidence || 0,
  };
};

const processOcrImage = async () => {
  if (!ocrImage) return;
  setOcrLoading(true);
  setOcrResult('');
  setOcrParsedItems([]);
  setOcrConfidence(0);

  let worker = null;
  try {
    const processedImage = await preprocessImage(ocrImage);
    worker = await createWorker('eng');

    // Try both segmentation modes, keep the better one.
    const passA = await runOcrPass(worker, processedImage, '6');
    const passB = await runOcrPass(worker, processedImage, '4');
    const best = passB.confidence > passA.confidence ? passB : passA;

    await worker.terminate();
    worker = null;

    setOcrResult(best.text);
    setOcrConfidence(best.confidence);

    const parsed = parseOcrTextToItems(best.text);
    setOcrParsedItems(parsed);

    if (parsed.length === 0 && best.text.trim()) {
      setSnackbar({
        open: true,
        message: 'Text mila laikin items match nahi hue — "Add Row Manually" se add kar sakte hain.',
        severity: 'warning'
      });
    } else {
      setSnackbar({
        open: true,
        message: `OCR complete! ${parsed.length} items detected (Confidence: ${Math.round(best.confidence)}%)`,
        severity: best.confidence > 50 ? 'success' : 'warning'
      });
    }
  } catch (err) {
    console.error('OCR error:', err);
    setSnackbar({ open: true, message: 'OCR failed: ' + err.message, severity: 'error' });
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) { /* already gone */ }
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
    /^\s*#\s*$/, /^\s*S\.?No\.?\s*$/i, /^\s*Item\s*$/i, /^\s*Sr\.?\s*$/i,
    /Thank you|Please pay|Due date|^\s*Account|^\s*Phone|^\s*Email|^\s*Website|^\s*Address|GST|NTN|VAT/i,
    /^\s*Rs?\.?\s*[\d,]+\s*$/, /^\s*PKR\s*[\d,]+\s*$/i,
    /^\s*Date\s*[:\-]?\s*\d/i, /^\s*Qty\s*$/i, /^\s*Price\s*$/i, /^\s*Rate\s*$/i,
    /^\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*$/,
    /signature|authorized|received by|prepared by|checked by/i,
  ];

  const NUMBER_RE = /[\d,]+\.?\d*/g;
  const UNIT_WORDS = /^(pcs?|pieces?|kg|kgs|gm|gram|meter|mtr|box|pack|set|unit|dozen|pair|ltr|liter|ml|th|than|x)$/i;
  // A "code" token: a standalone alphanumeric chunk that isn't a plain number
  // and isn't a unit word — e.g. SKU123, ABC-45, 8901234567 (barcode-like)
  const CODE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9\-]{3,}$/;

  const genSku = (name) => {
    let base = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 15);
    if (!base) base = 'ITEM';
    let sku = base, n = 1;
    while (usedSkus.has(sku)) sku = `${base}-${n++}`;
    usedSkus.add(sku);
    return sku;
  };

  const isReasonable = (name, qty, price) => {
    if (!name || name.replace(/[^a-zA-Z]/g, '').length < 2) return false;
    if (!(price > 0) || !isFinite(price)) return false;
    if (price > 10000000) return false;
    if (!(qty > 0) || qty > 100000) return false;
    return true;
  };

  for (const rawLine of rawLines) {
    const cleanLine = rawLine.replace(/[|_~`]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanLine.length < 3) continue;
    if (skipPatterns.some(p => p.test(cleanLine))) continue;

    // Strip a leading serial number like "1." or "12)"
    const withoutSerial = cleanLine.replace(/^\d{1,3}[.)]\s+/, '');

    const numberMatches = [...withoutSerial.matchAll(NUMBER_RE)];
    if (numberMatches.length === 0) continue; // no numbers = not a product line

    const firstNumberIndex = numberMatches[0].index;
    let name = withoutSerial.slice(0, firstNumberIndex)
      .replace(/[^a-zA-Z0-9\s\-&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Drop a trailing unit word stuck to the name (e.g. "Sugar KG")
    name = name.replace(new RegExp(`\\s+${UNIT_WORDS.source.replace(/^\^|\$$/g, '')}$`, 'i'), '').trim();
    if (!name) continue;

    // Look for a separate alphanumeric code token between the name and the numbers
    // (skip pure unit words) — this becomes the product code/barcode if present.
    const betweenText = withoutSerial.slice(0, firstNumberIndex);
    const codeCandidate = betweenText
      .split(' ')
      .reverse()
      .find(tok => CODE_TOKEN.test(tok) && !UNIT_WORDS.test(tok) && /\d/.test(tok));

    const nums = numberMatches.map(m => parseFloat(m[0].replace(/,/g, ''))).filter(n => isFinite(n));
    let qty = 1, price = 0;

    if (nums.length >= 3) {
      // Likely [qty, price, amount] — verify qty*price ≈ amount, else fall back
      const [q, p, amt] = nums.slice(-3);
      const expected = q * p;
      if (Math.abs(expected - amt) <= Math.max(1, amt * 0.1)) {
        qty = q; price = p;
      } else {
        // fall back: treat last two as price/amount
        const [p2, amt2] = nums.slice(-2);
        const calcQty = p2 > 0 ? Math.round(amt2 / p2) : 1;
        if (calcQty > 0 && Math.abs(calcQty * p2 - amt2) <= Math.max(1, amt2 * 0.1)) {
          qty = calcQty; price = p2;
        } else {
          qty = 1; price = nums[nums.length - 1];
        }
      }
    } else if (nums.length === 2) {
      const [a, b] = nums;
      // if b is a clean multiple of a, treat a=price, b=amount -> derive qty
      if (a > 0 && b > a && b / a < 1000) {
        const calcQty = Math.round(b / a);
        if (calcQty > 0 && Math.abs(calcQty * a - b) <= Math.max(1, b * 0.1)) {
          qty = calcQty; price = a;
        } else {
          qty = a; price = b; // treat as [qty, price]
        }
      } else {
        qty = a; price = b;
      }
    } else {
      // single number = price, qty defaults to 1
      price = nums[0];
      qty = 1;
    }

    if (!isReasonable(name, qty, price)) continue;

    items.push({
      name: name.substring(0, 60),
      sku: codeCandidate ? codeCandidate.toUpperCase() : genSku(name),
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

  // ==================== OPEN OCR FROM PRODUCT DIALOG ====================
  const openOcrFromProduct = () => {
    setProductDialog(false);
    setOcrDialog(true);
    setOcrImage(null);
    setOcrResult('');
    setOcrParsedItems([]);
    setOcrConfidence(0);
  };

  const handleOcrProductsImport = async () => {
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
      setProductDialog(true); // Re-open product dialog
      setSnackbar({ open: true, message: `${created} products imported from image!`, severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
  };

    if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Inventory Management
      </Typography>
      
      <Tabs 
        value={activeTab} 
        onChange={(e, v) => setActiveTab(v)} 
        sx={{ mb: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Products" icon={<Inventory fontSize="small" />} iconPosition="start" />
        <Tab label="Purchases" icon={<LocalShipping fontSize="small" />} iconPosition="start" />
        <Tab label="Offers" icon={<LocalOffer fontSize="small" />} iconPosition="start" />
      </Tabs>

      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Products</Typography>
                    <Typography variant="h6" fontWeight="bold">{inventorySummary.totalProducts}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Variants</Typography>
                    <Typography variant="h6" fontWeight="bold">{inventorySummary.totalVariants}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Stock Qty</Typography>
                    <Typography variant="h6" fontWeight="bold">{inventorySummary.totalStockQty.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Cost Value</Typography>
                    <Typography variant="h6" fontWeight="bold">Rs. {inventorySummary.totalCostValue.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Retail Value</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">Rs. {inventorySummary.totalRetailValue.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={2}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Wholesale Value</Typography>
                    <Typography variant="h6" fontWeight="bold" color="info.main">Rs. {inventorySummary.totalWholesaleValue.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField 
                    fullWidth 
                    placeholder="Search products..." 
                    value={searchProduct} 
                    onChange={(e) => setSearchProduct(e.target.value)} 
                    InputProps={{ 
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ) 
                    }} 
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Brand</InputLabel>
                    <Select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} label="Brand">
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
                      <MenuItem value="">All Types</MenuItem>
                      {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenProduct()} fullWidth>
                    Add Product
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white' }}>Name / Variant</TableCell>
                    <TableCell sx={{ color: 'white' }}>SKU</TableCell>
                    <TableCell sx={{ color: 'white' }}>Type</TableCell>
                    <TableCell sx={{ color: 'white' }}>Category</TableCell>
                    <TableCell sx={{ color: 'white' }}>Stock</TableCell>
                    <TableCell sx={{ color: 'white' }}>Cost</TableCell>
                    <TableCell sx={{ color: 'white' }}>Retail</TableCell>
                    <TableCell sx={{ color: 'white' }}>Wholesale</TableCell>
                    <TableCell sx={{ color: 'white' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white' }} align="right">Actions</TableCell>
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
                          <TableCell>{parent.category_name || categories.find(c => c.id === parent.category_id)?.name || '-'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography fontWeight="bold" color={getStockColor(totalStock, parent.stock_alert_quantity)}>
                                {totalStock}
                              </Typography>
                              {getStockBadge(totalStock, parent.stock_alert_quantity)}
                            </Box>
                          </TableCell>
                          <TableCell>Rs. {Number(parent.purchase_price || 0).toLocaleString()}</TableCell>
                          <TableCell>Rs. {Number(parent.retail_price || 0).toLocaleString()}</TableCell>
                          <TableCell>Rs. {Number(parent.wholesale_price || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={parent.status === 'active' ? 'success' : 'default'}
                              label={parent.status === 'active' ? 'Active' : 'Inactive'} 
                            />
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
                            <TableCell>Rs. {Number(variant.purchase_price || 0).toLocaleString()}</TableCell>
                            <TableCell>Rs. {Number(variant.retail_price || 0).toLocaleString()}</TableCell>
                            <TableCell>Rs. {Number(variant.wholesale_price || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                color={variant.status === 'active' ? 'success' : 'default'}
                                label={variant.status === 'active' ? 'Active' : 'Inactive'} 
                              />
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

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button variant="outlined" startIcon={<Category />} onClick={() => setCategoryDialog(true)}>
                Manage Categories
              </Button>
              <Button variant="outlined" startIcon={<Scale />} onClick={() => setUnitDialog(true)}>
                Manage Units
              </Button>
            </Box>
          </Box>
        </Fade>
      )}

      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenPurchase()}>
                Add Purchase
              </Button>
            </Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white' }}>Purchase No</TableCell>
                    <TableCell sx={{ color: 'white' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white' }}>Supplier</TableCell>
                    <TableCell sx={{ color: 'white' }}>Items</TableCell>
                    <TableCell sx={{ color: 'white' }}>Total</TableCell>
                    <TableCell sx={{ color: 'white' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white' }}>Paid</TableCell>
                    <TableCell sx={{ color: 'white' }}>Due</TableCell>
                    <TableCell sx={{ color: 'white' }} align="right">Actions</TableCell>
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
                      <TableCell>Rs. {Number(purchase.grand_total || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          color={purchase.status === 'received' ? 'success' : purchase.status === 'pending' ? 'warning' : 'default'}
                          label={purchase.status || 'Unknown'} 
                        />
                      </TableCell>
                      <TableCell>Rs. {Number(purchase.paid_amount || 0).toLocaleString()}</TableCell>
                      <TableCell sx={{ color: (purchase.grand_total - purchase.paid_amount) > 0 ? 'error.main' : 'success.main' }}>
                        Rs. {Number((purchase.grand_total || 0) - (purchase.paid_amount || 0)).toLocaleString()}
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
          </Box>
        </Fade>
      )}

      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenOffer()}>
                Add Offer
              </Button>
            </Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white' }}>Offer Name</TableCell>
                    <TableCell sx={{ color: 'white' }}>Discount</TableCell>
                    <TableCell sx={{ color: 'white' }}>Period</TableCell>
                    <TableCell sx={{ color: 'white' }}>Items</TableCell>
                    <TableCell sx={{ color: 'white' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white' }} align="right">Actions</TableCell>
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
                        {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `Rs. ${offer.discount_value}`}
                      </TableCell>
                      <TableCell>
                        {formatDate(offer.start_date)} - {formatDate(offer.end_date) || 'No end'}
                      </TableCell>
                      <TableCell>{offer.items_count || (offer.items?.length || 0)} products</TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          color={offer.status === 'active' ? 'success' : 'default'}
                          label={offer.status === 'active' ? 'Active' : 'Inactive'} 
                        />
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
          </Box>
        </Fade>
      )}

      {/* ==================== PRODUCT DIALOG ==================== */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        <form onSubmit={handleSaveProduct}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Product Name" name="name" value={productForm.name} onChange={handleProductChange} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="SKU" name="sku" value={productForm.sku} onChange={handleProductChange} required disabled={!!editingProduct} />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Product Type</InputLabel>
                  <Select name="type" value={productForm.type} onChange={handleProductChange} label="Product Type">
                    {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select name="category_id" value={productForm.category_id} onChange={handleProductChange} label="Category">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select name="unit" value={productForm.unit} onChange={handleProductChange} label="Unit">
                    {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Cost Price" name="costPrice" type="number" value={productForm.costPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Retail Price" name="retailPrice" type="number" value={productForm.retailPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Wholesale Price" name="wholesalePrice" type="number" value={productForm.wholesalePrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Barcode" name="barcode" value={productForm.barcode} onChange={handleProductChange} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Stock Quantity" name="stock" type="number" value={productForm.stock} onChange={handleProductChange} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Min Stock Alert" name="minStock" type="number" value={productForm.minStock} onChange={handleProductChange} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Variant Name" name="variant_name" value={productForm.variant_name} onChange={handleProductChange} placeholder="e.g. Default, Size L, Red" />
              </Grid>

              {dialogProductType === 'imei' && (
                <Grid item xs={12}>
                  <TextField fullWidth label="IMEI Numbers (one per line)" name="imeiList" value={productForm.imeiList} onChange={handleProductChange} multiline rows={4} placeholder="353456789012345&#10;353456789012346" />
                </Grid>
              )}

              {dialogProductType === 'fabric' && (
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Fabric Length (meters per than)" name="fabricLength" type="number" value={productForm.fabricLength} onChange={handleProductChange} />
                </Grid>
              )}

              {dialogProductType === 'grocery' && (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Weight (kg)" name="weight" type="number" value={productForm.weight} onChange={handleProductChange} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Expiry Date" name="expiryDate" type="date" value={productForm.expiryDate} onChange={handleProductChange} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Batch Number" name="batchNumber" value={productForm.batchNumber} onChange={handleProductChange} />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField fullWidth label="Description" name="description" value={productForm.description} onChange={handleProductChange} multiline rows={2} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select name="status" value={productForm.status} onChange={handleProductChange} label="Status">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProductDialog(false)}>Cancel</Button>
            <Button variant="outlined" startIcon={<CameraAlt />} onClick={openOcrFromProduct} sx={{ mr: 1 }}>
              Scan Bill
            </Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>Save Product</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== VARIANT DIALOG ==================== */}
      <Dialog open={variantDialog} onClose={() => setVariantDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Variant to "{variantParent?.product_name || variantParent?.name}"</DialogTitle>
        <form onSubmit={handleSaveVariant}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="SKU" name="sku" value={variantForm.sku} onChange={handleVariantChange} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Variant Name" name="variantName" value={variantForm.variantName} onChange={handleVariantChange} placeholder="e.g. Red, XL, 128GB" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Cost Price" name="costPrice" type="number" value={variantForm.costPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Retail Price" name="retailPrice" type="number" value={variantForm.retailPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Wholesale Price" name="wholesalePrice" type="number" value={variantForm.wholesalePrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Stock Quantity" name="stock" type="number" value={variantForm.stock} onChange={handleVariantChange} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Barcode" name="barcode" value={variantForm.barcode} onChange={handleVariantChange} />
              </Grid>
              {(variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && (
                <Grid item xs={12}>
                  <TextField fullWidth label="IMEI Numbers (one per line)" name="imeiList" value={variantForm.imeiList} onChange={handleVariantChange} multiline rows={4} />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVariantDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>Save Variant</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== CATEGORY DIALOG ==================== */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Categories</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleAddCategory} sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <TextField fullWidth name="categoryName" label="New Category Name" required size="small" />
              </Grid>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Parent Category</InputLabel>
                  <Select name="parent_id" defaultValue="" label="Parent Category">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth>Add</Button>
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
                <ListItemText 
                  primary={cat.name} 
                  secondary={cat.parent_id ? `Parent: ${categories.find(c => c.id === cat.parent_id)?.name || cat.parent_id}` : 'Top Level'} 
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== UNIT DIALOG ==================== */}
      <Dialog open={unitDialog} onClose={() => setUnitDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Units</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleAddUnit} sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={10}>
                <TextField fullWidth name="unitName" label="New Unit Name" required size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button type="submit" variant="contained" startIcon={<Add />} fullWidth>Add</Button>
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

      {/* ==================== PURCHASE DIALOG ==================== */}
      <Dialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editingPurchase ? 'Edit Purchase' : 'Add New Purchase'}</DialogTitle>
        <form onSubmit={handleSavePurchase}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Supplier</InputLabel>
                  <Select value={purchaseForm.supplier_id} onChange={handleSupplierChange} label="Supplier">
                    <MenuItem value="">Select Supplier</MenuItem>
                    {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Purchase No" value={purchaseForm.purchase_no} onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_no: e.target.value }))} required />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Supplier Invoice No" value={purchaseForm.supplier_invoice_no} onChange={(e) => setPurchaseForm(prev => ({ ...prev, supplier_invoice_no: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Purchase Date" type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchase_date: e.target.value }))} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Due Date" type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm(prev => ({ ...prev, due_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={purchaseForm.status} onChange={(e) => setPurchaseForm(prev => ({ ...prev, status: e.target.value }))} label="Status">
                    <MenuItem value="received">Received</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="ordered">Ordered</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
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
            
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Product</InputLabel>
                  <Select value={currentItem.product_variant_id} onChange={handleProductSelect} label="Product">
                    <MenuItem value="">Select Product</MenuItem>
                    {products.map(p => <MenuItem key={p.id} value={p.id}>{p.product_name || p.name} - {p.sku} (Stock: {p.current_stock})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Quantity" type="number" value={currentItem.quantity} onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Purchase Price" type="number" value={currentItem.purchase_price} onChange={(e) => setCurrentItem(prev => ({ ...prev, purchase_price: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Tax %" type="number" value={currentItem.tax_percentage} onChange={(e) => setCurrentItem(prev => ({ ...prev, tax_percentage: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Expiry Date" type="date" value={currentItem.expiry_date} onChange={(e) => setCurrentItem(prev => ({ ...prev, expiry_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={1}>
                <Button variant="contained" onClick={addItem} fullWidth><Add /></Button>
              </Grid>
            </Grid>

            {currentItem.product_variant_id && (products.find(p => p.id == currentItem.product_variant_id)?.product_type === 'imei' || products.find(p => p.id == currentItem.product_variant_id)?.type === 'imei') && (
              <Grid item xs={12} sx={{ mt: 1 }}>
                <TextField fullWidth label="IMEI Numbers (one per line, count must match quantity)" value={currentItem.imeiList} onChange={(e) => setCurrentItem(prev => ({ ...prev, imeiList: e.target.value }))} multiline rows={3} />
              </Grid>
            )}

            {priceHistory.length > 0 && (
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Recent Purchase Prices:</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  {priceHistory.map((h, i) => (
                    <Chip key={i} size="small" label={`Rs. ${h.purchase_price} (${formatDate(h.purchase_date)})`} variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={{ mt: 2, mb: 2, display: 'flex', gap: 2 }}>
              <Button variant="outlined" startIcon={<UploadFile />} onClick={() => openBulkImport('purchase')}>
                Bulk Import
              </Button>
              <Button variant="outlined" startIcon={<CameraAlt />} onClick={() => { setPurchaseDialog(false); setOcrDialog(true); setOcrImage(null); setOcrResult(''); setOcrParsedItems([]); }}>
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
                      <TableCell>Rs. {Number(item.purchase_price).toLocaleString()}</TableCell>
                      <TableCell>{item.tax_percentage}%</TableCell>
                      <TableCell>Rs. {Number(item.sub_total).toLocaleString()}</TableCell>
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

            <Grid container spacing={2} justifyContent="flex-end">
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Discount" type="number" value={purchaseForm.discount_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, discount_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Tax Amount" type="number" value={purchaseForm.tax_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, tax_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Shipping" type="number" value={purchaseForm.shipping_charges} onChange={(e) => setPurchaseForm(prev => ({ ...prev, shipping_charges: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography>Subtotal: Rs. {subTotal.toLocaleString()}</Typography>
              <Typography>Tax: Rs. {totalTax.toLocaleString()}</Typography>
              <Typography>Discount: Rs. {discount.toLocaleString()}</Typography>
              <Typography>Shipping: Rs. {shipping.toLocaleString()}</Typography>
              <Typography variant="h6" fontWeight="bold">Grand Total: Rs. {grandTotal.toLocaleString()}</Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={2} justifyContent="flex-end" sx={{ mt: 1 }}>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Paid Amount" type="number" value={purchaseForm.paid_amount} onChange={(e) => setPurchaseForm(prev => ({ ...prev, paid_amount: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
                </Grid>
              </Grid>
              <Typography sx={{ mt: 1, color: due > 0 ? 'error.main' : 'success.main' }}>
                Due Amount: Rs. {due.toLocaleString()}
              </Typography>
            </Box>

            <TextField fullWidth label="Notes" multiline rows={2} value={purchaseForm.notes} onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))} sx={{ mt: 2 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPurchaseDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>Save Purchase</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== OFFER DIALOG ==================== */}
      <Dialog open={offerDialog} onClose={() => setOfferDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingOffer ? 'Edit Offer' : 'Add New Offer'}</DialogTitle>
        <form onSubmit={handleSaveOffer}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Offer Name" value={offerForm.name} onChange={(e) => setOfferForm(prev => ({ ...prev, name: e.target.value }))} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Description" value={offerForm.description} onChange={(e) => setOfferForm(prev => ({ ...prev, description: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Discount Type</InputLabel>
                  <Select value={offerForm.discount_type} onChange={(e) => setOfferForm(prev => ({ ...prev, discount_type: e.target.value }))} label="Discount Type">
                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                    <MenuItem value="fixed">Fixed Amount (Rs.)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Discount Value" type="number" value={offerForm.discount_value} onChange={(e) => setOfferForm(prev => ({ ...prev, discount_value: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">{offerForm.discount_type === 'percentage' ? '%' : 'Rs.'}</InputAdornment> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Start Date" type="date" value={offerForm.start_date} onChange={(e) => setOfferForm(prev => ({ ...prev, start_date: e.target.value }))} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="End Date" type="date" value={offerForm.end_date} onChange={(e) => setOfferForm(prev => ({ ...prev, end_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={offerForm.status} onChange={(e) => setOfferForm(prev => ({ ...prev, status: e.target.value }))} label="Status">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Add Products to Offer</Typography>

            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Filter Category</InputLabel>
                  <Select value={offerCategoryFilter} onChange={(e) => { setOfferCategoryFilter(e.target.value); setSelectedOfferProduct(null); setSelectedOfferVariant(null); }} label="Filter Category">
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={productsByCategory}
                  getOptionLabel={(option) => `${option.product_name || option.name} - ${option.sku}`}
                  value={selectedOfferProduct}
                  onChange={(e, newValue) => { setSelectedOfferProduct(newValue); setSelectedOfferVariant(null); }}
                  renderInput={(params) => <TextField {...params} label="Select Product" />}
                  disabled={!offerCategoryFilter}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth disabled={!selectedOfferProduct}>
                  <InputLabel>Select Variant</InputLabel>
                  <Select value={selectedOfferVariant?.id || ''} onChange={(e) => {
                    const variant = variantsOfSelectedProduct.find(v => v.id == e.target.value);
                    setSelectedOfferVariant(variant);
                    setOfferVariantPrice(variant?.retail_price || '');
                  }} label="Select Variant">
                    {variantsOfSelectedProduct.map(v => <MenuItem key={v.id} value={v.id}>{v.variant_name || 'Default'} - Stock: {v.current_stock}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" onClick={handleAddToOffer} fullWidth disabled={!selectedOfferVariant} startIcon={<Add />}>
                  Add
                </Button>
              </Grid>
            </Grid>

            {selectedOfferVariant && (
              <TextField fullWidth label="Custom Offer Price (leave empty for default)" type="number" value={offerVariantPrice} onChange={(e) => setOfferVariantPrice(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} sx={{ mt: 1 }} />
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Variant</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Original Price</TableCell>
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
                      <TableCell>Rs. {Number(item.original_price).toLocaleString()}</TableCell>
                      <TableCell>Rs. {Number(item.offer_price).toLocaleString()}</TableCell>
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
              <Typography>Original Total: Rs. {offerOriginalTotal.toLocaleString()}</Typography>
              <Typography>Discount: Rs. {calculatedDiscount.toLocaleString()}</Typography>
              <Typography variant="h6" fontWeight="bold">Final Total: Rs. {offerFinalTotal.toLocaleString()}</Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOfferDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>Save Offer</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==================== BULK IMPORT DIALOG ==================== */}
      <Dialog open={bulkImportDialog} onClose={() => setBulkImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Import</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Import Mode</InputLabel>
                <Select value={bulkImportMode} onChange={(e) => setBulkImportMode(e.target.value)} label="Import Mode">
                  <MenuItem value="purchase">Add to Purchase</MenuItem>
                  <MenuItem value="products">Create Products</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Delimiter</InputLabel>
                <Select value={bulkDelimiter} onChange={(e) => setBulkDelimiter(e.target.value)} label="Delimiter">
                  <MenuItem value="auto">Auto Detect</MenuItem>
                  <MenuItem value="tab">Tab</MenuItem>
                  <MenuItem value="comma">Comma</MenuItem>
                  <MenuItem value="pipe">Pipe |</MenuItem>
                  <MenuItem value="semicolon">Semicolon ;</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Checkbox checked={bulkHasHeaders} onChange={(e) => setBulkHasHeaders(e.target.checked)} />} label="First row is header" />
            </Grid>
          </Grid>

          <TextField fullWidth multiline rows={6} label="Paste data here (Name, SKU, Qty, Price)" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Product Name&#9;SKU&#9;10&#9;500&#10;Another Product&#9;SKU2&#9;5&#9;300" sx={{ mb: 2 }} />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <TextField fullWidth label="Name Column" type="number" value={bulkColumnMap.name} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, name: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth label="SKU Column" type="number" value={bulkColumnMap.sku} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, sku: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth label="Qty Column" type="number" value={bulkColumnMap.qty} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, qty: Number(e.target.value) }))} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth label="Price Column" type="number" value={bulkColumnMap.price} onChange={(e) => setBulkColumnMap(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </Grid>
          </Grid>

          <Button variant="outlined" onClick={parseBulkText} startIcon={<TableChart />} sx={{ mb: 2 }}>
            Preview Data
          </Button>

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
                      <TableCell>Rs. {row.purchase_price}</TableCell>
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
        <DialogActions>
          <Button onClick={() => setBulkImportDialog(false)}>Cancel</Button>
          <Button variant="outlined" onClick={parseBulkText}>Preview</Button>
          {bulkImportMode === 'purchase' && (
            <Button variant="contained" onClick={applyBulkToPurchase} disabled={bulkPreview.length === 0} startIcon={<Save />}>
              Add to Purchase
            </Button>
          )}
          {bulkImportMode === 'products' && (
            <Button variant="contained" onClick={applyBulkToProducts} disabled={bulkPreview.length === 0} startIcon={<Save />}>
              Create Products
            </Button>
          )}
        </DialogActions>
      </Dialog>

            {/* ==================== OCR DIALOG ==================== */}
      <Dialog open={ocrDialog} onClose={() => setOcrDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Scan Bill (OCR)</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <Button variant="outlined" component="label" startIcon={<CameraAlt />}>
              Upload Image
              <input type="file" accept="image/*" hidden onChange={handleOcrImageUpload} />
            </Button>
            {ocrImage && (
              <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => { setOcrImage(null); setOcrResult(''); setOcrParsedItems([]); setOcrConfidence(0); }}>
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
              <Button 
                variant="contained" 
                onClick={processOcrImage} 
                disabled={ocrLoading} 
                startIcon={ocrLoading ? <CircularProgress size={20} /> : <DocumentScanner />}
              >
                {ocrLoading ? 'Processing...' : 'Process Image'}
              </Button>
            </Box>
          )}

          {ocrConfidence > 0 && (
            <Alert severity={ocrConfidence > 60 ? 'success' : 'warning'} sx={{ mb: 2 }}>
              OCR Confidence: {Math.round(ocrConfidence)}%
            </Alert>
          )}

          {ocrResult && (
            <TextField 
              fullWidth 
              multiline 
              rows={4} 
              label="Extracted Text" 
              value={ocrResult} 
              InputProps={{ readOnly: true }} 
              sx={{ mb: 2 }} 
            />
          )}

          {ocrResult && ocrParsedItems.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Koi item automatically parse nahi hua. Aap "Add Row Manually" se items khud add kar sakte hain.
              <Box sx={{ mt: 1 }}>
                <Button size="small" variant="outlined" startIcon={<Add />} onClick={addManualOcrItem}>Add Row Manually</Button>
              </Box>
            </Alert>
          )}

          {ocrParsedItems.length > 0 && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                OCR se jo bhi galat aaye, neeche direct edit kar sakte hain — name, qty, price sab editable hain. Missing item ho to "Add Row" se manually add karein.
              </Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell width={100}>Qty</TableCell>
                      <TableCell width={140}>Price</TableCell>
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
              <Button size="small" startIcon={<Add />} onClick={addManualOcrItem} sx={{ mt: 1 }}>
                Add Row Manually
              </Button>
              <Box sx={{ mt: 1, textAlign: 'right' }}>
                <Typography variant="subtitle2">
                  Total Items: {ocrParsedItems.length} &nbsp;|&nbsp; Total Value: Rs. {ocrParsedItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0).toLocaleString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOcrDialog(false)}>Cancel</Button>
          <Button 
            variant="outlined" 
            onClick={applyOcrToPurchase} 
            disabled={ocrParsedItems.length === 0} 
            startIcon={<LocalShipping />}
          >
            Add to Purchase
          </Button>
          <Button 
            variant="contained" 
            onClick={applyOcrToProducts} 
            disabled={ocrParsedItems.length === 0} 
            startIcon={<Inventory />}
          >
            Create Products
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
