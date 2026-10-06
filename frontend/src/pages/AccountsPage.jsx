import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Chip, MenuItem, FormControl,
  InputLabel, Select, Stack, Card, CardContent, Tabs, Tab,
  Tooltip, Pagination, Snackbar, Alert, LinearProgress,
  InputAdornment, Divider, useMediaQuery, useTheme,
  Drawer, Collapse, List, ListItem, ListItemText, ListItemIcon, Fade,
  Checkbox, FormControlLabel, TablePagination, Skeleton
} from '../components/ui/tailwind-mui';
import {
  Search, FilterList, Visibility, Print, Refresh, AccountBalance,
  TrendingUp, TrendingDown, Menu as MenuIcon, Close, ArrowUpward,
  ArrowDownward, Add, Delete, Edit, SwapHoriz, Balance,
  CalendarToday, Warning, CheckCircle, AccountBalanceWallet,
  Payment, Savings, PhoneAndroid, Print as PrintIcon,
  PictureAsPdf, ArrowForward, MoneyOff, AttachMoney, Inventory,
  People, ShoppingCart, KeyboardArrowDown, KeyboardArrowUp,
  Dashboard, Receipt, Assessment, BarChart, MenuBook
} from '../components/ui/icons';
import db from '../database/db';
import useSyncListener from '../hooks/useSyncListener';
import UnifiedPagination from '../components/common/UnifiedPagination';

// ==================== CONSTANTS ====================
const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash', icon: <Payment fontSize="small" /> },
  { value: 'bank', label: 'Bank Account', icon: <AccountBalance fontSize="small" /> },
  { value: 'easypaisa', label: 'EasyPaisa', icon: <PhoneAndroid fontSize="small" /> },
  { value: 'jazzcash', label: 'JazzCash', icon: <PhoneAndroid fontSize="small" /> },
  { value: 'cheque', label: 'Cheque', icon: <Savings fontSize="small" /> },
  { value: 'other', label: 'Other', icon: <AccountBalanceWallet fontSize="small" /> },
];

const TRANSACTION_TYPES = [
  { value: 'credit', label: 'Money In (Credit)', color: 'success' },
  { value: 'debit', label: 'Money Out (Debit)', color: 'error' },
];

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

const DB_NAME = 'RAATH_POS_DEMO';

// ==================== UTILITY FUNCTIONS ====================
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
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const getToday = () => new Date().toISOString().split('T')[0];
const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const getAccountTypeLabel = (type) => ACCOUNT_TYPES.find(t => t.value === type)?.label || type;
const getAccountTypeColor = (type) => {
  const map = { cash: '#10b981', bank: '#3b82f6', easypaisa: '#f59e0b', jazzcash: '#ef4444', cheque: '#8b5cf6', other: '#6b7280' };
  return map[type] || '#6b7280';
};

// ==================== BULLETPROOF INDEXEDDB FALLBACK ====================
const safeIdbQuery = (storeName, fallback = []) => {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(storeName)) {
          resolve(fallback);
          idb.close();
          return;
        }
        const tx = idb.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result || fallback);
        getAll.onerror = () => resolve(fallback);
        tx.oncomplete = () => idb.close();
      };
      req.onerror = () => resolve(fallback);
      req.onblocked = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
};

// ==================== MOBILE ACCOUNT CARD ====================
const MobileAccountCard = ({ account, index, onEdit, onDelete, onStatement, onSetOpening }) => {
  const [expanded, setExpanded] = useState(false);
  const typeColor = getAccountTypeColor(account.type);

  return (
    <Card sx={{ mb: 1.5, borderLeft: `4px solid ${typeColor}` }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              #{index} {account.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {getAccountTypeLabel(account.type)} {account.bank_name ? `• ${account.bank_name}` : ''}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={Number(account.current_balance) >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(account.current_balance)}
            </Typography>
            <Chip 
              size="small" 
              sx={{ height: 16, fontSize: '0.5rem', bgcolor: typeColor, color: 'white' }}
              label={String(account.status || 'active').toUpperCase()}
            />
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Opening Balance</Typography>
              <Typography variant="body2">{formatCurrency(account.opening_balance)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Current Balance</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(account.current_balance)}</Typography>
            </Grid>
            {account.account_number && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Account #</Typography>
                <Typography variant="body2" fontFamily="monospace">{account.account_number}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            onClick={() => onStatement(account)}
            sx={{ flex: 1, bgcolor: '#f59e0b', fontSize: '0.6rem', py: 0.5, '&:hover': { bgcolor: '#d97706' } }}
          >
            Statement
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<CalendarToday />} 
            onClick={() => onSetOpening(account)}
            sx={{ flex: 1, fontSize: '0.6rem', py: 0.5 }}
          >
            Opening
          </Button>
          <IconButton size="small" color="primary" onClick={() => onEdit(account)}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(account)}>
            <Delete fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE TRANSACTION CARD ====================
const MobileTransactionCard = ({ tx, index }) => {
  const [expanded, setExpanded] = useState(false);
  const isCredit = tx.transaction_type === 'credit';

  return (
    <Card sx={{ mb: 1.5, borderLeft: isCredit ? '4px solid #10b981' : '4px solid #ef4444' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              #{index} {tx.reference_type || 'Transaction'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {tx.description || '-'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={isCredit ? 'success.main' : 'error.main'}>
              {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(tx.date).split(',')[0]}
            </Typography>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Previous</Typography>
              <Typography variant="body2">{formatCurrency(tx.previous_balance)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">After</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(tx.balance_after)}</Typography>
            </Grid>
            {tx.reference_no && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Ref #</Typography>
                <Typography variant="body2" fontFamily="monospace">{tx.reference_no}</Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

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

// ==================== STAT CARD COMPONENT ====================
const StatCard = React.memo(({ title, amount, icon, color, isMobile }) => (
  <Card sx={{ height: '100%', bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
      <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2} alignItems={isMobile ? 'flex-start' : 'center'}>
        <Box sx={{ p: 1.2, bgcolor: '#e8eaf6', borderRadius: 2, color: '#1c2580', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.primary" fontWeight={600} sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{title}</Typography>
          <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.1rem' : '1.35rem', lineHeight: 1.2 }}>{formatCurrency(amount)}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
));

// ==================== MAIN COMPONENT ====================
export default function AccountsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  // Financial Data State
  const [dateFrom, setDateFrom] = useState(getStartOfMonth);
  const [dateTo, setDateTo] = useState(getToday);
  const [financialData, setFinancialData] = useState(null);
  const [financialError, setFinancialError] = useState(null);

  // Ledger Filters
  const [ledgerFilterType, setLedgerFilterType] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState(getStartOfMonth);
  const [ledgerTo, setLedgerTo] = useState(getToday);

  // Account Filters
  const [searchAccount, setSearchAccount] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTxAccount, setFilterTxAccount] = useState('');
  const [filterTxType, setFilterTxType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(getStartOfMonth());
  const [filterDateTo, setFilterDateTo] = useState(getToday());
  const [showFilters, setShowFilters] = useState(false);

  // Account Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

  // Transactions Pagination
  const [txPage, setTxPage] = useState(1);
  const [txRowsPerPage, setTxRowsPerPage] = useState(25);
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txRowsPerPage;
    return transactions.slice(start, start + txRowsPerPage);
  }, [transactions, txPage, txRowsPerPage]);

  // Trial Balance Pagination
  const [trialPage, setTrialPage] = useState(0);
  const [trialRowsPerPage, setTrialRowsPerPage] = useState(25);
  const [expandedRows, setExpandedRows] = useState({});

  // Stats
  const [stats, setStats] = useState({ totalAccounts: 0, totalBalance: 0, todayCredits: 0, todayDebits: 0 });

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ==================== DIALOGS ====================
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', account_number: '', bank_name: '', opening_balance: 0, status: 'active' });

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [transferDialog, setTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', amount: '', description: '', date: getToday() });

  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ account_id: '', new_balance: '', reason: '', date: getToday() });

  const [openingDialog, setOpeningDialog] = useState(false);
  const [openingForm, setOpeningForm] = useState({ account_id: '', opening_balance: '', date: getToday(), notes: '' });

  const [statementDialog, setStatementDialog] = useState(false);
  const [statementAccount, setStatementAccount] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [statementFrom, setStatementFrom] = useState(getStartOfMonth());
  const [statementTo, setStatementTo] = useState(getToday());

  const [ledgerEntryDialog, setLedgerEntryDialog] = useState(false);
  const [ledgerEntryForm, setLedgerEntryForm] = useState({ account_id: '', date: getToday(), type: 'debit', amount: '', description: '', payment_mode: 'cash', reference_no: '' });

  // ==================== HELPER FUNCTIONS ====================
  const getDateRange = useCallback(() => {
    const from = new Date(dateFrom); 
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); 
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [dateFrom, dateTo]);

  // ==================== BULLETPROOF LOAD GENERAL LEDGER ====================
  const loadGeneralLedger = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];

      // Strategy 1: Try db.getGeneralLedger if available
      if (db && typeof db.getGeneralLedger === 'function') {
        try {
          const filters = {};
          if (ledgerFilterType) filters.payment_mode = ledgerFilterType;
          if (ledgerFrom) filters.fromDate = ledgerFrom;
          if (ledgerTo) filters.toDate = ledgerTo;
          data = await db.getGeneralLedger(filters);
        } catch (dbErr) {
          console.warn('[Accounts] db.getGeneralLedger failed, trying fallback...', dbErr.message);
        }
      }

      // Strategy 2: Try db.getAllGeneralLedger
      if ((!data || !data.length) && db && typeof db.getAllGeneralLedger === 'function') {
        try {
          data = await db.getAllGeneralLedger();
        } catch (dbErr) {
          console.warn('[Accounts] db.getAllGeneralLedger failed, trying IndexedDB fallback...', dbErr.message);
        }
      }

      // Strategy 3: Direct IndexedDB fallback (BULLETPROOF)
      if (!data || !data.length) {
        data = await safeIdbQuery('general_ledger', []);
      }

      const arr = Array.isArray(data) ? data : [];

      // Client-side date filter as backup
      const filtered = arr.filter(entry => {
        if (!ledgerFrom && !ledgerTo) return true;
        const d = new Date(entry.date || entry.created_at || 0);
        const from = ledgerFrom ? new Date(ledgerFrom) : new Date('2000-01-01');
        const to = ledgerTo ? new Date(ledgerTo) : new Date('2099-12-31');
        to.setHours(23, 59, 59, 999);
        return d >= from && d <= to;
      });

      // Payment mode filter
      const finalData = ledgerFilterType 
        ? filtered.filter(e => String(e.payment_mode || '').toLowerCase() === ledgerFilterType.toLowerCase())
        : filtered;

      setLedgerData(finalData);
    } catch (err) {
      console.error('[Accounts] Ledger load error:', err);
      setSnackbar({ open: true, message: 'Ledger load failed: ' + err.message, severity: 'error' });
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  }, [ledgerFilterType, ledgerFrom, ledgerTo]);

  // ==================== BULLETPROOF LOAD ACCOUNT DATA ====================
  // ==================== BULLETPROOF LOAD ACCOUNT DATA ====================
  const loadAccountData = useCallback(async () => {
    setLoading(true);
    try {
      let allAccounts = [];
      if (db && typeof db.getAccounts === 'function') {
        allAccounts = await db.getAccounts().catch(() => []);
      }
      if (!allAccounts || !allAccounts.length) {
        allAccounts = await safeIdbQuery('accounts', []);
      }

      const activeAccounts = (allAccounts || []).filter(a => !a.is_deleted);
      setAccounts(activeAccounts);

      const totalBalance = activeAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
      setStats(prev => ({ ...prev, totalAccounts: activeAccounts.length, totalBalance }));

      const txFilters = {};
      if (filterTxAccount) txFilters.accountId = filterTxAccount;
      if (filterTxType) txFilters.type = filterTxType;
      if (filterDateFrom) txFilters.fromDate = filterDateFrom;
      if (filterDateTo) txFilters.toDate = filterDateTo;

      let allTransactions = [];

      if (filterTxAccount) {
        let txs = [];
        if (db && typeof db.getAccountTransactions === 'function') {
          txs = await db.getAccountTransactions(filterTxAccount, txFilters).catch(() => []);
        }
        if (!txs || !txs.length) {
          const allTxs = await safeIdbQuery('account_transactions', []);
          txs = allTxs.filter(t => String(t.account_id) === String(filterTxAccount));
        }
        const acc = activeAccounts.find(a => String(a.id) === String(filterTxAccount));
        allTransactions = (txs || []).map(t => ({ ...t, account_name: acc?.name || `Account #${filterTxAccount}` }));
      } else {
        // Fast batch load in a single query
        let allTxs = [];
        if (db && typeof db.getAllAccountTransactions === 'function') {
          allTxs = await db.getAllAccountTransactions().catch(() => []);
        }
        if (!allTxs || !allTxs.length) {
          allTxs = await safeIdbQuery('account_transactions', []);
        }
        const accMap = new Map(activeAccounts.map(a => [String(a.id), a.name]));
        allTransactions = (allTxs || [])
          .filter(t => {
            if (filterTxType && t.transaction_type !== filterTxType) return false;
            if (filterDateFrom && String(t.date || '').substring(0, 10) < filterDateFrom) return false;
            if (filterDateTo && String(t.date || '').substring(0, 10) > filterDateTo) return false;
            return true;
          })
          .map(t => ({
            ...t,
            account_name: accMap.get(String(t.account_id)) || `Account #${t.account_id}`
          }));
        allTransactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      }

      setTransactions(allTransactions);

      const todayStr = getToday();
      let todayCredits = 0, todayDebits = 0;
      const todayTxs = allTransactions.filter(t => String(t.date || '').substring(0, 10) === todayStr);
      todayTxs.forEach(t => {
        if (t.transaction_type === 'credit') todayCredits += Number(t.amount || 0);
        else todayDebits += Number(t.amount || 0);
      });

      setStats({ totalAccounts: activeAccounts.length, totalBalance, todayCredits, todayDebits });
    } catch (err) {
      console.error('[Accounts] Load error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filterTxAccount, filterTxType, filterDateFrom, filterDateTo]);

  // ==================== BULLETPROOF LOAD FINANCIAL DATA ====================
  const loadFinancialData = useCallback(async () => {
    setFinancialLoading(true);
    setFinancialError(null);

    try {
      const safeDbCall = async (methodName, storeName) => {
        if (db && typeof db[methodName] === 'function') {
          try { return await db[methodName](); } catch (e) { /* fallback */ }
        }
        return safeIdbQuery(storeName, []);
      };

      const results = await Promise.allSettled([
        safeDbCall('getSalesHistory', 'sales'),
        safeDbCall('getPurchases', 'purchases'),
        safeDbCall('getExpenses', 'expenses'),
        safeDbCall('getAllVariants', 'product_variants'),
        safeDbCall('getCustomers', 'customers'),
        safeDbCall('getSuppliers', 'suppliers'),
        safeDbCall('getAllSaleItems', 'sale_items')
      ]);

      const [salesResult, purchasesResult, expensesResult, variantsResult, customersResult, suppliersResult, saleItemsResult] = results;

      const sales = salesResult.status === 'fulfilled' ? (salesResult.value || []) : [];
      const purchases = purchasesResult.status === 'fulfilled' ? (purchasesResult.value || []) : [];
      const expenses = expensesResult.status === 'fulfilled' ? (expensesResult.value || []) : [];
      const variants = variantsResult.status === 'fulfilled' ? (variantsResult.value || []) : [];
      const customers = customersResult.status === 'fulfilled' ? (customersResult.value || []) : [];
      const suppliers = suppliersResult.status === 'fulfilled' ? (suppliersResult.value || []) : [];
      const saleItems = saleItemsResult.status === 'fulfilled' ? (saleItemsResult.value || []) : [];

      const { from, to } = getDateRange();
      const inRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d >= from && d <= to;
      };

      const periodSales = sales.filter(s => !s.is_deleted && inRange(s.date));
      const periodPurchases = purchases.filter(p => !p.is_deleted && inRange(p.purchase_date || p.date));
      const periodExpenses = expenses.filter(e => !e.is_deleted && inRange(e.date));

      const saleMap = new Map(sales.filter(s => !s.is_deleted).map(s => [s.id, s]));
      const periodSaleItems = saleItems.filter(si => {
        const sale = saleMap.get(si.sale_id);
        return sale && !sale.is_deleted && inRange(sale.date);
      });

      const accountsMap = CHART_OF_ACCOUNTS.reduce((acc, a) => {
        acc[a.code] = { ...a, debit: 0, credit: 0 };
        return acc;
      }, {});

      // SALES
      periodSales.forEach(s => {
        const total = Number(s.grand_total || 0);
        const paid = Number(s.paid_amount || 0);
        const due = Number(s.due_amount || 0);
        accountsMap['4001'].credit += total;
        if (['cash', 'cod', 'cash_on_delivery'].includes(s.payment_mode)) {
          accountsMap['1001'].debit += paid;
        } else {
          accountsMap['1002'].debit += paid;
        }
        if (due > 0) accountsMap['1101'].debit += due;
      });

      // PURCHASES
      periodPurchases.forEach(p => {
        const total = Number(p.grand_total || 0);
        const paid = Number(p.paid_amount || 0);
        accountsMap['1102'].debit += total;
        accountsMap['1001'].credit += paid;
        const unpaid = total - paid;
        if (unpaid > 0) accountsMap['2001'].credit += unpaid;
      });

      // EXPENSES
      periodExpenses.forEach(e => {
        const amt = Number(e.amount || 0);
        accountsMap['6008'].debit += amt;
        accountsMap['1001'].credit += amt;
      });

      // COGS (Perpetual Inventory)
      const cogs = periodSaleItems.reduce((sum, si) => {
        const variant = variants.find(v => String(v.id) === String(si.product_variant_id));
        return sum + (variant ? (Number(variant.purchase_price || 0) * Number(si.quantity || 0)) : 0);
      }, 0);
      accountsMap['5001'].debit += cogs;
      accountsMap['1102'].credit += cogs;

      // INVENTORY ADJUSTMENT (Physical vs Expected)
      const expectedInventory = accountsMap['1102'].debit - accountsMap['1102'].credit;
      const physicalInventory = variants.reduce((sum, v) => {
        return sum + (Number(v.current_stock || 0) * Number(v.purchase_price || 0));
      }, 0);
      const adjustment = physicalInventory - expectedInventory;
      if (adjustment > 0.01) {
        accountsMap['1102'].debit += adjustment;
      } else if (adjustment < -0.01) {
        accountsMap['1102'].credit += Math.abs(adjustment);
      }

      // NET INCOME
      const revenue = accountsMap['4001'].credit;
      const cogsVal = accountsMap['5001'].debit;
      const expVal = accountsMap['6008'].debit;
      const netIncome = revenue - cogsVal - expVal;

      accountsMap['3002'].credit = netIncome > 0 ? netIncome : 0;
      if (netIncome < 0) accountsMap['3002'].debit = Math.abs(netIncome);

      // EQUITY
      const totalAssets = (accountsMap['1001'].debit - accountsMap['1001'].credit) 
                        + (accountsMap['1002'].debit - accountsMap['1002'].credit) 
                        + (accountsMap['1101'].debit - accountsMap['1101'].credit) 
                        + (accountsMap['1102'].debit - accountsMap['1102'].credit);

      const totalLiabilities = accountsMap['2001'].credit - accountsMap['2001'].debit;
      const totalEquity = totalAssets - totalLiabilities;
      const retainedEarnings = accountsMap['3002'].credit - accountsMap['3002'].debit;
      const ownerCapital = totalEquity - retainedEarnings;

      accountsMap['3001'].credit = ownerCapital > 0 ? ownerCapital : 0;
      if (ownerCapital < 0) accountsMap['3001'].debit = Math.abs(ownerCapital);

      // TRIAL BALANCE
      const trial = Object.values(accountsMap)
        .map(acc => {
          const net = acc.normal_balance === 'debit' ? (acc.debit - acc.credit) : (acc.credit - acc.debit);
          return { ...acc, net };
        })
        .filter(acc => acc.debit !== 0 || acc.credit !== 0);

      const totalDebit = trial.reduce((s, a) => s + a.debit, 0);
      const totalCredit = trial.reduce((s, a) => s + a.credit, 0);

      setFinancialData({
        trial, totalDebit, totalCredit,
        balanceSheet: {
          assets: [
            { name: 'Cash in Hand', code: '1001', amount: accountsMap['1001'].debit - accountsMap['1001'].credit },
            { name: 'Bank Account', code: '1002', amount: accountsMap['1002'].debit - accountsMap['1002'].credit },
            { name: 'Accounts Receivable', code: '1101', amount: accountsMap['1101'].debit - accountsMap['1101'].credit },
            { name: 'Inventory', code: '1102', amount: accountsMap['1102'].debit - accountsMap['1102'].credit },
          ],
          liabilities: [
            { name: 'Accounts Payable', code: '2001', amount: accountsMap['2001'].credit - accountsMap['2001'].debit },
          ],
          equity: [
            { name: "Owner's Capital", code: '3001', amount: accountsMap['3001'].credit - accountsMap['3001'].debit },
            { name: 'Retained Earnings', code: '3002', amount: accountsMap['3002'].credit - accountsMap['3002'].debit },
          ]
        },
        pnl: { revenue, cogs: cogsVal, expenses: expVal, netIncome },
        summary: {
          totalAssets, totalLiabilities, totalEquity,
          cash: accountsMap['1001'].debit - accountsMap['1001'].credit,
          bank: accountsMap['1002'].debit - accountsMap['1002'].credit,
          receivables: accountsMap['1101'].debit - accountsMap['1101'].credit,
          inventory: accountsMap['1102'].debit - accountsMap['1102'].credit,
          payables: accountsMap['2001'].credit - accountsMap['2001'].debit,
        }
      });
      setTrialPage(0);
    } catch (err) {
      console.error('[Accounts] Financial load error:', err);
      setFinancialError(err.message);
      setSnackbar({ open: true, message: 'Financial data error: ' + err.message, severity: 'error' });
    } finally {
      setFinancialLoading(false);
    }
  }, [dateFrom, dateTo, getDateRange]);

  // ==================== LOAD ALL DATA ====================
  const loadAllData = useCallback(async () => {
    await Promise.all([loadAccountData(), loadFinancialData()]);
  }, [loadAccountData, loadFinancialData]);

  // ==================== EFFECTS ====================
  useEffect(() => { loadAccountData(); }, [loadAccountData]);
  useSyncListener(loadAllData);

  useEffect(() => {
    if (activeTab === 7) loadGeneralLedger();
    else if (activeTab >= 1 && activeTab <= 6) {
      loadFinancialData();
    }
  }, [activeTab, loadGeneralLedger, loadFinancialData]);

  useEffect(() => {
    const timer = setTimeout(() => loadFinancialData(), 600);
    return () => clearTimeout(timer);
  }, [loadFinancialData]);

  // ==================== ACCOUNT CRUD ====================
  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({ name: '', type: 'cash', account_number: '', bank_name: '', opening_balance: 0, status: 'active' });
    setAccountDialog(true);
  };

  const openEditAccount = (account) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name || '', type: account.type || 'cash',
      account_number: account.account_number || '', bank_name: account.bank_name || '',
      opening_balance: account.opening_balance || 0, status: account.status || 'active'
    });
    setAccountDialog(true);
  };

  const handleSaveAccount = async () => {
    try {
      if (!accountForm.name.trim()) throw new Error('Account name is required');
      if (!accountForm.type) throw new Error('Account type is required');
      const data = { ...accountForm, opening_balance: Number(accountForm.opening_balance) || 0, name: accountForm.name.trim() };
      if (editingAccount) {
        await db.updateAccount(editingAccount.id, data);
        setSnackbar({ open: true, message: 'Account updated!', severity: 'success' });
      } else {
        await db.createAccount(data);
        setSnackbar({ open: true, message: 'Account created!', severity: 'success' });
      }
      setAccountDialog(false);
      loadAccountData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDeleteAccount = (account) => { setDeleteTarget(account); setDeleteDialog(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await db.deleteAccount(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.name}" deleted!`, severity: 'success' });
      setDeleteDialog(false); setDeleteTarget(null);
      loadAccountData();
    } catch (err) {
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== TRANSFER ====================
  const openTransfer = () => {
    setTransferForm({ from_account_id: '', to_account_id: '', amount: '', description: '', date: getToday() });
    setTransferDialog(true);
  };

  const handleTransfer = async () => {
    try {
      if (!transferForm.from_account_id) throw new Error('Select source account');
      if (!transferForm.to_account_id) throw new Error('Select destination account');
      if (transferForm.from_account_id === transferForm.to_account_id) throw new Error('Cannot transfer to same account');
      const amount = Number(transferForm.amount);
      if (!amount || amount <= 0) throw new Error('Enter valid amount');
      await db.transferBetweenAccounts({
        from_account_id: transferForm.from_account_id, to_account_id: transferForm.to_account_id,
        amount, description: transferForm.description || 'Account transfer', date: transferForm.date || new Date().toISOString()
      });
      setSnackbar({ open: true, message: `Transferred ${formatCurrency(amount)}!`, severity: 'success' });
      setTransferDialog(false);
      loadAllData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // ==================== ADJUST BALANCE ====================
  const openAdjust = (account) => {
    setAdjustForm({ account_id: account.id, new_balance: account.current_balance || 0, reason: '', date: getToday() });
    setAdjustDialog(true);
  };

  const handleAdjust = async () => {
    try {
      const newBalance = Number(adjustForm.new_balance);
      if (!Number.isFinite(newBalance)) throw new Error('Enter valid balance');
      await db.adjustAccountBalance({
        account_id: adjustForm.account_id, new_balance: newBalance,
        reason: adjustForm.reason || 'Manual adjustment', date: adjustForm.date || new Date().toISOString()
      });
      setSnackbar({ open: true, message: 'Balance adjusted!', severity: 'success' });
      setAdjustDialog(false);
      loadAllData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // ==================== DAILY OPENING BALANCE ====================
  const openSetOpening = (account) => {
    setOpeningForm({ account_id: account.id, opening_balance: account.opening_balance || 0, date: getToday(), notes: '' });
    setOpeningDialog(true);
  };

  const handleSetOpening = async () => {
    try {
      const bal = Number(openingForm.opening_balance);
      if (!Number.isFinite(bal)) throw new Error('Enter valid balance');
      await db.setDailyOpeningBalance({ account_id: openingForm.account_id, opening_balance: bal, date: openingForm.date, notes: openingForm.notes });
      setSnackbar({ open: true, message: 'Daily opening balance set!', severity: 'success' });
      setOpeningDialog(false);
      loadAllData();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // ==================== STATEMENT ====================
  const openStatement = async (account) => {
    setStatementAccount(account);
    setStatementFrom(getStartOfMonth());
    setStatementTo(getToday());
    setStatementData(null);
    setStatementDialog(true);
    loadStatement(account.id, getStartOfMonth(), getToday());
  };

  const loadStatement = async (accountId, from, to) => {
    try {
      let data = null;
      if (db && typeof db.getAccountStatement === 'function') {
        data = await db.getAccountStatement(accountId, from, to);
      }
      if (Array.isArray(data)) {
        const opening = 0;
        const totalCredits = data.filter(t => t.type === 'credit' || t.transaction_type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalDebits = data.filter(t => t.type === 'debit' || t.transaction_type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
        const closing = opening + totalCredits - totalDebits;
        data = { opening_balance: opening, closing_balance: closing, total_credits: totalCredits, total_debits: totalDebits, transactions: data };
      }
      if (!data || !data.transactions) {
        const allTxs = await safeIdbQuery('account_transactions', []);
        const accTxs = allTxs
          .filter(t => String(t.account_id) === String(accountId))
          .filter(t => {
            if (!from && !to) return true;
            const d = new Date(t.date || 0);
            const f = from ? new Date(from) : new Date('2000-01-01');
            const tDate = to ? new Date(to) : new Date('2099-12-31');
            tDate.setHours(23,59,59,999);
            return d >= f && d <= tDate;
          })
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        const opening = accTxs.length > 0 ? (accTxs[0].previous_balance || 0) : 0;
        const totalCredits = accTxs.filter(t => t.transaction_type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalDebits = accTxs.filter(t => t.transaction_type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
        const closing = accTxs.length > 0 ? (accTxs[accTxs.length - 1].balance_after || opening) : opening;
        data = { opening_balance: opening, closing_balance: closing, total_credits: totalCredits, total_debits: totalDebits, transactions: accTxs };
      }
      setStatementData(data);
    } catch (err) {
      setSnackbar({ open: true, message: 'Statement error: ' + err.message, severity: 'error' });
    }
  };

  const handleLoadStatement = () => {
    if (!statementAccount) return;
    loadStatement(statementAccount.id, statementFrom, statementTo);
  };

  // ==================== MANUAL LEDGER ENTRY ====================
  const openLedgerEntry = () => {
    setLedgerEntryForm({ account_id: '', date: getToday(), type: 'debit', amount: '', description: '', payment_mode: 'cash', reference_no: '' });
    setLedgerEntryDialog(true);
  };

  const handleSaveLedgerEntry = async () => {
    try {
      if (!ledgerEntryForm.account_id) throw new Error('Account select karein');
      const amt = Number(ledgerEntryForm.amount);
      if (!amt || amt <= 0) throw new Error('Sahi amount daalein');
      if (!ledgerEntryForm.description.trim()) throw new Error('Reason / Description zaroori hai');
      await db.createTransaction({
        account_id: ledgerEntryForm.account_id, date: ledgerEntryForm.date || new Date().toISOString(),
        transaction_type: ledgerEntryForm.type, amount: amt, description: ledgerEntryForm.description.trim(),
        payment_mode: ledgerEntryForm.payment_mode, reference_no: ledgerEntryForm.reference_no || '', reference_type: 'manual_entry'
      });
      setSnackbar({ open: true, message: `${ledgerEntryForm.type === 'credit' ? 'Incoming (Aaya)' : 'Outgoing (Gaya)'} entry saved!`, severity: 'success' });
      setLedgerEntryDialog(false);
      await loadAllData();
      if (activeTab === 7) loadGeneralLedger();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // ==================== PDF / PRINT ====================
  const handleDownloadPDF = () => {
    if (!statementData || !statementAccount) return;
    const printWindow = window.open('', '_blank');
    const rowsHtml = statementData.transactions.map((tx, i) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${formatDate(tx.date)}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${tx.description || tx.reference_type || '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;color:${tx.transaction_type === 'credit' ? '#10b981' : 'inherit'};">${tx.transaction_type === 'credit' ? formatCurrency(tx.amount) : '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;color:${tx.transaction_type === 'debit' ? '#ef4444' : 'inherit'};">${tx.transaction_type === 'debit' ? formatCurrency(tx.amount) : '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">${formatCurrency(tx.balance_after)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html><head><title>Account Statement — ${statementAccount.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #374151; }
        .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #111827; font-size: 22px; }
        .header p { margin: 5px 0 0; color: #6b7280; font-size: 13px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
        .meta-box { background: #f3f4f6; padding: 10px 15px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #10b981; color: white; text-align: left; padding: 8px; }
        .summary { margin-top: 20px; display: flex; justify-content: space-between; }
        .summary-box { text-align: center; padding: 15px; border-radius: 6px; flex: 1; margin: 0 5px; }
        .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #9ca3af; }
      </style></head><body>
        <div class="header"><h1>ACCOUNT STATEMENT</h1><p>${statementAccount.name} — ${getAccountTypeLabel(statementAccount.type)}</p></div>
        <div class="meta">
          <div class="meta-box"><strong>Period:</strong> ${statementFrom} to ${statementTo}<br><strong>Account #:</strong> ${statementAccount.account_number || 'N/A'}</div>
          <div class="meta-box"><strong>Generated:</strong> ${formatDate(new Date().toISOString())}</div>
        </div>
        <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th style="text-align:right">In (Credit)</th><th style="text-align:right">Out (Debit)</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>
          <tr style="background:#f9fafb;font-weight:bold;"><td colspan="5" style="padding:6px;">Opening Balance</td><td style="text-align:right;padding:6px;">${formatCurrency(statementData.opening_balance)}</td></tr>
          ${rowsHtml}
          <tr style="background:#ecfdf5;font-weight:bold;"><td colspan="3" style="padding:6px;">Closing Balance</td>
            <td style="text-align:right;padding:6px;color:#10b981;">+${formatCurrency(statementData.total_credits)}</td>
            <td style="text-align:right;padding:6px;color:#ef4444;">-${formatCurrency(statementData.total_debits)}</td>
            <td style="text-align:right;padding:6px;">${formatCurrency(statementData.closing_balance)}</td></tr>
        </tbody></table>
        <div class="summary">
          <div class="summary-box" style="background:#ecfdf5;"><div style="font-size:18px;font-weight:bold;color:#10b981;">${formatCurrency(statementData.total_credits)}</div><div style="font-size:11px;color:#065f46;">Total Money In</div></div>
          <div class="summary-box" style="background:#fef2f2;"><div style="font-size:18px;font-weight:bold;color:#ef4444;">${formatCurrency(statementData.total_debits)}</div><div style="font-size:11px;color:#991b1b;">Total Money Out</div></div>
          <div class="summary-box" style="background:#eff6ff;"><div style="font-size:18px;font-weight:bold;color:#3b82f6;">${formatCurrency(statementData.closing_balance)}</div><div style="font-size:11px;color:#1e40af;">Closing Balance</div></div>
        </div>
        <div class="footer">Powered by Raath Developers • This is a computer generated statement.</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // ==================== HANDLERS ====================
  const handleTabChange = (_, newValue) => setActiveTab(newValue);
  const handleTrialPageChange = (_, newPage) => setTrialPage(newPage);
  const handleTrialRowsPerPageChange = (event) => { setTrialRowsPerPage(parseInt(event.target.value, 10)); setTrialPage(0); };
  const toggleExpand = useCallback((code) => { setExpandedRows(prev => ({ ...prev, [code]: !prev[code] })); }, []);

  // ==================== MEMOIZED DATA ====================
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (!searchAccount.trim()) return true;
      return (acc.name || '').toLowerCase().includes(searchAccount.toLowerCase().trim());
    }).filter(acc => !filterType || acc.type === filterType);
  }, [accounts, searchAccount, filterType]);

  const paginatedAccounts = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredAccounts.slice(start, start + rowsPerPage);
  }, [filteredAccounts, page, rowsPerPage]);

  const todayLedgerStats = useMemo(() => {
    const today = getToday();
    const entries = ledgerData.filter(e => String(e.date || '').substring(0, 10) === today);
    const incoming = entries.filter(e => Number(e.credit) > 0).reduce((s, e) => s + Number(e.credit), 0);
    const outgoing = entries.filter(e => Number(e.debit) > 0).reduce((s, e) => s + Number(e.debit), 0);
    const byMode = {};
    entries.forEach(e => {
      const mode = e.payment_mode || 'other';
      if (!byMode[mode]) byMode[mode] = { in: 0, out: 0 };
      if (Number(e.credit) > 0) byMode[mode].in += Number(e.credit);
      if (Number(e.debit) > 0) byMode[mode].out += Number(e.debit);
    });
    return { incoming, outgoing, net: incoming - outgoing, count: entries.length, byMode };
  }, [ledgerData]);

  const paginatedTrial = useMemo(() => {
    if (!financialData) return [];
    return financialData.trial.slice(trialPage * trialRowsPerPage, trialPage * trialRowsPerPage + trialRowsPerPage);
  }, [financialData, trialPage, trialRowsPerPage]);

  const quickStats = financialData ? [
    { title: 'Total Assets', amount: financialData.summary.totalAssets, icon: <AccountBalance />, color: 'primary' },
    { title: 'Total Liabilities', amount: financialData.summary.totalLiabilities, icon: <MoneyOff />, color: 'error' },
    { title: "Owner's Equity", amount: financialData.summary.totalEquity, icon: <TrendingUp />, color: 'success' },
    { title: 'Cash in Hand', amount: financialData.summary.cash, icon: <AttachMoney />, color: 'warning' },
    { title: 'Bank Balance', amount: financialData.summary.bank, icon: <AccountBalanceWallet />, color: 'info' },
    { title: 'Receivables', amount: financialData.summary.receivables, icon: <People />, color: 'secondary' },
    { title: 'Inventory Value', amount: financialData.summary.inventory, icon: <Inventory />, color: 'primary' },
    { title: 'Accounts Payable', amount: financialData.summary.payables, icon: <ShoppingCart />, color: 'error' },
    { title: 'Net Income', amount: financialData.pnl.netIncome, icon: <TrendingUp />, color: financialData.pnl.netIncome >= 0 ? 'success' : 'error' },
  ] : [];

  // ==================== LOADING SKELETON ====================
  if (loading && !accounts.length && !financialData) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ my: 2 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2, maxWidth: 1400, mx: 'auto' }}>

      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
          <AccountBalanceWallet sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
          {isMobile ? 'Accounts' : 'Accounts & Financials'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>Menu</Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>Filters</Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadAllData}>
            {isMobile ? 'Sync' : 'Sync Data'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }} startIcon={<Add />} onClick={openAddAccount}>
            {isMobile ? 'Add' : 'Add Account'}
          </Button>
          <Button variant="outlined" size="small" color="warning" startIcon={<SwapHoriz />} onClick={openTransfer}>
            {isMobile ? 'Transfer' : 'Transfer'}
          </Button>
        </Stack>
      </Box>

      {/* STATS CARDS */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(5, 1fr)'
        },
        gap: isMobile ? 1 : 2,
        mb: 2
      }}>
        {[
          { title: 'Total Accounts', value: stats.totalAccounts },
          { title: 'Total Balance', value: formatCurrency(stats.totalBalance) },
          { title: "Today's In", value: formatCurrency(stats.todayCredits) },
          { title: "Today's Out", value: formatCurrency(stats.todayDebits) },
          { 
            title: 'Net Income', 
            value: financialLoading ? 'Calculating...' : financialData ? formatCurrency(financialData.pnl.netIncome) : '0',
            gridColumn: { xs: 'span 2', sm: 'auto' }
          },
        ].map((item, idx) => (
          <Card key={idx} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...(item.gridColumn ? { gridColumn: item.gridColumn } : {}) }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>{item.title}</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* DATE FILTER FOR FINANCIALS */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
        <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'flex-end'}>
          <Stack direction={isMobile ? 'column' : 'row'} spacing={1} flex={1}>
            <TextField type="date" label="From" size="small" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
            <TextField type="date" label="To" size="small" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent={isMobile ? 'space-between' : 'flex-end'} sx={{ mb: { xs: 0, sm: '1px' } }}>
            <Button variant="contained" startIcon={<Refresh />} onClick={loadFinancialData} disabled={financialLoading} size="small" sx={{ height: 38 }}>
              {financialLoading ? 'Calculating...' : 'Refresh Financials'}
            </Button>
            {!isMobile && <Chip icon={<CalendarToday />} label={`${formatDate(dateFrom)} - ${formatDate(dateTo)}`} variant="outlined" size="small" sx={{ height: 38 }} />}
          </Stack>
        </Stack>
        {isMobile && <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1 }}>{formatDate(dateFrom)} - {formatDate(dateTo)}</Typography>}
      </Paper>

      {/* MAIN TABS */}
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'} sx={{ minHeight: isMobile ? 40 : 48 }}>
          <Tab icon={<AccountBalance fontSize="small" />} label={isMobile ? 'Accounts' : 'Accounts'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<Dashboard fontSize="small" />} label={isMobile ? 'Dash' : 'Dashboard'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<TrendingUp fontSize="small" />} label={isMobile ? 'History' : 'Transactions'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<Receipt fontSize="small" />} label={isMobile ? 'Trial' : 'Trial Balance'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<Assessment fontSize="small" />} label={isMobile ? 'BS' : 'Balance Sheet'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<BarChart fontSize="small" />} label={isMobile ? 'P&L' : 'P&L'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<Visibility fontSize="small" />} label={isMobile ? 'Stmt' : 'Statement'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
          <Tab icon={<MenuBook fontSize="small" />} label={isMobile ? 'GL' : 'General Ledger'} sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }} />
        </Tabs>
      </Paper>

      {/* FILTERS */}
      {showFilters && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-end">
            {activeTab === 0 && (
              <>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Search Account" placeholder="Search account..." value={searchAccount} onChange={(e) => setSearchAccount(e.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} /> }} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Account Type</InputLabel>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Account Type">
                      <MenuItem value="">All Types</MenuItem>
                      {ACCOUNT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            {activeTab === 2 && (
              <>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Account</InputLabel>
                    <Select value={filterTxAccount} onChange={(e) => setFilterTxAccount(e.target.value)} label="Account">
                      <MenuItem value="">All Accounts</MenuItem>
                      {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="From" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="To" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Transaction Type</InputLabel>
                    <Select value={filterTxType} onChange={(e) => setFilterTxType(e.target.value)} label="Transaction Type">
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="credit">Money In (Credit)</MenuItem>
                      <MenuItem value="debit">Money Out (Debit)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      )}

      {/* ==================== TAB 0: ACCOUNTS ==================== */}
      {activeTab === 0 && (
        <Fade in>
          {isMobile ? (
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}><LinearProgress /><Typography sx={{ mt: 2 }}>Loading...</Typography></Box>
              ) : paginatedAccounts.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <AccountBalanceWallet sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No accounts found</Typography>
                </Paper>
              ) : (
                paginatedAccounts.map((acc, idx) => (
                  <MobileAccountCard key={acc.id} account={acc} index={(page - 1) * rowsPerPage + idx + 1}
                    onEdit={openEditAccount} onDelete={handleDeleteAccount} onStatement={openStatement} onSetOpening={openSetOpening} />
                ))
              )}
              <UnifiedPagination
                count={filteredAccounts.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(newR) => {
                  setRowsPerPage(newR);
                  setPage(1);
                }}
              />
            </Box>
          ) : (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Account</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Type</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Details</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Opening</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Current</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Status</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedAccounts.map((acc, idx) => (
                      <TableRow key={acc.id} hover>
                        <TableCell>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold" color="primary">{acc.name}</Typography>
                          {acc.bank_name && <Typography variant="caption" color="text.secondary">{acc.bank_name}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" icon={ACCOUNT_TYPES.find(t => t.value === acc.type)?.icon} label={getAccountTypeLabel(acc.type)} sx={{ bgcolor: getAccountTypeColor(acc.type), color: 'white', height: 22 }} />
                        </TableCell>
                        <TableCell>
                          {acc.account_number && <Typography variant="caption" fontFamily="monospace" display="block">#{acc.account_number}</Typography>}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(acc.opening_balance)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: Number(acc.current_balance) >= 0 ? 'success.main' : 'error.main' }}>
                          {formatCurrency(acc.current_balance)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={acc.status === 'active' ? 'success' : 'default'} label={String(acc.status || 'active').toUpperCase()} sx={{ height: 20 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Statement"><IconButton size="small" sx={{ color: '#f59e0b' }} onClick={() => openStatement(acc)}><Visibility fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Set Opening"><IconButton size="small" color="info" onClick={() => openSetOpening(acc)}><CalendarToday fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Adjust"><IconButton size="small" color="secondary" onClick={() => openAdjust(acc)}><Balance fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Edit"><IconButton size="small" color="primary" onClick={() => openEditAccount(acc)}><Edit fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteAccount(acc)}><Delete fontSize="small" /></IconButton></Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedAccounts.length === 0 && (
                      <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No accounts found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={filteredAccounts.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(newR) => {
                  setRowsPerPage(newR);
                  setPage(1);
                }}
              />
            </Paper>
          )}
        </Fade>
      )}

      {/* ==================== TAB 1: DASHBOARD ==================== */}
      {activeTab === 1 && financialData && (
        <Grid container spacing={isMobile ? 1 : 2}>
          {quickStats.map((stat, idx) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={idx}>
              <StatCard {...stat} isMobile={isMobile} />
            </Grid>
          ))}
        </Grid>
      )}
      {activeTab === 1 && !financialData && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Dashboard sx={{ fontSize: 48, color: '#d1d5db' }} />
          <Typography color="text.secondary">No financial data available. Please refresh.</Typography>
        </Paper>
      )}

      {/* ==================== TAB 2: TRANSACTIONS ==================== */}
      {activeTab === 2 && (
        <Fade in>
          {isMobile ? (
            <Box>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}><LinearProgress /><Typography sx={{ mt: 2 }}>Loading...</Typography></Box>
              ) : transactions.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <TrendingUp sx={{ fontSize: 48, color: '#d1d5db' }} />
                  <Typography color="text.secondary">No transactions found</Typography>
                </Paper>
              ) : (
                transactions.map((tx, idx) => <MobileTransactionCard key={tx.id || idx} tx={tx} index={idx + 1} />)
              )}
            </Box>
          ) : (
            <Paper>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Date</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Account</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Description</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Type</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Amount</TableCell>
                      <TableCell sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedTransactions.map((tx, idx) => (
                      <TableRow key={tx.id || idx} hover>
                        <TableCell>{(txPage - 1) * txRowsPerPage + idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="500">{tx.account_name || `Account #${tx.account_id}`}</Typography>
                          {tx.reference_no && <Typography variant="caption" fontFamily="monospace">{tx.reference_no}</Typography>}
                        </TableCell>
                        <TableCell><Typography variant="body2">{tx.description || tx.reference_type || '-'}</Typography></TableCell>
                        <TableCell>
                          <Chip size="small" color={tx.transaction_type === 'credit' ? 'success' : 'error'} 
                            icon={tx.transaction_type === 'credit' ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                            label={tx.transaction_type === 'credit' ? 'IN' : 'OUT'} sx={{ height: 20, fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: tx.transaction_type === 'credit' ? 'success.main' : 'error.main' }}>
                          {tx.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tx.balance_after)}</TableCell>
                      </TableRow>
                    ))}
                    {transactions.length === 0 && (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No transactions found</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <UnifiedPagination
                count={transactions.length}
                page={txPage}
                rowsPerPage={txRowsPerPage}
                onPageChange={setTxPage}
                onRowsPerPageChange={(newR) => {
                  setTxRowsPerPage(newR);
                  setTxPage(1);
                }}
              />
            </Paper>
          )}
        </Fade>
      )}

      {/* ==================== TAB 3: TRIAL BALANCE ==================== */}
      {activeTab === 3 && financialData && (
        <TableContainer component={Paper}>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontSize: isMobile ? '0.7rem' : '0.875rem' }}>Account</TableCell>
                {!isMobile && <><TableCell sx={{ color: 'white' }}>Type</TableCell><TableCell sx={{ color: 'white' }} align="right">Debit</TableCell><TableCell sx={{ color: 'white' }} align="right">Credit</TableCell></>}
                <TableCell sx={{ color: 'white' }} align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isMobile ? (
                paginatedTrial.map(acc => <MobileTrialRow key={acc.code} acc={acc} expanded={expandedRows} onToggle={toggleExpand} />)
              ) : (
                paginatedTrial.map(acc => (
                  <TableRow key={acc.code} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{acc.code}</Typography>
                      <Typography variant="caption" color="text.secondary">{acc.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={acc.type} size="small" color={
                        acc.type === 'asset' ? 'primary' : acc.type === 'liability' ? 'error' : acc.type === 'equity' ? 'success' : acc.type === 'revenue' ? 'info' : 'warning'
                      } sx={{ height: 20, fontSize: '0.6rem' }} />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(acc.debit)}</TableCell>
                    <TableCell align="right">{formatCurrency(acc.credit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: acc.net >= 0 ? 'success.main' : 'error.main' }}>{formatCurrency(acc.net)}</TableCell>
                  </TableRow>
                ))
              )}
              {paginatedTrial.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8 }}><Typography color="text.secondary">No trial balance data</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <UnifiedPagination
            count={financialData.trial.length}
            page={trialPage}
            rowsPerPage={trialRowsPerPage}
            isZeroBased={true}
            onPageChange={handleTrialPageChange}
            onRowsPerPageChange={handleTrialRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid #e5e7eb' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight="bold">Total Debit</Typography>
              <Typography variant="subtitle2" fontWeight="bold" color="primary">{formatCurrency(financialData.totalDebit)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">Total Credit</Typography>
              <Typography variant="subtitle2" fontWeight="bold" color="primary">{formatCurrency(financialData.totalCredit)}</Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight="bold">Difference</Typography>
              <Typography variant="subtitle1" fontWeight="bold" color={Math.abs(financialData.totalDebit - financialData.totalCredit) < 0.01 ? 'success.main' : 'error.main'}>
                {formatCurrency(Math.abs(financialData.totalDebit - financialData.totalCredit))}
              </Typography>
            </Stack>
          </Box>
        </TableContainer>
      )}
      {activeTab === 3 && !financialData && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Assessment sx={{ fontSize: 48, color: '#d1d5db' }} />
          <Typography color="text.secondary">No trial balance data available. Please refresh.</Typography>
        </Paper>
      )}

      {/* ==================== TAB 4: BALANCE SHEET ==================== */}
      {activeTab === 4 && financialData && (
        <Fade in>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, height: '100%' }}>
                <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
                  <AccountBalance sx={{ verticalAlign: 'middle', mr: 1 }} />Assets
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {financialData.balanceSheet.assets.map(item => (
                  <Stack key={item.code} direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #f3f4f6' }}>
                    <Typography variant="body2">
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1 }}>{item.code}</Typography>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color={item.amount >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(item.amount)}</Typography>
                  </Stack>
                ))}
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'primary.light', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight="bold" color="primary.dark">Total Assets</Typography>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary.dark">{formatCurrency(financialData.summary.totalAssets)}</Typography>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, height: '100%' }}>
                <Typography variant="h6" fontWeight="bold" color="error" gutterBottom>
                  <MoneyOff sx={{ verticalAlign: 'middle', mr: 1 }} />Liabilities
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {financialData.balanceSheet.liabilities.map(item => (
                  <Stack key={item.code} direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #f3f4f6' }}>
                    <Typography variant="body2">
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1 }}>{item.code}</Typography>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color={item.amount >= 0 ? 'error.main' : 'success.main'}>{formatCurrency(item.amount)}</Typography>
                  </Stack>
                ))}
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'error.light', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight="bold" color="error.dark">Total Liabilities</Typography>
                    <Typography variant="subtitle2" fontWeight="bold" color="error.dark">{formatCurrency(financialData.summary.totalLiabilities)}</Typography>
                  </Stack>
                </Box>
                <Typography variant="h6" fontWeight="bold" color="success" gutterBottom sx={{ mt: 3 }}>
                  <TrendingUp sx={{ verticalAlign: 'middle', mr: 1 }} />Equity
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {financialData.balanceSheet.equity.map(item => (
                  <Stack key={item.code} direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #f3f4f6' }}>
                    <Typography variant="body2">
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1 }}>{item.code}</Typography>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color={item.amount >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(item.amount)}</Typography>
                  </Stack>
                ))}
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight="bold" color="success.dark">Total Equity</Typography>
                    <Typography variant="subtitle2" fontWeight="bold" color="success.dark">{formatCurrency(financialData.summary.totalEquity)}</Typography>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: isMobile ? 1.5 : 2, bgcolor: 'grey.50' }}>
                <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="h6" fontWeight="bold">Accounting Equation</Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Assets ({formatCurrency(financialData.summary.totalAssets)}) = Liabilities ({formatCurrency(financialData.summary.totalLiabilities)}) + Equity ({formatCurrency(financialData.summary.totalEquity)})
                  </Typography>
                  <Chip label={Math.abs(financialData.summary.totalAssets - (financialData.summary.totalLiabilities + financialData.summary.totalEquity)) < 0.01 ? 'Balanced' : 'Unbalanced'} 
                    color={Math.abs(financialData.summary.totalAssets - (financialData.summary.totalLiabilities + financialData.summary.totalEquity)) < 0.01 ? 'success' : 'error'} size="small" />
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Fade>
      )}
      {activeTab === 4 && !financialData && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AccountBalance sx={{ fontSize: 48, color: '#d1d5db' }} />
          <Typography color="text.secondary">No balance sheet data available. Please refresh.</Typography>
        </Paper>
      )}

      {/* ==================== TAB 5: P&L ==================== */}
      {activeTab === 5 && financialData && (
        <Fade in>
          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: isMobile ? 1.5 : 2 }}>
                <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
                  <BarChart sx={{ verticalAlign: 'middle', mr: 1 }} />Profit & Loss Statement
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack direction="row" justifyContent="space-between" sx={{ py: 1.5, borderBottom: '1px solid #e5e7eb' }}>
                  <Typography variant="body1" fontWeight="medium">Sales Revenue</Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">{formatCurrency(financialData.pnl.revenue)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ py: 1.5, borderBottom: '1px solid #e5e7eb' }}>
                  <Typography variant="body1" fontWeight="medium">Cost of Goods Sold</Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">-{formatCurrency(financialData.pnl.cogs)}</Typography>
                </Stack>
                <Box sx={{ py: 1.5, bgcolor: 'grey.50', px: 2, my: 1, borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1" fontWeight="bold">Gross Profit</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">{formatCurrency(financialData.pnl.revenue - financialData.pnl.cogs)}</Typography>
                  </Stack>
                </Box>
                <Stack direction="row" justifyContent="space-between" sx={{ py: 1.5, borderBottom: '1px solid #e5e7eb' }}>
                  <Typography variant="body1" fontWeight="medium">Operating Expenses</Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">-{formatCurrency(financialData.pnl.expenses)}</Typography>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ py: 2, bgcolor: financialData.pnl.netIncome >= 0 ? 'success.light' : 'error.light', px: 2, borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight="bold" color={financialData.pnl.netIncome >= 0 ? 'success.dark' : 'error.dark'}>
                      Net {financialData.pnl.netIncome >= 0 ? 'Profit' : 'Loss'}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={financialData.pnl.netIncome >= 0 ? 'success.dark' : 'error.dark'}>
                      {formatCurrency(Math.abs(financialData.pnl.netIncome))}
                    </Typography>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={isMobile ? 1 : 2}>
                <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Gross Margin</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#1c2580">
                      {financialData.pnl.revenue > 0 ? ((financialData.pnl.revenue - financialData.pnl.cogs) / financialData.pnl.revenue * 100).toFixed(1) : 0}%
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Net Margin</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#1c2580">
                      {financialData.pnl.revenue > 0 ? (financialData.pnl.netIncome / financialData.pnl.revenue * 100).toFixed(1) : 0}%
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Revenue</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#1c2580">{formatCurrency(financialData.pnl.revenue)}</Typography>
                  </CardContent>
                </Card>
                <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }}>Total Costs</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#1c2580">{formatCurrency(financialData.pnl.cogs + financialData.pnl.expenses)}</Typography>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Fade>
      )}
      {activeTab === 5 && !financialData && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <BarChart sx={{ fontSize: 48, color: '#d1d5db' }} />
          <Typography color="text.secondary">No P&L data available. Please refresh.</Typography>
        </Paper>
      )}

      {/* ==================== TAB 6: STATEMENT ==================== */}
      {activeTab === 6 && (
        <Fade in>
          <Paper sx={{ p: isMobile ? 1.5 : 2 }}>
            <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
              <Visibility sx={{ verticalAlign: 'middle', mr: 1 }} />Account Statements
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select an account to view its detailed statement, or click the Statement button on any account in the Accounts tab.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={isMobile ? 1 : 2}>
              {accounts.map(acc => (
                <Grid item xs={12} sm={6} md={4} key={acc.id}>
                  <Card sx={{ borderLeft: `4px solid ${getAccountTypeColor(acc.type)}`, cursor: 'pointer' }} onClick={() => openStatement(acc)}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">{acc.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{getAccountTypeLabel(acc.type)}</Typography>
                        </Box>
                        <Typography variant="subtitle1" fontWeight="bold" color={Number(acc.current_balance) >= 0 ? 'success.main' : 'error.main'}>
                          {formatCurrency(acc.current_balance)}
                        </Typography>
                      </Stack>
                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button size="small" startIcon={<Visibility />} sx={{ color: '#f59e0b' }}>View Statement</Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {accounts.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <AccountBalanceWallet sx={{ fontSize: 48, color: '#d1d5db' }} />
                    <Typography color="text.secondary">No accounts available</Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Fade>
      )}

      {/* ==================== TAB 7: GENERAL LEDGER ==================== */}
      {activeTab === 7 && (
        <Fade in>
          <Box>
            <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb' }}>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'center'}>
                <FormControl fullWidth={isMobile} size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Account Type</InputLabel>
                  <Select value={ledgerFilterType} onChange={(e) => setLedgerFilterType(e.target.value)} label="Account Type">
                    <MenuItem value="">All Types</MenuItem>
                    {ACCOUNT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField type="date" label="From" size="small" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
                <TextField type="date" label="To" size="small" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
                <Button variant="contained" startIcon={<Refresh />} onClick={loadGeneralLedger} disabled={loading} fullWidth={isMobile}>Load Ledger</Button>
                <Button variant="contained" startIcon={<Add />} onClick={openLedgerEntry} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} fullWidth={isMobile}>Add Entry</Button>
              </Stack>
            </Paper>

            {/* END OF DAY SUMMARY */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50', border: '1px solid #e5e7eb' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                End of Day Summary — {formatDate(new Date().toISOString()).split(',')[0]}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Aaj Kitna Aaya (Incoming)</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{formatCurrency(todayLedgerStats.incoming)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Aaj Kitna Gaya (Outgoing)</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{formatCurrency(todayLedgerStats.outgoing)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Net Position</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{formatCurrency(todayLedgerStats.net)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Total Entries (Aaj)</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>{todayLedgerStats.count}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              {Object.keys(todayLedgerStats.byMode).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" gutterBottom>Payment Mode Breakdown (Aaj ka):</Typography>
                  <Grid container spacing={1}>
                    {Object.entries(todayLedgerStats.byMode).map(([mode, vals]) => (
                      <Grid item xs={6} md={4} key={mode}>
                        <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{mode}</Typography>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="success.main" fontWeight="bold">+{formatCurrency(vals.in)}</Typography>
                            <Typography variant="body2" color="error.main" fontWeight="bold">-{formatCurrency(vals.out)}</Typography>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Paper>

            {loading && <LinearProgress sx={{ mb: 2 }} />}

            {ledgerData.length > 0 && (
              <Paper>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    <MenuBook sx={{ verticalAlign: 'middle', mr: 1 }} />General Ledger
                  </Typography>
                  <Chip label={`${ledgerData.length} entries`} size="small" color="primary" />
                </Box>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>Account</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>Mode</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>Ref</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }} align="right">Debit</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }} align="right">Credit</TableCell>
                        <TableCell sx={{ bgcolor: '#8b5cf6', color: 'white', fontWeight: 'bold' }} align="right">Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ledgerData.map((entry, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(entry.date)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="500">{entry.account_name || entry.account_id}</Typography>
                            <Typography variant="caption" color="text.secondary">{getAccountTypeLabel(entry.account_type)}</Typography>
                          </TableCell>
                          <TableCell><Typography variant="body2">{entry.description || entry.reference_type || '-'}</Typography></TableCell>
                          <TableCell>
                            <Chip size="small" label={entry.payment_mode || '-'} sx={{ height: 20, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: getAccountTypeColor(entry.payment_mode) + '22', color: getAccountTypeColor(entry.payment_mode), border: `1px solid ${getAccountTypeColor(entry.payment_mode)}` }} />
                          </TableCell>
                          <TableCell><Typography variant="caption" fontFamily="monospace">{entry.reference_no || '-'}</Typography></TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(entry.running_balance || entry.balance_after)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {ledgerData.length === 0 && !loading && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <MenuBook sx={{ fontSize: 48, color: '#d1d5db' }} />
                <Typography color="text.secondary" gutterBottom>No ledger entries found</Typography>
                <Typography variant="caption" color="text.secondary">Select filters and click Load Ledger to view entries</Typography>
              </Paper>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== DIALOGS ==================== */}

      {/* Account Dialog */}
      <Dialog open={accountDialog} onClose={() => setAccountDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Add New Account'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Account Name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })} label="Account Type">
                  {ACCOUNT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={accountForm.status} onChange={(e) => setAccountForm({ ...accountForm, status: e.target.value })} label="Status">
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Account Number / IBAN" value={accountForm.account_number} onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Bank Name" value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Opening Balance" type="number" value={accountForm.opening_balance} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccount} disabled={!accountForm.name.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete account <strong>"{deleteTarget?.name}"</strong>?</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            This action cannot be undone. All associated transactions will be preserved but marked.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialog} onClose={() => setTransferDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle><SwapHoriz sx={{ verticalAlign: 'middle', mr: 1 }} />Transfer Between Accounts</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>From Account</InputLabel>
                <Select value={transferForm.from_account_id} onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })} label="From Account">
                  {accounts.filter(a => a.status === 'active').map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.current_balance)})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>To Account</InputLabel>
                <Select value={transferForm.to_account_id} onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })} label="To Account">
                  {accounts.filter(a => a.status === 'active').map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.current_balance)})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount" type="number" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleTransfer} disabled={!transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount}>Transfer</Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustDialog} onClose={() => setAdjustDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle><Balance sx={{ verticalAlign: 'middle', mr: 1 }} />Adjust Balance</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Adjusting balance for: <strong>{accounts.find(a => a.id === adjustForm.account_id)?.name}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="New Balance" type="number" value={adjustForm.new_balance} onChange={(e) => setAdjustForm({ ...adjustForm, new_balance: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={adjustForm.date} onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleAdjust}>Adjust</Button>
        </DialogActions>
      </Dialog>

      {/* Opening Balance Dialog */}
      <Dialog open={openingDialog} onClose={() => setOpeningDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle><CalendarToday sx={{ verticalAlign: 'middle', mr: 1 }} />Set Opening Balance</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Setting opening balance for: <strong>{accounts.find(a => a.id === openingForm.account_id)?.name}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Opening Balance" type="number" value={openingForm.opening_balance} onChange={(e) => setOpeningForm({ ...openingForm, opening_balance: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={openingForm.date} onChange={(e) => setOpeningForm({ ...openingForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes" multiline rows={2} value={openingForm.notes} onChange={(e) => setOpeningForm({ ...openingForm, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpeningDialog(false)}>Cancel</Button>
          <Button variant="contained" color="info" onClick={handleSetOpening}>Set Opening</Button>
        </DialogActions>
      </Dialog>

      {/* Statement Dialog */}
      <Dialog open={statementDialog} onClose={() => setStatementDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle><Visibility sx={{ verticalAlign: 'middle', mr: 1 }} />Account Statement — {statementAccount?.name}</DialogTitle>
        <DialogContent>
          <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ mb: 2 }}>
            <TextField type="date" label="From" size="small" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
            <TextField type="date" label="To" size="small" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={isMobile} />
            <Button variant="contained" size="small" startIcon={<Refresh />} onClick={handleLoadStatement} fullWidth={isMobile}>Load</Button>
            <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={handleDownloadPDF} disabled={!statementData} fullWidth={isMobile}>Print / PDF</Button>
          </Stack>

          {statementData && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Opening Balance</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(statementData.opening_balance)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Closing Balance</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(statementData.closing_balance)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>Net Change</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#1c2580">{formatCurrency(statementData.closing_balance - statementData.opening_balance)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1c2580' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>#</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }}>Description</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">In (Cr)</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Out (Dr)</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.875rem' }} align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell colSpan={5} sx={{ fontWeight: 'bold' }}>Opening Balance</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(statementData.opening_balance)}</TableCell>
                    </TableRow>
                    {(statementData.transactions || []).map((tx, i) => (
                      <TableRow key={tx.id || i} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{tx.description || tx.reference_type || '-'}</Typography>
                          {tx.reference_no && <Typography variant="caption" fontFamily="monospace">{tx.reference_no}</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: tx.transaction_type === 'credit' ? 'bold' : 'normal' }}>
                          {tx.transaction_type === 'credit' ? formatCurrency(tx.amount) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: tx.transaction_type === 'debit' ? 'bold' : 'normal' }}>
                          {tx.transaction_type === 'debit' ? formatCurrency(tx.amount) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tx.balance_after)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.50', fontWeight: 'bold' }}>
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(statementData.total_credits)}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(statementData.total_debits)}</TableCell>
                      <TableCell align="right">{formatCurrency(statementData.closing_balance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {!statementData && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Visibility sx={{ fontSize: 48, color: '#d1d5db' }} />
              <Typography color="text.secondary">Select date range and click Load to view statement</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatementDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== ADD LEDGER ENTRY DIALOG ==================== */}
      <Dialog open={ledgerEntryDialog} onClose={() => setLedgerEntryDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle><Add sx={{ verticalAlign: 'middle', mr: 1 }} />Add Manual Ledger Entry</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Account *</InputLabel>
                <Select value={ledgerEntryForm.account_id} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, account_id: e.target.value })} label="Account *">
                  <MenuItem value=""><em>Select Account — Account Chunein</em></MenuItem>
                  {accounts.filter(a => a.status === 'active').map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.name} ({getAccountTypeLabel(a.type)}) — Bal: {formatCurrency(a.current_balance)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date" type="date" value={ledgerEntryForm.date} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type *</InputLabel>
                <Select value={ledgerEntryForm.type} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, type: e.target.value })} label="Type *">
                  <MenuItem value="debit">Money Out (Debit) — Paisa Gaya</MenuItem>
                  <MenuItem value="credit">Money In (Credit) — Paisa Aaya</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount" type="number" value={ledgerEntryForm.amount} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, amount: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason / Description" value={ledgerEntryForm.description} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, description: e.target.value })} placeholder="e.g. Office rent, Salary, Cash sale, Bill payment..." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Mode / Bank</InputLabel>
                <Select value={ledgerEntryForm.payment_mode} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, payment_mode: e.target.value })} label="Payment Mode / Bank">
                  <MenuItem value="cash">Cash in Hand</MenuItem>
                  <MenuItem value="bank">Bank Account</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Reference / Voucher #" value={ledgerEntryForm.reference_no} onChange={(e) => setLedgerEntryForm({ ...ledgerEntryForm, reference_no: e.target.value })} placeholder="Optional reference number" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLedgerEntryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveLedgerEntry} disabled={!ledgerEntryForm.account_id || !ledgerEntryForm.amount || !ledgerEntryForm.description.trim()}>
            Save Entry
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ width: 250, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">Menu</Typography>
            <IconButton onClick={() => setMobileDrawer(false)}><Close /></IconButton>
          </Box>
          <List>
            {[
              { label: 'Accounts', icon: <AccountBalance />, tab: 0 },
              { label: 'Dashboard', icon: <Dashboard />, tab: 1 },
              { label: 'Transactions', icon: <TrendingUp />, tab: 2 },
              { label: 'Trial Balance', icon: <Receipt />, tab: 3 },
              { label: 'Balance Sheet', icon: <Assessment />, tab: 4 },
              { label: 'P&L', icon: <BarChart />, tab: 5 },
              { label: 'Statements', icon: <Visibility />, tab: 6 },
              { label: 'General Ledger', icon: <MenuBook />, tab: 7 },
            ].map(item => (
              <ListItem button key={item.tab} onClick={() => { setActiveTab(item.tab); setMobileDrawer(false); }} selected={activeTab === item.tab}>
                <ListItemIcon sx={{ color: activeTab === item.tab ? 'primary.main' : 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
