import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Tabs, Tab, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, MenuItem, Chip,
  FormControl, InputLabel, Select, Card, CardContent,
  Divider, InputAdornment, Tooltip, Fade, Stack,
  List, ListItem, ListItemText, CircularProgress
} from '@mui/material';
import {
  Add, Edit, Delete, Search, QrCode, PhoneAndroid, Straighten,
  LocalGroceryStore, Save, Category, Scale, Inventory, LocalShipping,
  AddCircle, History, Warning,
  KeyboardArrowDown, KeyboardArrowUp
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

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState(() => {
    const saved = localStorage.getItem('custom_units');
    return saved ? JSON.parse(saved) : DEFAULT_UNITS;
  });
  const [loading, setLoading] = useState(true);
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterType, setFilterType] = useState('');

  // Dialog states
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [dialogProductType, setDialogProductType] = useState('standard');
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [unitDialog, setUnitDialog] = useState(false);

  // Variant Dialog States
  const [variantDialog, setVariantDialog] = useState(false);
  const [variantParent, setVariantParent] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: '',
    variantName: '',
    costPrice: '',
    retailPrice: '',
    wholesalePrice: '',
    stock: '',
    barcode: '',
    imeiList: ''
  });

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
    status: 'active',
    variant_name: 'Default'
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
  const [priceHistory, setPriceHistory] = useState([]);

  // Expand/Collapse Groups
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroup = (productId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, brnds, purchs, supps] = await Promise.all([
        db.getAllVariants ? db.getAllVariants() : db.getProducts(),
        db.getCategories(),
        db.getBrands ? db.getBrands() : Promise.resolve([]),
        db.getPurchases(),
        db.getSuppliers()
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      setBrands(brnds || []);
      setPurchases(purchs || []);
      setSuppliers(supps || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      if (!groups.has(pid)) {
        groups.set(pid, { parent: p, variants: [] });
      }
      groups.get(pid).variants.push(p);
    });
    return Array.from(groups.values());
  }, [filteredProducts]);

  const resetProductForm = useCallback(() => {
    const last = JSON.parse(localStorage.getItem('last_product_defaults') || '{}');
    setProductForm({
      name: '',
      sku: '',
      type: last.type || 'standard',
      category_id: last.category_id || '',
      unit: last.unit || 'Piece',
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
      status: 'active',
      variant_name: 'Default'
    });
    setDialogProductType(last.type || 'standard');
  }, []);

  const handleOpenProduct = useCallback((product = null) => {
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
        status: product.status || 'active',
        variant_name: product.variant_name || 'Default'
      });
    } else {
      resetProductForm();
    }
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
      alert('Name and SKU required!');
      return;
    }

    const meta = {};
    if (productForm.type === 'imei' && productForm.imeiList) {
      meta.imeiList = productForm.imeiList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    if (productForm.type === 'fabric') {
      meta.fabricLength = Number(productForm.fabricLength) || 0;
    }
    if (productForm.type === 'grocery') {
      meta.weight = Number(productForm.weight) || 0;
      meta.expiryDate = productForm.expiryDate;
      meta.batchNumber = productForm.batchNumber;
    }

    const productData = {
      name: productForm.name,
      brand_id: null,
      category_id: Number(productForm.category_id) || null,
      type: productForm.type,
      unit: productForm.unit,
      tax_type: 'inclusive',
      description: JSON.stringify(meta),
      status: productForm.status
    };

    const variantData = {
      sku: sku,
      barcode: productForm.barcode || null,
      variant_name: productForm.variant_name || (productForm.type === 'fabric' ? `${productForm.fabricLength || 0}m per than` : 'Default'),
      purchase_price: Number(productForm.costPrice) || 0,
      retail_price: Number(productForm.retailPrice) || 0,
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
        type: productForm.type,
        category_id: productForm.category_id,
        unit: productForm.unit
      }));
      await loadData();
      setProductDialog(false);
      setEditingProduct(null);
      resetProductForm();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving product: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Delete this product permanently? This cannot be undone!')) {
      try {
        const variant = products.find(p => p.id == id);
        if (variant) {
          const productId = variant.product_id;
          const siblingVariants = products.filter(p => p.product_id === productId);
          
          await db.deleteVariant(id);
          if (siblingVariants.length <= 1) {
            await db.deleteProduct(productId);
          }
        }
        await loadData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleOpenVariant = (parentProduct) => {
    setVariantParent(parentProduct);
    setVariantForm({
      sku: parentProduct.sku || '',
      variantName: '',
      costPrice: parentProduct.purchase_price || '',
      retailPrice: parentProduct.retail_price || '',
      wholesalePrice: parentProduct.wholesale_price || '',
      stock: '',
      barcode: '',
      imeiList: ''
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
          product_id: variantParent.product_id,
          sku: sku,
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

      await loadData();
      setVariantDialog(false);
      setVariantParent(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await db.createCategory({
        name: form.categoryName.value,
        slug: form.categoryName.value.toLowerCase().replace(/\s+/g, '-'),
        parent_id: form.parent_id.value ? Number(form.parent_id.value) : null,
        status: 'active'
      });
      await loadData();
      form.reset();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Delete this category?')) {
      try {
        await db.deleteCategory(id);
        await loadData();
      } catch (err) {
        alert('Error: ' + err.message);
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
    }
    e.target.reset();
  };

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
        discount_amount: String(purchase.discount_amount || 0),
        tax_amount: String(purchase.tax_amount || 0),
        shipping_charges: String(purchase.shipping_charges || 0),
        notes: purchase.notes || '',
        paid_amount: String(purchase.paid_amount || 0),
        payment_mode: purchase.payment_mode || 'cash'
      });
    } else {
      setPurchaseForm({
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
      setItems([]);
    }
    setCurrentItem({
      product_variant_id: '',
      product_name: '',
      sku: '',
      quantity: '1',
      purchase_price: '',
      tax_percentage: '0',
      expiry_date: '',
      imeiList: ''
    });
    setPriceHistory([]);
    setPurchaseDialog(true);
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
    } catch {
      setPriceHistory([]);
    }
    setCurrentItem(prev => ({
      ...prev,
      product_variant_id: variantId,
      product_name: product.product_name || product.name,
      sku: product.sku,
      purchase_price: product.purchase_price || '',
      quantity: '1',
      imeiList: ''
    }));
  };

  const addItem = () => {
    if (!currentItem.product_variant_id || !currentItem.purchase_price) return;
    
    const selectedProduct = products.find(p => p.id == currentItem.product_variant_id);
    const qty = parseFloat(currentItem.quantity) || 1;
    
    if (selectedProduct?.product_type === 'imei' || selectedProduct?.type === 'imei') {
      const imeis = (currentItem.imeiList || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (imeis.length !== qty) {
        alert(`IMEI count mismatch! Expected ${qty}, got ${imeis.length}.`);
        return;
      }
    }

    const price = parseFloat(currentItem.purchase_price) || 0;
    const tax = parseFloat(currentItem.tax_percentage) || 0;
    const subTotal = qty * price;
    const taxAmount = subTotal * (tax / 100);
    setItems(prev => [...prev, { 
      ...currentItem, 
      quantity: qty, 
      purchase_price: price, 
      tax_percentage: tax, 
      sub_total: subTotal + taxAmount, 
      expiry_date: currentItem.expiry_date,
      imeiList: currentItem.imeiList
    }]);
    setCurrentItem({ 
      product_variant_id: '', 
      product_name: '', 
      sku: '', 
      quantity: '1', 
      purchase_price: '', 
      tax_percentage: '0', 
      expiry_date: '',
      imeiList: ''
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
        supplier_id: parseInt(purchaseForm.supplier_id),
        purchase_no: purchaseForm.purchase_no,
        supplier_invoice_no: purchaseForm.supplier_invoice_no,
        purchase_date: purchaseForm.purchase_date,
        due_date: purchaseForm.due_date || null,
        status: purchaseForm.status,
        total_amount: subTotal,
        discount_amount: discount,
        tax_amount: totalTax,
        shipping_charges: shipping,
        grand_total: grandTotal,
        paid_amount: paid,
        payment_status: paid >= grandTotal ? 'paid' : paid > 0 ? 'partial' : 'due',
        notes: purchaseForm.notes,
        created_by: 1
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
            purchase_id: purchaseId,
            product_variant_id: item.product_variant_id,
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            tax_percentage: item.tax_percentage,
            sub_total: item.sub_total,
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
            supplier_id: purchaseForm.supplier_id,
            type: 'purchase',
            amount: due,
            description: `Purchase ${purchaseForm.purchase_no} - Stock Added`
          });
        }
        
        if (db.logToGeneralLedger) {
          await db.logToGeneralLedger('purchase', purchaseId, 0, grandTotal, `Purchase Bill ${purchaseForm.purchase_no}`);
        }
      }
      
      alert('Purchase saved!');
      setPurchaseDialog(false);
      setEditingPurchase(null);
      setItems([]);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeletePurchase = async (id) => {
    if (window.confirm('Delete this purchase record?')) {
      try {
        await db.deletePurchase(id);
        await loadData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
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
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Inventory Management
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="fullWidth" textColor="primary" indicatorColor="primary">
          <Tab icon={<Inventory />} label="Products" iconPosition="start" />
          <Tab icon={<LocalShipping />} label="Purchases" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* PRODUCTS TAB */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField fullWidth size="small" placeholder="Search by name or SKU..."
                    value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)}
                    InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel shrink>Category</InputLabel>
                    <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} label="Category">
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel shrink>Brand</InputLabel>
                    <Select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} label="Brand">
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => (
                        <MenuItem key={b.id} value={b.name}>{b.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel shrink>Type</InputLabel>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
                      <MenuItem value="">All Types</MenuItem>
                      {PRODUCT_TYPES.map(t => (
                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="outlined" size="small" startIcon={<Category />} onClick={() => setCategoryDialog(true)}>Categories</Button>
                    <Button variant="outlined" size="small" startIcon={<Scale />} onClick={() => setUnitDialog(true)}>Units</Button>
                    <Button variant="contained" size="small" startIcon={<Add />} onClick={() => handleOpenProduct()}>Add Product</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Product Grid Layout */}
            <Paper sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              {/* FIXED: Balanced grid column layout widths from '11fr' to '1.5fr' to prevent text squishing */}
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: '40px 2fr 1.5fr 1.5fr 100px 120px', 
                p: '12px 16px', 
                bgcolor: '#f5f5f5', 
                fontWeight: 600,
                fontSize: 13,
                color: '#666',
                borderBottom: '2px solid #e0e0e0'
              }}>
                <div></div>
                <div>Product Name</div>
                <div>Brand / Category</div>
                <div>SKU</div>
                <div style={{ textAlign: 'center' }}>Stock</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </Box>

              <Box sx={{ borderTop: 'none' }}>
                {groupedProducts.length === 0 && (
                  <Box sx={{ p: 5, textAlign: 'center', color: '#999' }}>No products found</Box>
                )}

                {groupedProducts.map(({ parent, variants }) => {
                  const isExpanded = expandedGroups.has(parent.product_id);
                  const totalStock = variants.reduce((sum, v) => sum + (Number(v.current_stock) || 0), 0);

                  return (
                    <Box key={parent.product_id} sx={{ borderBottom: '1px solid #f0f0f0' }}>
                      {/* FIXED: Body row grid matching identical spacing framework layout specs */}
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 2fr 1.5fr 1.5fr 100px 120px', 
                        p: '14px 16px', 
                        alignItems: 'center',
                        bgcolor: isExpanded ? '#e3f2fd' : '#fff',
                        transition: 'background 0.2s'
                      }}>
                        <button 
                          type="button"
                          onClick={() => toggleGroup(parent.product_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: '#1976d2' }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>

                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#333' }}>{parent.product_name}</Typography>
                          <Typography sx={{ fontSize: 12, color: '#888', mt: 0.25 }}>
                            {parent.description ? parseMeta(parent.description).batchNumber || '' : ''}
                          </Typography>
                          <Stack direction="row" spacing={0.5} mt={0.5}>
                            {getTypeChip(parent.product_type || parent.type)}
                            {/* FIXED: Direct data backup parsing mapping variables */}
                            <Chip size="small" label={parent.category_name || '-'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          </Stack>
                        </Box>

                        <Box sx={{ fontSize: 13, color: '#666' }}>
                          <div>{parent.brand_name || '-'}</div>
                          {/* FIXED: Dual key mapping model for real-time validation fallback safety */}
                          <div style={{ fontSize: 12, color: '#1976d2', fontWeight: 500 }}>{parent.category_name || '-'}</div>
                        </Box>

                        <Box sx={{ fontSize: 13, color: '#666', fontFamily: 'monospace' }}>
                          {variants.length === 1 ? variants[0].sku : `${variants.length} variants`}
                        </Box>

                        <Box sx={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#fff', background: getStockColor(totalStock, parent.stock_alert_quantity || 5) }}>
                            {totalStock}
                          </span>
                        </Box>

                        <Box sx={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleOpenVariant(parent)} style={{ padding: '6px 10px', fontSize: 12, background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} title="Add Variant">+V</button>
                          <button onClick={() => handleOpenProduct(parent)} style={{ padding: '6px 10px', fontSize: 12, background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => handleDeleteProduct(parent.id || variants[0]?.id)} style={{ padding: '6px 10px', fontSize: 12, background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Del</button>
                        </Box>
                      </Box>

                      {isExpanded && variants && variants.length > 0 && (
                        <Box sx={{ bgcolor: '#fafafa' }}>
                          {variants.map((variant, idx) => (
                            <Box 
                              key={variant.id} 
                              sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: '40px 2fr 1.5fr 1.5fr 100px 120px', 
                                p: '12px 16px 12px 56px', 
                                alignItems: 'center',
                                borderTop: idx === 0 ? '1px dashed #e0e0e0' : '1px solid #f5f5f5',
                                fontSize: 14
                              }}
                            >
                              <div></div>
                              <Box><span style={{ color: '#555' }}>{variant.variant_name || 'Default'}</span></Box>
                              <Box sx={{ fontSize: 12, color: '#888' }}>Purchase: Rs. {variant.purchase_price?.toLocaleString() || 0}</Box>
                              <Box sx={{ fontFamily: 'monospace', fontSize: 13, color: '#1976d2' }}>{variant.sku}</Box>
                              <Box sx={{ textAlign: 'center' }}>
                                <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: '#fff', background: getStockColor(variant.current_stock, variant.stock_alert_quantity) }}>
                                  {variant.current_stock || 0}
                                </span>
                              </Box>
                              <Box sx={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleOpenProduct(variant)} style={{ padding: '5px 8px', fontSize: 11, background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                                <button onClick={() => handleDeleteProduct(variant.id)} style={{ padding: '5px 8px', fontSize: 11, background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Del</button>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* PURCHASES TAB */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" placeholder="Search by invoice or supplier..."
                    InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="contained" size="small" startIcon={<Add />} onClick={() => handleOpenPurchase()}>New Purchase</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={2}>
              {purchases.map(purchase => {
                const supplier = suppliers.find(s => s.id === purchase.supplier_id);
                const dueAmount = Number(purchase.grand_total || 0) - Number(purchase.paid_amount || 0);
                return (
                  <Grid item xs={12} md={6} key={purchase.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box>
                            <Typography variant="h6" fontWeight="bold">{purchase.purchase_no}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              <LocalShipping fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                              {supplier?.name || purchase.supplier_name || 'Unknown Supplier'}
                            </Typography>
                          </Box>
                          <Chip size="small" color={purchase.payment_status === 'paid' ? 'success' : purchase.payment_status === 'partial' ? 'warning' : 'error'} label={purchase.payment_status?.toUpperCase()} />
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box display="flex" justifyContent="space-between" mb={1}><Typography variant="body2" color="text.secondary">Date:</Typography><Typography variant="body2">{formatDate(purchase.purchase_date)}</Typography></Box>
                        <Box display="flex" justifyContent="space-between" mb={1}><Typography variant="body2" color="text.secondary">Due Date:</Typography><Typography variant="body2">{formatDate(purchase.due_date)}</Typography></Box>
                        <Box display="flex" justifyContent="space-between" mb={1}><Typography variant="body2" color="text.secondary">Grand Total:</Typography><Typography variant="body2" fontWeight="bold">Rs. {Number(purchase.grand_total).toLocaleString()}</Typography></Box>
                        <Box display="flex" justifyContent="space-between" mb={2}><Typography variant="body2" color="text.secondary">Due Amount:</Typography><Typography variant="body2" color={dueAmount > 0 ? 'error' : 'success'} fontWeight="bold">Rs. {dueAmount.toLocaleString()}</Typography></Box>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" startIcon={<History />}>View</Button>
                          <Button size="small" variant="outlined" onClick={() => handleOpenPurchase(purchase)}>Edit</Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => handleDeletePurchase(purchase.id)}>Delete</Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* PRODUCT DIALOG */}
      <Dialog open={productDialog} onClose={() => { setProductDialog(false); setEditingProduct(null); resetProductForm(); }} maxWidth="md" fullWidth>
        <form onSubmit={handleSaveProduct}>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}><TextField name="name" label="Product Name *" fullWidth required value={productForm.name} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={6}><TextField name="sku" label="SKU / Barcode *" fullWidth required value={productForm.sku} onChange={handleProductChange} InputProps={{ startAdornment: <QrCode color="action" sx={{ mr: 1 }} /> }} /></Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Product Type</InputLabel>
                  <Select name="type" label="Product Type" value={productForm.type} onChange={handleProductChange}>
                    {PRODUCT_TYPES.map(t => <MenuItem key={t.value} value={t.value}><Box display="flex" alignItems="center" gap={1}>{t.icon} {t.label}</Box></MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select name="category_id" label="Category" value={productForm.category_id} onChange={handleProductChange}>
                    <MenuItem value="">Select Category</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Unit</InputLabel>
                  <Select name="unit" label="Unit" value={productForm.unit} onChange={handleProductChange}>
                    {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><TextField name="costPrice" label="Cost Price (Rs.) *" type="number" fullWidth required value={productForm.costPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField name="retailPrice" label="Retail Price (Rs.) *" type="number" fullWidth required value={productForm.retailPrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField name="wholesalePrice" label="Wholesale Price (Rs.)" type="number" fullWidth value={productForm.wholesalePrice} onChange={handleProductChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={12} md={3}><TextField name="barcode" label="Barcode" fullWidth value={productForm.barcode} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField name="stock" label="Opening Stock *" type="number" fullWidth required value={productForm.stock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField name="minStock" label="Min Stock Alert" type="number" fullWidth value={productForm.minStock} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}><TextField name="tax" label="Tax %" type="number" fullWidth value={productForm.tax} onChange={handleProductChange} /></Grid>

              {dialogProductType === 'imei' && (
                <Grid item xs={12}>
                  <TextField name="imeiList" label="IMEI Numbers (one per line)" fullWidth multiline rows={3} value={productForm.imeiList} onChange={handleProductChange} helperText="Enter each IMEI on a new line." />
                </Grid>
              )}
              {dialogProductType === 'fabric' && (
                <Grid item xs={12} md={6}><TextField name="fabricLength" label="Meters per Than" type="number" fullWidth value={productForm.fabricLength} onChange={handleProductChange} /></Grid>
              )}
              {dialogProductType === 'grocery' && (
                <>
                  <Grid item xs={12} md={4}><TextField name="weight" label="Weight per Unit" type="number" fullWidth value={productForm.weight} onChange={handleProductChange} /></Grid>
                  <Grid item xs={12} md={4}><TextField name="expiryDate" label="Expiry Date" type="date" fullWidth value={productForm.expiryDate} onChange={handleProductChange} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid item xs={12} md={4}><TextField name="batchNumber" label="Batch Number" fullWidth value={productForm.batchNumber} onChange={handleProductChange} /></Grid>
                </>
              )}
              <Grid item xs={12}><TextField name="description" label="Description / Notes" fullWidth multiline rows={2} value={productForm.description} onChange={handleProductChange} /></Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select name="status" label="Status" value={productForm.status} onChange={handleProductChange}>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setProductDialog(false); setEditingProduct(null); resetProductForm(); }}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Save />}>{editingProduct ? 'Update' : 'Save'} Product</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ADD VARIANT DIALOG */}
      <Dialog open={variantDialog} onClose={() => setVariantDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveVariant}>
          <DialogTitle>Add Variant to {variantParent?.product_name}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}><TextField name="variantName" label="Variant Name (e.g. Black 8+128)" fullWidth value={variantForm.variantName} onChange={handleVariantChange} /></Grid>
              <Grid item xs={12}><TextField name="sku" label="SKU / Barcode *" fullWidth required value={variantForm.sku} onChange={handleVariantChange} /></Grid>
              <Grid item xs={6}><TextField name="costPrice" label="Cost Price (Rs.)" type="number" fullWidth value={variantForm.costPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={6}><TextField name="retailPrice" label="Retail Price (Rs.)" type="number" fullWidth value={variantForm.retailPrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={6}><TextField name="wholesalePrice" label="Wholesale Price (Rs.)" type="number" fullWidth value={variantForm.wholesalePrice} onChange={handleVariantChange} InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} /></Grid>
              <Grid item xs={6}><TextField name="stock" label="Opening Stock" type="number" fullWidth value={variantForm.stock} onChange={handleVariantChange} /></Grid>
              <Grid item xs={12}><TextField name="barcode" label="Barcode (Optional)" fullWidth value={variantForm.barcode} onChange={handleVariantChange} /></Grid>
              {(variantParent?.product_type === 'imei' || variantParent?.type === 'imei') && (
                <Grid item xs={12}>
                  <TextField name="imeiList" label="IMEI Numbers" fullWidth multiline rows={4} value={variantForm.imeiList} onChange={handleVariantChange} />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVariantDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" startIcon={<Add />}>Add Variant</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CATEGORY MANAGER */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Categories</DialogTitle>
        <DialogContent>
          <List dense>
            {categories.map(cat => (
              <ListItem key={cat.id} secondaryAction={<IconButton edge="end" color="error" onClick={() => handleDeleteCategory(cat.id)}><Delete fontSize="small" /></IconButton>}>
                <ListItemText primary={cat.name} secondary={cat.parent_name ? `Subcategory of: ${cat.parent_name}` : 'Main Category'} />
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <form onSubmit={handleAddCategory}>
            <Stack spacing={2}>
              <TextField name="categoryName" label="Category Name" size="small" fullWidth required />
              <FormControl fullWidth size="small">
                <InputLabel>Parent Category</InputLabel>
                <Select name="parent_id" label="Parent Category" defaultValue="">
                  <MenuItem value="">Main Category</MenuItem>
                  {categories.filter(c => !c.parent_id).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <Button type="submit" variant="contained" size="small" startIcon={<Add />} fullWidth>Add Category</Button>
            </Stack>
          </form>
        </DialogContent>
      </Dialog>

      {/* UNIT MANAGER */}
      <Dialog open={unitDialog} onClose={() => setUnitDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Manage Units</DialogTitle>
        <DialogContent>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {units.map(u => <Chip key={u} label={u} onDelete={() => { const updated = units.filter(unit => unit !== u); setUnits(updated); localStorage.setItem('custom_units', JSON.stringify(updated)); }} />)}
          </Box>
          <form onSubmit={handleAddUnit}>
            <TextField name="unitName" label="New Unit Name" size="small" fullWidth required />
            <Button type="submit" variant="contained" size="small" startIcon={<Add />} sx={{ mt: 1 }} fullWidth>Add Unit</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* PURCHASE DIALOG */}
      <Dialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleSavePurchase}>
          <DialogTitle>New Purchase Entry</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Supplier</InputLabel>
                  <Select value={purchaseForm.supplier_id} onChange={handleSupplierChange} label="Supplier">
                    {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><TextField value={purchaseForm.purchase_no} label="Invoice No *" fullWidth required /></Grid>
              <Grid item xs={12} md={3}><TextField value={purchaseForm.supplier_invoice_no} onChange={(e) => setPurchaseForm(prev => ({...prev, supplier_invoice_no: e.target.value}))} label="Supplier Bill No" fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField type="date" value={purchaseForm.purchase_date} label="Purchase Date" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={3}><TextField type="number" value={purchaseForm.discount_amount} onChange={(e) => setPurchaseForm(prev => ({...prev, discount_amount: e.target.value}))} label="Discount" fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField type="number" value={purchaseForm.shipping_charges} onChange={(e) => setPurchaseForm(prev => ({...prev, shipping_charges: e.target.value}))} label="Shipping" fullWidth /></Grid>

              <Grid item xs={12}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Product</InputLabel>
                      <Select value={currentItem.product_variant_id} onChange={handleProductSelect}>
                        {products.map(p => <MenuItem key={p.id} value={p.id}>{p.product_name || p.name} ({p.sku})</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} md={2}><TextField type="number" value={currentItem.quantity} onChange={(e) => setCurrentItem(prev => ({...prev, quantity: e.target.value}))} label="Qty" fullWidth size="small" /></Grid>
                  <Grid item xs={6} md={2}><TextField type="number" value={currentItem.purchase_price} onChange={(e) => setCurrentItem(prev => ({...prev, purchase_price: e.target.value}))} label="Price" fullWidth size="small" /></Grid>
                </Grid>
                {(() => {
                  const sel = products.find(p => p.id == currentItem.product_variant_id);
                  if (sel?.product_type === 'imei' || sel?.type === 'imei') {
                    return <TextField label="IMEIs" fullWidth multiline rows={2} value={currentItem.imeiList || ''} onChange={(e) => setCurrentItem(prev => ({...prev, imeiList: e.target.value}))} sx={{ mt: 1 }} />;
                  }
                  return null;
                })()}
                <Button variant="contained" size="small" onClick={addItem} sx={{ mt: 1 }}>Add Item</Button>
              </Grid>

              {items.length > 0 && (
                <Grid item xs={12}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.product_name} ({item.sku})</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">Rs. {item.purchase_price}</TableCell>
                            <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeItem(i)}><Delete fontSize="small" /></IconButton></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}

              <Grid item xs={12} md={6}><Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography fontWeight="bold">Grand Total: Rs. {grandTotal.toLocaleString()}</Typography>
                <TextField type="number" value={purchaseForm.paid_amount} onChange={(e) => setPurchaseForm(prev => ({...prev, paid_amount: e.target.value}))} label="Paid Amount" size="small" sx={{ mt: 1 }} />
              </Paper></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPurchaseDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save Purchase</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}