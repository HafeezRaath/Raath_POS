import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PointOfSale,
  Package,
  Users,
  Receipt,
  Truck,
  CreditCard,
  Clock,
  Print,
  Assessment,
  RefreshCw,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  BarChart2,
  PieChart as PieIcon,
  CheckCircle,
  AlertCircle,
  Landmark,
  Smartphone,
  Store,
} from '../components/ui/icons';
import Button from '../components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Alert from '../components/ui/Alert';
import db from '../database/db';
import useSyncListener from '../hooks/useSyncListener';
import { formatCleanId } from '../utils/receiptGenerator';
import UnifiedPagination from '../components/common/UnifiedPagination';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const isDateBetween = (dateStr, startDate, endDate) => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  } catch {
    return false;
  }
};

const isEMIDueSoon = (nextDueDate, days = 7) => {
  if (!nextDueDate) return false;
  try {
    const due = new Date(nextDueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays >= 0;
  } catch {
    return false;
  }
};

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444'];

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('today');
  const [chartView, setChartView] = useState('area'); // 'area' or 'bar'

  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    todayPaid: 0,
    todayDue: 0,
    lowStock: 0,
    totalProducts: 0,
    outOfStock: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    pendingEMI: 0,
    todayReturns: 0,
    todayExpenses: 0,
  });

  const [recentSales, setRecentSales] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesRowsPerPage, setSalesRowsPerPage] = useState(5);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [systemAccounts, setSystemAccounts] = useState([]);

  const paginatedRecentSales = useMemo(() => {
    const start = (salesPage - 1) * salesRowsPerPage;
    return recentSales.slice(start, start + salesRowsPerPage);
  }, [recentSales, salesPage, salesRowsPerPage]);

  const isElectron =
    typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron;

  const getPeriodDates = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'week': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startDate = startOfWeek.toISOString().split('T')[0];
        endDate = today;
        break;
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = startOfMonth.toISOString().split('T')[0];
        endDate = today;
        break;
      }
      case 'lastMonth': {
        const lastMonth = new Date(now);
        lastMonth.setMonth(now.getMonth() - 1);
        const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        startDate = startOfLastMonth.toISOString().split('T')[0];
        endDate = endOfLastMonth.toISOString().split('T')[0];
        break;
      }
      default:
        startDate = today;
        endDate = today;
    }

    return { startDate, endDate, today };
  }, [period]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getPeriodDates();

      let todaySalesData,
        lowStockData,
        productsData,
        customersData,
        suppliersData,
        emiData,
        returnsData,
        expensesData,
        recentSalesData,
        topProductsData,
        paymentModes,
        trendData,
        categorySalesData;

      if (isElectron) {
        const [
          salesResult,
          lowStockResult,
          productsResult,
          customersResult,
          suppliersResult,
          emiResult,
          returnsResult,
          expensesResult,
          recentSalesResult,
          topProductsResult,
          paymentResult,
          trendResult,
          categoryResult,
        ] = await Promise.all([
          db.query(
            `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count,
             COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as due
             FROM sales 
             WHERE date(date) >= date(?) AND date(date) <= date(?)
             AND is_deleted = 0`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT pv.*, p.name as product_name
             FROM product_variants pv
             JOIN products p ON pv.product_id = p.id
             WHERE pv.current_stock <= pv.stock_alert_quantity 
             AND pv.is_deleted = 0`
          ),
          db.query(`SELECT id FROM products WHERE is_deleted = 0`),
          db.query(`SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0`),
          db.query(`SELECT COUNT(*) as count FROM suppliers WHERE is_deleted = 0`),
          db.query(
            `SELECT COUNT(*) as count FROM emi_records
             WHERE status = 'active' 
             AND next_due_date <= date('now', '+7 days')`
          ),
          db.query(
            `SELECT COALESCE(SUM(refund_amount), 0) as total, COUNT(*) as count
             FROM sale_returns 
             WHERE date(return_date) >= date(?) AND date(return_date) <= date(?)`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT COALESCE(SUM(amount), 0) as total
             FROM expenses 
             WHERE date(date) >= date(?) AND date(date) <= date(?)
             AND is_deleted = 0`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT s.*, c.name as customer_name
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE date(s.date) >= date(?) AND date(s.date) <= date(?)
             AND s.is_deleted = 0
             ORDER BY s.date DESC LIMIT 10`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT 
               pv.id as product_variant_id,
               p.name as product_name,
               pv.sku,
               COALESCE(SUM(si.quantity), 0) as total_sold,
               COALESCE(SUM(si.total), 0) as total_revenue
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             JOIN products p ON si.product_id = p.id
             JOIN product_variants pv ON si.product_variant_id = pv.id
             WHERE date(s.date) >= date(?) AND date(s.date) <= date(?)
             AND s.is_deleted = 0
             GROUP BY si.product_variant_id
             ORDER BY total_sold DESC
             LIMIT 5`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT payment_mode, COUNT(*) as count,
             COALESCE(SUM(grand_total), 0) as amount
             FROM sales 
             WHERE date(date) >= date(?) AND date(date) <= date(?)
             AND is_deleted = 0
             GROUP BY payment_mode`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT date(date) as day, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
             FROM sales
             WHERE date(date) >= date(?) AND date(date) <= date(?)
             AND is_deleted = 0
             GROUP BY date(date)
             ORDER BY date(date)`,
            [startDate, endDate]
          ),
          db.query(
            `SELECT c.name as category, COUNT(s.id) as count, COALESCE(SUM(s.grand_total), 0) as total
             FROM sales s
             JOIN sale_items si ON s.id = si.sale_id
             JOIN products p ON si.product_id = p.id
             JOIN categories c ON p.category_id = c.id
             WHERE date(s.date) >= date(?) AND date(s.date) <= date(?)
             AND s.is_deleted = 0
             GROUP BY c.id`,
            [startDate, endDate]
          ),
        ]);

        todaySalesData = salesResult;
        lowStockData = lowStockResult;
        productsData = productsResult;
        customersData = customersResult;
        suppliersData = suppliersResult;
        emiData = emiResult;
        returnsData = returnsResult;
        expensesData = expensesResult;
        recentSalesData = recentSalesResult;
        topProductsData = topProductsResult;
        paymentModes = paymentResult;
        trendData = trendResult;
        categorySalesData = categoryResult;
      } else {
        const [
          allSales,
          allVariants,
          allProducts,
          allCustomers,
          allSuppliers,
          allEMIs,
          allReturns,
          allExpenses,
          allSaleItems,
          allCategories,
          allAccounts,
        ] = await Promise.all([
          db.getSalesHistory(),
          db.getAllVariants(),
          db.getProducts(),
          db.getCustomers(),
          db.getSuppliers(),
          db.getEMIs(),
          db.getSaleReturns(),
          db.getExpenses(),
          db.getAllSaleItems(),
          db.getCategories(),
          db.getAccounts ? db.getAccounts().catch(() => []) : Promise.resolve([]),
        ]);

        setSystemAccounts(Array.isArray(allAccounts) ? allAccounts : []);

        const periodSales = allSales.filter((s) => {
          if (s.is_deleted) return false;
          return isDateBetween(s.date, startDate, endDate);
        });

        todaySalesData = [
          {
            total: periodSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
            count: periodSales.length,
            paid: periodSales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0),
            due: periodSales.reduce((sum, s) => sum + (Number(s.due_amount) || 0), 0),
          },
        ];

        lowStockData = allVariants.filter(
          (v) => Number(v.current_stock) <= Number(v.stock_alert_quantity) && !v.is_deleted
        );
        productsData = allProducts.filter((p) => !p.is_deleted);
        customersData = [{ count: allCustomers.length }];
        suppliersData = [{ count: allSuppliers.length }];
        emiData = [
          {
            count: allEMIs.filter(
              (e) => e.status === 'active' && isEMIDueSoon(e.next_due_date, 7)
            ).length,
          },
        ];

        const periodReturns = allReturns.filter((r) => {
          if (r.is_deleted) return false;
          return isDateBetween(r.return_date, startDate, endDate);
        });
        returnsData = [
          {
            total: periodReturns.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0),
            count: periodReturns.length,
          },
        ];

        const periodExpenses = allExpenses.filter((e) => {
          if (e.is_deleted) return false;
          return isDateBetween(e.date, startDate, endDate);
        });
        expensesData = [
          {
            total: periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
          },
        ];

        recentSalesData = periodSales
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);

        const trendMap = {};
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          trendMap[dateStr] = { day: dateStr, count: 0, total: 0 };
        }

        periodSales.forEach((s) => {
          const dateKey = s.date.split('T')[0];
          if (trendMap[dateKey]) {
            trendMap[dateKey].count += 1;
            trendMap[dateKey].total += Number(s.grand_total) || 0;
          }
        });

        trendData = Object.values(trendMap).sort((a, b) => a.day.localeCompare(b.day));

        const categoryMap = {};
        const periodSaleIds = new Set(periodSales.map((s) => s.id));
        allSaleItems.forEach((si) => {
          if (periodSaleIds.has(si.sale_id)) {
            const cat = allCategories.find((c) => c.id === si.category_id);
            const catName = cat?.name || 'General';
            if (!categoryMap[catName]) {
              categoryMap[catName] = { category: catName, count: 0, total: 0 };
            }
            categoryMap[catName].count += 1;
            categoryMap[catName].total += Number(si.total) || 0;
          }
        });
        categorySalesData = Object.values(categoryMap);

        const productSalesMap = {};
        const periodSaleItems = allSaleItems.filter((si) => periodSaleIds.has(si.sale_id));
        periodSaleItems.forEach((si) => {
          const key = si.product_variant_id;
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              product_variant_id: key,
              product_id: si.product_id,
              product_name: si.product_name || 'Unknown',
              sku: si.sku || '',
              total_sold: 0,
              total_revenue: 0,
            };
          }
          productSalesMap[key].total_sold += Number(si.quantity) || 0;
          productSalesMap[key].total_revenue += Number(si.total) || 0;
        });
        topProductsData = Object.values(productSalesMap)
          .sort((a, b) => b.total_sold - a.total_sold)
          .slice(0, 5);

        const paymentMap = {};
        periodSales.forEach((s) => {
          let spList = null;
          if (s.split_payments) {
            try {
              spList = typeof s.split_payments === 'string' ? JSON.parse(s.split_payments) : s.split_payments;
            } catch (_) {}
          }

          if (s.payment_mode === 'split' && Array.isArray(spList) && spList.length > 0) {
            spList.forEach((sp) => {
              const accKey = sp.account_name || sp.method || 'Split';
              if (!paymentMap[accKey]) {
                paymentMap[accKey] = { payment_mode: accKey, count: 0, amount: 0 };
              }
              paymentMap[accKey].count += 1;
              paymentMap[accKey].amount += Number(sp.amount) || 0;
            });
          } else {
            const mode = s.payment_mode || 'cash';
            if (!paymentMap[mode]) {
              paymentMap[mode] = { payment_mode: mode, count: 0, amount: 0 };
            }
            paymentMap[mode].count += 1;
            paymentMap[mode].amount += Number(s.paid_amount || s.grand_total) || 0;
          }
        });
        paymentModes = Object.values(paymentMap);
      }

      const parsedSales = Number(todaySalesData?.[0]?.total || 0);
      const parsedCount = Number(todaySalesData?.[0]?.count || 0);
      const parsedPaid = Number(todaySalesData?.[0]?.paid || 0);
      const parsedDue = Number(todaySalesData?.[0]?.due || 0);
      const parsedLowStockCount = lowStockData?.length || 0;
      const parsedOutOfStockCount =
        lowStockData?.filter((i) => Number(i.current_stock) === 0).length || 0;
      const parsedExpenses = Number(expensesData?.[0]?.total || 0);
      const parsedEMI = Number(emiData?.[0]?.count || 0);

      setStats({
        todaySales: parsedSales,
        todayCount: parsedCount,
        todayPaid: parsedPaid,
        todayDue: parsedDue,
        lowStock: parsedLowStockCount,
        totalProducts: productsData?.length || 0,
        outOfStock: parsedOutOfStockCount,
        totalCustomers: Number(customersData?.[0]?.count || 0),
        totalSuppliers: Number(suppliersData?.[0]?.count || 0),
        pendingEMI: parsedEMI,
        todayReturns: Number(returnsData?.[0]?.total || 0),
        todayExpenses: parsedExpenses,
      });

      setRecentSales(Array.isArray(recentSalesData) ? recentSalesData : []);
      setLowStockItems(Array.isArray(lowStockData) ? lowStockData.slice(0, 5) : []);
      setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
      setPaymentBreakdown(Array.isArray(paymentModes) ? paymentModes : []);
      setSalesTrendData(Array.isArray(trendData) ? trendData : []);
      setCategoryData(Array.isArray(categorySalesData) ? categorySalesData : []);
    } catch (e) {
      console.error('Dashboard data loading error:', e);
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [period, getPeriodDates, isElectron]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);
  useSyncListener(loadAllData);

  const formattedTrendData = useMemo(() => {
    return salesTrendData.map((d) => ({
      ...d,
      dayLabel: new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' }),
    }));
  }, [salesTrendData]);

  const quickActions = [
    {
      icon: PointOfSale,
      label: 'New Bill',
      path: '/billing',
      color: 'bg-emerald-600 text-white hover:bg-emerald-700',
    },
    {
      icon: Package,
      label: 'Add Product',
      path: '/products',
      color: 'bg-indigo-600 text-white hover:bg-indigo-700',
    },
    {
      icon: Truck,
      label: 'Purchase Stock',
      path: '/inventory',
      color: 'bg-blue-600 text-white hover:bg-blue-700',
    },
    {
      icon: Users,
      label: 'Customers',
      path: '/customers',
      color: 'bg-slate-800 text-white hover:bg-slate-900',
    },
    {
      icon: Assessment,
      label: 'View Reports',
      path: '/reports',
      color: 'bg-amber-600 text-white hover:bg-amber-700',
    },
    {
      icon: Receipt,
      label: 'Sales History',
      path: '/sales-history',
      color: 'bg-purple-600 text-white hover:bg-purple-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Store Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time business performance overview & inventory telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Period Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'lastMonth', label: 'Last Mo.' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p.id
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            icon={RefreshCw}
            loading={loading}
            title="Refresh statistics"
          />
        </div>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden bg-white border border-[#e2e8f0]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1c2580]" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Revenue ({period})
                </span>
                <h3 className="text-2xl font-extrabold text-[#1c2580] mt-1">
                  {formatCurrency(stats.todaySales)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stats.todayCount} total bills issued
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#e8eaf6] text-[#1c2580] flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold flex items-center gap-1">
                <ArrowUp size={14} className="text-[#1c2580]" /> Paid: {formatCurrency(stats.todayPaid)}
              </span>
              {stats.todayDue > 0 && (
                <span className="text-slate-600 font-semibold">
                  Due: {formatCurrency(stats.todayDue)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Stock Alerts */}
        <Card
          className="hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer bg-white border border-[#e2e8f0]"
          onClick={() => navigate('/stock-tracking')}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1c2580]" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Low Stock Alerts
                </span>
                <h3 className="text-2xl font-extrabold text-[#1c2580] mt-1">{stats.lowStock}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stats.outOfStock} items currently out of stock
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#e8eaf6] text-[#1c2580] flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Products: {stats.totalProducts}</span>
              <span className="text-[#1c2580] font-bold">Review Stock →</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Expenses */}
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden bg-white border border-[#e2e8f0]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1c2580]" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Expenses & Returns
                </span>
                <h3 className="text-2xl font-extrabold text-[#1c2580] mt-1">
                  {formatCurrency(stats.todayExpenses + stats.todayReturns)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exp: {formatCurrency(stats.todayExpenses)} • Ret: {formatCurrency(stats.todayReturns)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#e8eaf6] text-[#1c2580] flex items-center justify-center">
                <TrendingDown size={24} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Net Estimated Profit:</span>
              <span className="font-bold text-[#1c2580]">
                {formatCurrency(stats.todaySales - (stats.todayExpenses + stats.todayReturns))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Operations Overview */}
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden bg-white border border-[#e2e8f0]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1c2580]" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Directory
                </span>
                <h3 className="text-2xl font-extrabold text-[#1c2580] mt-1">
                  {stats.totalCustomers}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stats.totalSuppliers} registered suppliers
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#e8eaf6] text-[#1c2580] flex items-center justify-center">
                <Users size={24} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Pending EMI Alerts:</span>
              <Badge variant="slate" size="xs">
                {stats.pendingEMI} due
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl shadow-xs font-semibold text-xs transition-all active:scale-95 ${action.color}`}
            >
              <Icon size={18} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sales Revenue Telemetry</CardTitle>
              <CardDescription>Daily revenue trends across the selected period</CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setChartView('area')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  chartView === 'area' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                Area
              </button>
              <button
                type="button"
                onClick={() => setChartView('bar')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  chartView === 'bar' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                Bar
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-64 sm:h-72 w-full">
              {formattedTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'area' ? (
                    <AreaChart data={formattedTrendData}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <RechartsTooltip
                        formatter={(value) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#6366F1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={formattedTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <RechartsTooltip
                        formatter={(value) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No sales recorded in this timeframe
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Breakdown of sales collection channels</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-52 w-full">
              {paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="amount"
                      nameKey="payment_mode"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {paymentBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val) => [formatCurrency(val), 'Amount']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No payment data available
                </div>
              )}
            </div>

            {/* Payment Mode Pills */}
            <div className="mt-4 space-y-2">
              {paymentBreakdown.map((pm, idx) => (
                <div
                  key={pm.payment_mode}
                  className="flex items-center justify-between text-xs text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="capitalize font-medium">{pm.payment_mode}</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(pm.amount)}</span>
                </div>
              ))}
            </div>

            {/* Active System Accounts & Balances */}
            {systemAccounts && systemAccounts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Balances</span>
                  <button 
                    type="button" 
                    onClick={() => navigate('/accounts')}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    View Accounts &rarr;
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {systemAccounts.map((acc) => (
                    <div key={acc.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-600 font-medium truncate">{acc.name}</span>
                      <span className={`text-xs font-bold ${Number(acc.current_balance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(acc.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section: Recent Invoices & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/sales-history')}
              iconRight={ArrowRight}
            >
              All Invoices
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead align="right">Amount</TableHead>
                  <TableHead align="center">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecentSales.length > 0 ? (
                  paginatedRecentSales.map((sale, idx) => (
                    <TableRow key={sale.id || idx}>
                      <TableCell className="font-mono text-xs font-bold text-indigo-600">
                        {formatCleanId(sale, (salesPage - 1) * salesRowsPerPage + idx)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {sale.customer_name || 'Walk-in Customer'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(sale.date)}
                      </TableCell>
                      <TableCell align="right" className="font-bold text-slate-900">
                        {formatCurrency(sale.grand_total)}
                      </TableCell>
                      <TableCell align="center">
                        <Badge
                          variant={
                            sale.payment_status === 'paid'
                              ? 'success'
                              : sale.payment_status === 'partial'
                              ? 'warning'
                              : 'danger'
                          }
                          size="xs"
                        >
                          {sale.payment_mode === 'split' ? 'Split Pay' : (sale.payment_mode || 'Cash')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400">
                      No recent sales found for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <UnifiedPagination
              count={recentSales.length}
              page={salesPage}
              rowsPerPage={salesRowsPerPage}
              onPageChange={setSalesPage}
              onRowsPerPageChange={(r) => {
                setSalesRowsPerPage(r);
                setSalesPage(1);
              }}
              rowsPerPageOptions={[5, 10, 20]}
            />
          </Card>
        </div>

        {/* Low Stock & Top Products Column */}
        <div className="space-y-6">
          {/* Low Stock Watchlist */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Low Stock Items</CardTitle>
              <Badge variant="danger" size="xs">
                {stats.lowStock} Alerts
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 truncate max-w-[180px]">
                        {item.product_name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.sku || 'N/A'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold ${
                          Number(item.current_stock) === 0 ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {item.current_stock} left
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Limit: {item.stock_alert_quantity}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  <CheckCircle size={24} className="mx-auto text-emerald-500/40 mb-1" />
                  All inventory stock levels are healthy
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Selling Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {topProducts.length > 0 ? (
                topProducts.map((p, idx) => (
                  <div
                    key={p.product_variant_id || idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{p.product_name}</p>
                        <span className="text-[10px] text-slate-400">{p.total_sold} units sold</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 flex-shrink-0">
                      {formatCurrency(p.total_revenue)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No product sales registered yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}