import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Stack, Card, CardContent, 
  Tabs, Tab, Grid, Snackbar, Alert, Divider, useTheme
} from '@mui/material';
import {
  AccountBalance, TrendingUp, TrendingDown, AccountBalanceWallet,
  MoneyOff, AttachMoney, Inventory, People, ShoppingCart,
  CalendarToday, Refresh
} from '@mui/icons-material';
import db from '../database/db';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getToday = () => new Date().toISOString().split('T')[0];
const getStartOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const CHART_OF_ACCOUNTS = [
  { code: '1001', name: 'Cash in Hand', type: 'asset', category: 'current_asset', normal_balance: 'debit' },
  { code: '1002', name: 'Bank Account', type: 'asset', category: 'current_asset', normal_balance: 'debit' },
  { code: '1101', name: 'Accounts Receivable', type: 'asset', category: 'current_asset', normal_balance: 'debit' },
  { code: '1102', name: 'Inventory', type: 'asset', category: 'current_asset', normal_balance: 'debit' },
  { code: '2001', name: 'Accounts Payable', type: 'liability', category: 'current_liability', normal_balance: 'credit' },
  { code: '3001', name: "Owner's Capital", type: 'equity', category: 'equity', normal_balance: 'credit' },
  { code: '3002', name: 'Retained Earnings', type: 'equity', category: 'equity', normal_balance: 'credit' },
  { code: '4001', name: 'Sales Revenue', type: 'revenue', category: 'revenue', normal_balance: 'credit' },
  { code: '5001', name: 'Cost of Goods Sold', type: 'expense', category: 'cogs', normal_balance: 'debit' },
  { code: '6008', name: 'Operating Expenses', type: 'expense', category: 'operating_expense', normal_balance: 'debit' },
];

export default function AccountsPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [dateFrom, setDateFrom] = useState(getStartOfMonth());
  const [dateTo, setDateTo] = useState(getToday());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sales, purchases, expenses, variants, customers, suppliers, saleItems] = await Promise.all([
        db.getSalesHistory(), db.getPurchases(), db.getExpenses(), 
        db.getAllVariants(), db.getCustomers(), db.getSuppliers(),
        db.getAllSaleItems ? db.getAllSaleItems() : Promise.resolve([])
      ]);

      const from = new Date(dateFrom); from.setHours(0,0,0,0);
      const to = new Date(dateTo); to.setHours(23,59,59,999);

      const inRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= from && d <= to;
      };

      const periodSales = sales.filter(s => !s.is_deleted && inRange(s.date));
      const periodPurchases = purchases.filter(p => !p.is_deleted && inRange(p.purchase_date || p.date));
      const periodExpenses = expenses.filter(e => !e.is_deleted && inRange(e.date));
      const periodSaleItems = saleItems.filter(si => {
        const sale = sales.find(s => s.id === si.sale_id);
        return sale && !sale.is_deleted && inRange(sale.date);
      });

      // Initialize accounts
      const accounts = {};
      CHART_OF_ACCOUNTS.forEach(a => {
        accounts[a.code] = { ...a, debit: 0, credit: 0 };
      });

      // Process Sales
      periodSales.forEach(s => {
        const total = Number(s.grand_total || 0);
        const paid = Number(s.paid_amount || 0);
        const due = Number(s.due_amount || 0);
        
        accounts['4001'].credit += total; // Revenue
        
        if (s.payment_mode === 'cash' || s.payment_mode === 'cod' || s.payment_mode === 'cash_on_delivery') {
          accounts['1001'].debit += paid;
        } else {
          accounts['1002'].debit += paid; // Bank/Card/Cheque
        }
        
        if (due > 0) {
          accounts['1101'].debit += due;
        }
      });

      // Process Purchases (Periodic Inventory: Purchases increase Inventory directly)
      periodPurchases.forEach(p => {
        const total = Number(p.grand_total || 0);
        const paid = Number(p.paid_amount || 0);
        
        accounts['1102'].debit += total; // Inventory
        accounts['1001'].credit += paid; // Cash out
        
        const unpaid = total - paid;
        if (unpaid > 0) {
          accounts['2001'].credit += unpaid; // Payables
        }
      });

      // Process Expenses
      periodExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        accounts['6008'].debit += amt;
        accounts['1001'].credit += amt;
      });

      // COGS from sale_items (Perpetual: reduce inventory by COGS)
      const cogs = periodSaleItems.reduce((sum, si) => {
        const variant = variants.find(v => v.id === si.product_variant_id);
        const cost = variant ? (Number(variant.purchase_price || 0) * Number(si.quantity || 0)) : 0;
        return sum + cost;
      }, 0);
      accounts['5001'].debit = cogs;

      // Adjust Inventory for COGS sold (Perpetual adjustment)
      // Closing Inventory = Opening + Purchases - COGS. We use physical count from variants.
      const physicalInventory = variants.reduce((sum, v) => sum + (Number(v.current_stock || 0) * Number(v.purchase_price || 0)), 0);
      accounts['1102'].debit = physicalInventory;

      // Calculate Net Income
      const revenue = accounts['4001'].credit;
      const cogsVal = accounts['5001'].debit;
      const expVal = accounts['6008'].debit;
      const netIncome = revenue - cogsVal - expVal;

      // Set Retained Earnings = Net Income (for current period view)
      // In real system, you'd fetch accumulated retained earnings from DB
      accounts['3002'].credit = netIncome > 0 ? netIncome : 0;
      if (netIncome < 0) accounts['3002'].debit = Math.abs(netIncome); // Net loss

      // Owner's Capital = Assets - Liabilities - Retained Earnings (auto-calculated to balance)
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

      // Build Trial Balance
      const trial = Object.values(accounts).map(acc => {
        const net = acc.normal_balance === 'debit' ? (acc.debit - acc.credit) : (acc.credit - acc.debit);
        return { ...acc, net };
      }).filter(acc => acc.debit !== 0 || acc.credit !== 0); // Hide zero accounts

      const totalDebit = trial.reduce((s, a) => s + a.debit, 0);
      const totalCredit = trial.reduce((s, a) => s + a.credit, 0);

      setData({
        accounts,
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
      
      setSnackbar({ open: true, message: 'Financial data refreshed' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error loading data: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [dateFrom, dateTo]);

  const StatCard = ({ title, amount, icon, color }) => (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1.5, bgcolor: `${color}.light`, borderRadius: 2, color: `${color}.dark` }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h6" fontWeight="bold">{formatCurrency(amount)}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  if (!data) return <Box sx={{ p: 3 }}><Typography>Loading accounts...</Typography></Box>;

  return (
    <Box sx={{ p: 2, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        <AccountBalance sx={{ verticalAlign: 'middle', mr: 1 }} />
        Accounts & Financials
      </Typography>

      {/* Date Filter */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          type="date" label="From" size="small"
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date" label="To" size="small"
          value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="contained" startIcon={<Refresh />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
        <Chip icon={<CalendarToday />} label={`${formatDate(dateFrom)} - ${formatDate(dateTo)}`} variant="outlined" />
      </Paper>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Dashboard" />
          <Tab label="Trial Balance" />
          <Tab label="Balance Sheet" />
          <Tab label="P&L Statement" />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: DASHBOARD ==================== */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Total Assets" amount={data.summary.totalAssets} icon={<AccountBalance />} color="primary" />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Total Liabilities" amount={data.summary.totalLiabilities} icon={<MoneyOff />} color="error" />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Owner's Equity" amount={data.summary.totalEquity} icon={<TrendingUp />} color="success" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Cash in Hand" amount={data.summary.cash} icon={<AttachMoney />} color="warning" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Bank Balance" amount={data.summary.bank} icon={<AccountBalanceWallet />} color="info" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Receivables" amount={data.summary.receivables} icon={<People />} color="secondary" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Inventory Value" amount={data.summary.inventory} icon={<Inventory />} color="primary" />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Accounts Payable" amount={data.summary.payables} icon={<ShoppingCart />} color="error" />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Net Income" amount={data.pnl.netIncome} icon={<TrendingUp />} color={data.pnl.netIncome >= 0 ? 'success' : 'error'} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard title="Payables" amount={data.summary.payables} icon={<TrendingDown />} color="error" />
          </Grid>
        </Grid>
      )}

      {/* ==================== TAB 1: TRIAL BALANCE ==================== */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white' }}>Code</TableCell>
                <TableCell sx={{ color: 'white' }}>Account Name</TableCell>
                <TableCell sx={{ color: 'white' }}>Type</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Debit (PKR)</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Credit (PKR)</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Net Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.trial.map(acc => (
                <TableRow key={acc.code} hover>
                  <TableCell fontWeight="medium">{acc.code}</TableCell>
                  <TableCell>{acc.name}</TableCell>
                  <TableCell>
                    <Chip label={acc.type} size="small" color={
                      acc.type === 'asset' ? 'primary' : 
                      acc.type === 'liability' ? 'error' : 
                      acc.type === 'equity' ? 'success' : 
                      acc.type === 'revenue' ? 'info' : 'warning'
                    } />
                  </TableCell>
                  <TableCell align="right" sx={{ color: acc.debit > 0 ? 'text.primary' : 'text.disabled' }}>
                    {formatCurrency(acc.debit)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: acc.credit > 0 ? 'text.primary' : 'text.disabled' }}>
                    {formatCurrency(acc.credit)}
                  </TableCell>
                  <TableCell align="right" fontWeight="bold">
                    {formatCurrency(acc.net)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell colSpan={3} align="right" fontWeight="bold">TOTALS</TableCell>
                <TableCell align="right" fontWeight="bold" color="primary">{formatCurrency(data.totalDebit)}</TableCell>
                <TableCell align="right" fontWeight="bold" color="primary">{formatCurrency(data.totalCredit)}</TableCell>
                <TableCell align="right" fontWeight="bold">
                  {Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? (
                    <Chip icon={<TrendingUp />} label="Balanced" color="success" size="small" />
                  ) : (
                    <Chip label={`Diff: ${formatCurrency(data.totalDebit - data.totalCredit)}`} color="error" size="small" />
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ==================== TAB 2: BALANCE SHEET ==================== */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {/* ASSETS */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
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

          {/* LIABILITIES + EQUITY */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom color="error" fontWeight="bold">
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

              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom color="success" fontWeight="bold">
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
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              (Auto-calculated)
                            </Typography>
                          )}
                          {item.code === '3002' && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              (Revenue - COGS - Exp)
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

              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Accounting Equation Verification
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
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ==================== TAB 3: P&L STATEMENT ==================== */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
          <Typography variant="h5" align="center" fontWeight="bold" gutterBottom>
            Profit & Loss Statement
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
            For the period {formatDate(dateFrom)} to {formatDate(dateTo)}
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            {/* Revenue */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Sales Revenue</Typography>
              <Typography variant="subtitle1" fontWeight="medium">{formatCurrency(data.pnl.revenue)}</Typography>
            </Stack>

            <Divider />

            {/* COGS */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" color="text.secondary" sx={{ pl: 2 }}>
                Less: Cost of Goods Sold
              </Typography>
              <Typography variant="subtitle1" color="error">{formatCurrency(data.pnl.cogs)}</Typography>
            </Stack>

            {/* Gross Profit */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">Gross Profit</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color={data.pnl.revenue - data.pnl.cogs >= 0 ? 'success.main' : 'error'}>
                {formatCurrency(data.pnl.revenue - data.pnl.cogs)}
              </Typography>
            </Stack>

            <Divider />

            {/* Expenses */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" color="text.secondary" sx={{ pl: 2 }}>
                Less: Operating Expenses
              </Typography>
              <Typography variant="subtitle1" color="error">{formatCurrency(data.pnl.expenses)}</Typography>
            </Stack>

            <Divider sx={{ borderWidth: 2 }} />

            {/* Net Income */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: data.pnl.netIncome >= 0 ? 'success.light' : 'error.light', p: 2, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                {data.pnl.netIncome >= 0 ? 'Net Income' : 'Net Loss'}
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {formatCurrency(Math.abs(data.pnl.netIncome))}
              </Typography>
            </Stack>

            {/* Margin */}
            <Typography variant="caption" align="center" color="text.secondary">
              Net Margin: {data.pnl.revenue > 0 ? ((data.pnl.netIncome / data.pnl.revenue) * 100).toFixed(2) : '0.00'}%
            </Typography>
          </Stack>
        </Paper>
      )}

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="info" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}