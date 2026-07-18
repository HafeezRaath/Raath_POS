import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Stack, Card, CardContent,
  Tabs, Tab, Grid, Snackbar, Alert, Divider, useTheme, useMediaQuery,
  IconButton, TablePagination, Collapse, Skeleton
} from '@mui/material';
import {
  AccountBalance, TrendingUp, TrendingDown, AccountBalanceWallet,
  MoneyOff, AttachMoney, Inventory, People, ShoppingCart,
  CalendarToday, Refresh, KeyboardArrowDown, KeyboardArrowUp,
  Dashboard, Receipt, Assessment, BarChart
} from '@mui/icons-material';
import db from '../database/db';

// ==================== CONSTANTS ====================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { 
    style: 'currency', 
    currency: 'PKR', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

const getToday = () => new Date().toISOString().split('T')[0];
const getStartOfMonth = () => { 
  const d = new Date(); 
  d.setDate(1); 
  return d.toISOString().split('T')[0]; 
};

// ==================== CHART OF ACCOUNTS ====================
const CHART_OF_ACCOUNTS = [
  { code: '1001', name: 'Cash in Hand', type: 'asset', normal_balance: 'debit' },
  { code: '1002', name: 'Bank Account', type: 'asset', normal_balance: 'debit' },
  { code: '1101', name: 'Accounts Receivable', type: 'asset', normal_balance: 'debit' },
  { code: '1102', name: 'Inventory', type: 'asset', normal_balance: 'debit' },
  { code: '2001', name: 'Accounts Payable', type: 'liability', normal_balance: 'credit' },
  { code: '3001', name: "Owner's Capital", type: 'equity', normal_balance: 'credit' },
  { code: '3002', name: 'Retained Earnings', type: 'equity', normal_balance: 'credit' },
  { code: '4001', name: 'Sales Revenue', type: 'revenue', normal_balance: 'credit' },
  { code: '5001', name: 'Cost of Goods Sold', type: 'expense', normal_balance: 'debit' },
  { code: '6008', name: 'Operating Expenses', type: 'expense', normal_balance: 'debit' },
];

// ==================== STAT CARD COMPONENT ====================
const StatCard = React.memo(({ title, amount, icon, color, isMobile }) => (
  <Card elevation={2} sx={{ height: '100%' }}>
    <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
      <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2} alignItems={isMobile ? 'flex-start' : 'center'}>
        <Box sx={{ p: 1, bgcolor: `${color}.light`, borderRadius: 2, color: `${color}.dark` }}>
          {icon}
        </Box>
        <Box>
          <Typography variant={isMobile ? 'caption' : 'body2'} color="text.secondary">{title}</Typography>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">{formatCurrency(amount)}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
));

// ==================== MOBILE TRIAL ROW ====================
const MobileTrialRow = React.memo(({ acc, expanded, onToggle }) => {
  const isExpanded = expanded[acc.code] || false;
  
  return (
    <>
      <TableRow hover onClick={() => onToggle(acc.code)} sx={{ cursor: 'pointer' }}>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small">
              {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
            </IconButton>
            <Box>
              <Typography variant="body2" fontWeight="medium">{acc.code}</Typography>
              <Typography variant="caption" color="text.secondary">{acc.name}</Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell align="right">
          <Chip label={acc.type} size="small" color={
            acc.type === 'asset' ? 'primary' : 
            acc.type === 'liability' ? 'error' : 
            acc.type === 'equity' ? 'success' : 
            acc.type === 'revenue' ? 'info' : 'warning'
          } sx={{ height: 20, fontSize: '0.6rem' }} />
        </TableCell>
        <TableCell align="right">{formatCurrency(acc.net)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={3} sx={{ py: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Debit</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(acc.debit)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Credit</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(acc.credit)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Balance</Typography>
                  <Typography variant="body2" fontWeight="bold" color={acc.net >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(acc.net)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
});

// ==================== MAIN COMPONENT ====================
export default function AccountsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState(0);
  const [dateFrom, setDateFrom] = useState(getStartOfMonth);
  const [dateTo, setDateTo] = useState(getToday);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedRows, setExpandedRows] = useState({});

  // ==================== HELPER FUNCTIONS ====================
  const getDateRange = useCallback(() => {
    const from = new Date(dateFrom); 
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); 
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [dateFrom, dateTo]);

  // ==================== DATA LOADING ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use Promise.allSettled to prevent one failure from breaking everything
      const results = await Promise.allSettled([
        db.getSalesHistory ? db.getSalesHistory() : Promise.resolve([]),
        db.getPurchases ? db.getPurchases() : Promise.resolve([]),
        db.getExpenses ? db.getExpenses() : Promise.resolve([]),
        db.getAllVariants ? db.getAllVariants() : Promise.resolve([]),
        db.getCustomers ? db.getCustomers() : Promise.resolve([]),
        db.getSuppliers ? db.getSuppliers() : Promise.resolve([]),
        db.getAllSaleItems ? db.getAllSaleItems() : Promise.resolve([])
      ]);

      // Extract data or use empty arrays on failure
      const [salesResult, purchasesResult, expensesResult, variantsResult, customersResult, suppliersResult, saleItemsResult] = results;
      
      const sales = salesResult.status === 'fulfilled' ? salesResult.value : [];
      const purchases = purchasesResult.status === 'fulfilled' ? purchasesResult.value : [];
      const expenses = expensesResult.status === 'fulfilled' ? expensesResult.value : [];
      const variants = variantsResult.status === 'fulfilled' ? variantsResult.value : [];
      const customers = customersResult.status === 'fulfilled' ? customersResult.value : [];
      const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
      const saleItems = saleItemsResult.status === 'fulfilled' ? saleItemsResult.value : [];

      // ==================== FILTER BY DATE ====================
      const { from, to } = getDateRange();
      const inRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= from && d <= to;
      };

      // Filter arrays - only what's needed
      const periodSales = sales.filter(s => !s.is_deleted && inRange(s.date));
      const periodPurchases = purchases.filter(p => !p.is_deleted && inRange(p.purchase_date || p.date));
      const periodExpenses = expenses.filter(e => !e.is_deleted && inRange(e.date));

      // Optimize: Create sale lookup map for faster access
      const saleMap = new Map(sales.filter(s => !s.is_deleted).map(s => [s.id, s]));
      const periodSaleItems = saleItems.filter(si => {
        const sale = saleMap.get(si.sale_id);
        return sale && !sale.is_deleted && inRange(sale.date);
      });

      // ==================== PROCESS ACCOUNTS ====================
      // Use reduce for better performance
      const accounts = CHART_OF_ACCOUNTS.reduce((acc, a) => {
        acc[a.code] = { ...a, debit: 0, credit: 0 };
        return acc;
      }, {});

      // Process Sales (batch update)
      periodSales.forEach(s => {
        const total = Number(s.grand_total || 0);
        const paid = Number(s.paid_amount || 0);
        const due = Number(s.due_amount || 0);
        
        accounts['4001'].credit += total;
        
        if (['cash', 'cod', 'cash_on_delivery'].includes(s.payment_mode)) {
          accounts['1001'].debit += paid;
        } else {
          accounts['1002'].debit += paid;
        }
        
        if (due > 0) accounts['1101'].debit += due;
      });

      // Process Purchases
      periodPurchases.forEach(p => {
        const total = Number(p.grand_total || 0);
        const paid = Number(p.paid_amount || 0);
        accounts['1102'].debit += total;
        accounts['1001'].credit += paid;
        const unpaid = total - paid;
        if (unpaid > 0) accounts['2001'].credit += unpaid;
      });

      // Process Expenses
      periodExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        accounts['6008'].debit += amt;
        accounts['1001'].credit += amt;
      });

      // Calculate COGS efficiently using reduce
      const cogs = periodSaleItems.reduce((sum, si) => {
        const variant = variants.find(v => v.id === si.product_variant_id);
        return sum + (variant ? (Number(variant.purchase_price || 0) * Number(si.quantity || 0)) : 0);
      }, 0);
      accounts['5001'].debit = cogs;

      // Physical Inventory
      const physicalInventory = variants.reduce((sum, v) => {
        return sum + (Number(v.current_stock || 0) * Number(v.purchase_price || 0));
      }, 0);
      accounts['1102'].debit = physicalInventory;

      // Calculate Net Income
      const revenue = accounts['4001'].credit;
      const cogsVal = accounts['5001'].debit;
      const expVal = accounts['6008'].debit;
      const netIncome = revenue - cogsVal - expVal;

      // Retained Earnings
      accounts['3002'].credit = netIncome > 0 ? netIncome : 0;
      if (netIncome < 0) accounts['3002'].debit = Math.abs(netIncome);

      // Calculate totals
      const totalAssets = (accounts['1001'].debit - accounts['1001'].credit) 
                        + (accounts['1002'].debit - accounts['1002'].credit) 
                        + (accounts['1101'].debit - accounts['1101'].credit) 
                        + (accounts['1102'].debit - accounts['1102'].credit);
      
      const totalLiabilities = accounts['2001'].credit - accounts['2001'].debit;
      const totalEquity = totalAssets - totalLiabilities;
      const retainedEarnings = accounts['3002'].credit - accounts['3002'].debit;
      const ownerCapital = totalEquity - retainedEarnings;
      
      accounts['3001'].credit = ownerCapital > 0 ? ownerCapital : 0;
      if (ownerCapital < 0) accounts['3001'].debit = Math.abs(ownerCapital);

      // Build Trial Balance (filter out zero accounts)
      const trial = Object.values(accounts)
        .map(acc => {
          const net = acc.normal_balance === 'debit' ? (acc.debit - acc.credit) : (acc.credit - acc.debit);
          return { ...acc, net };
        })
        .filter(acc => acc.debit !== 0 || acc.credit !== 0);

      const totalDebit = trial.reduce((s, a) => s + a.debit, 0);
      const totalCredit = trial.reduce((s, a) => s + a.credit, 0);

      // ==================== SET DATA ====================
      setData({
        trial,
        totalDebit,
        totalCredit,
        balanceSheet: {
          assets: [
            { name: 'Cash in Hand', code: '1001', amount: accounts['1001'].debit - accounts['1001'].credit },
            { name: 'Bank Account', code: '1002', amount: accounts['1002'].debit - accounts['1002'].credit },
            { name: 'Accounts Receivable', code: '1101', amount: accounts['1101'].debit - accounts['1101'].credit },
            { name: 'Inventory', code: '1102', amount: accounts['1102'].debit - accounts['1102'].credit },
          ],
          liabilities: [
            { name: 'Accounts Payable', code: '2001', amount: accounts['2001'].credit - accounts['2001'].debit },
          ],
          equity: [
            { name: "Owner's Capital", code: '3001', amount: accounts['3001'].credit - accounts['3001'].debit },
            { name: 'Retained Earnings', code: '3002', amount: accounts['3002'].credit - accounts['3002'].debit },
          ]
        },
        pnl: { revenue, cogs: cogsVal, expenses: expVal, netIncome },
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          cash: accounts['1001'].debit - accounts['1001'].credit,
          bank: accounts['1002'].debit - accounts['1002'].credit,
          receivables: accounts['1101'].debit - accounts['1101'].credit,
          inventory: accounts['1102'].debit - accounts['1102'].credit,
          payables: accounts['2001'].credit - accounts['2001'].debit,
        }
      });
      
      setSnackbar({ open: true, message: '✅ Data refreshed successfully', severity: 'success' });
      setPage(0);
      
    } catch (err) {
      console.error('[Accounts] Error:', err);
      setError(err.message);
      setSnackbar({ open: true, message: '❌ Error: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, getDateRange]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    // Debounce loadData to prevent excessive calls
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  // ==================== HANDLERS ====================
  const handleTabChange = useCallback((_, newValue) => {
    setActiveTab(newValue);
  }, []);

  const handlePageChange = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const toggleExpand = useCallback((code) => {
    setExpandedRows(prev => ({ ...prev, [code]: !prev[code] }));
  }, []);

  // ==================== MEMOIZED DATA ====================
  const paginatedTrial = useMemo(() => {
    if (!data) return [];
    return data.trial.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [data, page, rowsPerPage]);

  // ==================== LOADING SKELETON ====================
  if (loading && !data) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ my: 2 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  // ==================== ERROR STATE ====================
  if (error && !data) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" gutterBottom>Failed to load accounts data</Typography>
        <Button variant="contained" onClick={loadData}>Retry</Button>
      </Box>
    );
  }

  if (!data) return null;

  // ==================== QUICK STATS DATA ====================
  const quickStats = [
    { title: 'Total Assets', amount: data.summary.totalAssets, icon: <AccountBalance />, color: 'primary' },
    { title: 'Total Liabilities', amount: data.summary.totalLiabilities, icon: <MoneyOff />, color: 'error' },
    { title: "Owner's Equity", amount: data.summary.totalEquity, icon: <TrendingUp />, color: 'success' },
    { title: 'Cash in Hand', amount: data.summary.cash, icon: <AttachMoney />, color: 'warning' },
    { title: 'Bank Balance', amount: data.summary.bank, icon: <AccountBalanceWallet />, color: 'info' },
    { title: 'Receivables', amount: data.summary.receivables, icon: <People />, color: 'secondary' },
    { title: 'Inventory Value', amount: data.summary.inventory, icon: <Inventory />, color: 'primary' },
    { title: 'Accounts Payable', amount: data.summary.payables, icon: <ShoppingCart />, color: 'error' },
    { title: 'Net Income', amount: data.pnl.netIncome, icon: <TrendingUp />, color: data.pnl.netIncome >= 0 ? 'success' : 'error' },
  ];

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 1400, mx: 'auto', pb: isMobile ? 2 : 2 }}>
      {/* Header */}
      <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" gutterBottom>
        <AccountBalance sx={{ verticalAlign: 'middle', mr: 1 }} />
        Accounts & Financials
      </Typography>

      {/* Date Filter */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'center'}>
          <Stack direction={isMobile ? 'column' : 'row'} spacing={1} flex={1}>
            <TextField
              type="date" 
              label="From" 
              size="small"
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth={isMobile}
            />
            <TextField
              type="date" 
              label="To" 
              size="small"
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth={isMobile}
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent={isMobile ? 'space-between' : 'flex-end'}>
            <Button 
              variant="contained" 
              startIcon={<Refresh />} 
              onClick={loadData} 
              disabled={loading}
              size={isMobile ? 'small' : 'medium'}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            {!isMobile && (
              <Chip 
                icon={<CalendarToday />} 
                label={`${formatDate(dateFrom)} - ${formatDate(dateTo)}`} 
                variant="outlined" 
                size="small" 
              />
            )}
          </Stack>
          {isMobile && (
            <Typography variant="caption" color="text.secondary" align="center">
              {formatDate(dateFrom)} - {formatDate(dateTo)}
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          allowScrollButtonsMobile={!isMobile}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          <Tab label={isMobile ? 'Dash' : 'Dashboard'} icon={isMobile ? <Dashboard fontSize="small" /> : undefined} />
          <Tab label={isMobile ? 'Trial' : 'Trial Balance'} icon={isMobile ? <Receipt fontSize="small" /> : undefined} />
          <Tab label={isMobile ? 'BS' : 'Balance Sheet'} icon={isMobile ? <Assessment fontSize="small" /> : undefined} />
          <Tab label={isMobile ? 'P&L' : 'P&L Statement'} icon={isMobile ? <BarChart fontSize="small" /> : undefined} />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: DASHBOARD ==================== */}
      {activeTab === 0 && (
        <Grid container spacing={isMobile ? 1 : 2}>
          {quickStats.map((stat, idx) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={idx}>
              <StatCard {...stat} isMobile={isMobile} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* ==================== TAB 1: TRIAL BALANCE ==================== */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Account</TableCell>
                {!isMobile && (
                  <>
                    <TableCell sx={{ color: 'white' }}>Type</TableCell>
                    <TableCell sx={{ color: 'white' }} align="right">Debit</TableCell>
                    <TableCell sx={{ color: 'white' }} align="right">Credit</TableCell>
                  </>
                )}
                <TableCell sx={{ color: 'white' }} align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isMobile ? (
                paginatedTrial.map(acc => (
                  <MobileTrialRow 
                    key={acc.code} 
                    acc={acc} 
                    expanded={expandedRows}
                    onToggle={toggleExpand}
                  />
                ))
              ) : (
                paginatedTrial.map(acc => (
                  <TableRow key={acc.code} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{acc.code}</Typography>
                      <Typography variant="caption" color="text.secondary">{acc.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={acc.type} size="small" color={
                        acc.type === 'asset' ? 'primary' : 
                        acc.type === 'liability' ? 'error' : 
                        acc.type === 'equity' ? 'success' : 
                        acc.type === 'revenue' ? 'info' : 'warning'
                      } sx={{ height: 20, fontSize: '0.6rem' }} />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(acc.debit)}</TableCell>
                    <TableCell align="right">{formatCurrency(acc.credit)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color={acc.net >= 0 ? 'success.main' : 'error.main'}>
                        {formatCurrency(acc.net)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell colSpan={isMobile ? 1 : 3} align="right">
                  <Typography fontWeight="bold">TOTALS</Typography>
                </TableCell>
                {!isMobile && (
                  <>
                    <TableCell align="right" fontWeight="bold" sx={{ color: 'primary.main' }}>
                      {formatCurrency(data.totalDebit)}
                    </TableCell>
                    <TableCell align="right" fontWeight="bold" sx={{ color: 'primary.main' }}>
                      {formatCurrency(data.totalCredit)}
                    </TableCell>
                  </>
                )}
                <TableCell align="right">
                  {Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? (
                    <Chip icon={<TrendingUp />} label="Balanced" color="success" size="small" />
                  ) : (
                    <Chip label={`Diff: ${formatCurrency(data.totalDebit - data.totalCredit)}`} color="error" size="small" />
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={isMobile ? [5, 10, 25] : [10, 25, 50, 100]}
            component="div"
            count={data.trial.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            labelRowsPerPage={isMobile ? 'Rows:' : 'Rows per page:'}
            sx={{
              '.MuiTablePagination-select': { fontSize: isMobile ? '0.75rem' : '0.875rem' },
              '.MuiTablePagination-displayedRows': { fontSize: isMobile ? '0.7rem' : '0.875rem' },
            }}
          />
        </TableContainer>
      )}

      {/* ==================== TAB 2: BALANCE SHEET ==================== */}
      {activeTab === 2 && (
        <Grid container spacing={isMobile ? 1 : 3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: isMobile ? 1.5 : 2, height: '100%' }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom color="primary" fontWeight="bold">
                <AccountBalance sx={{ verticalAlign: 'middle', mr: 1 }} /> ASSETS
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableBody>
                  {data.balanceSheet.assets.map(item => (
                    <TableRow key={item.code}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'primary.light' }}>
                    <TableCell fontWeight="bold">Total Assets</TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(data.summary.totalAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: isMobile ? 1.5 : 2, height: '100%' }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom color="error" fontWeight="bold">
                <MoneyOff sx={{ verticalAlign: 'middle', mr: 1 }} /> LIABILITIES
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableBody>
                  {data.balanceSheet.liabilities.map(item => (
                    <TableRow key={item.code}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'error.light' }}>
                    <TableCell fontWeight="bold">Total Liabilities</TableCell>
                    <TableCell align="right" fontWeight="bold">{formatCurrency(data.summary.totalLiabilities)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Box sx={{ mt: isMobile ? 2 : 3 }}>
                <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom color="success" fontWeight="bold">
                  <TrendingUp sx={{ verticalAlign: 'middle', mr: 1 }} /> EQUITY
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableBody>
                    {data.balanceSheet.equity.map(item => (
                      <TableRow key={item.code}>
                        <TableCell>
                          {item.name}
                          {item.code === '3001' && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: isMobile ? 'block' : 'inline', ml: isMobile ? 0 : 1 }}>
                              (Auto)
                            </Typography>
                          )}
                          {item.code === '3002' && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: isMobile ? 'block' : 'inline', ml: isMobile ? 0 : 1 }}>
                              (Net Income)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'success.light' }}>
                      <TableCell fontWeight="bold">Total Equity</TableCell>
                      <TableCell align="right" fontWeight="bold">{formatCurrency(data.summary.totalEquity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              {!isMobile && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Accounting Equation
                  </Typography>
                  <Typography variant="body2">
                    Assets ({formatCurrency(data.summary.totalAssets)}) = 
                    Liabilities ({formatCurrency(data.summary.totalLiabilities)}) + 
                    Equity ({formatCurrency(data.summary.totalEquity)})
                  </Typography>
                  <Chip 
                    label={Math.abs(data.summary.totalAssets - (data.summary.totalLiabilities + data.summary.totalEquity)) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                    color={Math.abs(data.summary.totalAssets - (data.summary.totalLiabilities + data.summary.totalEquity)) < 0.01 ? "success" : "error"}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}
            </Paper>
          </Grid>
          {isMobile && (
            <Grid item xs={12}>
              <Paper sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight="bold" display="block">Accounting Equation</Typography>
                <Typography variant="caption">Assets = Liabilities + Equity</Typography>
                <Chip 
                  label={Math.abs(data.summary.totalAssets - (data.summary.totalLiabilities + data.summary.totalEquity)) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                  color={Math.abs(data.summary.totalAssets - (data.summary.totalLiabilities + data.summary.totalEquity)) < 0.01 ? "success" : "error"}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ==================== TAB 3: P&L STATEMENT ==================== */}
      {activeTab === 3 && (
        <Paper sx={{ p: isMobile ? 2 : 3, maxWidth: 700, mx: 'auto' }}>
          <Typography variant={isMobile ? 'h6' : 'h5'} align="center" fontWeight="bold" gutterBottom>
            Profit & Loss Statement
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
            {formatDate(dateFrom)} to {formatDate(dateTo)}
          </Typography>
          <Divider sx={{ my: isMobile ? 1.5 : 2 }} />

          <Stack spacing={isMobile ? 1.5 : 2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'}>Sales Revenue</Typography>
              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="medium">{formatCurrency(data.pnl.revenue)}</Typography>
            </Stack>
            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant={isMobile ? 'body2' : 'subtitle1'} color="text.secondary" sx={{ pl: isMobile ? 1 : 2 }}>
                Less: Cost of Goods Sold
              </Typography>
              <Typography variant={isMobile ? 'body2' : 'subtitle1'} color="error">{formatCurrency(data.pnl.cogs)}</Typography>
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'grey.50', p: isMobile ? 1 : 1.5, borderRadius: 1 }}>
              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold">Gross Profit</Typography>
              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold" color={data.pnl.revenue - data.pnl.cogs >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(data.pnl.revenue - data.pnl.cogs)}
              </Typography>
            </Stack>
            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant={isMobile ? 'body2' : 'subtitle1'} color="text.secondary" sx={{ pl: isMobile ? 1 : 2 }}>
                Less: Operating Expenses
              </Typography>
              <Typography variant={isMobile ? 'body2' : 'subtitle1'} color="error">{formatCurrency(data.pnl.expenses)}</Typography>
            </Stack>
            <Divider sx={{ borderWidth: 2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: data.pnl.netIncome >= 0 ? 'success.light' : 'error.light', p: isMobile ? 1.5 : 2, borderRadius: 2 }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                {data.pnl.netIncome >= 0 ? 'Net Income' : 'Net Loss'}
              </Typography>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                {formatCurrency(Math.abs(data.pnl.netIncome))}
              </Typography>
            </Stack>

            <Typography variant="caption" align="center" color="text.secondary">
              Net Margin: {data.pnl.revenue > 0 ? ((data.pnl.netIncome / data.pnl.revenue) * 100).toFixed(2) : '0.00'}%
            </Typography>

            {isMobile && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight="bold" display="block">Quick Summary</Typography>
                <Stack direction="row" justifyContent="space-around">
                  {[
                    { label: 'Revenue', value: data.pnl.revenue },
                    { label: 'Expenses', value: data.pnl.expenses },
                    { label: 'COGS', value: data.pnl.cogs },
                  ].map(item => (
                    <Box key={item.label}>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body2" fontWeight="bold">{formatCurrency(item.value)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
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