import React, { useState, useEffect, useMemo } from 'react';
// Dashboard.jsx ke top pe check karo
import {
  Grid, Card, CardContent, Typography, Box, Paper, LinearProgress,
  List, ListItem, ListItemText, ListItemIcon, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Divider, Tooltip, IconButton, Stack, Badge, Skeleton
} from '@mui/material';
import {
  TrendingUp, ShoppingCart, Warning, AttachMoney, PointOfSale,
  Inventory, People, AccountBalance, Speed, Receipt, ArrowUpward,
  ArrowDownward, CalendarToday, LocalShipping, Payment, Schedule,
  Notifications, ArrowForward, TrendingFlat, MonetizationOn,
  CreditCard, AccountCircle, DoneAll, Error, Info, Print,
  AddShoppingCart, Assessment, Category, Store
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import db from '../database/db';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

const StatCard = ({ title, value, sub, icon, color, trend, trendValue, onClick, loading }) => (
  <Card 
    sx={{ 
      height: '100%', 
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': onClick ? { transform: 'translateY(-4px)', boxShadow: 4 } : {}
    }}
    onClick={onClick}
  >
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography color="text.secondary" gutterBottom variant="body2" fontWeight="medium">
            {title}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={120} height={40} />
          ) : (
            <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
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
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main`, width: 48, height: 48 }}>
          {icon}
        </Avatar>
      </Box>
      {trend && !loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {trend === 'up' ? <ArrowUpward fontSize="small" color="success" /> : 
           trend === 'down' ? <ArrowDownward fontSize="small" color="error" /> : 
           <TrendingFlat fontSize="small" color="info" />}
          <Typography variant="caption" color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary'}>
            {trendValue}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

const QuickAction = ({ icon, label, color, onClick }) => (
  <Button
    variant="outlined"
    startIcon={icon}
    onClick={onClick}
    sx={{
      justifyContent: 'flex-start',
      py: 1.5,
      px: 2,
      borderColor: `${color}.main`,
      color: `${color}.main`,
      '&:hover': { bgcolor: `${color}.50`, borderColor: `${color}.main` }
    }}
    fullWidth
  >
    {label}
  </Button>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0, todayCount: 0, todayPaid: 0, todayDue: 0,
    weekSales: 0, weekCount: 0,
    monthSales: 0, monthCount: 0,
    lowStock: 0, totalProducts: 0, outOfStock: 0,
    totalCustomers: 0, totalSuppliers: 0,
    pendingEMI: 0, todayReturns: 0, todayExpenses: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [todayActivity, setTodayActivity] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        todaySalesData, weekSalesData, monthSalesData,
        lowStockData, productsData, customersData, suppliersData,
        emiData, returnsData, expensesData,
        recentSalesData, topProductsData, paymentModes
      ] = await Promise.all([
        db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count, COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as due FROM sales WHERE date(date) = date('now') AND is_deleted = 0`),
        db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM sales WHERE date(date) >= date(?) AND is_deleted = 0`, [weekAgo]),
        db.query(`SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM sales WHERE date(date) >= date(?) AND is_deleted = 0`, [monthAgo]),
        db.query(`SELECT pv.*, p.name as product_name FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.current_stock <= pv.stock_alert_quantity AND pv.is_deleted = 0`),
        db.query(`SELECT id FROM products WHERE is_deleted = 0`),
        db.query(`SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0`),
        db.query(`SELECT COUNT(*) as count FROM suppliers WHERE is_deleted = 0`),
        db.query(`SELECT COUNT(*) as count FROM emi_records WHERE status = 'active' AND next_due_date <= date('now', '+7 days')`),
        db.query(`SELECT COALESCE(SUM(refund_amount), 0) as total, COUNT(*) as count FROM sale_returns WHERE date(return_date) = date('now')`),
        db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(date) = date('now') AND is_deleted = 0`),
        db.query(`SELECT s.*, c.name as customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE date(s.date) = date('now') AND s.is_deleted = 0 ORDER BY s.date DESC LIMIT 10`),
        db.getTopSellingProducts(weekAgo, today, 5),
        db.query(`SELECT payment_mode, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as amount FROM sales WHERE date(date) = date('now') AND is_deleted = 0 GROUP BY payment_mode`)
      ]);

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

      const activity = [];
      if (parsedTodayCount > 0) activity.push({ type: 'sale', text: `${parsedTodayCount} sales registered today`, amount: parsedTodaySales, icon: <PointOfSale color="success" />, time: 'Today' });
      if (parsedExpenses > 0) activity.push({ type: 'expense', text: 'Daily expenses recorded', amount: parsedExpenses, icon: <MonetizationOn color="error" />, time: 'Today' });
      if (parsedEMI > 0) activity.push({ type: 'emi', text: `${parsedEMI} Installment alerts pending`, amount: 0, icon: <Schedule color="warning" />, time: 'Upcoming' });
      if (parsedLowStockCount > 0) activity.push({ type: 'stock', text: `${parsedLowStockCount} variants require replenishment`, amount: 0, icon: <Warning color="error" />, time: 'Alert' });
      
      setTodayActivity(activity);

    } catch (e) {
      console.error('Database payload stream mapping exception:', e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = useMemo(() => [
    { 
      title: "Today's Sales", 
      value: formatCurrency(stats.todaySales), 
      sub: `${stats.todayCount} bills • ${formatCurrency(stats.todayPaid)} paid`, 
      icon: <AttachMoney />, 
      color: 'primary',
      trend: 'up',
      trendValue: `${stats.weekCount > 0 ? ((stats.todayCount / (stats.weekCount/7)) * 100 - 100).toFixed(0) : 0}% vs avg`,
      onClick: () => navigate('/history')
    },
    { 
      title: 'Low Stock Alert', 
      value: stats.lowStock, 
      sub: `${stats.outOfStock} out of stock • Need attention`, 
      icon: <Warning />, 
      color: 'error',
      trend: stats.lowStock > 10 ? 'up' : 'down',
      trendValue: stats.lowStock > 10 ? 'Critical' : 'Normal',
      onClick: () => navigate('/reports')
    },
    { 
      title: 'Total Products', 
      value: stats.totalProducts, 
      sub: `${stats.totalCustomers} customers • ${stats.totalSuppliers} suppliers`, 
      icon: <Inventory />, 
      color: 'success',
      trend: 'up',
      trendValue: 'Active inventory',
      onClick: () => navigate('/inventory')
    },
    { 
      title: 'Monthly Revenue', 
      value: formatCurrency(stats.monthSales), 
      sub: `${stats.monthCount} bills this month`, 
      icon: <TrendingUp />, 
      color: 'secondary',
      trend: 'up',
      trendValue: `${stats.weekSales > 0 ? ((stats.monthSales / stats.weekSales * 7/30) * 100 - 100).toFixed(0) : 0}% vs last week`,
      onClick: () => navigate('/reports')
    },
  ], [stats, navigate]);

  const quickActions = [
    { icon: <PointOfSale />, label: 'New Sale', color: 'primary', path: '/pos' },
    { icon: <AddShoppingCart />, label: 'New Purchase', color: 'info', path: '/purchases' },
    { icon: <People />, label: 'Add Customer', color: 'success', path: '/customers' },
    { icon: <LocalShipping />, label: 'Add Supplier', color: 'warning', path: '/suppliers' },
    { icon: <Assessment />, label: 'View Reports', color: 'secondary', path: '/reports' },
    { icon: <Print />, label: 'Print Last Bill', color: 'default', path: '/history' },
  ];

  const getPaymentColor = (mode) => {
    const colors = { cash: 'success', credit: 'warning', bank: 'info', easypaisa: 'secondary', jazzcash: 'primary' };
    return colors[mode] || 'default';
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
            <Store sx={{ verticalAlign: 'middle', mr: 1 }} />
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<PointOfSale />} onClick={() => navigate('/pos')} size="small">
            New Sale
          </Button>
          <Button variant="outlined" startIcon={<Assessment />} onClick={() => navigate('/reports')} size="small">
            Reports
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((card, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <StatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* LEFT COLUMN */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* TODAY'S SALES TABLE */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  <Receipt sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                  Today's Sales
                </Typography>
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/history')}>
                  View All
                </Button>
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={200} />
              ) : recentSales.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Payment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.map((sale) => (
                        <TableRow key={sale.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/history')}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{sale.invoice_no}</TableCell>
                          <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                          <TableCell>{formatDate(sale.date).split(',')[1] || formatDate(sale.date)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(Number(sale.grand_total || 0))}</TableCell>
                          <TableCell align="center">
                            <Chip 
                              size="small" 
                              label={(sale.payment_status || 'paid').toUpperCase()} 
                              color={sale.payment_status === 'paid' ? 'success' : sale.payment_status === 'due' ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              size="small" 
                              label={(sale.payment_mode || 'cash').toUpperCase()} 
                              color={getPaymentColor(sale.payment_mode)}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Receipt sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary">No sales today</Typography>
                  <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => navigate('/pos')}>
                    Create First Sale
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* TOP PRODUCTS & PAYMENT BREAKDOWN */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    <TrendingUp sx={{ verticalAlign: 'middle', mr: 1, color: 'success.main' }} />
                    Top Products (7 Days)
                  </Typography>
                  {loading ? (
                    <Skeleton variant="rectangular" height={150} />
                  ) : topProducts.length > 0 ? (
                    <List dense>
                      {topProducts.map((product, i) => (
                        <ListItem key={i} sx={{ px: 0 }}>
                          <ListItemIcon>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: i < 3 ? 'warning.main' : 'grey.400', fontSize: 14, fontWeight: 'bold' }}>
                              {i + 1}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography component="span" variant="body2" fontWeight="medium">{product.product_name}</Typography>
                                <Typography component="span" variant="body2" fontWeight="bold" color="success.main">{formatCurrency(product.total_revenue)}</Typography>
                              </Box>
                            }
                            secondary={
                              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                <Typography component="span" variant="caption" color="text.secondary">{product.total_sold} sold</Typography>
                                <Typography component="span" variant="caption" color="text.secondary">{product.sku}</Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary" align="center" py={2}>No sales data</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    <Payment sx={{ verticalAlign: 'middle', mr: 1, color: 'info.main' }} />
                    Payment Modes (Today)
                  </Typography>
                  {loading ? (
                    <Skeleton variant="rectangular" height={150} />
                  ) : paymentBreakdown.length > 0 ? (
                    <>
                      {paymentBreakdown.map((mode, i) => (
                        <Box key={i} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight="medium">{mode.payment_mode?.toUpperCase()}</Typography>
                            <Typography variant="body2" fontWeight="bold">{formatCurrency(mode.amount)}</Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={stats.todaySales > 0 ? (mode.amount / stats.todaySales) * 100 : 0}
                            color={getPaymentColor(mode.payment_mode)}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption" color="text.secondary">{mode.count} transactions</Typography>
                        </Box>
                      ))}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" fontWeight="bold">Total</Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(stats.todaySales)}</Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography color="text.secondary" align="center" py={2}>No payment data</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* RIGHT COLUMN */}
        <Grid size={{ xs: 12, lg: 4 }}>
          {/* QUICK ACTIONS */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                <Speed sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                Quick Actions
              </Typography>
              <Grid container spacing={1}>
                {quickActions.map((action, i) => (
                  <Grid size={{ xs: 6 }} key={i}>
                    <QuickAction {...action} onClick={() => navigate(action.path)} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* ACTIVITY FEED */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                <Notifications sx={{ verticalAlign: 'middle', mr: 1, color: 'warning.main' }} />
                Activity Feed
              </Typography>
              {loading ? (
                <Skeleton variant="rectangular" height={100} />
              ) : todayActivity.length > 0 ? (
                <List dense>
                  {todayActivity.map((activity, i) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>{activity.icon}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography component="span" variant="body2">{activity.text}</Typography>
                            {activity.amount > 0 && (
                              <Typography component="span" variant="body2" fontWeight="bold" color={activity.type === 'expense' ? 'error.main' : 'success.main'}>
                                {formatCurrency(activity.amount)}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography component="span" variant="caption" color="text.secondary">{activity.time}</Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" align="center" py={2}>No activity today</Typography>
              )}
            </CardContent>
          </Card>

          {/* LOW STOCK ALERTS */}
          <Card sx={{ borderLeft: 4, borderColor: stats.lowStock > 0 ? 'error.main' : 'success.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  <Warning sx={{ verticalAlign: 'middle', mr: 1, color: stats.lowStock > 0 ? 'error.main' : 'success.main' }} />
                  Stock Alerts
                </Typography>
                {stats.lowStock > 0 && (
                  <Badge badgeContent={stats.lowStock} color="error">
                    <Warning color="error" />
                  </Badge>
                )}
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={100} />
              ) : lowStockItems.length > 0 ? (
                <List dense>
                  {lowStockItems.map((stockItem, i) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <ListItemIcon>
                        {Number(stockItem.current_stock) === 0 ? <Error color="error" /> : <Warning color="warning" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography component="span" variant="body2" fontWeight="medium">{stockItem.product_name}</Typography>
                            <Chip 
                              size="small" 
                              label={`${stockItem.current_stock} left`} 
                              color={Number(stockItem.current_stock) === 0 ? 'error' : 'warning'}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography component="span" variant="caption" color="text.secondary">
                            SKU: {stockItem.sku} • Alert: {stockItem.stock_alert_quantity}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <DoneAll sx={{ color: 'success.main', fontSize: 40, mb: 1 }} />
                  <Typography color="success.main" fontWeight="medium">All stock levels healthy</Typography>
                </Box>
              )}

              {stats.lowStock > 5 && (
                <Button fullWidth size="small" sx={{ mt: 1 }} onClick={() => navigate('/reports')}>
                  View All {stats.lowStock} Items
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}