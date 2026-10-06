import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Fade, Pagination, Alert, Snackbar,
  Stack, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Avatar, Badge, Divider, List, ListItem,
  ListItemText, ListItemIcon, SwipeableDrawer,
  InputAdornment, Tooltip, LinearProgress, ButtonGroup, Switch, FormControlLabel,
  Popper, Popover, ToggleButton, ToggleButtonGroup
} from '../components/ui/tailwind-mui';
import {
  Person, Phone, Store, AccountBalance, Payment, History, FilterList,
  Search, Refresh, Warning, CheckCircle, Error as ErrorIcon, TrendingUp,
  AccountBalanceWallet, Visibility, Menu as MenuIcon, Close,
  ArrowUpward, ArrowDownward, Receipt, AttachMoney, MonetizationOn,
  CreditCard, LocalAtm, Print, CalendarToday, Delete, Edit,
  ReceiptLong, QrCode, VerifiedUser, DoneAll, PowerSettingsNew,
  VisibilityOff, ShoppingCart, Inventory, Restore, LinkOff,
  FileDownload, Assessment, DateRange, Timer, MoneyOff
} from '../components/ui/icons';
import db from '../database/db';
import UnifiedPagination from '../components/common/UnifiedPagination';
import { printReceiptDirect, getEffectiveReceiptSettings, getEffectiveShopProfile, getThermalDimensions } from '../utils/receiptGenerator';

// ==================== HELPERS ====================
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const daysSince = (dateStr) => {
  if (!dateStr) return 0;
  return daysBetween(dateStr, new Date());
};

const generatePaymentRef = () => {
  return `PAY-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
};

// ==================== GET SHOP PROFILE ====================
const getShopProfile = () => {
  try {
    const saved = localStorage.getItem('shop_profile');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { 
    name: 'My Store', 
    tagline: '', 
    address: '', 
    phone: '', 
    logoPreview: null,
    receiptFooter: 'Thank you for shopping with us!'
  };
};

const getPaymentModeIcon = (mode) => {
  const icons = {
    cash: <LocalAtm fontSize="small" />,
    bank_transfer: <AccountBalance fontSize="small" />,
    easypaisa: <CreditCard fontSize="small" />,
    jazzcash: <CreditCard fontSize="small" />,
    credit: <MonetizationOn fontSize="small" />
  };
  return icons[mode] || <Payment fontSize="small" />;
};

const getPaymentModeColor = (mode) => {
  const colors = {
    cash: 'success',
    bank_transfer: 'info',
    easypaisa: 'secondary',
    jazzcash: 'primary',
    credit: 'warning'
  };
  return colors[mode] || 'default';
};

// ==================== AGING ANALYSIS COMPONENT ====================
const AgingAnalysis = ({ customer, sales }) => {
  const customerSales = sales.filter(s => 
    String(s.customer_id) === String(customer.id) && 
    !s.is_deleted && 
    (parseFloat(s.due_amount) > 0)
  );

  const buckets = { _0_30: 0, _31_60: 0, _61_90: 0, _90plus: 0 };

  customerSales.forEach(sale => {
    const due = parseFloat(sale.due_amount) || 0;
    if (due <= 0) return;
    const days = daysSince(sale.date);
    if (days <= 30) buckets._0_30 += due;
    else if (days <= 60) buckets._31_60 += due;
    else if (days <= 90) buckets._61_90 += due;
    else buckets._90plus += due;
  });

  const total = buckets._0_30 + buckets._31_60 + buckets._61_90 + buckets._90plus;
  if (total <= 0) return null;

  return (
    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
      <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        <Timer fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
        Aging Analysis (Outstanding)
      </Typography>
      <Grid container spacing={1}>
        <Grid item xs={3}>
          <Box sx={{ textAlign: 'center', p: 0.5, bgcolor: '#f0fdf4', borderRadius: 1 }}>
            <Typography variant="caption" color="success.main" fontWeight="bold">0-30d</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(buckets._0_30)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box sx={{ textAlign: 'center', p: 0.5, bgcolor: '#fef3c7', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.main" fontWeight="bold">31-60d</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(buckets._31_60)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box sx={{ textAlign: 'center', p: 0.5, bgcolor: '#fff7ed', borderRadius: 1 }}>
            <Typography variant="caption" color="error.main" fontWeight="bold">61-90d</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(buckets._61_90)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={3}>
          <Box sx={{ textAlign: 'center', p: 0.5, bgcolor: '#fef2f2', borderRadius: 1 }}>
            <Typography variant="caption" color="error.dark" fontWeight="bold">90d+</Typography>
            <Typography variant="body2" fontWeight="bold">{formatCurrency(buckets._90plus)}</Typography>
          </Box>
        </Grid>
      </Grid>
      <LinearProgress 
        variant="determinate" 
        value={Math.min(100, (total / (parseFloat(customer.credit_limit) || total || 1)) * 100)} 
        sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#e5e7eb' }}
      />
    </Box>
  );
};

// ==================== CREDIT LIMIT WARNING ====================
const CreditLimitWarning = ({ customer }) => {
  const limit = parseFloat(customer.credit_limit) || 0;
  const balance = parseFloat(customer.current_balance) || 0;
  if (limit <= 0) return null;

  const usage = (balance / limit) * 100;
  const isOverLimit = balance > limit;
  const isNearLimit = usage >= 80 && !isOverLimit;

  if (!isOverLimit && !isNearLimit) return null;

  return (
    <Alert severity={isOverLimit ? 'error' : 'warning'} sx={{ mt: 1, py: 0.5 }}>
      <Typography variant="caption" fontWeight="bold">
        {isOverLimit 
          ? `OVER LIMIT! Used: ${formatCurrency(balance)} / Limit: ${formatCurrency(limit)}` 
          : `Near Limit: ${formatCurrency(balance)} / ${formatCurrency(limit)} (${Math.round(usage)}%)`
        }
      </Typography>
    </Alert>
  );
};

// ==================== PAYMENT RECEIPT COMPONENT ====================
const PaymentReceipt = React.forwardRef(({ payment, customer, shop }, ref) => {
  if (!payment || !customer) {
    return <div ref={ref}>No receipt data</div>;
  }

  const settings = getEffectiveReceiptSettings();
  const dims = getThermalDimensions(settings);

  const dateStr = payment.date ? new Date(payment.date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) : '';

  return (
    <div ref={ref} style={{
      width: '100%',
      padding: `${dims.paddingMm}mm`,
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: `${dims.fontSizePx}px`,
      lineHeight: '1.4',
      background: '#fff',
      color: '#000',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #000' }}>
        {shop?.logoPreview && (
          <img src={shop.logoPreview} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '4px', filter: 'grayscale(100%)' }} />
        )}
        <div style={{ fontSize: `${dims.titleSizePx}px`, fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {shop?.name || 'RAATH POS'}
        </div>
        {shop?.tagline && <div style={{ fontSize: `${dims.smallSizePx}px`, color: '#000' }}>{shop.tagline}</div>}
        <div style={{ fontSize: `${dims.smallSizePx}px`, color: '#000', marginTop: '2px' }}>
          {shop?.phone && <span style={{ marginRight: '6px' }}>Tel: {shop.phone}</span>}
          {shop?.address && <span>{shop.address}</span>}
        </div>
        <div style={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 'bold', marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '3px' }}>
          PAYMENT RECOVERY RECEIPT
        </div>
      </div>

      <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Receipt #:</span>
          <span style={{ fontWeight: '700' }}>{payment.reference_no || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Date:</span>
          <span style={{ fontWeight: '600' }}>{dateStr}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Mode:</span>
          <span style={{ fontWeight: '700', textTransform: 'uppercase' }}>
            {String(payment.payment_mode || 'cash').toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ border: '1px dashed #000', padding: '6px', marginBottom: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: `${dims.smallSizePx}px`, fontWeight: 'bold', textTransform: 'uppercase' }}>RECEIVED FROM</div>
        <div style={{ fontSize: `${dims.headerSizePx}px`, fontWeight: '900' }}>{customer?.name || 'N/A'}</div>
        {customer?.phone && <div style={{ fontSize: `${dims.smallSizePx}px` }}>Phone: {customer.phone}</div>}
        {customer?.ntn && <div style={{ fontSize: `${dims.smallSizePx}px` }}>NTN: {customer.ntn}</div>}
      </div>

      <div style={{ background: '#000', color: '#fff', padding: '8px', textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: `${dims.smallSizePx}px`, letterSpacing: '1px' }}>AMOUNT RECEIVED</div>
        <div style={{ fontSize: `${dims.titleSizePx + 2}px`, fontWeight: '900' }}>Rs. {Number(payment.amount).toFixed(2)}</div>
      </div>

      {payment.previous_balance > 0 && (
        <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '6px', fontSize: `${dims.fontSizePx}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Previous Balance:</span>
            <span style={{ fontWeight: '600' }}>Rs. {Number(payment.previous_balance).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Remaining Balance:</span>
            <span style={{ fontWeight: '900' }}>Rs. {Number(payment.remaining_balance).toFixed(2)}</span>
          </div>
        </div>
      )}

      {payment.description && (
        <div style={{ border: '1px dashed #000', padding: '4px 6px', marginBottom: '6px', fontSize: `${dims.smallSizePx}px` }}>
          <span style={{ fontWeight: 'bold' }}>Note: </span>
          <span>{payment.description}</span>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '2px solid #000' }}>
        <div style={{ fontSize: `${dims.headerSizePx}px`, fontWeight: 'bold' }}>Thank You!</div>
        <div style={{ fontSize: `${dims.smallSizePx}px`, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{shop?.receiptFooter || 'Thank you for your payment!'}</div>
      </div>
    </div>
  );
});

// ==================== STATEMENT DIALOG ====================
const StatementDialog = ({ open, onClose, customer, ledger, shop }) => {
  const printRef = useRef();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!customer) return null;

  const totalDebit = ledger.filter(l => l.isDebit && !l.isOpening).reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = ledger.filter(l => !l.isDebit && !l.isOpening).reduce((sum, l) => sum + l.amount, 0);
  const openingBalance = parseFloat(customer.opening_balance) || 0;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const printHTML = `
      <html><head><title>Statement - ${customer.name}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #10b981; color: white; padding: 6px; text-align: left; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
        .header { text-align: center; margin-bottom: 20px; }
        .summary { display: flex; justify-content: space-between; margin: 15px 0; padding: 10px; background: #f8fafc; }
      </style></head><body>${content}</body></html>
    `;
    const win = window.open('', '_blank');
    win.document.write(printHTML);
    win.document.close();
    win.onload = () => { setTimeout(() => { win.print(); setTimeout(() => win.close(), 500); }, 300); };
  };

  const handleExportCSV = () => {
    const rows = [['Date', 'Type', 'Description', 'Reference', 'Mode', 'Debit', 'Credit', 'Balance']];
    ledger.forEach(entry => {
      rows.push([
        formatDate(entry.date),
        entry.type,
        entry.description,
        entry.reference_no || '',
        entry.payment_mode,
        entry.isDebit ? entry.amount.toFixed(2) : '',
        !entry.isDebit ? entry.amount.toFixed(2) : '',
        entry.balance_after.toFixed(2)
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${customer.name.replace(/\s+/g, '_')}_statement.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment />
          Customer Statement: {customer.name}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }} startIcon={<FileDownload />} onClick={handleExportCSV}>
            CSV
          </Button>
          <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }} startIcon={<Print />} onClick={handlePrint}>
            Print
          </Button>
          <IconButton size="small" sx={{ color: 'white' }} onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <div ref={printRef} style={{ padding: '20px' }}>
          <div className="header" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Typography variant="h5" fontWeight="bold" color="#10b981">{shop?.name || 'RAATH POS'}</Typography>
            <Typography variant="body2" color="text.secondary">{shop?.address}</Typography>
            <Typography variant="body2" color="text.secondary">Tel: {shop?.phone}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" fontWeight="bold">STATEMENT OF ACCOUNT</Typography>
            <Typography variant="body2">Period: All Transactions</Typography>
          </div>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight="bold">{customer.name}</Typography>
              <Typography variant="caption" color="text.secondary">{customer.shop_name}</Typography>
              <Typography variant="caption" display="block" color="text.secondary">Phone: {customer.phone || 'N/A'}</Typography>
              <Typography variant="caption" display="block" color="text.secondary">NTN: {customer.ntn || 'N/A'}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Statement Date</Typography>
              <Typography variant="body2" fontWeight="bold">{formatDate(new Date())}</Typography>
              <Typography variant="caption" color="text.secondary">Account Type</Typography>
              <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>{customer.customer_type || 'Retail'}</Typography>
            </Box>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#1c2580' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Type</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Description</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Ref#</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Debit</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Credit</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">No transactions</TableCell></TableRow>
                ) : (
                  ledger.map((entry, idx) => (
                    <TableRow key={idx} hover sx={{ bgcolor: entry.isOpening ? '#fef3c7' : 'inherit' }}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={entry.type} color={entry.isDebit ? 'error' : 'success'} sx={{ height: 18, fontSize: '0.6rem' }} />
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.reference_no || '-'}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{entry.isDebit ? formatCurrency(entry.amount) : '-'}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{!entry.isDebit ? formatCurrency(entry.amount) : '-'}</TableCell>
                      <TableCell align="right" fontWeight="bold">{formatCurrency(entry.balance_after)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Opening Balance</Typography>
                <Typography variant="h6" fontWeight="bold">{formatCurrency(openingBalance)}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Total Sales (Debit)</Typography>
                <Typography variant="h6" fontWeight="bold" color="error.main">{formatCurrency(totalDebit)}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Total Payments (Credit)</Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(totalCredit)}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                <Typography variant="h6" fontWeight="bold" color={customer.current_balance > 0 ? 'error.main' : 'success.main'}>
                  {formatCurrency(customer.current_balance)}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              This is a computer-generated statement and does not require signature.
            </Typography>
          </Box>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==================== PAYMENT HISTORY TABLE ====================
const PaymentHistoryTable = ({ payments, onPrint, onDelete }) => {
  if (!payments || payments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Payment sx={{ fontSize: 48, color: '#d1d5db' }} />
        <Typography color="text.secondary">No payment history</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#1c2580' }}>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Date</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Amount</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Mode</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Reference</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Description</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment, idx) => (
            <TableRow key={idx} hover>
              <TableCell>{formatDateTime(payment.date)}</TableCell>
              <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell>
                <Chip 
                  size="small" 
                  icon={getPaymentModeIcon(payment.payment_mode)} 
                  label={String(payment.payment_mode || 'cash').toUpperCase()} 
                  color={getPaymentModeColor(payment.payment_mode)}
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              </TableCell>
              <TableCell>{payment.reference_no || '-'}</TableCell>
              <TableCell>{payment.description || '-'}</TableCell>
              <TableCell align="center">
                <Tooltip title="Print Receipt">
                  <IconButton size="small" color="primary" onClick={() => onPrint(payment)}>
                    <Print fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Payment">
                  <IconButton size="small" color="error" onClick={() => onDelete(payment)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ==================== MOBILE CUSTOMER CARD ====================
const MobileCustomerCard = ({ customer, onView, onClear, onDelete, getCustomerSalesSummary, index }) => {
  const [expanded, setExpanded] = useState(false);
  const summary = getCustomerSalesSummary(customer.id);
  const balance = parseFloat(customer.current_balance || 0);
  const limit = parseFloat(customer.credit_limit) || 0;
  const usagePercent = limit > 0 ? Math.min(100, (Math.max(0, balance) / limit) * 100) : 0;

  return (
    <Card sx={{ 
      mb: 1.5, 
      borderLeft: balance > 0 ? '4px solid #ef4444' : '4px solid #10b981',
      overflow: 'hidden',
      bgcolor: balance > 0 ? '#fff5f5' : '#f0fdf4'
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight="bold" noWrap>
                #{index} {customer.name}
              </Typography>
              <Chip 
                size="small" 
                color={customer.customer_type === 'wholesale' ? 'info' : 'default'} 
                label={String(customer.customer_type || 'retail').toUpperCase()} 
                sx={{ height: 16, fontSize: '0.5rem' }} 
              />
              {limit > 0 && usagePercent >= 90 && (
                <Chip size="small" label="LIMIT!" color="error" sx={{ height: 16, fontSize: '0.5rem' }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" display="block">
              <Phone sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
              {customer.phone || 'No phone'}
            </Typography>
            {customer.shop_name && (
              <Typography variant="caption" color="primary.main" display="block">
                <Store sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                {customer.shop_name}
              </Typography>
            )}
            {summary.lastPaymentDate && (
              <Typography variant="caption" color="warning.main" display="block">
                <Timer sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                Last paid: {formatDate(summary.lastPaymentDate)} ({summary.daysSincePayment}d ago)
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" fontWeight="bold" color={balance > 0 ? 'error.main' : balance < 0 ? 'warning.main' : 'success.main'}>
              {formatCurrency(balance)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {summary.invoiceCount} invoices
            </Typography>
            {limit > 0 && (
              <Typography variant="caption" display="block" color={usagePercent > 80 ? 'error.main' : 'text.secondary'}>
                Limit: {Math.round(usagePercent)}%
              </Typography>
            )}
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Sales</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(summary.totalSales)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Paid</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(summary.totalPaid)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Total Due</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(summary.totalDue)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(limit)}</Typography>
            </Grid>
            <Grid item xs={12}>
              <LinearProgress 
                variant="determinate" 
                value={usagePercent} 
                sx={{ height: 6, borderRadius: 3, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#10b981' }}}
              />
            </Grid>

            {summary.lastItems && summary.lastItems.length > 0 && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" fontWeight="bold" color="text.secondary">Recent Purchases:</Typography>
                <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {summary.lastItems.slice(0, 3).map((item, i) => (
                    <Chip 
                      key={i} 
                      size="small" 
                      label={`${item.name || 'Item'} (x${item.qty || 1})`} 
                      icon={<Inventory fontSize="small" />}
                      sx={{ fontSize: '0.5rem', height: 20, bgcolor: '#f3f4f6' }} 
                    />
                  ))}
                  {summary.lastItems.length > 3 && (
                    <Chip size="small" label={`+${summary.lastItems.length - 3} more`} sx={{ fontSize: '0.5rem', height: 20 }} />
                  )}
                </Box>
              </Grid>
            )}
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<Visibility />} 
            onClick={() => onView(customer)}
            sx={{ flex: 1, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            View Ledger
          </Button>
          <Tooltip title="Clear Balance (Set to 0)">
             <Button size="small" variant="outlined" color="warning" startIcon={<Restore />} onClick={() => onClear(customer)} sx={{ flex: 1 }}>Clear</Button>
          </Tooltip>
          <Tooltip title="Delete Customer">
             <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => onDelete(customer)} sx={{ flex: 1 }}>Delete</Button>
          </Tooltip>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== MOBILE LEDGER ENTRY ====================
const MobileLedgerEntry = ({ entry }) => {
  return (
    <Paper sx={{ mb: 1, p: 1.5, bgcolor: entry.isOpening ? '#fef3c7' : (entry.isDebit ? '#fff5f5' : '#f0fdf4'), borderLeft: entry.isOpening ? '3px solid #f59e0b' : 'none' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip 
              size="small" 
              label={entry.type} 
              color={entry.isOpening ? 'warning' : (entry.isDebit ? 'error' : 'success')} 
              sx={{ height: 16, fontSize: '0.5rem', fontWeight: 'bold' }} 
            />
            <Chip 
              size="small" 
              icon={getPaymentModeIcon(entry.payment_mode)} 
              label={String(entry.payment_mode || '-').toUpperCase()} 
              color={getPaymentModeColor(entry.payment_mode)}
              sx={{ height: 16, fontSize: '0.45rem' }}
            />
            {entry.reference_no && (
              <Chip size="small" label={entry.reference_no} variant="outlined" sx={{ height: 16, fontSize: '0.45rem' }} />
            )}
          </Box>
          <Typography variant="body2" fontWeight="medium" noWrap>{entry.description}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDateTime(entry.date)}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', ml: 1 }}>
          <Typography variant="body2" fontWeight="bold" color={entry.isDebit ? 'error.main' : 'success.main'}>
            {entry.isDebit ? '+' : '-'}{formatCurrency(entry.amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Bal: {formatCurrency(entry.balance_after)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

// ==================== MAIN COMPONENT ====================
export default function RecoveryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [activeTab, setActiveTab] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 15);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [recoveryEnabled, setRecoveryEnabled] = useState(() => {
    const saved = localStorage.getItem('recovery_module_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [showLedgerPanel, setShowLedgerPanel] = useState(true);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [verifyingBalance, setVerifyingBalance] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [popoverItems, setPopoverItems] = useState([]);
  const [popoverSaleId, setPopoverSaleId] = useState(null);

  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const printRef = useRef();

  const shopProfile = useMemo(() => getShopProfile(), []);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [orphanSales, setOrphanSales] = useState([]);
  const [fixOrphanDialog, setFixOrphanDialog] = useState(false);
  const [selectedCustomerForOrphan, setSelectedCustomerForOrphan] = useState('');

  useEffect(() => {
    localStorage.setItem('recovery_module_enabled', String(recoveryEnabled));
  }, [recoveryEnabled]);

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async () => {
    if (!recoveryEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let customersData = [];
      let salesData = [];

      if (window.electronAPI && window.electronAPI.dbQuery) {
        console.log('[Recovery] Using Electron API');
        customersData = await window.electronAPI.dbQuery(
          "SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name"
        );
        salesData = await window.electronAPI.dbQuery(
          "SELECT * FROM sales WHERE is_deleted = 0 ORDER BY id DESC"
        );
      } else {
        console.log('[Recovery] Using Browser mode');
        customersData = await db.getCustomers();
        salesData = await db.getSalesHistory();
      }

      const normalizedCustomers = (Array.isArray(customersData) ? customersData : []).map(c => ({
        ...c,
        current_balance: parseFloat(c.current_balance) || 0,
        opening_balance: parseFloat(c.opening_balance) || 0,
        credit_limit: parseFloat(c.credit_limit) || 0
      }));

      setCustomers(normalizedCustomers);
      setSales(Array.isArray(salesData) ? salesData : []);

      const orphan = (Array.isArray(salesData) ? salesData : []).filter(
        s => s.customer_id === null || s.customer_id === undefined || s.customer_id === ''
      );
      setOrphanSales(orphan);

      console.log('[Recovery] Loaded:', {
        customers: normalizedCustomers.length,
        sales: salesData.length,
        orphan: orphan.length
      });

    } catch (err) {
      console.error('Load error:', err);
      setSnackbar({ 
        open: true, 
        message: 'Error loading data: ' + err.message, 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  }, [recoveryEnabled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== FETCH SALE ITEMS ====================
  const fetchSaleItems = useCallback(async (saleId) => {
    try {
      let items = [];

      if (window.electronAPI && window.electronAPI.dbQuery) {
        const result = await window.electronAPI.dbQuery(
          "SELECT si.*, pv.sku, p.name as product_name FROM sale_items si JOIN product_variants pv ON si.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id WHERE si.sale_id = ?",
          [saleId]
        );
        if (result && result.length > 0) items = result;
      }

      if (items.length === 0 && db.getSaleItems) {
        items = await db.getSaleItems(saleId);
      }

      if (items.length === 0) {
        const sale = sales.find(s => String(s.id) === String(saleId));
        if (sale && sale.items) items = sale.items;
      }

      return items;
    } catch (err) {
      console.error('Error fetching items:', err);
      return [];
    }
  }, [sales]);

  // ==================== BUILD LEDGER (FULLY FIXED - NO DOUBLE COUNTING) ====================
  const buildLedger = useCallback(async (customer) => {
    if (!customer || !recoveryEnabled) return [];

    try {
      console.log('[Ledger] Building ledger for:', customer.name, '| Opening:', customer.opening_balance);

      // Step 1: Get customer_ledger entries (THE ONLY SOURCE OF TRUTH)
      let ledgerEntries = [];
      try {
        if (window.electronAPI && window.electronAPI.dbQuery) {
          const result = await window.electronAPI.dbQuery(
            "SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY date ASC, id ASC",
            [customer.id]
          );
          ledgerEntries = result || [];
        } else if (db.getCustomerLedger) {
          ledgerEntries = await db.getCustomerLedger(customer.id);
        }
        console.log('[Ledger] Ledger entries from DB:', ledgerEntries.length);
      } catch (e) {
        console.warn('Ledger fetch failed:', e);
      }

      // Step 2: Get sales for enrichment (invoice numbers, due amounts)
      let customerSales = [];
      try {
        if (window.electronAPI && window.electronAPI.dbQuery) {
          const result = await window.electronAPI.dbQuery(
            "SELECT id, invoice_no, grand_total, paid_amount, due_amount, date, payment_mode FROM sales WHERE customer_id = ? AND is_deleted = 0 ORDER BY date ASC",
            [customer.id]
          );
          customerSales = result || [];
        } else {
          customerSales = sales.filter(s => 
            String(s.customer_id) === String(customer.id) && !s.is_deleted
          );
        }
      } catch (e) {
        console.warn('Sales fetch failed:', e);
      }

      const saleMap = {};
      customerSales.forEach(s => { saleMap[s.id] = s; });

      // Step 3: Build transactions
      const transactions = [];
      const openingBalance = parseFloat(customer.opening_balance) || 0;

      // Opening Balance entry
      if (openingBalance !== 0) {
        transactions.push({
          id: `opening-${customer.id}`,
          date: customer.created_at || new Date(0).toISOString(),
          type: 'Opening Balance',
          description: 'Initial account opening balance',
          payment_mode: '-',
          reference_no: 'OPENING',
          amount: Math.abs(openingBalance),
          isDebit: openingBalance > 0,
          source: null,
          sourceId: null,
          balance_after: openingBalance,
          isOpening: true,
          saleId: null
        });
      }

      // Process ledger entries chronologically
      let runningBalance = openingBalance;

      (ledgerEntries || []).forEach(entry => {
        const amount = parseFloat(entry.amount) || 0;
        const entryType = String(entry.type || '').toLowerCase().trim();
        const isSale = entryType === 'sale';
        const isDebit = isSale || entryType === 'debit';

        if (isDebit) {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }

        const associatedSale = entry.sale_id ? saleMap[entry.sale_id] : null;
        const invoiceNo = associatedSale?.invoice_no || entry.reference_no || entry.sale_id || '';

        transactions.push({
          id: `ledger-${entry.id}`,
          date: entry.date || new Date().toISOString(),
          type: isSale ? 'Sale' : (entryType === 'payment' || entryType === 'received' ? 'Payment Received' : 'Adjustment'),
          description: entry.description || (isSale ? `Invoice #${invoiceNo}` : `Payment via ${(entry.payment_mode || 'cash').toUpperCase()}`),
          payment_mode: entry.payment_mode || 'cash',
          reference_no: entry.reference_no || invoiceNo,
          amount: amount,
          isDebit: isDebit,
          source: entry,
          sourceId: entry.id,
          saleId: entry.sale_id,
          balance_after: parseFloat(runningBalance.toFixed(2)),
          isOpening: false,
          grandTotal: associatedSale ? parseFloat(associatedSale.grand_total || 0) : null,
          paidAmount: associatedSale ? parseFloat(associatedSale.paid_amount || 0) : null,
          dueAmount: associatedSale ? parseFloat(associatedSale.due_amount || 0) : amount
        });
      });

      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      let balance = openingBalance;
      const processed = transactions.map(t => {
        if (t.isOpening) return t;
        if (t.isDebit) {
          balance += t.amount;
        } else {
          balance -= t.amount;
        }
        return { ...t, balance_after: parseFloat(balance.toFixed(2)) };
      });

      const payments = processed.filter(t => 
        t.type === 'Payment Received' || t.type === 'payment' || t.type === 'Payment'
      );
      setPaymentHistory(payments);

      console.log('[Ledger] Ledger built:', processed.length, 'entries | Final balance:', balance);

      const dbBalance = parseFloat(customer.current_balance) || 0;
      if (Math.abs(balance - dbBalance) > 0.01) {
        console.warn('[Ledger] BALANCE MISMATCH! Calculated:', balance, 'DB:', dbBalance);
      }

      return processed.reverse();

    } catch (err) {
      console.error('[Ledger] Ledger build error:', err);
      return [];
    }
  }, [sales, recoveryEnabled]);

  const viewLedger = async (customer) => {
    if (!recoveryEnabled) return;
    console.log('[Ledger] Viewing ledger for:', customer.name, '| Balance:', customer.current_balance);

    setSelectedCustomer(customer);
    try {
      const ledgerData = await buildLedger(customer);
      setLedger(ledgerData);
      console.log('[Ledger] Ledger loaded:', ledgerData.length, 'entries');
    } catch (err) {
      console.error('[Ledger] View ledger error:', err);
      setLedger([]);
    }
    setPaymentDialog(false);
    if (isMobile) setMobileDrawer(false);
  };

  // ==================== VERIFY BALANCE ====================
  const verifyBalance = async () => {
    if (!selectedCustomer) return;
    setVerifyingBalance(true);
    try {
      const ledgerData = await buildLedger(selectedCustomer);
      const calculated = ledgerData.length > 0 ? ledgerData[0].balance_after : 0;
      const dbBalance = parseFloat(selectedCustomer.current_balance) || 0;

      if (Math.abs(calculated - dbBalance) > 0.01) {
        setSnackbar({
          open: true,
          message: `Mismatch! Calculated: ${formatCurrency(calculated)} | DB: ${formatCurrency(dbBalance)}`,
          severity: 'warning'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Balance verified: ${formatCurrency(calculated)} (matches database)`,
          severity: 'success'
        });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Verify failed: ' + err.message, severity: 'error' });
    } finally {
      setVerifyingBalance(false);
    }
  };

  // ==================== GET CUSTOMER SALES SUMMARY (FIXED) ====================
  const getCustomerSalesSummary = useCallback((customerId) => {
    if (!recoveryEnabled) return { 
      totalSales: 0, totalPaid: 0, totalDue: 0, 
      invoiceCount: 0, lastSale: null, lastItems: [],
      lastPaymentDate: null, daysSincePayment: 0
    };

    const customerSales = sales.filter(s => {
      if (!s || s.is_deleted) return false;
      return String(s.customer_id) === String(customerId);
    });

    const totalSales = customerSales.reduce((sum, s) => sum + (parseFloat(s.grand_total) || 0), 0);
    const totalPaid = customerSales.reduce((sum, s) => sum + (parseFloat(s.paid_amount) || 0), 0);
    const totalDue = customerSales.reduce((sum, s) => sum + (parseFloat(s.due_amount) || 0), 0);
    const invoiceCount = customerSales.length;
    const lastSale = customerSales.length > 0 ? customerSales[0] : null;

    let lastItems = [];
    if (lastSale && lastSale.items && Array.isArray(lastSale.items)) {
      lastItems = lastSale.items;
    }

    let lastPaymentDate = null;
    if (paymentHistory.length > 0) {
      const sorted = [...paymentHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
      lastPaymentDate = sorted[0].date;
    }
    const daysSincePayment = lastPaymentDate ? daysSince(lastPaymentDate) : 0;

    return { totalSales, totalPaid, totalDue, invoiceCount, lastSale, lastItems, lastPaymentDate, daysSincePayment };
  }, [sales, recoveryEnabled, paymentHistory]);

  // ==================== FIX ORPHAN SALES ====================
  const handleFixOrphanSales = async () => {
    if (!selectedCustomerForOrphan) {
      setSnackbar({ open: true, message: 'Please select a customer!', severity: 'warning' });
      return;
    }

    try {
      const customer = customers.find(c => String(c.id) === String(selectedCustomerForOrphan));
      if (!customer) {
        setSnackbar({ open: true, message: 'Customer not found!', severity: 'error' });
        return;
      }

      let updated = 0;
      for (const sale of orphanSales) {
        try {
          if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery(
              "UPDATE sales SET customer_id = ? WHERE id = ?",
              [customer.id, sale.id]
            );
          } else if (db.updateSale) {
            await db.updateSale(sale.id, { ...sale, customer_id: customer.id });
          }
          updated++;
        } catch (e) {
          console.error('Failed to update sale:', sale.id, e);
        }
      }

      setSnackbar({ 
        open: true, 
        message: `${updated} orphan sales assigned to "${customer.name}"!`, 
        severity: 'success' 
      });

      setFixOrphanDialog(false);
      setOrphanSales([]);
      await loadData();

    } catch (err) {
      console.error('Fix orphan error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== PAYMENT FUNCTIONS (FULLY FIXED WITH ELECTRON SUPPORT) ====================
  const handlePaymentOpen = () => {
    if (!selectedCustomer) {
      setSnackbar({ open: true, message: 'No customer selected!', severity: 'warning' });
      return;
    }
    if (selectedCustomer.current_balance <= 0) {
      setSnackbar({ open: true, message: 'No outstanding balance to receive!', severity: 'info' });
      return;
    }
    setPaymentForm(prev => ({ ...prev, reference_no: generatePaymentRef() }));
    setPaymentDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedCustomer || !recoveryEnabled) return;

    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      setSnackbar({ open: true, message: 'Enter a valid payment amount!', severity: 'warning' });
      return;
    }

    const currentBalance = parseFloat(selectedCustomer.current_balance || 0);

    if (amount > currentBalance) {
      setSnackbar({ 
        open: true, 
        message: `Payment amount (${formatCurrency(amount)}) exceeds outstanding balance (${formatCurrency(currentBalance)})`, 
        severity: 'warning' 
      });
      return;
    }

    const newBalance = currentBalance - amount;

    try {
      console.log('[Payment] PROCESSING PAYMENT:', {
        customer: selectedCustomer.name,
        amount: amount,
        currentBalance: currentBalance,
        newBalance: newBalance,
        mode: paymentForm.payment_mode,
        reference: paymentForm.reference_no
      });

      const ledgerEntry = {
        customer_id: selectedCustomer.id,
        type: 'payment',
        amount: amount,
        balance_after: newBalance,
        description: paymentForm.description || `Payment received via ${paymentForm.payment_mode.toUpperCase()}`,
        payment_mode: paymentForm.payment_mode,
        reference_no: paymentForm.reference_no || generatePaymentRef(),
        date: paymentForm.date ? new Date(paymentForm.date).toISOString() : new Date().toISOString(),
        sale_id: null
      };

      // Step 1: Add to customer_ledger (Electron + Browser)
      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery(
          `INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description, payment_mode, reference_no, date, sale_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ledgerEntry.customer_id,
            ledgerEntry.type,
            ledgerEntry.amount,
            ledgerEntry.balance_after,
            ledgerEntry.description,
            ledgerEntry.payment_mode,
            ledgerEntry.reference_no,
            ledgerEntry.date,
            ledgerEntry.sale_id
          ]
        );
      } else if (db.addCustomerLedgerEntry) {
        await db.addCustomerLedgerEntry(ledgerEntry);
      } else {
        throw new Error('Database function not available');
      }

      // Step 2: Update customer balance (Electron + Browser)
      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery(
          "UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?",
          [newBalance, new Date().toISOString(), selectedCustomer.id]
        );
      } else if (db.updateCustomer) {
        await db.updateCustomer(selectedCustomer.id, {
          ...selectedCustomer,
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        });
      } else {
        throw new Error('Update customer function not available');
      }

      // Step 3: Log to general ledger
      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger(
          'cash', 
          selectedCustomer.id, 
          amount, 
          0, 
          `Payment received from ${selectedCustomer.name} (Ref: ${ledgerEntry.reference_no})`
        );
      }

      // Step 4: Store payment for receipt
      const paymentData = {
        amount: amount,
        payment_mode: paymentForm.payment_mode,
        reference_no: ledgerEntry.reference_no,
        description: paymentForm.description || `Payment received via ${paymentForm.payment_mode.toUpperCase()}`,
        date: ledgerEntry.date,
        previous_balance: currentBalance,
        remaining_balance: newBalance
      };
      setLastPayment(paymentData);

      // Step 5: Reset form
      setPaymentDialog(false);
      setPaymentForm({
        amount: '',
        payment_mode: 'cash',
        reference_no: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });

      // Step 6: Reload data
      await loadData();

      // Step 7: Refresh selected customer
      const refreshedCustomer = { ...selectedCustomer, current_balance: newBalance };
      setSelectedCustomer(refreshedCustomer);

      // Step 8: Rebuild ledger
      const ledgerData = await buildLedger(refreshedCustomer);
      setLedger(ledgerData);

      setSnackbar({ 
        open: true, 
        message: `Payment of ${formatCurrency(amount)} received! Remaining: ${formatCurrency(newBalance)}`, 
        severity: 'success' 
      });

      setShowPaymentReceipt(true);

    } catch (err) {
      console.error('[Payment] Error:', err);
      setSnackbar({ 
        open: true, 
        message: 'Payment failed: ' + err.message, 
        severity: 'error' 
      });
    }
  };

  // ==================== PRINT PAYMENT RECEIPT ====================
  const handlePrintPaymentReceipt = useCallback(async () => {
    if (!lastPayment) {
      setSnackbar({ open: true, message: 'No payment record to print!', severity: 'error' });
      return;
    }

    const settings = getEffectiveReceiptSettings();
    const shop = getEffectiveShopProfile();
    const payAmount = Number(lastPayment.amount || 0);

    const paymentItem = {
      name: `Payment Received (${(lastPayment.payment_mode || 'Cash').toUpperCase()})`,
      title: `Payment Received (${(lastPayment.payment_mode || 'Cash').toUpperCase()})`,
      qty: 1,
      quantity: 1,
      price: payAmount,
      total: payAmount
    };

    try {
      setSnackbar({ open: true, message: 'Printing payment receipt...', severity: 'info' });
      const res = await printReceiptDirect(
        {
          sale: {
            invoiceNo: lastPayment.reference_no || `REC-${lastPayment.id || Date.now().toString().slice(-6)}`,
            customer_name: selectedCustomer?.name || 'Customer',
            customer_phone: selectedCustomer?.phone || '',
            customer_ntn: selectedCustomer?.ntn || '',
            subtotal: payAmount,
            grand_total: payAmount,
            paid_amount: payAmount,
            due_amount: Number(lastPayment.remaining_balance || 0),
            payment_mode: (lastPayment.payment_mode || 'CASH').toUpperCase(),
            date: lastPayment.payment_date || lastPayment.created_at || new Date(),
            items: [paymentItem]
          },
          items: [paymentItem]
        },
        {
          receiptSettings: settings,
          shopProfile: shop,
          design: settings.design
        }
      );

      if (res && res.success) {
        setSnackbar({ open: true, message: 'Payment receipt printed!', severity: 'success' });
      } else if (res && res.error) {
        setSnackbar({ open: true, message: `Print error: ${res.error}`, severity: 'error' });
      }
    } catch (err) {
      console.error('Print payment error:', err);
      setSnackbar({ open: true, message: 'Print failed: ' + err.message, severity: 'error' });
    }
  }, [lastPayment, selectedCustomer]);

  // ==================== DELETE PAYMENT (FULLY FIXED) ====================
  const handleDeletePayment = async (payment) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;

    try {
      const amount = parseFloat(payment.amount);
      const currentBalance = parseFloat(selectedCustomer.current_balance || 0);
      const newBalance = currentBalance + amount;

      // Delete from customer_ledger
      if (payment.source && payment.source.id) {
        if (window.electronAPI && window.electronAPI.dbQuery) {
          await window.electronAPI.dbQuery("DELETE FROM customer_ledger WHERE id = ?", [payment.source.id]);
        } else if (db.deleteCustomerLedgerEntry) {
          await db.deleteCustomerLedgerEntry(payment.source.id);
        }
      }

      // Reverse customer balance
      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery(
          "UPDATE customers SET current_balance = ? WHERE id = ?",
          [newBalance, selectedCustomer.id]
        );
      } else if (db.updateCustomer) {
        await db.updateCustomer(selectedCustomer.id, {
          ...selectedCustomer,
          current_balance: newBalance
        });
      }

      // Reverse general ledger if possible
      if (db.logToGeneralLedger) {
        await db.logToGeneralLedger(
          'cash',
          selectedCustomer.id,
          0,
          amount,
          `Payment reversal for ${selectedCustomer.name} (deleted)`
        );
      }

      await loadData();
      const updatedCustomer = { ...selectedCustomer, current_balance: newBalance };
      setSelectedCustomer(updatedCustomer);
      const ledgerData = await buildLedger(updatedCustomer);
      setLedger(ledgerData);

      setSnackbar({ 
        open: true, 
        message: `Payment of ${formatCurrency(amount)} reversed! New balance: ${formatCurrency(newBalance)}`, 
        severity: 'info' 
      });
    } catch (err) {
      console.error('Delete payment error:', err);
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DELETE LEDGER ENTRY ====================
  const handleDeleteLedgerEntry = async (entry) => {
    if (!entry.sourceId && !entry.source?.id) {
      setSnackbar({ open: true, message: 'This entry cannot be deleted directly.', severity: 'warning' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this "${entry.type}" entry of ${formatCurrency(entry.amount)}?`)) return;

    try {
      const entryId = entry.sourceId || entry.source?.id;
      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery("DELETE FROM customer_ledger WHERE id = ?", [entryId]);
      } else if (db.deleteCustomerLedgerEntry) {
        await db.deleteCustomerLedgerEntry(entryId);
      }

      await loadData();
      const ledgerData = await buildLedger(selectedCustomer);
      setLedger(ledgerData);

      setSnackbar({ open: true, message: 'Entry deleted!', severity: 'success' });
    } catch (err) {
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== CLEAR CUSTOMER BALANCE ====================
  const handleClearBalance = async (customer) => {
    if (!window.confirm(`Are you sure you want to CLEAR the balance for "${customer.name}"? (Current: ${formatCurrency(customer.current_balance)})`)) return;

    try {
      const oldBalance = parseFloat(customer.current_balance) || 0;

      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery(
          "UPDATE customers SET current_balance = 0 WHERE id = ?",
          [customer.id]
        );
        await window.electronAPI.dbQuery(
          `INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description, payment_mode, reference_no, date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [customer.id, 'adjustment', oldBalance, 0, `Manual balance clear (was ${formatCurrency(oldBalance)})`, 'cash', 'ADJ-CLEAR', new Date().toISOString()]
        );
      } else {
        await db.updateCustomer(customer.id, { ...customer, current_balance: 0 });
        await db.addCustomerLedgerEntry({
          customer_id: customer.id,
          type: 'adjustment',
          amount: oldBalance,
          balance_after: 0,
          description: `Manual balance clear (was ${formatCurrency(oldBalance)})`,
          payment_mode: 'cash',
          reference_no: 'ADJ-CLEAR',
          date: new Date().toISOString()
        });
      }

      setSnackbar({ open: true, message: `Balance cleared for ${customer.name}`, severity: 'success' });
      await loadData();

      if (selectedCustomer && selectedCustomer.id === customer.id) {
        const updatedCustomer = { ...customer, current_balance: 0 };
        setSelectedCustomer(updatedCustomer);
        const ledgerData = await buildLedger(updatedCustomer);
        setLedger(ledgerData);
      }
    } catch (err) {
      console.error('Clear balance error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DELETE CUSTOMER ====================
  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE the customer "${customer.name}"?`)) return;
    if (!window.confirm('FINAL WARNING: This action cannot be undone. Proceed?')) return;

    try {
      if (window.electronAPI && window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery("DELETE FROM customers WHERE id = ?", [customer.id]);
      } else if (db.deleteCustomer) {
        await db.deleteCustomer(customer.id);
      } else {
        setSnackbar({ open: true, message: 'Delete function not available.', severity: 'error' });
        return;
      }

      setSnackbar({ open: true, message: `Customer "${customer.name}" deleted.`, severity: 'success' });
      await loadData();
      if (selectedCustomer && selectedCustomer.id === customer.id) {
        setSelectedCustomer(null);
        setLedger([]);
      }
    } catch (err) {
      console.error('Delete customer error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== VIEW SALE ITEMS ====================
  const handleViewItems = async (event, saleId) => {
    setAnchorEl(event.currentTarget);
    setPopoverSaleId(saleId);
    const items = await fetchSaleItems(saleId);
    setPopoverItems(items || []);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setPopoverItems([]);
    setPopoverSaleId(null);
  };

  const openPopover = Boolean(anchorEl);

  // ==================== FIX NEGATIVE BALANCES ====================
  const fixNegativeBalances = async () => {
    if (!window.confirm('This will fix all customers with negative balances. Continue?')) return;

    try {
      let fixed = 0;
      for (const customer of customers) {
        const balance = parseFloat(customer.current_balance || 0);
        if (balance < 0) {
          if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery(
              "UPDATE customers SET current_balance = 0 WHERE id = ?",
              [customer.id]
            );
          } else if (db.updateCustomer) {
            await db.updateCustomer(customer.id, { ...customer, current_balance: 0 });
          }
          fixed++;
        }
      }
      setSnackbar({ open: true, message: `Fixed ${fixed} customers with negative balances!`, severity: 'success' });
      await loadData();
      if (selectedCustomer) {
        const ledgerData = await buildLedger(selectedCustomer);
        setLedger(ledgerData);
      }
    } catch (err) {
      console.error('Fix negative balances error:', err);
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== FILTERS & STATS ====================
  const filteredCustomers = useMemo(() => {
    if (!recoveryEnabled) return [];
    return customers.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (c.phone || '').includes(searchQuery.trim()) ||
        (c.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim());

      const balance = parseFloat(c.current_balance || 0);

      let matchType = true;
      if (activeTab === 1) matchType = balance > 0;
      else if (activeTab === 2) matchType = balance <= 0;
      else if (activeTab === 3) matchType = c.customer_type === 'wholesale';
      else if (activeTab === 4) matchType = c.customer_type === 'retail';

      return matchSearch && matchType;
    });
  }, [customers, searchQuery, activeTab, recoveryEnabled]);

  const paginatedCustomers = useMemo(() => {
    if (!recoveryEnabled) return [];
    const start = (page - 1) * rowsPerPage;
    return filteredCustomers.slice(start, start + rowsPerPage);
  }, [filteredCustomers, page, rowsPerPage, recoveryEnabled]);

  const stats = useMemo(() => {
    if (!recoveryEnabled) return { totalPending: 0, totalReceivable: 0, defaulters: 0, wholesale: 0, retail: 0 };
    const totalPending = customers.reduce((sum, c) => sum + (parseFloat(c.current_balance) > 0 ? parseFloat(c.current_balance) : 0), 0);
    const totalReceivable = customers.reduce((sum, c) => sum + (parseFloat(c.current_balance) || 0), 0);
    const defaulters = customers.filter(c => (parseFloat(c.current_balance) || 0) > 0).length;
    const wholesale = customers.filter(c => c.customer_type === 'wholesale').length;
    const retail = customers.filter(c => c.customer_type === 'retail').length;

    return { totalPending, totalReceivable, defaulters, wholesale, retail };
  }, [customers, recoveryEnabled]);

  const handleTabChange = (e, v) => {
    setActiveTab(v);
    setPage(1);
  };

  const ledgerSummary = useMemo(() => {
    if (!recoveryEnabled) return { totalDue: 0, totalReceived: 0 };
    const totalDue = ledger.filter(l => l.isDebit && !l.isOpening).reduce((sum, l) => sum + l.amount, 0);
    const totalReceived = ledger.filter(l => !l.isDebit && !l.isOpening).reduce((sum, l) => sum + l.amount, 0);
    return { totalDue, totalReceived };
  }, [ledger, recoveryEnabled]);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return ledger;
    if (ledgerFilter === 'sales') return ledger.filter(l => l.type === 'Sale' || l.isOpening);
    if (ledgerFilter === 'payments') return ledger.filter(l => l.type === 'Payment Received');
    return ledger;
  }, [ledger, ledgerFilter]);

  // ==================== TOGGLE RECOVERY ====================
  const toggleRecovery = () => {
    const newState = !recoveryEnabled;
    setRecoveryEnabled(newState);
    if (!newState) {
      setSelectedCustomer(null);
      setLedger([]);
      setCustomers([]);
      setSales([]);
      setOrphanSales([]);
    } else {
      loadData();
    }
    setSnackbar({ 
      open: true, 
      message: newState ? 'Recovery Module Enabled' : 'Recovery Module Disabled', 
      severity: newState ? 'success' : 'info' 
    });
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>

      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary">
            <AccountBalanceWallet sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 24 : 28 }} />
            {isMobile ? 'Recovery' : 'Recovery & Receivable Management'}
          </Typography>
          <Chip 
            size="small" 
            label={recoveryEnabled ? 'ON' : 'OFF'} 
            color={recoveryEnabled ? 'success' : 'error'}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <Tooltip title="Fix Negative Balances">
            <Button variant="outlined" size="small" color="error" onClick={fixNegativeBalances} startIcon={<Restore />}>
              Fix Balances
            </Button>
          </Tooltip>
          <Tooltip title={recoveryEnabled ? 'Disable Recovery Module' : 'Enable Recovery Module'}>
            <FormControlLabel
              control={
                <Switch 
                  checked={recoveryEnabled} 
                  onChange={toggleRecovery}
                  color="success"
                  size={isMobile ? 'small' : 'medium'}
                />
              }
              label={recoveryEnabled ? 'ON' : 'OFF'}
              sx={{ mr: 0 }}
            />
          </Tooltip>

          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            {isMobile ? 'Filters' : 'Toggle Search'}
          </Button>
          <Button variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} startIcon={<Refresh />} onClick={loadData} disabled={loading || !recoveryEnabled}>
            {loading ? 'Loading...' : isMobile ? 'Sync' : 'Sync Ledgers'}
          </Button>
        </Stack>
      </Box>

      {/* DISABLED STATE */}
      {!recoveryEnabled && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fef9e7', border: '2px dashed #f59e0b' }}>
          <PowerSettingsNew sx={{ fontSize: 60, color: '#f59e0b' }} />
          <Typography variant="h6" color="#92400e" fontWeight="bold" sx={{ mt: 1 }}>
            Recovery Module is Disabled
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Toggle the switch above to enable recovery and receivable management.
          </Typography>
        </Paper>
      )}

      {/* ORPHAN SALES WARNING */}
      {recoveryEnabled && orphanSales.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setFixOrphanDialog(true)}>
              Fix Now ({orphanSales.length})
            </Button>
          }
        >
          {orphanSales.length} sales are not assigned to any customer.
        </Alert>
      )}

      {/* NEGATIVE BALANCE WARNING */}
      {recoveryEnabled && customers.some(c => parseFloat(c.current_balance || 0) < 0) && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={fixNegativeBalances}>
              Fix Now
            </Button>
          }
        >
          {customers.filter(c => parseFloat(c.current_balance || 0) < 0).length} customers have NEGATIVE balances!
        </Alert>
      )}

      {/* STATS CARDS */}
      {recoveryEnabled && (
        <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
          {[
            { title: 'Total Receivable', value: formatCurrency(stats.totalReceivable), icon: <TrendingUp />, isReceivable: true },
            { title: 'Pending Balance', value: formatCurrency(stats.totalPending), icon: <Warning />, isPending: true },
            { title: 'Arrears', value: stats.defaulters, icon: <ErrorIcon />, isCount: true, isDefaulter: stats.defaulters > 0 },
            { title: 'Wholesale', value: stats.wholesale, icon: <Store />, isCount: true },
            { title: 'Retail', value: stats.retail, icon: <Person />, isCount: true },
            { title: 'Total Customers', value: customers.length, icon: <AccountBalance />, isCount: true },
          ].map((stat, idx) => (
            <Grid item xs={4} md={2} key={idx}>
              <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                  <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                    {stat.title}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                    {stat.isCount ? stat.value : stat.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* TABS */}
      {recoveryEnabled && (
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
              icon={<AccountBalance fontSize="small" />} 
              iconPosition="start" 
              label={isMobile ? 'All (' + customers.length + ')' : 'All Ledgers (' + customers.length + ')'} 
              sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
            />
            <Tab 
              icon={<Warning fontSize="small" />} 
              iconPosition="start" 
              label={isMobile ? 'Due (' + stats.defaulters + ')' : 'Arrears (' + stats.defaulters + ')'} 
              sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
            />
            <Tab 
              icon={<CheckCircle fontSize="small" />} 
              iconPosition="start" 
              label={isMobile ? 'Settled' : 'Fully Settled'} 
              sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
            />
            <Tab 
              icon={<Store fontSize="small" />} 
              iconPosition="start" 
              label={isMobile ? 'Whole' : 'Wholesale'} 
              sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
            />
            <Tab 
              icon={<Person fontSize="small" />} 
              iconPosition="start" 
              label={isMobile ? 'Retail' : 'Retail'} 
              sx={{ fontSize: isMobile ? '0.6rem' : '0.875rem', py: isMobile ? 0.5 : 1 }}
            />
          </Tabs>
        </Paper>
      )}

      {/* SEARCH */}
      {recoveryEnabled && showFilters && (
        <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #10b981', bgcolor: '#fbfdfb' }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth 
                size="small" 
                placeholder={isMobile ? "Search customers..." : "Search by name, phone, or shop name..."}
                value={searchQuery} 
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{ 
                  startAdornment: <Search sx={{ mr: 1, color: '#10b981' }} />,
                  endAdornment: searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Close fontSize="small" />
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="outlined" color="success" size="small" onClick={() => { setSearchQuery(''); setPage(1); }}>
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      {recoveryEnabled && (
        <Grid container spacing={isMobile ? 1 : 2}>
          {/* CUSTOMER LIST */}
          <Grid item xs={12} md={selectedCustomer && !isMobile && showLedgerPanel ? 4 : 12}>
            <Paper sx={{ border: '1px solid #e5e7eb' }}>
              {isMobile ? (
                <Box sx={{ p: 0.5 }}>
                  {loading ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <LinearProgress />
                      <Typography sx={{ mt: 2 }}>Loading...</Typography>
                    </Box>
                  ) : paginatedCustomers.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <AccountBalanceWallet sx={{ fontSize: 48, color: '#d1d5db' }} />
                      <Typography color="text.secondary">No customers found</Typography>
                    </Paper>
                  ) : (
                    paginatedCustomers.map((c, idx) => (
                      <MobileCustomerCard
                        key={c.id}
                        customer={c}
                        index={(page - 1) * rowsPerPage + idx + 1}
                        onView={viewLedger}
                        onClear={handleClearBalance}
                        onDelete={handleDeleteCustomer}
                        getCustomerSalesSummary={getCustomerSalesSummary}
                      />
                    ))
                  )}
                  <UnifiedPagination
                    count={filteredCustomers.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={(newR) => {
                      setRowsPerPage(newR);
                      setPage(1);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </Box>
              ) : (
                <>
                  <TableContainer sx={{ maxHeight: selectedCustomer && showLedgerPanel ? 'calc(100vh - 380px)' : 'calc(100vh - 320px)' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#1c2580' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>#</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Party Details</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Type</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Balance</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Sales</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedCustomers.map((c, idx) => {
                          const summary = getCustomerSalesSummary(c.id);
                          const isSelected = selectedCustomer?.id === c.id;
                          const balance = parseFloat(c.current_balance || 0);
                          const limit = parseFloat(c.credit_limit) || 0;
                          const usagePercent = limit > 0 ? Math.min(100, (Math.max(0, balance) / limit) * 100) : 0;

                          return (
                            <TableRow 
                              key={c.id} 
                              hover 
                              onClick={() => viewLedger(c)}
                              sx={{ 
                                cursor: 'pointer',
                                bgcolor: isSelected ? '#f0fdf4' : balance > 0 ? '#fff5f5' : 'inherit',
                                '&:hover': { bgcolor: '#f3f4f6' }
                              }}
                            >
                              <TableCell>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                              <TableCell>
                                <Typography variant="subtitle2" fontWeight="bold">{c.name}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  <Phone sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                                  {c.phone || 'No phone'}
                                </Typography>
                                {c.shop_name && (
                                  <Typography variant="caption" color="primary.main" fontWeight={500} display="block">
                                    <Store sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                                    {c.shop_name}
                                  </Typography>
                                )}
                                {limit > 0 && (
                                  <Box sx={{ mt: 0.5 }}>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={usagePercent}
                                      sx={{ height: 4, borderRadius: 2, width: 100, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#10b981' }}}
                                    />
                                    <Typography variant="caption" color={usagePercent > 80 ? 'error.main' : 'text.secondary'}>
                                      {Math.round(usagePercent)}% of {formatCurrency(limit)}
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  size="small" 
                                  color={c.customer_type === 'wholesale' ? 'info' : 'default'} 
                                  label={String(c.customer_type || 'retail').toUpperCase()} 
                                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 'bold' }} 
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="bold" color={balance > 0 ? 'error.main' : balance < 0 ? 'warning.main' : 'success.main'}>
                                  {formatCurrency(balance)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {summary.invoiceCount} invoices
                                </Typography>
                                {summary.daysSincePayment > 0 && balance > 0 && (
                                  <Typography variant="caption" color="warning.main" display="block">
                                    Last paid: {summary.daysSincePayment}d ago
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="500">
                                  {formatCurrency(summary.totalSales)}
                                </Typography>
                                <Typography variant="caption" color="success.main">
                                  Paid: {formatCurrency(summary.totalPaid)}
                                </Typography>
                                {summary.lastSale && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Last: {formatDate(summary.lastSale.date)}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); viewLedger(c); }}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                  <Tooltip title="Clear Balance">
                                    <IconButton size="small" color="warning" onClick={(e) => { e.stopPropagation(); handleClearBalance(c); }}>
                                      <Restore fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete Customer">
                                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c); }}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {paginatedCustomers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                              <Typography color="text.secondary">No matching records found.</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <UnifiedPagination
                    count={filteredCustomers.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={(newR) => {
                      setRowsPerPage(newR);
                      setPage(1);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              )}
            </Paper>
          </Grid>

          {/* LEDGER PANEL */}
          {selectedCustomer && !isMobile && showLedgerPanel && (
            <Grid item xs={12} md={8}>
              <Fade in>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<Assessment />} onClick={() => setShowStatementDialog(true)}>
                      Statement
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<VerifiedUser />} onClick={verifyBalance} disabled={verifyingBalance}>
                      {verifyingBalance ? 'Verifying...' : 'Verify'}
                    </Button>
                    <Tooltip title="Close Ledger Panel">
                      <IconButton size="small" color="error" onClick={() => setShowLedgerPanel(false)}>
                        <VisibilityOff fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Card variant="outlined" sx={{ mb: 2, borderLeft: '5px solid #10b981', bgcolor: '#f9fafb' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <Typography variant="h6" fontWeight="bold" color="primary.main">{selectedCustomer.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{selectedCustomer.shop_name || 'Individual Account'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            <Phone sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                            {selectedCustomer.phone || '-'}
                          </Typography>
                          <CreditLimitWarning customer={selectedCustomer} />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <Typography variant="caption" color="text.secondary" display="block">Total Sales</Typography>
                          <Typography variant="h6" fontWeight="bold" color="error.main">
                            {formatCurrency(ledgerSummary.totalDue)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <Typography variant="caption" color="text.secondary" display="block">Total Paid</Typography>
                          <Typography variant="h6" fontWeight="bold" color="success.main">
                            {formatCurrency(ledgerSummary.totalReceived)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <Typography variant="caption" color="text.secondary" display="block">Outstanding</Typography>
                          <Typography variant="h5" fontWeight="bold" color={(selectedCustomer.current_balance || 0) > 0 ? 'error.main' : (selectedCustomer.current_balance || 0) < 0 ? 'warning.main' : 'success.main'}>
                            {formatCurrency(selectedCustomer.current_balance)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Button 
                            fullWidth 
                            variant="contained" 
                            color="success" 
                            size="small" 
                            startIcon={<Payment />} 
                            onClick={handlePaymentOpen}
                            disabled={selectedCustomer.current_balance <= 0}
                            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                          >
                            Receive Payment
                          </Button>
                          <Button 
                            fullWidth 
                            variant="outlined" 
                            size="small" 
                            startIcon={<FileDownload />} 
                            onClick={() => setShowStatementDialog(true)}
                            sx={{ mt: 1 }}
                          >
                            Export Statement
                          </Button>
                        </Grid>
                      </Grid>
                      <AgingAnalysis customer={selectedCustomer} sales={sales} />
                    </CardContent>
                  </Card>

                  <Paper sx={{ border: '1px solid #e5e7eb' }}>
                    <Box sx={{ p: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        <History sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.1rem', color: '#10b981' }} /> 
                        Transaction Ledger ({filteredLedger.length} entries)
                      </Typography>
                      <ToggleButtonGroup
                        value={ledgerFilter}
                        exclusive
                        onChange={(e, val) => val && setLedgerFilter(val)}
                        size="small"
                      >
                        <ToggleButton value="all" sx={{ fontSize: '0.65rem', py: 0.3 }}>All</ToggleButton>
                        <ToggleButton value="sales" sx={{ fontSize: '0.65rem', py: 0.3 }}>Sales</ToggleButton>
                        <ToggleButton value="payments" sx={{ fontSize: '0.65rem', py: 0.3 }}>Payments</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <TableContainer sx={{ maxHeight: 'calc(100vh - 520px)' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#1c2580' }}>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }}>Date</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }}>Type</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }}>Description</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }}>Ref#</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }} align="right">Debit</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }} align="right">Credit</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }} align="right">Balance</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }} align="center">Items</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', py: 1.2 }} align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredLedger.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">No transactions found.</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredLedger.map((entry) => (
                              <TableRow key={entry.id} hover sx={{ bgcolor: entry.isOpening ? '#fef3c7' : 'inherit' }}>
                                <TableCell sx={{ fontSize: '0.75rem' }}>{formatDate(entry.date)}</TableCell>
                                <TableCell>
                                  <Chip 
                                    size="small" 
                                    label={entry.type} 
                                    color={entry.isOpening ? 'warning' : (entry.isDebit ? 'error' : 'success')} 
                                    sx={{ height: 18, fontSize: '0.55rem', fontWeight: 'bold' }} 
                                  />
                                </TableCell>
                                <TableCell sx={{ fontSize: '0.75rem' }}>{entry.description}</TableCell>
                                <TableCell sx={{ fontSize: '0.7rem' }}>{entry.reference_no || '-'}</TableCell>
                                <TableCell align="right" sx={{ color: 'red', fontWeight: 500, fontSize: '0.75rem' }}>
                                  {entry.isDebit ? formatCurrency(entry.amount) : '-'}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'green', fontWeight: 500, fontSize: '0.75rem' }}>
                                  {!entry.isDebit ? formatCurrency(entry.amount) : '-'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                                  {formatCurrency(entry.balance_after)}
                                </TableCell>
                                <TableCell align="center">
                                  {entry.type === 'Sale' && entry.saleId && (
                                    <Tooltip title="View Items">
                                      <IconButton 
                                        size="small" 
                                        color="info" 
                                        onClick={(e) => handleViewItems(e, entry.saleId)}
                                      >
                                        <ShoppingCart fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  {!entry.isOpening && (
                                    <Tooltip title="Delete Entry">
                                      <IconButton 
                                        size="small" 
                                        color="error" 
                                        onClick={() => handleDeleteLedgerEntry(entry)}
                                      >
                                        <Delete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>

                  {paymentHistory.length > 0 && (
                    <Paper sx={{ mt: 2, border: '1px solid #e5e7eb' }}>
                      <Box sx={{ p: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          <Payment sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.1rem', color: '#10b981' }} /> 
                          Payment History ({paymentHistory.length})
                        </Typography>
                      </Box>
                      <PaymentHistoryTable 
                        payments={paymentHistory} 
                        onPrint={(payment) => {
                          setLastPayment(payment);
                          setShowPaymentReceipt(true);
                        }}
                        onDelete={handleDeletePayment}
                      />
                    </Paper>
                  )}
                </Box>
              </Fade>
            </Grid>
          )}

          {/* LEDGER PANEL CLOSED */}
          {selectedCustomer && !isMobile && !showLedgerPanel && (
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', bgcolor: '#f9fafb', borderRadius: 2, border: '2px dashed #d1d5db' }}>
                <Button 
                  variant="contained" 
                  startIcon={<Visibility />} 
                  onClick={() => setShowLedgerPanel(true)}
                  sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                >
                  Show Ledger Panel
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* ===== MOBILE LEDGER DRAWER ===== */}
      {isMobile && selectedCustomer && recoveryEnabled && (
        <Drawer 
          anchor="bottom" 
          open={!!selectedCustomer} 
          onClose={() => setSelectedCustomer(null)}
          sx={{ '& .MuiDrawer-paper': { height: '90vh', maxHeight: '90vh' } }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {selectedCustomer?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedCustomer?.shop_name || ''}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedCustomer(null)}>
                <Close />
              </IconButton>
            </Box>

            {selectedCustomer && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 1.5, bgcolor: '#f9fafb', borderRadius: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                    <Typography variant="h6" fontWeight="bold" color={(selectedCustomer.current_balance || 0) > 0 ? 'error.main' : (selectedCustomer.current_balance || 0) < 0 ? 'warning.main' : 'success.main'}>
                      {formatCurrency(selectedCustomer.current_balance)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      variant="contained" 
                      color="success" 
                      size="small" 
                      startIcon={<Payment />} 
                      onClick={() => { setPaymentDialog(true); }}
                      disabled={selectedCustomer.current_balance <= 0}
                      sx={{ bgcolor: '#10b981' }}
                    >
                      Pay
                    </Button>
                    <IconButton size="small" color="error" onClick={() => handleDeleteCustomer(selectedCustomer)}>
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>

                <ToggleButtonGroup
                  value={ledgerFilter}
                  exclusive
                  onChange={(e, val) => val && setLedgerFilter(val)}
                  size="small"
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  <ToggleButton value="all" sx={{ fontSize: '0.65rem' }}>All</ToggleButton>
                  <ToggleButton value="sales" sx={{ fontSize: '0.65rem' }}>Sales</ToggleButton>
                  <ToggleButton value="payments" sx={{ fontSize: '0.65rem' }}>Payments</ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                  <History sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1rem' }} />
                  Transaction History ({filteredLedger.length})
                </Typography>

                <List dense sx={{ maxHeight: 'calc(70vh - 160px)', overflow: 'auto' }}>
                  {filteredLedger.length === 0 ? (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      No transactions found
                    </Typography>
                  ) : (
                    filteredLedger.map((entry, idx) => (
                      <MobileLedgerEntry key={entry.id || idx} entry={entry} />
                    ))
                  )}
                </List>
              </>
            )}
          </Box>
        </Drawer>
      )}

      {/* ===== FIX ORPHAN SALES DIALOG ===== */}
      <Dialog open={fixOrphanDialog} onClose={() => setFixOrphanDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white' }}>
          <LinkOff sx={{ verticalAlign: 'middle', mr: 1 }} />
          Fix Orphan Sales ({orphanSales.length})
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {orphanSales.length} sales are currently not assigned to any customer.
          </Alert>

          <FormControl fullWidth size="small">
            <InputLabel>Select Customer</InputLabel>
            <Select
              value={selectedCustomerForOrphan}
              onChange={(e) => setSelectedCustomerForOrphan(e.target.value)}
              label="Select Customer"
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto', bgcolor: '#f9fafb', p: 1, borderRadius: 1 }}>
            <Typography variant="caption" fontWeight="bold">Orphan Sales:</Typography>
            {orphanSales.slice(0, 10).map((sale, idx) => (
              <Typography key={idx} variant="caption" display="block" color="text.secondary">
                {sale.invoice_no || sale.id} - {formatCurrency(sale.grand_total)}
              </Typography>
            ))}
            {orphanSales.length > 10 && (
              <Typography variant="caption" color="text.secondary">
                ... and {orphanSales.length - 10} more
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixOrphanDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleFixOrphanSales}
            disabled={!selectedCustomerForOrphan}
            startIcon={<DoneAll />}
          >
            Assign All
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== STATEMENT DIALOG ===== */}
      <StatementDialog 
        open={showStatementDialog} 
        onClose={() => setShowStatementDialog(false)} 
        customer={selectedCustomer}
        ledger={ledger}
        shop={shopProfile}
      />

      {/* ===== PAYMENT RECEIPT DIALOG ===== */}
      <Dialog open={showPaymentReceipt} onClose={() => setShowPaymentReceipt(false)} maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', py: 1 }}>
          <ReceiptLong sx={{ mr: 1, verticalAlign: 'middle' }} />
          Payment Receipt
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#f3f4f6' }}>
          <Paper 
            sx={{ 
              p: 1, 
              width: getEffectiveReceiptSettings().paperSize === '58mm' ? '58mm' : (getEffectiveReceiptSettings().paperSize === 'custom' ? `${getEffectiveReceiptSettings().customWidthMm || 80}mm` : '80mm'), 
              maxWidth: '100%', 
              bgcolor: 'white', 
              boxShadow: 3 
            }} 
            className="payment-receipt-content"
          >
            <PaymentReceipt 
              ref={printRef}
              payment={lastPayment} 
              customer={selectedCustomer}
              shop={shopProfile}
            />
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentReceipt(false)}>Close</Button>
          <Button onClick={handlePrintPaymentReceipt} variant="contained" startIcon={<Print />} sx={{ bgcolor: '#10b981' }}>
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== POPOVER FOR ITEMS ===== */}
      <Popover
        open={openPopover}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, maxWidth: 300, minWidth: 200 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCart fontSize="small" /> Purchased Items
          </Typography>
          <Divider sx={{ mb: 1 }} />
          {popoverItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No items found.</Typography>
          ) : (
            <List dense>
              {popoverItems.map((item, i) => (
                <ListItem key={i} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <Typography variant="caption" fontWeight="bold" color="primary">x{item.qty || 1}</Typography>
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name || 'Product'} 
                    secondary={formatCurrency(item.price || 0)} 
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Button size="small" onClick={handleClosePopover}>Close</Button>
          </Box>
        </Box>
      </Popover>

      {/* ===== PAYMENT DIALOG ===== */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <Payment sx={{ verticalAlign: 'middle', mr: 1 }} />
          Receive Payment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedCustomer && (
            <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Customer:</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedCustomer.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Outstanding:</Typography>
                  <Typography variant="body2" color="error.main" fontWeight="bold">{formatCurrency(selectedCustomer.current_balance)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">After Payment:</Typography>
                  <Typography variant="body2" color="success.main" fontWeight="bold">
                    {formatCurrency(Math.max(0, (selectedCustomer.current_balance || 0) - (parseFloat(paymentForm.amount) || 0)))}
                  </Typography>
                </Box>
              </Box>

              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Amount (PKR) *" 
                value={paymentForm.amount} 
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                autoFocus 
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  endAdornment: paymentForm.amount && (
                    <InputAdornment position="end">
                      <Chip 
                        size="small" 
                        label={'Max: ' + formatCurrency(selectedCustomer.current_balance)} 
                        color="info" 
                        sx={{ height: 18, fontSize: '0.5rem' }} 
                      />
                    </InputAdornment>
                  )
                }}
              />

              <TextField 
                fullWidth 
                size="small" 
                type="date" 
                label="Date *" 
                value={paymentForm.date} 
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} 
                InputLabelProps={{ shrink: true }} 
              />

              <FormControl size="small" fullWidth>
                <InputLabel>Payment Mode *</InputLabel>
                <Select 
                  value={paymentForm.payment_mode} 
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })} 
                  label="Payment Mode *"
                >
                  <MenuItem value="cash"><LocalAtm sx={{ mr: 1 }} /> Cash</MenuItem>
                  <MenuItem value="bank_transfer"><AccountBalance sx={{ mr: 1 }} /> Bank Transfer</MenuItem>
                  <MenuItem value="easypaisa"><CreditCard sx={{ mr: 1 }} /> EasyPaisa</MenuItem>
                  <MenuItem value="jazzcash"><CreditCard sx={{ mr: 1 }} /> JazzCash</MenuItem>
                </Select>
              </FormControl>

              <TextField 
                fullWidth 
                size="small" 
                label="Reference No." 
                value={paymentForm.reference_no} 
                onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} 
                placeholder="Auto-generated if empty"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setPaymentForm({ ...paymentForm, reference_no: generatePaymentRef() })}>
                        <Refresh fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <TextField 
                fullWidth 
                size="small" 
                label="Description / Note" 
                value={paymentForm.description} 
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} 
                placeholder="Optional note"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button fullWidth={isMobile} onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            fullWidth={isMobile}
            variant="contained" 
            color="success" 
            onClick={handlePayment} 
            disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0 || parseFloat(paymentForm.amount) > parseFloat(selectedCustomer?.current_balance || 0)}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            startIcon={<DoneAll />}
          >
            Post Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== MOBILE DRAWER ===== */}
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
              <ListItemText primary="Sync Data" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); toggleRecovery(); }}>
              <ListItemIcon><PowerSettingsNew /></ListItemIcon>
              <ListItemText primary={recoveryEnabled ? 'Disable Recovery' : 'Enable Recovery'} />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); fixNegativeBalances(); }}>
              <ListItemIcon><Restore /></ListItemIcon>
              <ListItemText primary="Fix Negative Balances" />
            </ListItem>
            {orphanSales.length > 0 && (
              <ListItem button onClick={() => { setMobileDrawer(false); setFixOrphanDialog(true); }}>
                <ListItemIcon><LinkOff /></ListItemIcon>
                <ListItemText primary={`Fix Orphan Sales (${orphanSales.length})`} />
              </ListItem>
            )}
          </List>
        </Box>
      </Drawer>

      {/* ===== SNACKBAR ===== */}
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