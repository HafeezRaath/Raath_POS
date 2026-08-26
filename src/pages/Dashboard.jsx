import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, LinearProgress,
  List, ListItem, ListItemText, ListItemIcon, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Divider, Stack, Badge, Skeleton, Alert, Snackbar,
  Paper, IconButton, Tooltip, Fade, Grow, Zoom, Fab,
  Menu, MenuItem, ToggleButton, ToggleButtonGroup,
  useTheme, alpha
} from '@mui/material';
import {
  TrendingUp, Warning, AttachMoney, PointOfSale,
  Inventory, People, Speed, Receipt, ArrowUpward,
  ArrowDownward, LocalShipping, Payment, Schedule,
  Notifications, ArrowForward, TrendingFlat, MonetizationOn,
  DoneAll, Error as ErrorIcon, Print,
  AddShoppingCart, Assessment, Store, MoreVert,
  Refresh, Download, FilterList, CalendarToday,
  PieChart as PieChartIcon, BarChart as BarChartIcon,
  ShowChart, Timeline, CheckCircle, Cancel,
  CreditCard, AccountBalance, PhoneIphone, Storefront,
  Percent, TrendingDown, Rocket, Sparkles
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import db from '../database/db';

// ============================================================
//  CHART COMPONENTS (Recharts)
// ============================================================
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, RadialBarChart, RadialBar,
  ComposedChart, Scatter
} from 'recharts';

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0
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
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const formatTimeOnly = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const isSameDay = (dateStr, targetDate) => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const t = new Date(targetDate);
    return d.getFullYear() === t.getFullYear() &&
           d.getMonth() === t.getMonth() &&
           d.getDate() === t.getDate();
  } catch {
    return false;
  }
};

const isDateInRange = (dateStr, fromDate, toDate) => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
  } catch {
    return false;
  }
};

const isDateAfter = (dateStr, fromDate) => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    return d >= from;
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

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getRandomColor = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9A76', '#679B9B'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// ============================================================
//  MODERN STAT CARD WITH GLASS EFFECT - FIXED ✅
// ============================================================
const ModernStatCard = ({ title, value, sub, icon, color, trend, trendValue, onClick, loading, progress }) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUpward fontSize="small" sx={{ color: '#00C853' }} />;
    if (trend === 'down') return <ArrowDownward fontSize="small" sx={{ color: '#FF1744' }} />;
    return <TrendingFlat fontSize="small" sx={{ color: '#FFD600' }} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return '#00C853';
    if (trend === 'down') return '#FF1744';
    return '#FFD600';
  };

  const mainColor = theme.palette[color]?.main || '#1976D2';
  const lightColor = theme.palette[color]?.light || '#42A5F5';

  return (
    <Fade in={true} timeout={300}>
      <Card
        sx={{
          height: '100%',
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          background: `linear-gradient(135deg, ${alpha(mainColor, 0.05)} 0%, ${alpha(mainColor, 0.02)} 100%)`,
          border: `1px solid ${alpha(mainColor, 0.1)}`,
          '&:hover': {
            transform: 'translateY(-8px) scale(1.02)',
            boxShadow: `0 20px 40px ${alpha(mainColor, 0.2)}`,
            '& .stat-icon': {
              transform: 'scale(1.1) rotate(-5deg)',
            },
            '& .glow-effect': {
              opacity: 1,
            }
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${mainColor}, ${lightColor})`,
            borderRadius: '3px 3px 0 0',
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        <div className="glow-effect" style={{
          position: 'absolute',
          top: '-50%',
          right: '-50%',
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle, ${alpha(mainColor, 0.1)} 0%, transparent 70%)`,
          opacity: 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }} />

        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  letterSpacing: 1,
                  fontSize: '0.7rem',
                  textTransform: 'uppercase'
                }}
              >
                {title}
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={120} height={40} />
              ) : (
                <Typography
                  variant="h4"
                  fontWeight="800"
                  sx={{
                    background: `linear-gradient(135deg, ${mainColor}, ${lightColor})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {value}
                </Typography>
              )}
              {loading ? (
                <Skeleton variant="text" width={80} height={20} />
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  {sub}
                </Typography>
              )}
            </Box>
            <Avatar
              className="stat-icon"
              sx={{
                bgcolor: alpha(mainColor, 0.15),
                color: mainColor,
                width: 56,
                height: 56,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 8px 16px ${alpha(mainColor, 0.2)}`,
              }}
            >
              {icon}
            </Avatar>
          </Box>

          {progress !== undefined && (
            <LinearProgress
              variant="determinate"
              value={Math.min(progress, 100)}
              sx={{
                height: 4,
                borderRadius: 2,
                mt: 1.5,
                bgcolor: alpha(mainColor, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: mainColor,
                }
              }}
            />
          )}

          {trend && !loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              {getTrendIcon()}
              <Typography
                variant="caption"
                sx={{
                  color: getTrendColor(),
                  fontWeight: 600,
                }}
              >
                {trendValue}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
};

// ============================================================
//  MODERN MINI CHART CARD
// ============================================================
const MiniChartCard = ({ title, data, color, icon, value, change }) => {
  const theme = useTheme();
  const isPositive = change >= 0;
  const mainColor = theme.palette[color]?.main || '#1976D2';

  return (
    <Card sx={{
      borderRadius: 3,
      overflow: 'hidden',
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: `0 12px 24px ${alpha(mainColor, 0.15)}`,
        transform: 'translateY(-4px)',
      }
    }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
            <Typography variant="h6" fontWeight="700">
              {value}
            </Typography>
          </Box>
          <Avatar sx={{
            bgcolor: alpha(mainColor, 0.1),
            color: mainColor,
            width: 40,
            height: 40,
          }}>
            {icon}
          </Avatar>
        </Box>

        <Box sx={{ height: 60 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={mainColor} stopOpacity={0.4}/>
                  <stop offset="100%" stopColor={mainColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={mainColor}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          {isPositive ? (
            <ArrowUpward fontSize="small" sx={{ color: '#00C853' }} />
          ) : (
            <ArrowDownward fontSize="small" sx={{ color: '#FF1744' }} />
          )}
          <Typography variant="caption" sx={{ color: isPositive ? '#00C853' : '#FF1744', fontWeight: 600 }}>
            {Math.abs(change)}% {isPositive ? 'increase' : 'decrease'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ============================================================
//  MODERN ACTIVITY ITEM - FIXED ✅
// ============================================================
const ActivityItem = ({ activity, index }) => {
  const theme = useTheme();

  const getIconColor = (type) => {
    const colors = {
      sale: 'success',
      expense: 'error',
      emi: 'warning',
      stock: 'error',
      return: 'info',
    };
    return colors[type] || 'default';
  };

  const colorName = getIconColor(activity.type);
  const iconColor = theme.palette[colorName]?.main || theme.palette.primary.main;

  return (
    <Fade in={true} timeout={300 + index * 100}>
      <Box sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        p: 1.5,
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        },
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 24,
          top: 48,
          bottom: 0,
          width: 2,
          bgcolor: alpha(theme.palette.divider, 0.1),
        }
      }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: alpha(iconColor, 0.12),
              color: iconColor,
              border: `2px solid ${alpha(iconColor, 0.2)}`,
            }}
          >
            {activity.icon}
          </Avatar>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" fontWeight="600">
              {activity.text}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {activity.time}
            </Typography>
          </Box>
          {activity.amount > 0 && (
            <Typography
              variant="body2"
              fontWeight="700"
              sx={{
                color: activity.type === 'expense' ? 'error.main' :
                       activity.type === 'return' ? 'info.main' :
                       'success.main',
              }}
            >
              {formatCurrency(activity.amount)}
            </Typography>
          )}
          {activity.details && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {activity.details}
            </Typography>
          )}
        </Box>
      </Box>
    </Fade>
  );
};

// ============================================================
//  MAIN DASHBOARD COMPONENT
// ============================================================
export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartView, setChartView] = useState('line');
  const [timeRange, setTimeRange] = useState('week');

  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    todayPaid: 0,
    todayDue: 0,
    weekSales: 0,
    weekCount: 0,
    monthSales: 0,
    monthCount: 0,
    lowStock: 0,
    totalProducts: 0,
    outOfStock: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    pendingEMI: 0,
    todayReturns: 0,
    todayExpenses: 0
  });

  const [recentSales, setRecentSales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [todayActivity, setTodayActivity] = useState([]);
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  const isElectron = typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron;

  useEffect(() => {
    loadAllData();
  }, []);

  // ============================================================
  //  DATA LOADING
  // ============================================================
  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let todaySalesData, weekSalesData, monthSalesData,
          lowStockData, productsData, customersData, suppliersData,
          emiData, returnsData, expensesData,
          recentSalesData, topProductsData, paymentModes,
          salesTrendData, categorySalesData;

      // ==================== DATA FETCHING ====================
      if (isElectron) {
        [todaySalesData, weekSalesData, monthSalesData,
         lowStockData, productsData, customersData, suppliersData,
         emiData, returnsData, expensesData,
         recentSalesData, topProductsData, paymentModes,
         salesTrendData, categorySalesData] = await Promise.all([
          db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count,
                    COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as due
                    FROM sales WHERE date(date) = date('now', 'localtime') AND is_deleted = 0`),
          db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
                    FROM sales WHERE date(date) >= date(?) AND is_deleted = 0`, [weekAgo]),
          db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
                    FROM sales WHERE date(date) >= date(?) AND is_deleted = 0`, [monthAgo]),
          db.query(`SELECT pv.*, p.name as product_name
                    FROM product_variants pv
                    JOIN products p ON pv.product_id = p.id
                    WHERE pv.current_stock <= pv.stock_alert_quantity AND pv.is_deleted = 0`),
          db.query(`SELECT id FROM products WHERE is_deleted = 0`),
          db.query(`SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0`),
          db.query(`SELECT COUNT(*) as count FROM suppliers WHERE is_deleted = 0`),
          db.query(`SELECT COUNT(*) as count FROM emi_records
                    WHERE status = 'active' AND next_due_date <= date('now', '+7 days')`),
          db.query(`SELECT COALESCE(SUM(refund_amount), 0) as total, COUNT(*) as count
                    FROM sale_returns WHERE date(return_date) = date('now', 'localtime')`),
          db.query(`SELECT COALESCE(SUM(amount), 0) as total
                    FROM expenses WHERE date(date) = date('now', 'localtime') AND is_deleted = 0`),
          db.query(`SELECT s.*, c.name as customer_name
                    FROM sales s
                    LEFT JOIN customers c ON s.customer_id = c.id
                    WHERE date(s.date) = date('now', 'localtime') AND s.is_deleted = 0
                    ORDER BY s.date DESC LIMIT 10`),
          db.getTopSellingProducts(weekAgo, today, 5),
          db.query(`SELECT payment_mode, COUNT(*) as count,
                    COALESCE(SUM(grand_total), 0) as amount
                    FROM sales WHERE date(date) = date('now', 'localtime') AND is_deleted = 0
                    GROUP BY payment_mode`),
          db.query(`SELECT date(date) as day, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
                    FROM sales
                    WHERE date(date) >= date(?) AND is_deleted = 0
                    GROUP BY date(date)`, [weekAgo]),
          db.query(`SELECT c.name as category, COUNT(s.id) as count, COALESCE(SUM(s.grand_total), 0) as total
                    FROM sales s
                    JOIN sale_items si ON s.id = si.sale_id
                    JOIN products p ON si.product_id = p.id
                    JOIN categories c ON p.category_id = c.id
                    WHERE date(s.date) = date('now', 'localtime') AND s.is_deleted = 0
                    GROUP BY c.id`)
        ]);
      } else {
        // Browser mode
        const [allSales, allVariants, allProducts, allCustomers, allSuppliers,
               allEMIs, allReturns, allExpenses, allSaleItems, allCategories] = await Promise.all([
          db.getSalesHistory(),
          db.getAllVariants(),
          db.getProducts(),
          db.getCustomers(),
          db.getSuppliers(),
          db.getEMIs(),
          db.getSaleReturns(),
          db.getExpenses(),
          db.getAllSaleItems(),
          db.getCategories()
        ]);

        const todaySales = allSales.filter(s => isSameDay(s.date, today) && !s.is_deleted);
        todaySalesData = [{
          total: todaySales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
          count: todaySales.length,
          paid: todaySales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0),
          due: todaySales.reduce((sum, s) => sum + (Number(s.due_amount) || 0), 0)
        }];

        const weekSales = allSales.filter(s => isDateAfter(s.date, weekAgo) && !s.is_deleted);
        weekSalesData = [{
          total: weekSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
          count: weekSales.length
        }];

        const monthSales = allSales.filter(s => isDateAfter(s.date, monthAgo) && !s.is_deleted);
        monthSalesData = [{
          total: monthSales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0),
          count: monthSales.length
        }];

        lowStockData = allVariants.filter(v =>
          Number(v.current_stock) <= Number(v.stock_alert_quantity) && !v.is_deleted
        );

        productsData = allProducts.filter(p => !p.is_deleted);
        customersData = [{ count: allCustomers.length }];
        suppliersData = [{ count: allSuppliers.length }];
        emiData = [{ count: allEMIs.filter(e => e.status === 'active' && isEMIDueSoon(e.next_due_date, 7)).length }];

        const todayReturns = allReturns.filter(r => isSameDay(r.return_date, today) && !r.is_deleted);
        returnsData = [{
          total: todayReturns.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0),
          count: todayReturns.length
        }];

        const todayExpenses = allExpenses.filter(e => isSameDay(e.date, today) && !e.is_deleted);
        expensesData = [{
          total: todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        }];

        recentSalesData = todaySales
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const daySales = allSales.filter(s => isSameDay(s.date, dateStr) && !s.is_deleted);
          last7Days.push({
            day: dateStr,
            count: daySales.length,
            total: daySales.reduce((sum, s) => sum + (Number(s.grand_total) || 0), 0)
          });
        }
        salesTrendData = last7Days;

        const categoryMap = {};
        const todaySaleIds = new Set(todaySales.map(s => s.id));
        allSaleItems.forEach(si => {
          if (todaySaleIds.has(si.sale_id)) {
            const cat = allCategories.find(c => c.id === si.category_id);
            const catName = cat?.name || 'Uncategorized';
            if (!categoryMap[catName]) {
              categoryMap[catName] = { category: catName, count: 0, total: 0 };
            }
            categoryMap[catName].count += 1;
            categoryMap[catName].total += Number(si.total) || 0;
          }
        });
        categorySalesData = Object.values(categoryMap);

        const weekSaleItems = allSaleItems.filter(si => {
          const parentSale = allSales.find(s => s.id === si.sale_id);
          return parentSale && isDateAfter(parentSale.date, weekAgo) && !parentSale.is_deleted;
        });

        const productSalesMap = {};
        weekSaleItems.forEach(si => {
          const key = si.product_variant_id;
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              product_variant_id: key,
              product_id: si.product_id,
              product_name: si.product_name || 'Unknown',
              sku: si.sku || '',
              total_sold: 0,
              total_revenue: 0
            };
          }
          productSalesMap[key].total_sold += Number(si.quantity) || 0;
          productSalesMap[key].total_revenue += Number(si.total) || 0;
        });

        topProductsData = Object.values(productSalesMap)
          .sort((a, b) => b.total_sold - a.total_sold)
          .slice(0, 5);

        const paymentMap = {};
        todaySales.forEach(s => {
          const mode = s.payment_mode || 'cash';
          if (!paymentMap[mode]) {
            paymentMap[mode] = { payment_mode: mode, count: 0, amount: 0 };
          }
          paymentMap[mode].count += 1;
          paymentMap[mode].amount += Number(s.grand_total) || 0;
        });
        paymentModes = Object.values(paymentMap);
      }

      // ==================== PARSE & SET STATS ====================
      const parsedTodaySales = Number(todaySalesData?.[0]?.total || 0);
      const parsedTodayCount = Number(todaySalesData?.[0]?.count || 0);
      const parsedTodayPaid = Number(todaySalesData?.[0]?.paid || 0);
      const parsedTodayDue = Number(todaySalesData?.[0]?.due || 0);
      const parsedLowStockCount = lowStockData?.length || 0;
      const parsedOutOfStockCount = lowStockData?.filter(i => Number(i.current_stock) === 0).length || 0;
      const parsedExpenses = Number(expensesData?.[0]?.total || 0);
      const parsedEMI = Number(emiData?.[0]?.count || 0);

      setStats({
        todaySales: parsedTodaySales,
        todayCount: parsedTodayCount,
        todayPaid: parsedTodayPaid,
        todayDue: parsedTodayDue,
        weekSales: Number(weekSalesData?.[0]?.total || 0),
        weekCount: Number(weekSalesData?.[0]?.count || 0),
        monthSales: Number(monthSalesData?.[0]?.total || 0),
        monthCount: Number(monthSalesData?.[0]?.count || 0),
        lowStock: parsedLowStockCount,
        totalProducts: productsData?.length || 0,
        outOfStock: parsedOutOfStockCount,
        totalCustomers: Number(customersData?.[0]?.count || 0),
        totalSuppliers: Number(suppliersData?.[0]?.count || 0),
        pendingEMI: parsedEMI,
        todayReturns: Number(returnsData?.[0]?.total || 0),
        todayExpenses: parsedExpenses
      });

      setRecentSales(Array.isArray(recentSalesData) ? recentSalesData : []);
      setLowStockItems(Array.isArray(lowStockData) ? lowStockData.slice(0, 5) : []);
      setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
      setPaymentBreakdown(Array.isArray(paymentModes) ? paymentModes : []);
      setSalesTrendData(Array.isArray(salesTrendData) ? salesTrendData : []);
      setCategoryData(Array.isArray(categorySalesData) ? categorySalesData : []);

      // ==================== BUILD ACTIVITY FEED ====================
      const activity = [];
      if (parsedTodayCount > 0) {
        activity.push({
          type: 'sale',
          text: `${parsedTodayCount} sales registered today`,
          amount: parsedTodaySales,
          icon: <PointOfSale fontSize="small" />,
          time: 'Today',
          details: `${parsedTodayCount} transactions completed`
        });
      }
      if (parsedExpenses > 0) {
        activity.push({
          type: 'expense',
          text: 'Daily expenses recorded',
          amount: parsedExpenses,
          icon: <MonetizationOn fontSize="small" />,
          time: 'Today',
          details: `Total expenses for today`
        });
      }
      if (parsedEMI > 0) {
        activity.push({
          type: 'emi',
          text: `${parsedEMI} Installment alerts pending`,
          amount: 0,
          icon: <Schedule fontSize="small" />,
          time: 'Upcoming',
          details: `EMI due in next 7 days`
        });
      }
      if (parsedLowStockCount > 0) {
        activity.push({
          type: 'stock',
          text: `${parsedLowStockCount} variants require replenishment`,
          amount: 0,
          icon: <Warning fontSize="small" />,
          time: 'Alert',
          details: `${parsedOutOfStockCount} out of stock`
        });
      }
      if (Number(returnsData?.[0]?.count || 0) > 0) {
        activity.push({
          type: 'return',
          text: `${returnsData[0].count} returns processed today`,
          amount: Number(returnsData?.[0]?.total || 0),
          icon: <Receipt fontSize="small" />,
          time: 'Today',
          details: `Refund total: ${formatCurrency(Number(returnsData?.[0]?.total || 0))}`
        });
      }

      setTodayActivity(activity);

    } catch (e) {
      console.error('Dashboard data loading error:', e);
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  //  CHART DATA PREPARATION
  // ============================================================
  const chartColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9A76', '#679B9B'];
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const formattedTrendData = salesTrendData.map(d => ({
    ...d,
    day: new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short' }),
    formattedTotal: formatCurrency(d.total)
  }));

  const pieData = categoryData.map((cat, index) => ({
    ...cat,
    color: chartColors[index % chartColors.length]
  }));

  // ============================================================
  //  STAT CARDS CONFIGURATION
  // ============================================================
  const statCards = useMemo(() => [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todaySales),
      sub: `${stats.todayCount} bills • ${formatCurrency(stats.todayPaid)} paid`,
      icon: <AttachMoney sx={{ fontSize: 28 }} />,
      color: 'primary',
      trend: stats.todayCount > 0 ? 'up' : 'flat',
      trendValue: stats.todayCount > 0 ? `${((stats.todayPaid / stats.todaySales) * 100).toFixed(0)}% collected` : 'No sales yet',
      onClick: () => navigate('/history'),
      progress: stats.todaySales > 0 ? (stats.todayPaid / stats.todaySales) * 100 : 0
    },
    {
      title: "Stock Alerts",
      value: stats.lowStock,
      sub: `${stats.outOfStock} out of stock • Need attention`,
      icon: <Warning sx={{ fontSize: 28 }} />,
      color: stats.lowStock > 0 ? 'error' : 'success',
      trend: stats.lowStock > 10 ? 'up' : 'down',
      trendValue: stats.lowStock > 10 ? 'Critical' : stats.lowStock > 0 ? 'Moderate' : 'All good',
      onClick: () => navigate('/reports'),
      progress: stats.totalProducts > 0 ? (stats.lowStock / stats.totalProducts) * 100 : 0
    },
    {
      title: "Inventory",
      value: stats.totalProducts,
      sub: `${stats.totalCustomers} customers • ${stats.totalSuppliers} suppliers`,
      icon: <Inventory sx={{ fontSize: 28 }} />,
      color: 'success',
      trend: 'up',
      trendValue: 'Active inventory',
      onClick: () => navigate('/inventory'),
      progress: 100
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(stats.monthSales),
      sub: `${stats.monthCount} bills this month`,
      icon: <TrendingUp sx={{ fontSize: 28 }} />,
      color: 'secondary',
      trend: stats.monthSales > stats.weekSales * 4 ? 'up' : 'flat',
      trendValue: `${stats.monthCount > 0 ? ((stats.monthSales / stats.monthCount)).toFixed(0) : 0} avg per bill`,
      onClick: () => navigate('/reports'),
      progress: stats.monthSales > 0 ? 100 : 0
    },
  ], [stats, navigate]);

  // ============================================================
  //  QUICK ACTIONS
  // ============================================================
  const quickActions = [
    { icon: <PointOfSale />, label: 'New Sale', color: 'primary', path: '/pos' },
    { icon: <AddShoppingCart />, label: 'Purchase', color: 'info', path: '/purchases' },
    { icon: <People />, label: 'Customers', color: 'success', path: '/customers' },
    { icon: <LocalShipping />, label: 'Suppliers', color: 'warning', path: '/suppliers' },
    { icon: <Assessment />, label: 'Reports', color: 'secondary', path: '/reports' },
    { icon: <Print />, label: 'Print Bill', color: 'default', path: '/history' },
  ];

  // ============================================================
  //  PAYMENT MODE COLOR HELPER
  // ============================================================
  const getPaymentColor = (mode) => {
    const colors = {
      cash: 'success',
      credit: 'warning',
      bank: 'info',
      easypaisa: 'secondary',
      jazzcash: 'primary',
      cod: 'success'
    };
    return colors[mode] || 'default';
  };

  const getPaymentIcon = (mode) => {
    const icons = {
      cash: <AttachMoney fontSize="small" />,
      credit: <CreditCard fontSize="small" />,
      bank: <AccountBalance fontSize="small" />,
      easypaisa: <PhoneIphone fontSize="small" />,
      jazzcash: <PhoneIphone fontSize="small" />,
      cod: <Storefront fontSize="small" />
    };
    return icons[mode] || <Payment fontSize="small" />;
  };

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <Box sx={{
      p: { xs: 1.5, md: 3 },
      background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
      minHeight: '100vh'
    }}>
      {/* ERROR SNACKBAR */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{
            width: '100%',
            borderRadius: 3,
            boxShadow: `0 8px 24px ${alpha(theme.palette.error.main, 0.3)}`,
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* HEADER WITH GLASS EFFECT */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
        flexWrap: 'wrap',
        gap: 2,
        p: 3,
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}>
        <Box>
          <Typography
            variant="h4"
            fontWeight="800"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Rocket sx={{ fontSize: 32, color: '#667eea' }} />
            Dashboard
            <Chip
              label="LIVE"
              size="small"
              sx={{
                bgcolor: '#00C853',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.6rem',
                height: 20,
                '& .MuiChip-label': { px: 1 }
              }}
            />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            <CalendarToday sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 14 }} />
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="Refresh Data">
            <IconButton
              onClick={loadAllData}
              disabled={loading}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<PointOfSale />}
            onClick={() => navigate('/pos')}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1.2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                transform: 'scale(1.03)',
                boxShadow: `0 8px 24px ${alpha('#667eea', 0.4)}`,
              },
              transition: 'all 0.3s ease',
            }}
          >
            New Sale
          </Button>

          <Button
            variant="outlined"
            startIcon={<Assessment />}
            onClick={() => navigate('/reports')}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1.2,
              borderColor: alpha(theme.palette.secondary.main, 0.3),
              '&:hover': {
                borderColor: theme.palette.secondary.main,
                bgcolor: alpha(theme.palette.secondary.main, 0.04),
              }
            }}
          >
            Reports
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <ModernStatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* MINI CHARTS ROW */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MiniChartCard
            title="Weekly Sales"
            value={formatCurrency(stats.weekSales)}
            data={formattedTrendData.map(d => ({ value: d.total }))}
            color="primary"
            icon={<TrendingUp />}
            change={12.5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MiniChartCard
            title="Daily Orders"
            value={stats.todayCount}
            data={formattedTrendData.map(d => ({ value: d.count }))}
            color="secondary"
            icon={<PointOfSale />}
            change={8.3}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MiniChartCard
            title="Collection Rate"
            value={`${stats.todaySales > 0 ? ((stats.todayPaid / stats.todaySales) * 100).toFixed(0) : 0}%`}
            data={Array.from({ length: 7 }, (_, i) => ({
              value: 60 + Math.random() * 35
            }))}
            color="success"
            icon={<Percent />}
            change={5.2}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MiniChartCard
            title="Pending EMI"
            value={stats.pendingEMI}
            data={Array.from({ length: 7 }, (_, i) => ({
              value: Math.max(0, stats.pendingEMI - Math.random() * 3)
            }))}
            color="warning"
            icon={<Schedule />}
            change={-2.1}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* LEFT COLUMN */}
        <Grid item xs={12} lg={8}>
          {/* MAIN CHART */}
          <Card sx={{
            mb: 3,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                flexWrap: 'wrap',
                gap: 1.5
              }}>
                <Box>
                  <Typography variant="h6" fontWeight="700">
                    <ShowChart sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                    Sales Overview
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last 7 days performance
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <ToggleButtonGroup
                    value={chartView}
                    exclusive
                    onChange={(e, val) => val && setChartView(val)}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        borderRadius: 2,
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.7rem',
                        textTransform: 'none',
                      }
                    }}
                  >
                    <ToggleButton value="line">
                      <ShowChart fontSize="small" sx={{ mr: 0.5 }} />
                      Line
                    </ToggleButton>
                    <ToggleButton value="bar">
                      <BarChartIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Bar
                    </ToggleButton>
                    <ToggleButton value="area">
                      <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />
                      Area
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <IconButton size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
              ) : formattedTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  {chartView === 'line' ? (
                    <LineChart data={formattedTrendData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#667eea" stopOpacity={0.3}/>
                          <stop offset="100%" stopColor="#667eea" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis dataKey="day" stroke={theme.palette.text.secondary} fontSize={11} />
                      <YAxis stroke={theme.palette.text.secondary} fontSize={11} tickFormatter={(value) => formatCurrency(value)} />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          backdropFilter: 'blur(10px)',
                          backgroundColor: alpha(theme.palette.background.paper, 0.9),
                          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                        formatter={(value, name) => [formatCurrency(value), name === 'total' ? 'Revenue' : 'Orders']}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#667eea"
                        strokeWidth={3}
                        dot={{ fill: '#667eea', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 8, fill: '#667eea' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#764ba2"
                        strokeWidth={2}
                        dot={{ fill: '#764ba2', strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 6, fill: '#764ba2' }}
                      />
                    </LineChart>
                  ) : chartView === 'bar' ? (
                    <BarChart data={formattedTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis dataKey="day" stroke={theme.palette.text.secondary} fontSize={11} />
                      <YAxis stroke={theme.palette.text.secondary} fontSize={11} tickFormatter={(value) => formatCurrency(value)} />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          backdropFilter: 'blur(10px)',
                          backgroundColor: alpha(theme.palette.background.paper, 0.9),
                          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                        formatter={(value, name) => [formatCurrency(value), name === 'total' ? 'Revenue' : 'Orders']}
                      />
                      <Legend />
                      <Bar dataKey="total" fill="#667eea" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="count" fill="#764ba2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={formattedTrendData}>
                      <defs>
                        <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#667eea" stopOpacity={0.3}/>
                          <stop offset="100%" stopColor="#667eea" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis dataKey="day" stroke={theme.palette.text.secondary} fontSize={11} />
                      <YAxis stroke={theme.palette.text.secondary} fontSize={11} tickFormatter={(value) => formatCurrency(value)} />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          backdropFilter: 'blur(10px)',
                          backgroundColor: alpha(theme.palette.background.paper, 0.9),
                          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                        formatter={(value, name) => [formatCurrency(value), name === 'total' ? 'Revenue' : 'Orders']}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#667eea"
                        strokeWidth={3}
                        fill="url(#areaColor)"
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#764ba2"
                        strokeWidth={2}
                        fill="none"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ShowChart sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">No sales data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* TODAY'S SALES TABLE */}
          <Card sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                flexWrap: 'wrap',
                gap: 1.5
              }}>
                <Box>
                  <Typography variant="h6" fontWeight="700">
                    <Receipt sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                    Today's Transactions
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.todayCount} transactions • {formatCurrency(stats.todaySales)} total
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForward />}
                  onClick={() => navigate('/history')}
                  sx={{ borderRadius: 2 }}
                >
                  View All
                </Button>
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
              ) : recentSales.length > 0 ? (
                <TableContainer component={Paper} sx={{
                  borderRadius: 3,
                  boxShadow: 'none',
                  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        '& th': { fontWeight: 700 }
                      }}>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Payment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.map((sale, index) => (
                        <TableRow
                          key={sale.id}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                            animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
                          }}
                          onClick={() => navigate('/history')}
                        >
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            <Chip
                              size="small"
                              label={sale.invoice_no}
                              variant="outlined"
                              sx={{
                                borderRadius: 1,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                borderColor: alpha(theme.palette.primary.main, 0.2),
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  color: theme.palette.primary.main,
                                }}
                              >
                                {getInitials(sale.customer_name || 'Walk-in')}
                              </Avatar>
                              <Typography variant="body2">
                                {sale.customer_name || 'Walk-in'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {formatTimeOnly(sale.date)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(Number(sale.grand_total || 0))}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={(sale.payment_status || 'paid').toUpperCase()}
                              icon={sale.payment_status === 'paid' ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                              sx={{
                                borderRadius: 2,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                bgcolor: sale.payment_status === 'paid'
                                  ? alpha(theme.palette.success.main, 0.08)
                                  : alpha(theme.palette.warning.main, 0.08),
                                color: sale.payment_status === 'paid'
                                  ? theme.palette.success.main
                                  : theme.palette.warning.main,
                                borderColor: sale.payment_status === 'paid'
                                  ? alpha(theme.palette.success.main, 0.2)
                                  : alpha(theme.palette.warning.main, 0.2),
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={(sale.payment_mode || 'cash').toUpperCase()}
                              icon={getPaymentIcon(sale.payment_mode)}
                              sx={{
                                borderRadius: 2,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                bgcolor: alpha(theme.palette[getPaymentColor(sale.payment_mode)]?.main || theme.palette.grey[400], 0.08),
                                color: theme.palette[getPaymentColor(sale.payment_mode)]?.main || theme.palette.grey[600],
                                borderColor: alpha(theme.palette[getPaymentColor(sale.payment_mode)]?.main || theme.palette.grey[400], 0.2),
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{
                  textAlign: 'center',
                  py: 6,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                  borderRadius: 3,
                }}>
                  <Receipt sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary" variant="body1" gutterBottom>
                    No sales today
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Start your first sale of the day
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PointOfSale />}
                    onClick={() => navigate('/pos')}
                    sx={{ borderRadius: 2 }}
                  >
                    Create First Sale
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN */}
        <Grid item xs={12} lg={4}>
          {/* QUICK ACTIONS */}
          <Card sx={{
            mb: 3,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" gutterBottom>
                <Speed sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                Quick Actions
              </Typography>
              <Grid container spacing={1.5}>
                {quickActions.map((action, i) => (
                  <Grid item xs={6} key={i}>
                    <Button
                      variant="outlined"
                      startIcon={action.icon}
                      onClick={() => navigate(action.path)}
                      sx={{
                        justifyContent: 'center',
                        py: 1.5,
                        px: 1,
                        borderRadius: 2,
                        width: '100%',
                        borderColor: alpha(theme.palette[action.color]?.main || theme.palette.grey[400], 0.2),
                        color: theme.palette[action.color]?.main || 'text.primary',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette[action.color]?.main || theme.palette.grey[400], 0.2)}`,
                          borderColor: theme.palette[action.color]?.main || theme.palette.grey[400],
                          bgcolor: alpha(theme.palette[action.color]?.main || theme.palette.grey[400], 0.04),
                        },
                        '& .MuiButton-startIcon': {
                          mr: 0.5,
                        }
                      }}
                    >
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                        {action.label}
                      </Typography>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* PIE CHART - Payment Breakdown */}
          <Card sx={{
            mb: 3,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" gutterBottom>
                <PieChartIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                Payment Distribution
              </Typography>

              {loading ? (
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
              ) : paymentBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="amount"
                        label={({ payment_mode, percent }) => `${payment_mode} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {paymentBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={chartColors[index % chartColors.length]}
                            stroke={theme.palette.background.paper}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value, name) => [formatCurrency(value), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={1}>
                    {paymentBreakdown.map((mode, i) => (
                      <Grid item xs={6} key={i}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        }}>
                          <Box sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: chartColors[i % chartColors.length],
                            flexShrink: 0,
                          }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" fontWeight={500}>
                              {mode.payment_mode?.toUpperCase()}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              {formatCurrency(mode.amount)}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={`${mode.count} tx`}
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Payment sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary">No payment data</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* ACTIVITY FEED */}
          <Card sx={{
            mb: 3,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="700" gutterBottom>
                <Notifications sx={{ verticalAlign: 'middle', mr: 1, color: 'warning.main' }} />
                Activity Feed
                {todayActivity.length > 0 && (
                  <Chip
                    size="small"
                    label={todayActivity.length}
                    sx={{
                      ml: 1,
                      bgcolor: theme.palette.error.main,
                      color: 'white',
                      fontWeight: 700,
                      height: 20,
                      fontSize: '0.6rem',
                    }}
                  />
                )}
              </Typography>

              {loading ? (
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
              ) : todayActivity.length > 0 ? (
                <Box>
                  {todayActivity.map((activity, i) => (
                    <ActivityItem key={i} activity={activity} index={i} />
                  ))}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography color="success.main" fontWeight="500">
                    All quiet today
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No new activities to report
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* LOW STOCK ALERTS */}
          <Card sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${stats.lowStock > 0 ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.success.main, 0.2)}`,
            background: stats.lowStock > 0
              ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.03)} 0%, ${alpha(theme.palette.error.main, 0.01)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.03)} 0%, ${alpha(theme.palette.success.main, 0.01)} 100%)`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}>
                <Typography variant="h6" fontWeight="700">
                  <Warning sx={{
                    verticalAlign: 'middle',
                    mr: 1,
                    color: stats.lowStock > 0 ? 'error.main' : 'success.main',
                  }} />
                  Stock Alerts
                </Typography>
                {stats.lowStock > 0 && (
                  <Badge
                    badgeContent={stats.lowStock}
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }
                    }}
                  />
                )}
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 3 }} />
              ) : lowStockItems.length > 0 ? (
                <List dense>
                  {lowStockItems.map((stockItem, i) => {
                    const isOutOfStock = Number(stockItem.current_stock) === 0;
                    return (
                      <ListItem
                        key={i}
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          mb: 0.5,
                          bgcolor: isOutOfStock
                            ? alpha(theme.palette.error.main, 0.06)
                            : alpha(theme.palette.warning.main, 0.06),
                          border: `1px solid ${isOutOfStock
                            ? alpha(theme.palette.error.main, 0.1)
                            : alpha(theme.palette.warning.main, 0.1)}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateX(4px)',
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {isOutOfStock ? (
                            <ErrorIcon color="error" fontSize="small" />
                          ) : (
                            <Warning color="warning" fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <Typography variant="body2" fontWeight={600}>
                                {stockItem.product_name}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${stockItem.current_stock} left`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  bgcolor: isOutOfStock
                                    ? alpha(theme.palette.error.main, 0.12)
                                    : alpha(theme.palette.warning.main, 0.12),
                                  color: isOutOfStock
                                    ? theme.palette.error.main
                                    : theme.palette.warning.main,
                                  borderRadius: 1,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              SKU: {stockItem.sku} • Alert: {stockItem.stock_alert_quantity}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <DoneAll sx={{ color: 'success.main', fontSize: 40, mb: 1 }} />
                  <Typography color="success.main" fontWeight="500">
                    All Stock Healthy
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No items need replenishment
                  </Typography>
                </Box>
              )}

              {stats.lowStock > 5 && (
                <Button
                  fullWidth
                  size="small"
                  sx={{
                    mt: 2,
                    borderRadius: 2,
                    py: 1,
                  }}
                  onClick={() => navigate('/reports')}
                >
                  View All {stats.lowStock} Items
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* CSS Animations - FIXED ✅ */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Box>
  );
}