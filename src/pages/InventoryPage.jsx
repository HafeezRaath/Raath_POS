import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Tabs, Tab, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress, Autocomplete,
  TablePagination, Alert, Snackbar
} from '@mui/material';
import {
  Add, Edit, Delete, Search, QrCode, PhoneAndroid, Straighten,
  LocalGroceryStore, Save, Category, Scale, Inventory, LocalShipping,
  AddCircle, History, Warning, Close, Print, Visibility
} from '@mui/icons-material';
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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState(() => {
    const saved = localStorage.getItem('custom_units');
    return saved ? JSON.parse(saved) : DEFAULT_UNITS;
  });
  const [loading, setLoading] = useState(true);
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination
  const [productPage, setProductPage] = useState(0);
  const [productRowsPerPage, setProductRowsPerPage] = useState(10);
  const [purchasePage, setPurchasePage] = useState(0);
  const [purchaseRowsPerPage, setPurchaseRowsPerPage] = useState(10);

  // Dialog states
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [dialogProductType, setDialogProductType] = useState('standard');
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [unitDialog, setUnitDialog] = useState(false);

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    type: 'standard',
    category_id: '',
    unit: 'Piece',
    costPrice: '',
    retailPrice: '',
    wholesalePrice: '',
    barcode: '',
    stock: '',
    minStock: '5',
    tax: '0',
    imeiList: '',
    fabricLength: '',
    weight: '',
    expiryDate: '',
    batchNumber: '',
    description: '',
    status: 'active'
  });

  // Purchase states
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    supplier_name: '',
    purchase_no: `PUR-${Date.now()}`,
    supplier_invoice_no: '',
    purchase_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'received',
    discount_amount: '0',
    tax_amount: '0',
    shipping_charges: '0',
    notes: '',
    paid_amount: '0',
    payment_mode: 'cash'
  });
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_variant_id: '',
    product_name: '',
    sku: '',
    quantity: '1',
    purchase_price: '',
    tax_percentage: '0',
    expiry_date: '',
    imeiList: ''
  });
  const [viewPurchaseDialog, setViewPurchaseDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [purchaseItems, setPurchaseItems] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats, purchs, supps] = await Promise.all([
        db.getAllVariants ? db.getAllVariants() : db.getProducts(),
        db.getCategories(),
        db.getPurchases(),
        db.getSuppliers()
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setPurchases(Array.isArray(purchs) ? purchs : []);
      setSuppliers(Array.isArray(supps) ? supps : []);
    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      const matchCategory = !filterCategory || (p.category_name === filterCategory) || (p.category_id == filterCategory);
      const matchType = !filterType || (p.product_type === filterType) || (p.type === filterType);
      return matchSearch && matchCategory && matchType;
    });
  }, [products, searchProduct, filterCategory, filterType]);

  const resetProductForm = () => {
    setProductForm({
      name: '', sku: '', type: 'standard', category_id: '', unit: 'Piece',
      costPrice: '', retailPrice: '', wholesalePrice: '', barcode: '',
      stock: '', minStock: '5', tax: '0', imeiList: '', fabricLength: '',
      weight: '', expiryDate: '', batchNumber: '', description: '', status: 'active'
    });
    setDialogProductType('standard');
  };

  const handleOpenProduct = (product = null) => {
    setEditingProduct(product);
    if (product) {
      const meta = parseMeta(product.description);
      setDialogProductType(product.product_type || product.type || 'standard');
      setProductForm({
        name: product.product_name || product.name || '',
        sku: product.sku || '',
        type: product.product_type || product.type || 'standard',
        category_id: product.category_id || '',
        unit: product.base_unit || product.unit || 'Piece',
        costPrice: product.purchase_price || '',
        retailPrice: product.retail_price || '',
        wholesalePrice: product.wholesale_price || '',
        barcode: product.barcode || '',
        stock: product.current_stock || '',
        minStock: product.stock_alert_quantity || '5',
        tax: '0',
        imeiList: meta.imeiList?.join('\n') || '',
        fabricLength: meta.fabricLength || '',
        weight: meta.weight || '',
        expiryDate: meta.expiryDate || '',
        batchNumber: meta.batchNumber || '',
        description: product.description && !meta.batchNumber ? product.description : '',
        status: product.status || 'active'
      });
    } else {
      resetProductForm();
    }
    setProductDialog(true);
  };

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));
    if (name === 'type') setDialogProductType(value);
  };

  // FIXED: Auto merging iPhone duplicate SKUs flawlessly + Adding IMEIs safely
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const sku = productForm.sku.trim();
    if (!productForm.name.trim() || !sku) {
      setSnackbar({ open: true, message: 'Name and SKU required!', severity: 'error' });
      return;
    }

    const meta = {};
    if (productForm.type === 'imei' && productForm.imeiList) {
      meta.imeiList = productForm.imeiList.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (productForm.type === 'fabric') meta.fabricLength = Number(productForm.fabricLength) || 0;
    if (productForm.type === 'grocery') {
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }

    const productData = {
      name: productForm.name, brand_id: null, category_id: Number(productForm.category_id) || null,
      type: productForm.type, unit: productForm.unit, tax_type: 'inclusive',
      description: JSON.stringify(meta), status: productForm.status
    };

    const variantData = {
      sku: sku, barcode: productForm.barcode || null,
      variant_name: productForm.type === 'fabric' ? `${productForm.fabricLength || 0}m per than` : 'Default',
      purchase_price: Number(productForm.costPrice) || 0, retail_price: Number(productForm.retailPrice) || 0,
      wholesale_price: Number(productForm.wholesalePrice) || 0, minimum_retail_price: Number(productForm.retailPrice) || 0,
      stock_alert_quantity: Number(productForm.minStock) || 5, current_stock: Number(productForm.stock) || 0
    };

    try {
      if (editingProduct) {
        await db.updateProduct(editingProduct.product_id || editingProduct.id, productData);
        await db.updateVariant(editingProduct.id, variantData);
      } else {
        const existingVariant = await db.getVariantBySKU ? await db.getVariantBySKU(sku) : null;
        if (existingVariant) {
          const addedStock = Number(productForm.stock) || 0;
          await db.updateVariantStock(existingVariant.id, addedStock);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            await db.addMultipleSerializedItems(existingVariant.id, meta.imeiList);
          }
        } else {
          const prodResult = await db.addProduct(productData);
          variantData.product_id = prodResult.lastInsertRowid;
          const varResult = await db.addVariant(variantData);
          if (productForm.type === 'imei' && meta.imeiList?.length > 0) {
            await db.addMultipleSerializedItems(varResult.lastInsertRowid, meta.imeiList);
          }
        }
      }
      await loadData();
      setProductDialog(false);
      setEditingProduct(null);
      resetProductForm();
      setSnackbar({ open: true, message: 'Product configuration saved!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving product: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Delete this product?')) {
      try {
        await db.deleteVariant(id);
        await loadData();
        setSnackbar({ open: true, message: 'Product deleted successfully!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await db.addCategory({
        name: form.categoryName.value,
        slug: form.categoryName.value.toLowerCase().replace(/\s+/g, '-'),
        parent_id: form.parent_id.value ? Number(form.parent_id.value) : null,
        status: 'active'
      });
      await loadData();
      form.reset();
      setCategoryDialog(false);
      setSnackbar({ open: true, message: 'Category saved!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Delete this category?')) {
      try {
        await db.deleteCategory(id);
        await loadData();
        setSnackbar({ open: true, message: 'Category deleted!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    }
  };

  const handleAddUnit = (e) => {
    e.preventDefault();
    const newUnit = e.target.unitName.value.trim();
    if (newUnit && !units.includes(newUnit)) {
      const updated = [...units, newUnit];
      setUnits(updated);
      localStorage.setItem('custom_units', JSON.stringify(updated));
      e.target.reset();
      setSnackbar({ open: true, message: 'Unit registered!', severity: 'success' });
    }
  };

  const handleDeleteUnit = (unitToDelete) => {
    if (window.confirm(`Delete unit "${unitToDelete}"?`)) {
      const updated = units.filter(u => u !== unitToDelete);
      setUnits(updated);
      localStorage.setItem('custom_units', JSON.stringify(updated));
      setSnackbar({ open: true, message: 'Unit removed.', severity: 'success' });
    }
  };

  // ==================== PURCHASE FUNCTIONS (FIXED IMEI & LEDGER SYNC) ====================

  const handleOpenPurchase = (purchase = null) => {
    setEditingPurchase(purchase);
    if (purchase) {
      setPurchaseForm({
        supplier_id: purchase.supplier_id || '',
        supplier_name: purchase.supplier_name || '',
        purchase_no: purchase.purchase_no || `PUR-${Date.now()}`,
        supplier_invoice_no: purchase.supplier_invoice_no || '',
        purchase_date: purchase.purchase_date ? purchase.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
        due_date: purchase.due_date ? purchase.due_date.split('T')[0] : '',
        status: purchase.status || 'received',
        discount_amount: String(purchase.discount_amount || '0'),
        tax_amount: String(purchase.tax_amount || '0'),
        shipping_charges: String(purchase.shipping_charges || '0'),
        notes: purchase.notes || '',
        paid_amount: String(purchase.paid_amount || '0'),
        payment_mode: purchase.payment_mode || 'cash'
      });
      db.getPurchaseItems(purchase.id).then(resItems => {
        setItems(Array.isArray(resItems) ? resItems.map(i => ({
          ...i,
          product_variant_id: i.product_variant_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: String(i.quantity),
          purchase_price: String(i.purchase_price),
          tax_percentage: String(i.tax_percentage || 0),
          expiry_date: i.expiry_date ? i.expiry_date.split('T')[0] : '',
          sub_total: i.sub_total,
          imeiList: ''
        })) : []);
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
    setCurrentItem({ product_variant_id: '', product_name: '', sku: '', quantity: '1', purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: '' });
    setPurchaseDialog(true);
  };

  const handlePurchaseChange = (e) => {
    const { name, value } = e.target;
    setPurchaseForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSupplierSelect = (e) => {
    const supplierId = e.target.value;
    const supplier = suppliers.find(s => s.id == supplierId);
    setPurchaseForm(prev => ({ ...prev, supplier_id: supplierId, supplier_name: supplier ? supplier.name : '' }));
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setCurrentItem(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSelect = (e, value) => {
    if (value) {
      setCurrentItem(prev => ({
        ...prev,
        product_variant_id: value.id,
        product_name: value.product_name || value.name,
        sku: value.sku,
        purchase_price: String(value.purchase_price || ''),
        tax_percentage: '0',
        type: value.product_type || value.type || 'standard'
      }));
    }
  };

  const handleAddItem = () => {
    if (!currentItem.product_variant_id) {
      setSnackbar({ open: true, message: 'Please select a product!', severity: 'error' });
      return;
    }
    const qty = Number(currentItem.quantity) || 0;
    if (qty <= 0) {
      setSnackbar({ open: true, message: 'Quantity must be greater than 0!', severity: 'error' });
      return;
    }

    if (currentItem.type === 'imei') {
      const imeis = (currentItem.imeiList || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (imeis.length !== qty) {
        alert(`IMEI count mismatch! Expected ${qty}, but got ${imeis.length}. Please enter exactly 1 IMEI per line.`);
        return;
      }
    }

    const subTotal = calculateItemTotal(currentItem.quantity, currentItem.purchase_price, currentItem.tax_percentage);
    setItems(prev => [...prev, { ...currentItem, sub_total: subTotal, id: `temp-${Date.now()}` }]);
    setCurrentItem({ product_variant_id: '', product_name: '', sku: '', quantity: '1', purchase_price: '', tax_percentage: '0', expiry_date: '', imeiList: '' });
  };

  const handleRemoveItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));
  const calculateItemTotal = (qty, price, tax) => (Number(qty) || 0) * (Number(price) || 0) * (1 + (Number(tax) || 0) / 100);

  const calculatePurchaseTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.sub_total) || 0), 0);
    const grandTotal = subtotal - (Number(purchaseForm.discount_amount) || 0) + (Number(purchaseForm.tax_amount) || 0) + (Number(purchaseForm.shipping_charges) || 0);
    const balance = grandTotal - (Number(purchaseForm.paid_amount) || 0);
    return { subtotal, grandTotal, balance, paid: Number(purchaseForm.paid_amount) || 0 };
  };

  // CRITICAL FIXED SAVING MACHINE: Automatically mapping child IMEIs & General Ledger
  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplier_id) return alert('Select supplier!');
    if (items.length === 0) return alert('Add items first!');

    const totals = calculatePurchaseTotals();
    const purchaseData = {
      supplier_id: Number(purchaseForm.supplier_id), purchase_no: purchaseForm.purchase_no,
      supplier_invoice_no: purchaseForm.supplier_invoice_no, purchase_date: purchaseForm.purchase_date,
      due_date: purchaseForm.due_date || null, status: purchaseForm.status, total_amount: totals.subtotal,
      discount_amount: Number(purchaseForm.discount_amount) || 0, tax_amount: Number(purchaseForm.tax_amount) || 0,
      shipping_charges: Number(purchaseForm.shipping_charges) || 0, grand_total: totals.grandTotal,
      paid_amount: totals.paid, payment_status: totals.balance <= 0 ? 'paid' : (totals.paid > 0 ? 'partial' : 'due'),
      notes: purchaseForm.notes, payment_mode: purchaseForm.payment_mode
    };

    try {
      let purchaseId;
      if (editingPurchase) {
        await db.updatePurchase(editingPurchase.id, purchaseData);
        purchaseId = editingPurchase.id;
      } else {
        const result = await db.addPurchase(purchaseData);
        purchaseId = result.lastInsertRowid;
      }

      if (!editingPurchase) {
        for (const item of items) {
          await db.addPurchaseItem({
            purchase_id: purchaseId, product_variant_id: item.product_variant_id,
            quantity: Number(item.quantity), purchase_price: Number(item.purchase_price),
            tax_percentage: Number(item.tax_percentage), sub_total: item.sub_total, expiry_date: item.expiry_date || null
          });
          await db.updateVariantStock(item.product_variant_id, Number(item.quantity));

          // FIXED: Appending live IMEI arrays direct into serialized schema during purchase flow
          if (item.type === 'imei' && item.imeiList) {
            const imeis = item.imeiList.split('\n').map(s => s.trim()).filter(Boolean);
            if (imeis.length > 0) {
              await db.addMultipleSerializedItems(item.product_variant_id, imeis);
            }
          }
        }

        if (totals.balance > 0) {
          await db.updateSupplierBalance(purchaseForm.supplier_id, totals.balance);
          await db.addLedgerEntry({
            supplier_id: purchaseForm.supplier_id, type: 'purchase', amount: totals.balance,
            description: `Purchase ${purchaseForm.purchase_no} - Ledger Registered`, date: purchaseForm.purchase_date
          });
        }

        if (db.logToGeneralLedger) {
          await db.logToGeneralLedger('purchase', purchaseId, 0, totals.grandTotal, `Purchase Order: ${purchaseForm.purchase_no}`);
        }
      }

      await loadData();
      setPurchaseDialog(false);
      setEditingPurchase(null);
      setItems([]);
      setSnackbar({ open: true, message: 'Stock Ledger Successfully Synchronized!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving purchase: ' + err.message, severity: 'error' });
    }
  };

  const handleDeletePurchase = async (id) => {
    if (window.confirm('Delete this purchase? This will not reverse stock.')) {
      try {
        await db.deletePurchase(id);
        await loadData();
        setSnackbar({ open: true, message: 'Purchase record flushed!', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      }
    }
  };

  const handleViewPurchase = async (purchase) => {
    setSelectedPurchase(purchase);
    try {
      const pItems = await db.getPurchaseItems(purchase.id);
      setPurchaseItems(Array.isArray(pItems) ? pItems : []);
      setViewPurchaseDialog(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  const getPaymentStatusChip = (status) => {
    const statusMap = {
      paid: <Chip size="small" color="success" label="Paid" />,
      partial: <Chip size="small" color="warning" label="Partial" />,
      due: <Chip size="small" color="error" label="Due" />
    };
    return statusMap[status] || <Chip size="small" label={status} />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        <Inventory sx={{ mr: 1, verticalAlign: 'middle' }} />
        Inventory Management
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Inventory fontSize="small" />} label="Products" />
          <Tab icon={<Category fontSize="small" />} label="Categories" />
          <Tab icon={<Scale fontSize="small" />} label="Units" />
          <Tab icon={<LocalShipping fontSize="small" />} label="Purchases" />
        </Tabs>
      </Paper>

      {/* ==================== PRODUCTS TAB ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" placeholder="Search by name or SKU..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Product Type</InputLabel>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Product Type">
                      <MenuItem value="">All Types</MenuItem>
                      {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth variant="contained" startIcon={<Add />} onClick={() => handleOpenProduct()}>Add Product</Button>
                </Grid>
              </Grid>
            </Paper>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>SKU</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Stock</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Prices</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts
                    .slice(productPage * productRowsPerPage, productPage * productRowsPerPage + productRowsPerPage)
                    .map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{product.product_name || product.name}</Typography>
                        {product.barcode && <Typography variant="caption" color="text.secondary"><QrCode fontSize="inherit" /> {product.barcode}</Typography>}
                      </TableCell>
                      <TableCell><Chip label={product.sku} size="small" variant="outlined" /></TableCell>
                      <TableCell>{getTypeChip(product.product_type || product.type)}</TableCell>
                      <TableCell>{product.category_name || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight="bold">{product.current_stock || 0}</Typography>
                          <Typography variant="caption" color="text.secondary">{product.base_unit || product.unit}</Typography>
                        </Box>
                        {getStockBadge(product.current_stock, product.stock_alert_quantity)}
                      </TableCell>
                      <TableCell><Chip size="small" color={product.status === 'active' ? 'success' : 'default'} label={product.status} /></TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="caption">Cost: {formatCurrency(product.purchase_price)}</Typography>
                          <Typography variant="caption">Retail: {formatCurrency(product.retail_price)}</Typography>
                          <Typography variant="caption">Wholesale: {formatCurrency(product.wholesale_price)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="primary" onClick={() => handleOpenProduct(product)}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteProduct(product.id)}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination component="div" count={filteredProducts.length} page={productPage} onPageChange={(e, p) => setProductPage(p)} rowsPerPage={productRowsPerPage} onRowsPerPageChange={(e) => { setProductRowsPerPage(parseInt(e.target.value, 10)); setProductPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} />
            </TableContainer>
          </Box>
        </Fade>
      )}

      {/* ==================== CATEGORIES TAB ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => setCategoryDialog(true)}>Add Category</Button>
            </Box>
            <Grid container spacing={2}>
              {categories.map(cat => (
                <Grid item xs={12} sm={6} md={4} key={cat.id}>
                  <Card><CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6">{cat.name}</Typography>
                        {cat.parent_name && <Typography variant="caption" color="text.secondary">Parent: {cat.parent_name}</Typography>}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Slug: {cat.slug}</Typography>
                      </Box>
                      <IconButton size="small" color="error" onClick={() => handleDeleteCategory(cat.id)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </CardContent></Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== UNITS TAB ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
              <form onSubmit={handleAddUnit}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}><TextField fullWidth size="small" name="unitName" label="New Unit Name" required /></Grid>
                  <Grid item xs={12} md={2}><Button type="submit" variant="contained" startIcon={<Add />} fullWidth>Add Unit</Button></Grid>
                </Grid>
              </form>
            </Paper>
            <Paper>
              <List>
                {units.map((unit, idx) => (
                  <ListItem key={idx} secondaryAction={<IconButton edge="end" color="error" onClick={() => handleDeleteUnit(unit)}><Delete fontSize="small" /></IconButton>}>
                    <ListItemText primary={unit} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* ==================== PURCHASES TAB ==================== */}
      {activeTab === 3 && (
        <Fade in>
          <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenPurchase()}>New Purchase</Button>
            </Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Purchase #</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Supplier</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Total</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Paid</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchases.slice(purchasePage * purchaseRowsPerPage, purchasePage * purchaseRowsPerPage + purchaseRowsPerPage).map((purchase) => (
                    <TableRow key={purchase.id} hover>
                      <TableCell><Typography variant="subtitle2">{purchase.purchase_no}</Typography>{purchase.supplier_invoice_no && <Typography variant="caption" color="text.secondary">Inv: {purchase.supplier_invoice_no}</Typography>}</TableCell>
                      <TableCell><Typography variant="body2">{purchase.supplier_name}</Typography></TableCell>
                      <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell><Chip size="small" color={purchase.status === 'received' ? 'success' : 'warning'} label={purchase.status} /></TableCell>
                      <TableCell>{formatCurrency(purchase.grand_total)}</TableCell>
                      <TableCell>{formatCurrency(purchase.paid_amount)}</TableCell>
                      <TableCell>{getPaymentStatusChip(purchase.payment_status)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="info" onClick={() => handleViewPurchase(purchase)}><Visibility fontSize="small" /></IconButton>
                        <IconButton size="small" color="primary" onClick={() => handleOpenPurchase(purchase)}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeletePurchase(purchase.id)}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination component="div" count={purchases.length} page={purchasePage} onPageChange={(e, p) => setPurchasePage(p)} rowsPerPage={purchaseRowsPerPage} onRowsPerPageChange={(e) => { setPurchaseRowsPerPage(parseInt(e.target.value, 10)); setPurchasePage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} />
            </TableContainer>
          </Box>
        </Fade>
      )}

      {/* PRODUCT DIALOG */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSaveProduct}>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}><TextField fullWidth label="Product Name *" name="name" value={productForm.name} onChange={handleProductChange} required /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="SKU *" name="sku" value={productForm.sku} onChange={handleProductChange} required /></Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Product Type</InputLabel>
                  <Select name="type" value={productForm.type} onChange={handleProductChange} label="Product Type">
                    {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select name="category_id" value={productForm.category_id} onChange={handleProductChange} label="Category">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
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
              <Grid item xs={12} md={4}><TextField fullWidth label="Barcode" name="barcode" value={productForm.barcode} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start"><QrCode /></InputAdornment> }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Current Stock" name="stock" type="number" value={productForm.stock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Min Stock Alert" name="minStock" type="number" value={productForm.minStock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Cost Price" name="costPrice" type="number" value={productForm.costPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Retail Price" name="retailPrice" type="number" value={productForm.retailPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Wholesale Price" name="wholesalePrice" type="number" value={productForm.wholesalePrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} /></Grid>

              {dialogProductType === 'imei' && (
                <Grid item xs={12}><TextField fullWidth multiline rows={4} label="IMEI / Serial Numbers (one per line)" name="imeiList" value={productForm.imeiList} onChange={handleProductChange} /></Grid>
              )}
              {dialogProductType === 'fabric' && (
                <Grid item xs={12} md={6}><TextField fullWidth label="Fabric Length" name="fabricLength" type="number" value={productForm.fabricLength} onChange={handleProductChange} /></Grid>
              )}
              {dialogProductType === 'grocery' && (
                <>
                  <Grid item xs={12} md={4}><TextField fullWidth label="Weight (kg)" name="weight" type="number" value={productForm.weight} onChange={handleProductChange} /></Grid>
                  <Grid item xs={12} md={4}><TextField fullWidth label="Expiry Date" name="expiryDate" type="date" value={productForm.expiryDate} onChange={handleProductChange} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid item xs={12} md={4}><TextField fullWidth label="Batch Number" name="batchNumber" value={productForm.batchNumber} onChange={handleProductChange} /></Grid>
                </>
              )}
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Description" name="description" value={productForm.description} onChange={handleProductChange} /></Grid>
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
            <Button type="submit" variant="contained" startIcon={<Save />}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CATEGORY DIALOG */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Category</DialogTitle>
        <form onSubmit={handleAddCategory}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Category Name" name="categoryName" required /></Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Parent Category</InputLabel>
                  <Select name="parent_id" defaultValue="">
                    <MenuItem value="">None</MenuItem>
                    {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCategoryDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* PURCHASE DIALOG */}
      <Dialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleSavePurchase}>
          <DialogTitle>{editingPurchase ? 'Edit Purchase' : 'New Purchase'}</DialogTitle>
          <DialogContent>
            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'background.default' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Purchase #" name="purchase_no" value={purchaseForm.purchase_no} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Supplier *</InputLabel>
                    <Select name="supplier_id" value={purchaseForm.supplier_id} onChange={handleSupplierSelect} required label="Supplier *">
                      {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Supplier Invoice #" name="supplier_invoice_no" value={purchaseForm.supplier_invoice_no} onChange={handlePurchaseChange} /></Grid>
                <Grid item xs={12} md={3}><FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select name="status" value={purchaseForm.status} onChange={handlePurchaseChange}>{/* options */}<MenuItem value="received">Received</MenuItem><MenuItem value="ordered">Ordered</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" name="purchase_date" value={purchaseForm.purchase_date} onChange={handlePurchaseChange} InputLabelProps={{ shrink: true }} required /></Grid>
                <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" name="due_date" value={purchaseForm.due_date} onChange={handlePurchaseChange} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Mode</InputLabel>
                    <Select name="payment_mode" value={purchaseForm.payment_mode} onChange={handlePurchaseChange}>
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="bank">Bank Transfer</MenuItem>
                      <MenuItem value="credit">Credit</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Paid Amount" name="paid_amount" type="number" value={purchaseForm.paid_amount} onChange={handlePurchaseChange} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} /></Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} md={4}>
                  <Autocomplete size="small" options={products} getOptionLabel={(option) => `${option.product_name || option.name} (${option.sku})`} onChange={handleProductSelect} renderInput={(params) => <TextField {...params} label="Select Product" />} />
                </Grid>
                <Grid item xs={6} md={2}><TextField fullWidth size="small" label="Qty" name="quantity" type="number" value={currentItem.quantity} onChange={handleItemChange} /></Grid>
                <Grid item xs={6} md={2}><TextField fullWidth size="small" label="Price" name="purchase_price" type="number" value={currentItem.purchase_price} onChange={handleItemChange} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} /></Grid>
                <Grid item xs={6} md={2}><TextField fullWidth size="small" label="Tax %" name="tax_percentage" type="number" value={currentItem.tax_percentage} onChange={handleItemChange} /></Grid>
                <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" name="expiry_date" value={currentItem.expiry_date} onChange={handleItemChange} InputLabelProps={{ shrink: true }} /></Grid>
                
                {currentItem.type === 'imei' && (
                  <Grid item xs={12}>
                    <TextField fullWidth multiline rows={2} label={`Enter ${currentItem.quantity} IMEIs (one per line)`} name="imeiList" value={currentItem.imeiList || ''} onChange={handleItemChange} helperText="Required for IMEI products." />
                  </Grid>
                )}
                
                <Grid item xs={12}><Button variant="outlined" startIcon={<AddCircle />} onClick={handleAddItem} fullWidth>Add Item</Button></Grid>
              </Grid>
            </Paper>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(item.purchase_price)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.sub_total)}</TableCell>
                      <TableCell align="right"><IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}><Delete fontSize="small" /></IconButton></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Paper sx={{ p: 2, minWidth: 300 }}>
                {(() => {
                  const totals = calculatePurchaseTotals();
                  return (
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between"><Typography>Subtotal:</Typography><Typography fontWeight="bold">{formatCurrency(totals.subtotal)}</Typography></Box>
                      <Box display="flex" justifyContent="space-between"><Typography>Grand Total:</Typography><Typography variant="h6" color="primary" fontWeight="bold">{formatCurrency(totals.grandTotal)}</Typography></Box>
                      <Box display="flex" justifyContent="space-between"><Typography>Balance Due:</Typography><Typography color="error.main" fontWeight="bold">{formatCurrency(totals.balance)}</Typography></Box>
                    </Stack>
                  );
                })()}
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPurchaseDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>Save Purchase</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* VIEW PURCHASE DIALOG */}
      <Dialog open={viewPurchaseDialog} onClose={() => setViewPurchaseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Purchase Details - {selectedPurchase?.purchase_no}</DialogTitle>
        <DialogContent>
          {selectedPurchase && (
            <Box>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.purchase_price)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.sub_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewPurchaseDialog(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}><Alert severity={snackbar.severity}>{snackbar.message}</Alert></Snackbar>
    </Box>
  );
}