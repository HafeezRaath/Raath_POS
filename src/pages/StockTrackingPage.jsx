import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Pagination, Snackbar, Alert, LinearProgress, Tooltip,
  Divider, useMediaQuery, useTheme, Drawer, Collapse, Fab,
  Avatar, Badge, Fade, Zoom, List, ListItem, ListItemText,
  ListItemIcon, SwipeableDrawer,
  CircularProgress  // ✅ ADDED
} from '@mui/material';
import {
  Search, FilterList, Visibility, Refresh, Inventory, Warning,
  CheckCircle, AccessTime, Layers, Speed, BarChart,
  RemoveShoppingCart, AttachMoney, Menu as MenuIcon,
  Close, ArrowUpward, ArrowDownward, TrendingUp, TrendingDown,
  Store, Category as CategoryIcon, Branding, Analytics
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

// ==================== MOBILE STOCK CARD ====================
const MobileStockCard = ({ product, onView }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STOCK_STATUS[product.status] || STOCK_STATUS.in_stock;

  return (
    <Card sx={{ mb: 1.5, borderLeft: `4px solid ${status.color === 'success' ? '#10b981' : status.color === 'warning' ? '#f59e0b' : status.color === 'error' ? '#ef4444' : '#94a3b8'}` }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {product.product_name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">{product.sku}</Typography>
              <Chip 
                size="small" 
                color={status.color} 
                icon={status.icon}
                label={status.label}
                sx={{ height: 16, fontSize: '0.5rem' }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={product.current_stock <= product.stock_alert_quantity ? 'error.main' : 'success.main'}>
              {product.current_stock}
            </Typography>
            <Typography variant="caption" color="text.secondary">units</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Cost Value</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(product.stock_value)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Retail Value</Typography>
            <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(product.retail_value)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Profit</Typography>
            <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(product.potential_profit)}</Typography>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body2">{product.category_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Brand</Typography>
              <Typography variant="body2">{product.brand_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Variant</Typography>
              <Typography variant="body2">{product.variant_name || 'Default'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Alert Qty</Typography>
              <Typography variant="body2">{product.stock_alert_quantity || 5}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Last Sale</Typography>
              <Typography variant="body2">{product.last_sale_date ? formatDate(product.last_sale_date) : 'Never'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Days Since Sale</Typography>
              <Typography variant="body2">{product.days_since_sale || '-'}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            onClick={() => onView(product)}
            sx={{ flex: 1, bgcolor: '#10b981' }}
          >
            View Details
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
export default function StockTrackingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

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
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>

      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <Inventory sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Stock Analytics' : 'Advanced Stock Analytics & Control Center'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            {isMobile ? 'Filters' : 'Filters Engine'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData} disabled={loading}>
            {loading ? 'Syncing...' : isMobile ? 'Sync' : 'Sync Tables'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
        {[
          { title: 'Products', value: stats.totalProducts, sub: `${stats.totalVariants} variants`, color: 'primary', icon: <Inventory /> },
          { title: 'Stock Value', value: formatCurrency(stats.totalStockValue), sub: 'cost valuation', color: 'info', icon: <AttachMoney /> },
          { title: 'Low Stock', value: stats.lowStockCount, sub: 'needs reorder', color: 'warning', icon: <Warning /> },
          { title: 'Out of Stock', value: stats.outOfStockCount, sub: 'zero stock', color: 'error', icon: <RemoveShoppingCart /> },
          { title: 'Dead Stock', value: stats.deadStockCount, sub: '90+ days idle', color: 'default', icon: <AccessTime /> },
          { title: 'Fast Moving', value: stats.fastMovingCount, sub: 'high demand', color: 'success', icon: <Speed /> },
          { title: 'Over Stock', value: stats.overStockCount, sub: 'excess volume', color: 'secondary', icon: <Layers /> },
        ].map((stat, idx) => (
          <Grid item xs={6} md={3} lg={2} key={idx}>
            <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main`, boxShadow: 1 }}>
              <CardContent sx={{ p: isMobile ? 1 : 1.5, '&:last-child': { pb: isMobile ? 1 : 1.5 } }}>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500} sx={{ fontSize: isMobile ? '0.55rem' : '0.75rem' }}>
                  {stat.title}
                </Typography>
                <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color={`${stat.color}.dark`} noWrap>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.5rem' : '0.68rem' }}>
                  {stat.sub}
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
          onChange={handleTabChange} 
          indicatorColor="primary" 
          textColor="primary" 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab 
            icon={<Inventory fontSize="small" />} 
            label={isMobile ? 'All' : 'All Registered'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Warning fontSize="small" />} 
            label={isMobile ? `Low (${stats.lowStockCount})` : `Low (${stats.lowStockCount})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<RemoveShoppingCart fontSize="small" />} 
            label={isMobile ? `Out (${stats.outOfStockCount})` : `Out of Stock (${stats.outOfStockCount})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<AccessTime fontSize="small" />} 
            label={isMobile ? `Dead (${stats.deadStockCount})` : `Dead Stock (${stats.deadStockCount})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Speed fontSize="small" />} 
            label={isMobile ? `Fast (${stats.fastMovingCount})` : `Fast Moving (${stats.fastMovingCount})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<Layers fontSize="small" />} 
            label={isMobile ? `Over (${stats.overStockCount})` : `Over Stock (${stats.overStockCount})`} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
          <Tab 
            icon={<BarChart fontSize="small" />} 
            label={isMobile ? 'Analytics' : 'Analytics'} 
            sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
          />
        </Tabs>
      </Paper>

      {/* FILTERS */}
      {showFilters && activeTab !== 6 && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth 
                size="small" 
                placeholder={isMobile ? "Search..." : "Search by name, SKU, barcode..."}
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} label="Category">
                  <MenuItem value="">All</MenuItem>
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Brand</InputLabel>
                <Select value={filterBrand} onChange={(e) => { setFilterBrand(e.target.value); setPage(1); }} label="Brand">
                  <MenuItem value="">All</MenuItem>
                  {brands.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={handleResetFilters}>Reset</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      {activeTab !== 6 && (
        <Fade in>
          {isMobile ? (
            // Mobile Cards View
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LinearProgress />
                  <Typography sx={{ mt: 2 }}>Loading...</Typography>
                </Box>
              ) : paginatedData.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Inventory sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No products found</Typography>
                </Paper>
              ) : (
                paginatedData.map((v) => (
                  <MobileStockCard key={v.id} product={v} onView={handleViewDetail} />
                ))
              )}
              {filteredData.length > rowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination 
                    count={Math.ceil(filteredData.length / rowsPerPage)} 
                    page={page} 
                    onChange={(e, p) => setPage(p)} 
                    color="primary" 
                    size="small"
                  />
                </Box>
              )}
            </Box>
          ) : (
            // Desktop Table View
            <Paper sx={{ border: '1px solid #e5e7eb' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}>SKU</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }} align="right">Stock</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }} align="right">Cost</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }} align="right">Retail</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}>Last Sale</TableCell>
                      <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                          <CircularProgress size={40} />
                          <Typography sx={{ mt: 2 }}>Loading data...</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {paginatedData.map((v) => (
                          <TableRow key={v.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold" color="primary">{v.product_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{v.variant_name || 'Default'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" fontFamily="monospace" sx={{ bgcolor: '#f3f4f6', px: 0.5, borderRadius: 0.5 }}>{v.sku}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color={v.current_stock <= v.stock_alert_quantity ? 'error.main' : 'success.main'}>
                                {v.current_stock}
                              </Typography>
                            </TableCell>
                            <TableCell>{getStatusChip(v.status)}</TableCell>
                            <TableCell align="right" fontWeight="500">{formatCurrency(v.stock_value)}</TableCell>
                            <TableCell align="right" color="success.main" fontWeight="500">{formatCurrency(v.retail_value)}</TableCell>
                            <TableCell>
                              {v.last_sale_date ? (
                                <Box>
                                  <Typography variant="caption" display="block">{formatDate(v.last_sale_date)}</Typography>
                                  <Typography variant="caption" color="text.secondary">{v.days_since_sale} days ago</Typography>
                                </Box>
                              ) : '-'}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Details">
                                <IconButton size="small" color="primary" onClick={() => handleViewDetail(v)}>
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                        {paginatedData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                              <Typography color="text.secondary">No matching products found</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
                <Pagination 
                  count={Math.ceil(filteredData.length / rowsPerPage)} 
                  page={page} 
                  onChange={(e, p) => setPage(p)} 
                  color="primary" 
                  size="small"
                />
              </Box>
            </Paper>
          )}
        </Fade>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 6 && (
        <Fade in>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12}>
              <Paper sx={{ p: isMobile ? 1.5 : 3, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  <Analytics sx={{ verticalAlign: 'middle', mr: 1, color: '#10b981' }} />
                  Category Distribution
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {stats.categoryBreakdown.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No data available</Typography>
                ) : (
                  stats.categoryBreakdown.map((cat, i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {cat.name} <span style={{ color: 'gray', fontSize: '0.8rem' }}>({cat.count} items)</span>
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          {formatCurrency(cat.stock_value)}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={stats.totalStockValue > 0 ? (cat.stock_value / stats.totalStockValue) * 100 : 0} 
                        sx={{ 
                          height: 6, 
                          borderRadius: 3, 
                          bgcolor: '#e5e7eb', 
                          '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } 
                        }} 
                      />
                    </Box>
                  ))
                )}
              </Paper>
            </Grid>
          </Grid>
        </Fade>
      )}

      {/* DETAIL DIALOG */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          Asset Audit: {selectedProduct?.product_name}
          <Chip 
            size="small" 
            label={String(selectedProduct?.status || 'unknown').toUpperCase()} 
            color={STATUS_CHIP_COLORS[selectedProduct?.status] || 'default'} 
            sx={{ ml: 2, fontWeight: 'bold', bgcolor: 'white' }} 
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedProduct && (
            <Box>
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 3, textAlign: 'center' }}>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Stock</Typography>
                    <Typography variant="h6" fontWeight="bold">{selectedProduct.current_stock}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Cost Value</Typography>
                    <Typography variant="h6" fontWeight="bold">{formatCurrency(selectedProduct.stock_value)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Retail Value</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(selectedProduct.retail_value)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}>
                    <Typography variant="caption" color="text.secondary">Profit</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">{formatCurrency(selectedProduct.potential_profit)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ mb: 1 }}>Purchase History</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productHistory.purchases?.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDate(p.purchase_date)}</TableCell>
                        <TableCell fontWeight="500">{p.purchase_no}</TableCell>
                        <TableCell>{p.supplier_name}</TableCell>
                        <TableCell align="right">{p.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(p.purchase_price)}</TableCell>
                      </TableRow>
                    ))}
                    {(!productHistory.purchases || productHistory.purchases.length === 0) && (
                      <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">No purchase history</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle2" fontWeight="bold" color="secondary" sx={{ mb: 1 }}>Sales History</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productHistory.sales?.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDate(s.date)}</TableCell>
                        <TableCell fontWeight="500">{s.invoice_no}</TableCell>
                        <TableCell>{s.customer_name}</TableCell>
                        <TableCell align="right">{s.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(s.price)}</TableCell>
                      </TableRow>
                    ))}
                    {(!productHistory.sales || productHistory.sales.length === 0) && (
                      <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">No sales history</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* MOBILE DRAWER */}
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
              <ListItemText primary="Refresh Data" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
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