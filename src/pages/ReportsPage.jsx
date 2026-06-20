import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Pagination, Divider, LinearProgress, Tooltip
} from '@mui/material';
import {
  Search, Refresh, Visibility, Assessment, Timeline, PointOfSale,
  LocalShipping, People, ShowChart, Inventory, MoneyOff, Warning, Error, CheckCircle, AccessTime, RemoveShoppingCart, Speed, TrendingDown
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

const FORECAST_STATUS = {
  critical_low: { color: 'error', label: 'Critical Low', icon: <Error fontSize="small" /> },
  low_stock: { color: 'error', label: 'Low Stock', icon: <Warning fontSize="small" /> },
  over_stock: { color: 'error', label: 'Over Stock', icon: <TrendingDown fontSize="small" /> },
  dead_stock: { color: 'default', label: 'Dead Stock', icon: <AccessTime fontSize="small" /> },
  out_of_stock: { color: 'error', label: 'Out of Stock', icon: <RemoveShoppingCart fontSize="small" /> },
  ok: { color: 'success', label: 'Optimal', icon: <CheckCircle fontSize="small" /> },
  fast_moving: { color: 'info', label: 'Fast Moving', icon: <Speed fontSize="small" /> },
};

export default function ReportsPage() {
  // ==================== GLOBAL STATES ====================
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // ==================== FORECASTING STATES ====================
  const [forecastData, setForecastData] = useState([]);
  const [forecastPeriod, setForecastPeriod] = useState(30);
  const [forecastThreshold, setForecastThreshold] = useState(7);
  const [overstockMultiplier, setOverstockMultiplier] = useState(60);
  const [fcSearch, setFcSearch] = useState('');
  const [fcStatus, setFcStatus] = useState('all');
  const [fcPage, setFcPage] = useState(1);
  const fcPerPage = 25;

  // ==================== SALES REPORT STATES ====================
  const [salesData, setSalesData] = useState([]);
  const [salesSummary, setSalesSummary] = useState({});
  const [salesFrom, setSalesFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [salesTo, setSalesTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [salesPaymentMode, setSalesPaymentMode] = useState('all');

  // ==================== PURCHASE / SUPPLIER STATES ====================
  const [purchaseData, setPurchaseData] = useState([]);
  const [supplierSummary, setSupplierSummary] = useState([]);
  const [purchaseFrom, setPurchaseFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [purchaseTo, setPurchaseTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [supSearch, setSupSearch] = useState('');

  // ==================== CUSTOMER STATES ====================
  const [customerData, setCustomerData] = useState([]);
  const [customerFrom, setCustomerFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [customerTo, setCustomerTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [custSearch, setCustSearch] = useState('');

  // ==================== PROFIT & LOSS STATES ====================
  const [plFrom, setPlFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [plTo, setPlTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [plSummary, setPlSummary] = useState({ revenue: 0, cogs: 0, expenses: 0, gross: 0, net: 0, grossMargin: 0, netMargin: 0 });

  // ==================== STOCK / INVENTORY STATES ====================
  const [stockValuation, setStockValuation] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topFrom, setTopFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [topTo, setTopTo] = useState(() => new Date().toISOString().split('T')[0]);

  // ==================== EXPENSE STATES ====================
  const [expenseData, setExpenseData] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState([]);
  const [expFrom, setExpFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [expTo, setExpTo] = useState(() => new Date().toISOString().split('T')[0]);

  // ==================== DETAIL DIALOG ====================
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState({ sales: [], purchases: [], summary: {} });

  // ==================== CODE LOGIC SYNC MATRIX ====================

  const loadForecasting = async () => {
    setLoading(true);
    try {
      const variants = await db.getAllVariants().catch(() => []);
      if (!Array.isArray(variants)) { setForecastData([]); return; }

      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - forecastPeriod);
      const periodStartStr = periodStart.toISOString().split('T')[0];

      const allSales = await db.getSalesHistory().catch(() => []);
      const periodSales = allSales.filter(s => {
        if (s.is_deleted) return false;
        return String(s.date || '').substring(0, 10) >= periodStartStr;
      });

      const saleItemsArrays = await Promise.all(periodSales.map(s => db.getSaleItems(s.id).catch(() => [])));
      const allSaleItems = saleItemsArrays.flat();

      const variantSales = {};
      const variantRevenue = {};
      const lastSaleDates = {};

      allSaleItems.forEach(item => {
        const vid = Number(item.product_variant_id);
        if (!variantSales[vid]) { variantSales[vid] = 0; variantRevenue[vid] = 0; }
        variantSales[vid] += (Number(item.quantity) || Number(item.qty) || 0);
        variantRevenue[vid] += (Number(item.total) || 0);

        const sale = periodSales.find(s => s.id === item.sale_id);
        if (sale?.date) {
          if (!lastSaleDates[vid] || sale.date > lastSaleDates[vid]) lastSaleDates[vid] = sale.date;
        }
      });

      const enriched = variants.map(v => {
        const variantId = Number(v.id);
        const currentStock = Number(v.current_stock) || 0;
        const alertQty = Number(v.stock_alert_quantity) || 5;
        const purchasePrice = Number(v.purchase_price) || 0;
        const retailPrice = Number(v.retail_price) || 0;

        const totalSold = variantSales[variantId] || 0;
        const totalRevenue = variantRevenue[variantId] || 0;
        const lastSaleDate = lastSaleDates[variantId] || null;

        const dailyVelocity = totalSold > 0 ? totalSold / forecastPeriod : 0;
        const daysRemaining = dailyVelocity > 0 ? Math.floor(currentStock / dailyVelocity) : (currentStock > 0 ? 9999 : 0);

        let status = 'ok';
        let suggestedOrder = 0;

        if (currentStock === 0) {
          status = 'out_of_stock';
          suggestedOrder = Math.ceil(dailyVelocity * 60);
        } else if (dailyVelocity > 0) {
          if (daysRemaining <= forecastThreshold) {
            status = daysRemaining <= 3 ? 'critical_low' : 'low_stock';
            suggestedOrder = Math.ceil((dailyVelocity * 60) - currentStock);
            if (suggestedOrder < 0) suggestedOrder = 0;
          } else if (currentStock > dailyVelocity * overstockMultiplier) {
            status = 'over_stock';
          } else if (totalSold > 20 && daysRemaining < 14) {
            status = 'fast_moving';
          }
        } else {
          if (currentStock > alertQty * 20) status = 'over_stock';
          else if (currentStock > 0 && getDaysAgo(lastSaleDate) > 90) status = 'dead_stock';
        }

        return {
          ...v,
          current_stock: currentStock,
          alert_qty: alertQty,
          total_sold_period: totalSold,
          total_revenue_period: totalRevenue,
          daily_velocity: dailyVelocity,
          days_remaining: daysRemaining,
          last_sale_date: lastSaleDate,
          days_since_sale: getDaysAgo(lastSaleDate),
          status,
          suggested_order: suggestedOrder,
          stock_value: currentStock * purchasePrice,
          retail_value: currentStock * retailPrice,
          potential_profit: currentStock * (retailPrice - purchasePrice)
        };
      });

      setForecastData(enriched);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadSalesReport = async () => {
    setLoading(true);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      let filtered = allSales.filter(s => {
        if (s.is_deleted) return false;
        const sd = String(s.date || '').substring(0, 10);
        return sd >= salesFrom && sd <= salesTo;
      });

      if (salesPaymentMode !== 'all') filtered = filtered.filter(s => s.payment_mode === salesPaymentMode);

      const enriched = await Promise.all(filtered.map(async s => {
        const items = await db.getSaleItems(s.id).catch(() => []);
        return {
          ...s,
          total_items: items.length,
          total_qty: items.reduce((sum, i) => sum + (Number(i.quantity) || Number(i.qty) || 0), 0),
          total_cost: items.reduce((sum, i) => sum + ((Number(i.quantity) || Number(i.qty) || 0) * (Number(i.unit_cost) || Number(i.purchase_price) || 0)), 0)
        };
      }));

      setSalesData(enriched);

      const summary = {
        total_bills: enriched.length,
        total_sales: enriched.reduce((s, x) => s + (Number(x.grand_total) || 0), 0),
        total_paid: enriched.reduce((s, x) => s + (Number(x.paid_amount) || 0), 0),
        total_due: enriched.reduce((s, x) => s + (Number(x.due_amount) || 0), 0),
        total_discount: enriched.reduce((s, x) => s + (Number(x.discount) || 0), 0),
        total_cost: enriched.reduce((s, x) => s + (Number(x.total_cost) || 0), 0),
        total_items_sold: enriched.reduce((s, x) => s + (Number(x.total_qty) || 0), 0)
      };
      summary.gross_profit = summary.total_sales - summary.total_cost;

      setSalesSummary(summary);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadPurchaseReport = async () => {
    setLoading(true);
    try {
      const allPurchases = await db.getPurchases().catch(() => []);
      const filtered = allPurchases.filter(p => {
        if (p.is_deleted) return false;
        const pd = String(p.purchase_date || '').substring(0, 10);
        return pd >= purchaseFrom && pd <= purchaseTo;
      });
      setPurchaseData(filtered);

      const allSuppliers = await db.getSuppliers().catch(() => []);
      const summary = allSuppliers.map(s => {
        const supPurchases = filtered.filter(p => p.supplier_id === s.id);
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          company_name: s.company_name,
          current_balance: Number(s.current_balance || 0),
          total_purchases: supPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0),
          total_paid: supPurchases.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0),
          bill_count: supPurchases.length
        };
      }).sort((a, b) => b.total_purchases - a.total_purchases);

      setSupplierSummary(summary);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadCustomerReport = async () => {
    setLoading(true);
    try {
      const allCustomers = await db.getCustomers().catch(() => []);
      const allSales = await db.getSalesHistory().catch(() => []);
      const periodSales = allSales.filter(s => !s.is_deleted && String(s.date || '').substring(0, 10) >= customerFrom && String(s.date || '').substring(0, 10) <= customerTo);

      const data = allCustomers.map(c => {
        const custPeriodSales = periodSales.filter(s => s.customer_id === c.id);
        return {
          ...c,
          period_sales: custPeriodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
          period_paid: custPeriodSales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0),
          current_balance: Number(c.current_balance || 0)
        };
      });

      setCustomerData(data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadProfitLoss = async () => {
    setLoading(true);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      const periodSales = allSales.filter(s => !s.is_deleted && String(s.date || '').substring(0, 10) >= plFrom && String(s.date || '').substring(0, 10) <= plTo);

      const revenue = periodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0);
      let cogs = 0;

      for (const sale of periodSales) {
        const items = await db.getSaleItems(sale.id).catch(() => []);
        for (const item of items) {
          cogs += (Number(item.quantity) || Number(item.qty) || 0) * (Number(item.unit_cost) || Number(item.purchase_price) || 0);
        }
      }

      const allExpenses = await db.getExpenses().catch(() => []);
      const periodExpenses = allExpenses.filter(e => !e.is_deleted && String(e.date || '').substring(0, 10) >= plFrom && String(e.date || '').substring(0, 10) <= plTo);
      const expenses = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const gross = revenue - cogs;
      const net = gross - expenses;

      setPlSummary({
        revenue, cogs, expenses, gross, net,
        grossMargin: revenue > 0 ? (gross / revenue) * 100 : 0,
        netMargin: revenue > 0 ? (net / revenue) * 100 : 0
      });
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadStockAnalytics = async () => {
    setLoading(true);
    try {
      const allVariants = await db.getAllVariants().catch(() => []);
      const allProducts = await db.getProducts().catch(() => []);

      const productMap = {};
      allProducts.forEach(p => productMap[Number(p.id)] = p);

      const categoryMap = {};
      allVariants.forEach(v => {
        const product = productMap[Number(v.product_id)];
        const catName = product?.category_name || 'Uncategorized';
        if (!categoryMap[catName]) {
          categoryMap[catName] = { category_name: catName, variant_count: 0, total_qty: 0, stock_value_at_cost: 0, stock_value_at_retail: 0, potential_profit: 0 };
        }
        const stock = Number(v.current_stock) || 0;
        categoryMap[catName].variant_count++;
        categoryMap[catName].total_qty += stock;
        categoryMap[catName].stock_value_at_cost += stock * (Number(v.purchase_price) || 0);
        categoryMap[catName].stock_value_at_retail += stock * (Number(v.retail_price) || 0);
        categoryMap[catName].potential_profit += stock * ((Number(v.retail_price) || 0) - (Number(v.purchase_price) || 0));
      });

      setStockValuation(Object.values(categoryMap).sort((a, b) => b.stock_value_at_cost - a.stock_value_at_cost));
      const top = await db.getTopSellingProducts(topFrom, topTo, 20).catch(() => []);
      setTopProducts(top);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const allExpenses = await db.getExpenses().catch(() => []);
      const filtered = allExpenses.filter(e => !e.is_deleted && String(e.date || '').substring(0, 10) >= expFrom && String(e.date || '').substring(0, 10) <= expTo);
      setExpenseData(filtered);

      const catMap = {};
      filtered.forEach(e => {
        const cat = e.category_name || 'General Expense';
        if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, total: 0 };
        catMap[cat].count++;
        catMap[cat].total += Number(e.amount || 0);
      });

      const totalExpenses = Object.values(catMap).reduce((s, c) => s + c.total, 0);
      setExpenseSummary(Object.values(catMap).map(c => ({
        ...c, percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
      })).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleViewDetail = async (product) => {
    setSelectedProduct(product);
    try {
      const allSales = await db.getSalesHistory().catch(() => []);
      const allPurchases = await db.getPurchases().catch(() => []);

      const salesWithItems = await Promise.all(allSales.filter(s => !s.is_deleted).map(async s => {
        const items = await db.getSaleItems(s.id).catch(() => []);
        return { ...s, items: items.filter(i => Number(i.product_variant_id) === Number(product.id)) };
      }));

      const purchaseItemsArrays = await Promise.all(allPurchases.filter(p => !p.is_deleted).map(async p => {
        const items = await db.getPurchaseItems(p.id).catch(() => []);
        return { ...p, items: items.filter(i => Number(i.product_variant_id) === Number(product.id)) };
      }));

      const salesHistory = salesWithItems.filter(s => s.items.length > 0).flatMap(s => s.items.map(item => ({
        invoice_no: s.invoice_no, date: s.date, quantity: Number(item.quantity) || Number(item.qty) || 0,
        price: item.price, total: item.total, customer_name: s.customer_name || 'Walk-in',
        total_profit: ((Number(item.price) || 0) - (Number(item.unit_cost) || Number(item.purchase_price) || 0)) * (Number(item.quantity) || Number(item.qty) || 0)
      }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

      const purchaseHistory = purchaseItemsArrays.filter(p => p.items.length > 0).flatMap(p => p.items.map(item => ({
        purchase_no: p.purchase_no, purchase_date: p.purchase_date, supplier_name: p.supplier_name || '-',
        quantity: item.quantity, purchase_price: item.purchase_price, sub_total: item.sub_total
      }))).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date)).slice(0, 50);

      setProductHistory({
        sales: salesHistory, purchases: purchaseHistory,
        summary: {
          total_sold: salesHistory.reduce((s, h) => s + h.quantity, 0),
          total_revenue: salesHistory.reduce((s, h) => s + (Number(h.total) || 0), 0),
          total_profit: salesHistory.reduce((s, h) => s + h.total_profit, 0),
          total_purchased: purchaseHistory.reduce((s, h) => s + (Number(h.quantity) || 0), 0),
          total_purchase_cost: purchaseHistory.reduce((s, h) => s + (Number(h.sub_total) || 0), 0)
        }
      });
      setDetailDialog(true);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === 0) loadForecasting();
    else if (activeTab === 1) loadSalesReport();
    else if (activeTab === 2) loadPurchaseReport();
    else if (activeTab === 3) loadCustomerReport();
    else if (activeTab === 4) loadProfitLoss();
    else if (activeTab === 5) loadStockAnalytics();
    else if (activeTab === 6) loadExpenses();
  }, [activeTab]);

  const filteredForecast = useMemo(() => {
    return forecastData.filter(v => {
      const matchSearch = !fcSearch || (v.product_name || '').toLowerCase().includes(fcSearch.toLowerCase()) || (v.sku || '').toLowerCase().includes(fcSearch.toLowerCase());
      return matchSearch && (fcStatus === 'all' || v.status === fcStatus);
    });
  }, [forecastData, fcSearch, fcStatus]);

  const paginatedForecast = useMemo(() => {
    return filteredForecast.slice((fcPage - 1) * fcPerPage, fcPage * fcPerPage);
  }, [filteredForecast, fcPage]);

  const forecastStats = useMemo(() => {
    const criticalLow = forecastData.filter(v => v.status === 'critical_low').length;
    const lowStock = forecastData.filter(v => v.status === 'low_stock').length;
    const outOfStock = forecastData.filter(v => v.status === 'out_of_stock').length;
    const overStock = forecastData.filter(v => v.status === 'over_stock').length;
    const ok = forecastData.filter(v => v.status === 'ok').length;
    return { criticalLow, lowStock, outOfStock, overStock, ok };
  }, [forecastData]);

  // Filters for dynamic views
  const filteredSuppliers = supplierSummary.filter(s => s.name?.toLowerCase().includes(supSearch.toLowerCase()) || s.company_name?.toLowerCase().includes(supSearch.toLowerCase()));
  const filteredCustomers = customerData.filter(c => c.name?.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch));

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER SECTION */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          <Assessment sx={{ verticalAlign: 'middle', mr: 1, fontSize: 28 }} />
          Enterprise Sourced Analytical Control Center
        </Typography>
        <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={() => loadForecasting()}>Force Sync Engine</Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* REFRESH PANELS TABS WRAPPER */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto" indicatorColor="primary" textColor="primary">
          <Tab icon={<Timeline fontSize="small" />} label="Run Velocity Forecast" />
          <Tab icon={<PointOfSale fontSize="small" />} label="Sales Analysis" />
          <Tab icon={<LocalShipping fontSize="small" />} label="Suppliers Ledger" />
          <Tab icon={<People fontSize="small" />} label="Customers Debt" />
          <Tab icon={<ShowChart fontSize="small" />} label="Profit & Loss Matrix" />
          <Tab icon={<Inventory fontSize="small" />} label="Stock Valuation" />
          <Tab icon={<MoneyOff fontSize="small" />} label="Expense Ledger" />
        </Tabs>
      </Paper>

      {/* TAB PANEL 0: VELOCITY FORECAST */}
      {activeTab === 0 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { title: 'Critical Low', value: forecastStats.criticalLow, color: 'error' },
              { title: 'Low Limit Alerts', value: forecastStats.lowStock, color: 'error' },
              { title: 'Out of Stock Level', value: forecastStats.outOfStock, color: 'error' },
              { title: 'Over Stock Count', value: forecastStats.overStock, color: 'warning' },
              { title: 'Optimal Safe Balance', value: forecastStats.ok, color: 'success' }
            ].map((stat, i) => (
              <Grid item xs={6} md={2.4} key={i}>
                <Card sx={{ bgcolor: `${stat.color}.light`, borderLeft: '4px solid', borderLeftColor: `${stat.color}.main` }}><CardContent sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">{stat.title}</Typography><Typography variant="h6" fontWeight="bold">{stat.value}</Typography></CardContent></Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb', boxShadow: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" placeholder="Fuzzy search product descriptors or SKU constraints..." value={fcSearch} onChange={(e) => setFcSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} /></Grid>
              <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small"><InputLabel>Velocity Forecast Basis</InputLabel>
                  <Select value={forecastPeriod} onChange={(e) => setForecastPeriod(Number(e.target.value))} label="Velocity Forecast Basis">
                    <MenuItem value={7}>Last 7 Trading Days</MenuItem><MenuItem value={30}>Last 30 Trading Days</MenuItem><MenuItem value={90}>Last 90 Trading Days</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small"><InputLabel>Account State Flag</InputLabel>
                  <Select value={fcStatus} onChange={(e) => setFcStatus(e.target.value)} label="Account State Flag">
                    <MenuItem value="all">Display All Structural States</MenuItem><MenuItem value="critical_low">Critical Low</MenuItem><MenuItem value="low_stock">Low Stock Alerts</MenuItem><MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}><Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setFcSearch(''); setFcStatus('all'); }}>Clear Parameters</Button></Grid>
            </Grid>
          </Paper>

          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  {['Product Model Nomenclature', 'Internal SKU', 'Stock Vol', 'Sold (Period)', 'Daily Velocity Rate', 'Days Left Runway', 'State Status Badge', 'Suggested Order Qty', 'Valuation Cost Basis', 'Action'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow></TableHead>
                <TableBody>
                  {paginatedForecast.map(v => (
                    <TableRow key={v.id} hover>
                      <TableCell><Typography variant="body2" fontWeight="bold">{v.product_name}</Typography><Typography variant="caption" color="text.secondary">{v.variant_name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" fontFamily="monospace" sx={{ bgcolor: '#f3f4f6', px: 0.5 }}>{v.sku}</Typography></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{v.current_stock}</TableCell>
                      <TableCell align="right">{v.total_sold_period}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{v.daily_velocity.toFixed(2)}/d</TableCell>
                      <TableCell align="right">
                        {v.daily_velocity > 0 ? (
                          <Box><Typography fontWeight="bold" color={v.days_remaining <= forecastThreshold ? 'error.main' : 'success.main'}>{v.days_remaining} days</Typography>
                            <LinearProgress variant="determinate" value={Math.min((v.days_remaining / 60) * 100, 100)} color={v.days_remaining <= forecastThreshold ? 'error' : 'success'} sx={{ height: 4, borderRadius: 2 }} />
                          </Box>
                        ) : 'No Outflow data'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" color={FORECAST_STATUS[v.status]?.color || 'default'} label={FORECAST_STATUS[v.status]?.label || v.status} />
                      </TableCell>
                      <TableCell align="right" sx={{ color: v.suggested_order > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>{v.suggested_order > 0 ? `+${v.suggested_order}` : '-'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(v.stock_value)}</TableCell>
                      <TableCell align="center"><IconButton size="small" color="primary" onClick={() => handleViewDetail(v)}><Visibility fontSize="small" /></IconButton></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}><Pagination count={Math.ceil(filteredForecast.length / fcPerPage)} page={fcPage} onChange={(e, p) => setFcPage(p)} color="primary" size="small" /></Box>
          </Paper>
        </Box>
      )}

      {/* TAB PANEL 1: SALES REPORT */}
      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" label="Sales Target From" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" type="date" label="Sales Target To" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select value={salesPaymentMode} onChange={(e) => setSalesPaymentMode(e.target.value)} label="Payment Mode">
                    <MenuItem value="all">All Channels</MenuItem>
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank">Bank Transfer</MenuItem>
                    <MenuItem value="credit">Credit / Due</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><Button fullWidth variant="contained" size="small" onClick={loadSalesReport}>Compile Sales Statement</Button></Grid>
            </Grid>
          </Paper>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}><Card sx={{ bg: '#f0fdf4' }}><CardContent><Typography variant="caption">Total Collected Revenue</Typography><Typography variant="h5" fontWeight="bold" color="green">{formatCurrency(salesSummary.total_sales)}</Typography></CardContent></Card></Grid>
            <Grid item xs={6} md={4}><Card><CardContent><Typography variant="caption">Total Margin Yield (Gross)</Typography><Typography variant="h5" fontWeight="bold" color="primary">{formatCurrency(salesSummary.gross_profit)}</Typography></CardContent></Card></Grid>
            <Grid item xs={6} md={4}><Card><CardContent><Typography variant="caption">Receivable Debt Booked</Typography><Typography variant="h5" fontWeight="bold" color="error">{formatCurrency(salesSummary.total_due)}</Typography></CardContent></Card></Grid>
          </Grid>

          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  {['Invoice Code ID', 'Posting Stamp', 'Acquired Consumer Party', 'Dispatched Qty', 'Gross Billing Value', 'Net Recovered Cash', 'Open Due Balance', 'Mode Channel'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#4b5563', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow></TableHead>
                <TableBody>
                  {salesData.map(sale => (
                    <TableRow key={sale.id} hover>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{sale.invoice_no}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(sale.date)}</TableCell>
                      <TableCell>{sale.customer_name || 'Counter Cash Pool'}</TableCell>
                      <TableCell align="right">{sale.total_qty || 0} units</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.grand_total)}</TableCell>
                      <TableCell align="right" sx={{ color: 'green' }}>{formatCurrency(sale.paid_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: sale.due_amount > 0 ? 'red' : 'inherit' }}>{formatCurrency(sale.due_amount)}</TableCell>
                      <TableCell align="center"><Chip size="small" label={String(sale.payment_mode || 'Cash').toUpperCase()} variant="outlined" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB PANEL 2: SUPPLIERS LEDGER */}
      {activeTab === 2 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="date" label="Purchases From" value={purchaseFrom} onChange={(e) => setPurchaseFrom(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="date" label="Purchases To" value={purchaseTo} onChange={(e) => setPurchaseTo(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}><Button fullWidth variant="contained" size="small" onClick={loadPurchaseReport}>Fetch Procurement Ledger</Button></Grid>
              <Grid item xs={12} sx={{ mt: 1 }}><TextField fullWidth size="small" placeholder="Filter by supplier or company..." value={supSearch} onChange={(e) => setSupSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} /></Grid>
            </Grid>
          </Paper>

          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  {['Supplier Name', 'Company Domain', 'Contact', 'Procurements Count', 'Total Orders Value', 'Paid Pool', 'Outstanding Payable'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#0284c7', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow></TableHead>
                <TableBody>
                  {filteredSuppliers.map(sup => (
                    <TableRow key={sup.id} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{sup.name}</TableCell>
                      <TableCell>{sup.company_name || '-'}</TableCell>
                      <TableCell>{sup.phone || '-'}</TableCell>
                      <TableCell align="center">{sup.bill_count} Invoices</TableCell>
                      <TableCell align="right">{formatCurrency(sup.total_purchases)}</TableCell>
                      <TableCell align="right" sx={{ color: 'green' }}>{formatCurrency(sup.total_paid)}</TableCell>
                      <TableCell align="right" sx={{ color: sup.current_balance > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>{formatCurrency(sup.current_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB PANEL 3: CUSTOMERS DEBT */}
      {activeTab === 3 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="date" label="Timeline From" value={customerFrom} onChange={(e) => setCustomerFrom(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" type="date" label="Timeline To" value={customerTo} onChange={(e) => setCustomerTo(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}><Button fullWidth variant="contained" size="small" onClick={loadCustomerReport}>Calculate Arrears Matrix</Button></Grid>
              <Grid item xs={12} sx={{ mt: 1 }}><TextField fullWidth size="small" placeholder="Search customer records by name or cellphone..." value={custSearch} onChange={(e) => setCustSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'gray' }} /> }} /></Grid>
            </Grid>
          </Paper>

          <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  {['Client Identity', 'Mobile Contact', 'Shop Branding', 'Period Buying Volume', 'Period Clearances', 'Total Balance Receivables'].map(h => (
                    <TableCell key={h} sx={{ bgcolor: '#7c3aed', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow></TableHead>
                <TableBody>
                  {filteredCustomers.map(cust => (
                    <TableRow key={cust.id} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{cust.name}</TableCell>
                      <TableCell>{cust.phone || '-'}</TableCell>
                      <TableCell>{cust.shop_name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(cust.period_sales)}</TableCell>
                      <TableCell align="right" sx={{ color: 'green' }}>{formatCurrency(cust.period_paid)}</TableCell>
                      <TableCell align="right" sx={{ color: cust.current_balance > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>{formatCurrency(cust.current_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB PANEL 4: PROFIT & LOSS MATRIX */}
      {activeTab === 4 && (
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', border: '1px solid #e5e7eb', boxShadow: 0 }}>
          <Typography variant="h6" align="center" fontWeight="bold" color="primary" gutterBottom>Statement of Profit & Loss Accounts</Typography>
          <Typography variant="caption" align="center" display="block" color="text.secondary" sx={{ mb: 3 }}>Accounting Bounds Window: {formatDate(plFrom)} up to {formatDate(plTo)}</Typography>
          <Divider sx={{ mb: 3 }} />

          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1 }}>
              <Typography fontWeight="bold" color="green">Aggregate Top-Line Gross Revenue Sales Pool</Typography>
              <Typography fontWeight="bold" color="green">{formatCurrency(plSummary.revenue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fef2f2', borderRadius: 1 }}>
              <Typography fontWeight="bold" color="red">Cost of Goods Sold (COGS Batch Expense Outflows)</Typography>
              <Typography fontWeight="bold" color="red">-{formatCurrency(plSummary.cogs)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#eff6ff', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">Calculated Gross Trading Profit Yield Margin</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{formatCurrency(plSummary.gross)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: '#fffbeb', borderRadius: 1 }}>
              <Typography variant="body2">Operating Expenditure (Indirect Vouchers Pool)</Typography>
              <Typography variant="body2">-{formatCurrency(plSummary.expenses)}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: plSummary.net >= 0 ? '#10b981' : '#ef4444', color: 'white', borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold">NET AUDITED COMPREHENSIVE INCOME BALANCE</Typography>
              <Typography variant="h6" fontWeight="bold">{formatCurrency(plSummary.net)}</Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* TAB PANEL 5: STOCK VALUATION */}
      {activeTab === 5 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Capital Allocation Distribution Matrix Categories</Typography>
            <Divider sx={{ mb: 1.5 }} />
            {stockValuation.map((cat, i) => (
              <Card key={i} variant="outlined" sx={{ mb: 1.5, bgcolor: '#f9fafb' }}><CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography fontWeight="bold">{cat.category_name}</Typography><Chip size="small" label={`${cat.total_qty} units stacked`} variant="outlined" /></Box>
                <Grid container spacing={1}>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Cost Value Sum</Typography><Typography variant="body2" fontWeight="bold">{formatCurrency(cat.stock_value_at_cost)}</Typography></Grid>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Retail Revenue Value</Typography><Typography variant="body2" color="green" fontWeight="bold">{formatCurrency(cat.stock_value_at_retail)}</Typography></Grid>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Potential Margin Profit</Typography><Typography variant="body2" color="primary.main" fontWeight="bold">{formatCurrency(cat.potential_profit)}</Typography></Grid>
                </Grid>
              </CardContent></Card>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Top Velocity Product Assets Ledger</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <TableContainer sx={{ maxHeight: 400 }}><Table size="small">
                <TableHead><TableRow sx={{ bgcolor: '#f9fafb' }}><TableCell>Product</TableCell><TableCell align="right">Sold Units Volume</TableCell><TableCell align="right">Revenue Sum Generated</TableCell></TableRow></TableHead>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Typography variant="body2" fontWeight="bold">{p.product_name}</Typography><Typography variant="caption" color="text.secondary">{p.sku}</Typography></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{p.total_sold} units</TableCell>
                      <TableCell align="right" sx={{ color: 'green', fontWeight: 'bold' }}>{formatCurrency(p.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB PANEL 6: EXPENSE LEDGER */}
      {activeTab === 6 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Expense Categorical Outflow Distribution</Typography>
            <Divider sx={{ mb: 1.5 }} />
            {expenseSummary.map((exp, i) => (
              <Card key={i} sx={{ mb: 1.5, borderLeft: '4px solid #f59e0b' }}>
                <CardContent sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography fontWeight="bold">{exp.category}</Typography>
                    <Typography variant="caption" color="text.secondary">{exp.count} debit transactions</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontWeight="bold" color="error.main">{formatCurrency(exp.total)}</Typography>
                    <Typography variant="caption" sx={{ bgcolor: '#fef3c7', px: 1, borderRadius: 1 }}>{exp.percentage.toFixed(1)}%</Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={5}><TextField fullWidth size="small" type="date" label="Expense From" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={5}><TextField fullWidth size="small" type="date" label="Expense To" value={expTo} onChange={(e) => setExpTo(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={2}><Button fullWidth variant="outlined" size="small" onClick={loadExpenses}><Refresh /></Button></Grid>
              </Grid>
            </Paper>

            <Paper sx={{ border: '1px solid #e5e7eb', boxShadow: 0 }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
                <Table size="small">
                  <TableHead><TableRow>
                    {['Date Stamp', 'Category Group', 'Descriptor Memo', 'Mode Channel', 'Amount Deducted'].map(h => (
                      <TableCell key={h} sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 'bold' }}>{h}</TableCell>
                    ))}
                  </TableRow></TableHead>
                  <TableBody>
                    {expenseData.map(e => (
                      <TableRow key={e.id} hover>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(e.date)}</TableCell>
                        <TableCell><Chip label={e.category_name || 'General'} size="small" variant="outlined" color="warning" /></TableCell>
                        <TableCell>{e.description || '-'}</TableCell>
                        <TableCell>{String(e.payment_mode || 'Cash').toUpperCase()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'red' }}>{formatCurrency(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* MASTER LIFECYCLE POPUP DETAILS */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e5e7eb' }}>Asset Audit Portfolio: {selectedProduct?.product_name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedProduct && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3, textAlign: 'center' }}>
                <Grid item xs={6} md={4}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Total Sales Volume</Typography><Typography variant="h6" fontWeight="bold" color="primary.main">{productHistory.summary.total_sold || 0} units</Typography></Paper></Grid>
                <Grid item xs={6} md={4}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Gross Sales revenues</Typography><Typography variant="h6" fontWeight="bold" color="green">{formatCurrency(productHistory.summary.total_revenue)}</Typography></Paper></Grid>
                <Grid item xs={12} md={4}><Paper sx={{ p: 1.5, bgcolor: '#f9fafb' }}><Typography variant="caption" color="text.secondary">Net Consolidated Profits</Typography><Typography variant="h6" fontWeight="bold" color="green">{formatCurrency(productHistory.summary.total_profit)}</Typography></Paper></Grid>
              </Grid>

              <Typography variant="subtitle2" fontWeight="bold" color="secondary" gutterBottom>Downstream Consumer Manifest Rows</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 0, maxHeight: 250 }}><Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Invoice ID</TableCell><TableCell>Client Account</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Total Net</TableCell></TableRow></TableHead>
                <TableBody>
                  {productHistory.sales?.map((s, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontSize: '0.78rem' }}>{formatDate(s.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{s.invoice_no}</TableCell>
                      <TableCell>{s.customer_name}</TableCell>
                      <TableCell align="right">{s.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(s.price)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailDialog(false)}>Dismiss View</Button></DialogActions>
      </Dialog>
    </Box>
  );
}