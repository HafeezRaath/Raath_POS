import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Pagination, Snackbar, Alert, LinearProgress, Tooltip,
  Divider
} from '@mui/material';
import {
  Search, FilterList, Visibility, Refresh, Inventory, Warning, 
  CheckCircle, AccessTime, Layers, Speed, BarChart, 
  RemoveShoppingCart, AttachMoney
} from '@mui/icons-material';
import db from '../database/db';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const getDaysAgo = (dateStr) => {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
};

const STOCK_STATUS = {
  in_stock: { color: 'success', label: 'In Stock', icon: <CheckCircle fontSize="small" /> },
  low_stock: { color: 'warning', label: 'Low Stock', icon: <Warning fontSize="small" /> },
  out_of_stock: { color: 'error', label: 'Out of Stock', icon: <RemoveShoppingCart fontSize="small" /> },
  dead_stock: { color: 'default', label: 'Dead Stock', icon: <AccessTime fontSize="small" /> },
  over_stock: { color: 'info', label: 'Over Stock', icon: <Layers fontSize="small" /> },
  fast_moving: { color: 'success', label: 'Fast Moving', icon: <Speed fontSize="small" /> },
};

const STATUS_CHIP_COLORS = {
  out_of_stock: 'error',
  low_stock: 'warning',
  dead_stock: 'default',
  over_stock: 'info',
  fast_moving: 'success',
  in_stock: 'success'
};

const safeDbCall = async (fn, fallback = []) => {
  if (typeof fn !== 'function') return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn('DB call failed:', err);
    return fallback;
  }
};

export default function StockTrackingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(25);

  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState({ sales: [], purchases: [] });

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalVariants: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    deadStockCount: 0,
    fastMovingCount: 0,
    overStockCount: 0,
    categoryBreakdown: []
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const isElectron = typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let variantsData, categoriesData, brandsData, allSales, allSaleItems, allPurchases, allPurchaseItems, allReturnItems;

      if (isElectron) {
        const variantsQuery = `
          SELECT pv.*, p.name as product_name, p.brand_id, p.category_id,
                 b.name as brand_name, c.name as category_name
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE pv.is_deleted = 0 AND p.is_deleted = 0
          ORDER BY pv.id DESC
        `;

        [variantsData, categoriesData, brandsData, allSales, allSaleItems, allPurchases, allPurchaseItems, allReturnItems] = await Promise.all([
          safeDbCall(() => db.electronQuery(variantsQuery)),
          safeDbCall(() => db.getCategories()),
          safeDbCall(() => db.getBrands()),
          safeDbCall(() => db.electronQuery("SELECT * FROM sales WHERE is_deleted = 0")),
          safeDbCall(() => db.electronQuery("SELECT * FROM sale_items")),
          safeDbCall(() => db.electronQuery("SELECT * FROM purchases WHERE is_deleted = 0")),
          safeDbCall(() => db.electronQuery("SELECT * FROM purchase_items")),
          safeDbCall(() => db.electronQuery("SELECT * FROM sale_return_items"))
        ]);
      } else {
        [variantsData, categoriesData, brandsData, allSales, allSaleItems, allPurchases, allPurchaseItems, allReturnItems] = await Promise.all([
          safeDbCall(() => db.getAllVariants()),
          safeDbCall(() => db.getCategories()),
          safeDbCall(() => db.getBrands()),
          safeDbCall(() => db.getSalesHistory()),
          safeDbCall(() => db.getAllSaleItems()),
          safeDbCall(() => db.getPurchases()),
          safeDbCall(() => db.getAllPurchaseItems()),
          safeDbCall(() => db.getAllSaleReturnItems())
        ]);
      }

      setCategories(categoriesData || []);
      setBrands(brandsData || []);

      const enriched = (variantsData || []).map(v => {
        const variantSaleItems = (allSaleItems || []).filter(si => si.product_variant_id === v.id);
        const variantSaleIds = variantSaleItems.map(si => si.sale_id);
        const variantSales = (allSales || []).filter(s => variantSaleIds.includes(s.id));

        const lastSale = variantSales.length > 0 
          ? [...variantSales].sort((a, b) => new Date(b.date) - new Date(a.date))[0] 
          : null;
        const totalSold = variantSaleItems.reduce((sum, si) => sum + (Number(si.quantity || si.qty || 0)), 0);

        const variantPurchaseItems = (allPurchaseItems || []).filter(pi => pi.product_variant_id === v.id);
        const variantPurchaseIds = variantPurchaseItems.map(pi => pi.purchase_id);
        const variantPurchases = (allPurchases || []).filter(p => variantPurchaseIds.includes(p.id));

        const lastPurchase = variantPurchases.length > 0
          ? [...variantPurchases].sort((a, b) => new Date(b.purchase_date || b.date) - new Date(a.purchase_date || a.date))[0]
          : null;
        const totalPurchased = variantPurchaseItems.reduce((sum, pi) => sum + (Number(pi.quantity || 0)), 0);

        const variantReturnItems = (allReturnItems || []).filter(sri => {
          if (sri.sale_item_id) {
            return variantSaleItems.some(vsi => vsi.id === sri.sale_item_id);
          }
          if (sri.sale_id) {
            return variantSaleItems.some(vsi => vsi.sale_id === sri.sale_id);
          }
          return false;
        });
        const totalReturned = variantReturnItems.reduce((sum, sri) => sum + (Number(sri.quantity || 0)), 0);

        const currentStock = Number(v.current_stock || 0);
        const alertQty = Number(v.stock_alert_quantity || 5);
        const purchasePrice = Number(v.purchase_price || 0);
        const retailPrice = Number(v.retail_price || 0);
        const netSold = Math.max(0, totalSold - totalReturned);
        const daysSinceSale = getDaysAgo(lastSale?.date);

        let status = 'in_stock';
        if (currentStock === 0) status = 'out_of_stock';
        else if (currentStock <= alertQty) status = 'low_stock';
        else if (daysSinceSale > 90 && currentStock > 0) status = 'dead_stock';
        else if (currentStock > alertQty * 10) status = 'over_stock';
        else if (netSold > 10 && daysSinceSale <= 30) status = 'fast_moving';

        return {
          ...v,
          current_stock: currentStock,
          stock_value: currentStock * purchasePrice,
          retail_value: currentStock * retailPrice,
          potential_profit: currentStock * (retailPrice - purchasePrice),
          last_sale_date: lastSale?.date || null,
          last_purchase_date: lastPurchase?.purchase_date || lastPurchase?.date || null,
          total_sold: netSold,
          total_purchased: totalPurchased,
          total_returned: totalReturned,
          days_since_sale: daysSinceSale,
          status
        };
      });

      setVariants(enriched);
      calculateStats(enriched);

    } catch (err) {
      console.error('Core Stack Tracking Pipeline Failure:', err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const calculateStats = useCallback((data) => {
    const totalValue = data.reduce((s, v) => s + v.stock_value, 0);
    const lowStock = data.filter(v => v.status === 'low_stock').length;
    const outOfStock = data.filter(v => v.status === 'out_of_stock').length;
    const deadStock = data.filter(v => v.status === 'dead_stock').length;
    const fastMoving = data.filter(v => v.status === 'fast_moving').length;
    const overStock = data.filter(v => v.status === 'over_stock').length;

    const catMap = {};
    data.forEach(v => {
      const cat = v.category_name || 'Uncategorized Asset Pool';
      if (!catMap[cat]) catMap[cat] = { count: 0, stock_value: 0 };
      catMap[cat].count++;
      catMap[cat].stock_value += v.stock_value;
    });

    setStats({
      totalProducts: new Set(data.map(v => v.product_id)).size,
      totalVariants: data.length,
      totalStockValue: totalValue,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      deadStockCount: deadStock,
      fastMovingCount: fastMoving,
      overStockCount: overStock,
      categoryBreakdown: Object.entries(catMap).map(([name, d]) => ({ name, ...d }))
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        await loadData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [loadData]);

  const handleViewDetail = async (product) => {
    setSelectedProduct(product);
    try {
      let sales, purchases;

      if (isElectron) {
        const salesQuery = `
          SELECT si.*, s.invoice_no, s.date, s.customer_name
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_variant_id = ? AND s.is_deleted = 0
          ORDER BY s.id DESC LIMIT 10
        `;
        const purchasesQuery = `
          SELECT pi.*, p.purchase_no, p.purchase_date, sup.name as supplier_name
          FROM purchase_items pi
          JOIN purchases p ON pi.purchase_id = p.id
          LEFT JOIN suppliers sup ON p.supplier_id = sup.id
          WHERE pi.product_variant_id = ? AND p.is_deleted = 0
          ORDER BY p.id DESC LIMIT 10
        `;

        [sales, purchases] = await Promise.all([
          safeDbCall(() => db.electronQuery(salesQuery, [product.id])),
          safeDbCall(() => db.electronQuery(purchasesQuery, [product.id]))
        ]);
      } else {
        const [allSales, allSaleItems, allPurchases, allPurchaseItems] = await Promise.all([
          safeDbCall(() => db.getSalesHistory()),
          safeDbCall(() => db.getAllSaleItems()),
          safeDbCall(() => db.getPurchases()),
          safeDbCall(() => db.getAllPurchaseItems())
        ]);

        const productSaleItems = (allSaleItems || []).filter(si => si.product_variant_id === product.id);
        sales = productSaleItems.map(si => {
          const sale = (allSales || []).find(s => s.id === si.sale_id);
          return { ...si, invoice_no: sale?.invoice_no, date: sale?.date, customer_name: sale?.customer_name };
        }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

        const productPurchaseItems = (allPurchaseItems || []).filter(pi => pi.product_variant_id === product.id);
        purchases = productPurchaseItems.map(pi => {
          const purchase = (allPurchases || []).find(p => p.id === pi.purchase_id);
          return { ...pi, purchase_no: purchase?.purchase_no, purchase_date: purchase?.purchase_date, supplier_name: purchase?.supplier_name };
        }).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date)).slice(0, 10);
      }

      setProductHistory({ sales, purchases });
      setDetailDialog(true);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error loading details: ' + err.message, severity: 'error' });
    }
  };

  const filteredData = useMemo(() => {
    return variants.filter(v => {
      const matchSearch = !searchQuery.trim() || 
        (v.product_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (v.variant_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (v.sku || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (v.barcode || '').toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchCategory = !filterCategory || String(v.category_id) === String(filterCategory);
      const matchBrand = !filterBrand || String(v.brand_id) === String(filterBrand);

      let matchStatus = true;
      if (activeTab === 1) matchStatus = v.status === 'low_stock';
      else if (activeTab === 2) matchStatus = v.status === 'out_of_stock';
      else if (activeTab === 3) matchStatus = v.status === 'dead_stock';
      else if (activeTab === 4) matchStatus = v.status === 'fast_moving';
      else if (activeTab === 5) matchStatus = v.status === 'over_stock';
      else if (filterStatus !== 'all') matchStatus = v.status === filterStatus;

      return matchSearch && matchCategory && matchBrand && matchStatus;
    });
  }, [variants, searchQuery, filterCategory, filterBrand, filterStatus, activeTab]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const getStatusChip = (status) => {
    const config = STOCK_STATUS[status] || STOCK_STATUS.in_stock;
    return <Chip size="small" color={config.color} icon={config.icon} label={config.label} sx={{ fontWeight: 'bold' }} />;
  };

  const handleTabChange = (e, v) => {
    setActiveTab(v);
    setPage(1);
    setFilterStatus('all');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterBrand('');
    setFilterStatus('all');
    setPage(1);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <Inventory sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Advanced Stock Analytics & Control Center
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            Filters Engine
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync Tables'}
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { title: 'Total Sourced Products', value: stats.totalProducts, sub: `${stats.totalVariants} active variants`, color: 'primary', icon: <Inventory /> },
          { title: 'Stock Asset Value (Cost)', value: formatCurrency(stats.totalStockValue), sub: 'procurement valuation', color: 'info', icon: <AttachMoney /> },
          { title: 'Low Alerts Core Count', value: stats.lowStockCount, sub: 'requires reorder', color: 'warning', icon: <Warning /> },
          { title: 'Out of Stock (Urgent)', value: stats.outOfStockCount, sub: 'zero volume levels', color: 'error', icon: <RemoveShoppingCart /> },
          { title: 'Processed Dead Inventory', value: stats.deadStockCount, sub: '90+ days idle rows', color: 'default', icon: <AccessTime /> },
          { title: 'Fast Moving Units Rate', value: stats.fastMovingCount, sub: 'high outbound demand', color: 'success', icon: <Speed /> },
          { title: 'Over Stock Accumulation', value: stats.overStockCount, sub: 'excess volume cap', color: 'secondary', icon: <Layers /> },
        ].map((stat, idx) => (
          <Grid item xs={6} md={3} lg={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>{stat.title}</Typography>
                <Typography variant="h6" fontWeight="bold" color={`${stat.color}.dark`} noWrap>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{stat.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="scrollable">
          <Tab icon={<Inventory fontSize="small" />} iconPosition="start" label="All Registered Stocks" />
          <Tab icon={<Warning fontSize="small" />} iconPosition="start" label={`Low Limit Alert (${stats.lowStockCount})`} />
          <Tab icon={<RemoveShoppingCart fontSize="small" />} iconPosition="start" label={`Out of Stock (${stats.outOfStockCount})`} />
          <Tab icon={<AccessTime fontSize="small" />} iconPosition="start" label={`Dead Volume Stack (${stats.deadStockCount})`} />
          <Tab icon={<Speed fontSize="small" />} iconPosition="start" label={`Fast Moving Outflows (${stats.fastMovingCount})`} />
          <Tab icon={<Layers fontSize="small" />} iconPosition="start" label={`Excessive Over Stock (${stats.overStockCount})`} />
          <Tab icon={<BarChart fontSize="small" />} iconPosition="start" label="Executive Allocation Matrix" />
        </Tabs>
      </Paper>

      {showFilters && activeTab !== 6 && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb', boxShadow: 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth 
                size="small" 
                label="Fuzzy Filter Search Console"
                placeholder="Type Catalog item name, variable specs, bar identifiers or unique SKU..."
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Sourced Category</InputLabel>
                <Select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} label="Product Sourced Category">
                  <MenuItem value="">Display All Category Pools</MenuItem>
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Brand Group Specification</InputLabel>
                <Select value={filterBrand} onChange={(e) => { setFilterBrand(e.target.value); setPage(1); }} label="Brand Group Specification">
                  <MenuItem value="">Show All Brands Allocations</MenuItem>
                  {brands.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={handleResetFilters}>Reset Variables</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {activeTab !== 6 && (
        <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', width: 40 }}></TableCell>
                  {['Product Model Nomenclature', 'Internal SKU Identity', 'Available Physical Stock', 'Lifecycle Status Badge', 'Inventory Sourced Cost Valuation', 'Retail Portfolio Valuation', 'Last Consumer Dispatch', 'Action Manifest'].map((head) => (
                    <TableCell key={head} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', py: 1.2 }}>{head}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">Loading stock data...</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {paginatedData.map((v) => (
                      <TableRow key={v.id} hover>
                        <TableCell></TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="primary">{v.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{v.variant_name || 'Standard Base Specs'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5 }}>{v.sku}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color={v.current_stock <= v.stock_alert_quantity ? 'error.main' : 'green'}>{v.current_stock} units</Typography>
                        </TableCell>
                        <TableCell>{getStatusChip(v.status)}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{formatCurrency(v.stock_value)}</TableCell>
                        <TableCell sx={{ color: 'green', fontWeight: 500 }}>{formatCurrency(v.retail_value)}</TableCell>
                        <TableCell>
                          {v.last_sale_date ? (
                            <Box><Typography variant="caption" display="block">{formatDate(v.last_sale_date)}</Typography><Typography variant="caption" color="text.secondary">{v.days_since_sale} days ago</Typography></Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Lifecycle History Details"><IconButton size="small" color="primary" onClick={() => handleViewDetail(v)}><Visibility fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedData.length === 0 && (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No matching inventory assets found matching filter constraints parameters.</Typography></TableCell></TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Pagination count={Math.ceil(filteredData.length / rowsPerPage)} page={page} onChange={(e, p) => setPage(p)} color="primary" size="small" />
          </Box>
        </Paper>
      )}

      {activeTab === 6 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={12}>
            <Paper sx={{ p: 3, border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Capital Allocation Distribution Matrix By Sourced Categories</Typography>
              <Divider sx={{ mb: 2 }} />
              {stats.categoryBreakdown.map((cat, i) => (
                <Box key={i} sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {cat.name} — <span style={{ color: 'gray' }}>({cat.count} variants logged)</span>
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(cat.stock_value)}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={stats.totalStockValue > 0 ? (cat.stock_value / stats.totalStockValue) * 100 : 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e5e7eb', pb: 1.5 }}>
          Asset Audit Portfolio Lifecycle: {selectedProduct?.product_name}
          <Chip 
            size="small" 
            label={String(selectedProduct?.status || 'unknown').toUpperCase()} 
            color={STATUS_CHIP_COLORS[selectedProduct?.status] || 'default'} 
            sx={{ ml: 2, fontWeight: 'bold' }} 
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedProduct && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3, textAlign: 'center' }}>
                <Grid item xs={6} md={3}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Current Balance Vol</Typography><Typography variant="h6" fontWeight="bold">{selectedProduct.current_stock}</Typography></Paper></Grid>
                <Grid item xs={6} md={3}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Asset Value Rate</Typography><Typography variant="h6" fontWeight="bold">{formatCurrency(selectedProduct.stock_value)}</Typography></Paper></Grid>
                <Grid item xs={6} md={3}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Market Value Projection</Typography><Typography variant="h6" fontWeight="bold" color="green">{formatCurrency(selectedProduct.retail_value)}</Typography></Paper></Grid>
                <Grid item xs={6} md={3}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Expected Ret Profit</Typography><Typography variant="h6" fontWeight="bold" color="primary">{formatCurrency(selectedProduct.potential_profit)}</Typography></Paper></Grid>
              </Grid>

              <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ mb: 1 }}>Procurement Sourced History Mappings (Upstream Batches)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, boxShadow: 0 }}>
                <Table size="small">
                  <TableHead><TableRow sx={{ bgcolor: '#f9fafb' }}><TableCell>Sourced On Date</TableCell><TableCell>Batch Inflow Invoice</TableCell><TableCell>Assigned Supplier Enterprise</TableCell><TableCell align="right">Procured Quantity</TableCell><TableCell align="right">Sourced Cost Unit Rate</TableCell></TableRow></TableHead>
                  <TableBody>
                    {productHistory.purchases?.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(p.purchase_date)}</TableCell>
                        <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>{p.purchase_no}</TableCell>
                        <TableCell>{p.supplier_name}</TableCell>
                        <TableCell align="right">{p.quantity} pcs</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(p.purchase_price)}</TableCell>
                      </TableRow>
                    ))}
                    {(!productHistory.purchases || productHistory.purchases.length === 0) && (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No procurement history found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle2" fontWeight="bold" color="secondary" sx={{ mb: 1 }}>Dispatched Consumer History Outflows (Downstream Sales)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 0 }}>
                <Table size="small">
                  <TableHead><TableRow sx={{ bgcolor: '#f9fafb' }}><TableCell>Dispatched Date Stamp</TableCell><TableCell>Outflow Sale Invoice</TableCell><TableCell>Acquired Client Party Name</TableCell><TableCell align="right">Dispatched Qty</TableCell><TableCell align="right">Consumer Settle Rate</TableCell></TableRow></TableHead>
                  <TableBody>
                    {productHistory.sales?.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(s.date)}</TableCell>
                        <TableCell sx={{ fontWeight: 500, color: 'secondary.main' }}>{s.invoice_no}</TableCell>
                        <TableCell>{s.customer_name}</TableCell>
                        <TableCell align="right">{s.quantity} pcs</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(s.price)}</TableCell>
                      </TableRow>
                    ))}
                    {(!productHistory.sales || productHistory.sales.length === 0) && (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No sales history found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailDialog(false)}>Dismiss Portfolio</Button></DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

