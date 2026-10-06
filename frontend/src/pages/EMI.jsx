// ============================================================
//  EMI.jsx — Complete EMI Dashboard (React + MUI)
//  Features: Full CRUD, Payments, History, Schedule, Tracker
//  Exports: CSV, PDF | Responsive: Mobile + Desktop
// ============================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Tabs, Tab, IconButton, Stack, Divider,
  LinearProgress, InputAdornment, FormControl, InputLabel, Select, MenuItem, Snackbar,
  useMediaQuery, useTheme, Collapse, Avatar, Badge, Tooltip,
  Drawer, List, ListItem, ListItemText, ListItemIcon, Fab, SpeedDial, SpeedDialAction,
  Checkbox, FormControlLabel, Pagination, Skeleton, Menu, Fade, Backdrop, CircularProgress,
  Autocomplete
} from '../components/ui/tailwind-mui';
import {
  Calculate as CalcIcon, Payment as PayIcon, History as HistoryIcon,
  Timeline, FilterList, Refresh, Warning, CheckCircle, Search,
  People, AttachMoney, TrendingUp, TrendingDown, CalendarToday,
  Menu as MenuIcon, Close, Receipt, Store, Phone, Person,
  Cancel, Check, ArrowForward, ArrowBack, FileDownload, PictureAsPdf,
  TableChart, MoreVert, Delete, Edit, Visibility, Print, Share,
  ArrowDropDown, CloudDownload, Assessment, MoneyOff, AccountBalance,
  CreditCard, LocalAtm, QrCode, Save, Add, Remove, ExpandMore, ExpandLess,
  UploadFile, ImageIcon, CameraAlt
} from '../components/ui/icons';
import UnifiedPagination from '../components/common/UnifiedPagination';

// ============================================================
//  HELPERS
// ============================================================

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

const getDaysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

const generateApplicationNo = () => {
  const prefix = 'EMI';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${timestamp}-${random}`;
};

const statusColors = {
  active: { bg: '#dbeafe', text: '#1e40af', chip: 'primary' },
  overdue: { bg: '#fee2e2', text: '#991b1b', chip: 'error' },
  defaulted: { bg: '#fef3c7', text: '#92400e', chip: 'warning' },
  closed: { bg: '#f3f4f6', text: '#4b5563', chip: 'default' },
  settled: { bg: '#d1fae5', text: '#065f46', chip: 'success' },
  completed: { bg: '#d1fae5', text: '#065f46', chip: 'success' },
  legal: { bg: '#fce7f3', text: '#9d174d', chip: 'secondary' }
};

const paymentModeIcons = {
  cash: <LocalAtm fontSize="small" />,
  bank_transfer: <AccountBalance fontSize="small" />,
  cheque: <Receipt fontSize="small" />,
  easypaisa: <Phone fontSize="small" />,
  jazzcash: <Phone fontSize="small" />,
  card: <CreditCard fontSize="small" />,
  other: <AttachMoney fontSize="small" />
};

// ============================================================
//  CSV EXPORT HELPER
// ============================================================
const downloadCSV = (filename, headers, rows) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const val = String(cell ?? '').replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

// ============================================================
//  PDF EXPORT HELPER (Print-based for reliability)
// ============================================================
const downloadPDF = (title, htmlContent) => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #333; }
        h1 { font-size: 16px; color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
        h2 { font-size: 12px; color: #666; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #10b981; color: white; padding: 6px; text-align: left; font-size: 9px; }
        td { padding: 5px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
        tr:nth-child(even) { background: #f9fafb; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: bold; }
        .badge-active { background: #dbeafe; color: #1e40af; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
        .badge-completed { background: #d1fae5; color: #065f46; }
        .badge-defaulted { background: #fef3c7; color: #92400e; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .footer { margin-top: 20px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        .summary-box { display: inline-block; margin: 5px 10px 5px 0; padding: 8px 12px; background: #f3f4f6; border-radius: 4px; }
        .summary-label { font-size: 8px; color: #666; text-transform: uppercase; }
        .summary-value { font-size: 12px; font-weight: bold; color: #111; }
      </style>
    </head>
    <body>
      ${htmlContent}
      <div class="footer">
        Generated by Raath Enterprise ERP | ${new Date().toLocaleString('en-GB')}<br>
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); window.close(); }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

// ============================================================
//  MOBILE EMI CARD
// ============================================================
const MobileEMICard = ({ emi, customer, details, onPay, onHistory, onView, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const statusConfig = statusColors[details.computedStatus] || statusColors.active;

  return (
    <Card sx={{
      mb: 1.5,
      borderLeft: `4px solid ${statusConfig.text}`,
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'all 0.2s',
      '&:active': { transform: 'scale(0.995)' }
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ color: '#111827' }}>
              {emi._customer_name || customer?.name || customer?.customer_name || 'Walk-in Customer'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {emi.product_name} {emi.product_sku ? `[${emi.product_sku}]` : ''}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={details.computedStatus.toUpperCase()}
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 'bold',
                  bgcolor: statusConfig.bg,
                  color: statusConfig.text,
                  border: `1px solid ${statusConfig.text}20`
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {emi.paid_months || 0}/{emi.total_months || 0} mo
              </Typography>
              {details.daysOverdue > 0 && (
                <Chip size="small" label={`${details.daysOverdue}d late`} color="error" sx={{ height: 18, fontSize: '0.55rem' }} />
              )}
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right', ml: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="#10b981">
              {formatCurrency(emi.emi_amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {formatDate(emi.next_due_date)}
            </Typography>
            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ mt: 0.5 }}>
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={() => { setAnchorEl(null); onView(emi); }}><ListItemIcon><Visibility fontSize="small" /></ListItemIcon>View Details</MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); onHistory(emi); }}><ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>History</MenuItem>
              {details.remainingMonths > 0 && details.computedStatus !== 'completed' && (
                <MenuItem onClick={() => { setAnchorEl(null); onPay(emi); }}><ListItemIcon><PayIcon fontSize="small" color="success" /></ListItemIcon>Record Payment</MenuItem>
              )}
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); onDelete(emi); }} sx={{ color: 'error.main' }}>
                <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>Delete EMI
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(details.progress, 100)}
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              bgcolor: '#e5e7eb',
              '& .MuiLinearProgress-bar': {
                bgcolor: details.isOverdue ? '#ef4444' : details.progress >= 100 ? '#10b981' : '#3b82f6',
                borderRadius: 4
              }
            }}
          />
          <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 35, textAlign: 'right' }}>
            {Math.round(details.progress)}%
          </Typography>
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Total Amount</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(emi.total_amount)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Down Payment</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(emi.down_payment)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Paid So Far</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(details.totalPaid)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Remaining</Typography>
              <Typography variant="body2" fontWeight="bold" color={details.isOverdue ? 'error' : 'warning.main'}>
                {formatCurrency(emi.remaining_amount)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Phone</Typography>
              <Typography variant="body2">{customer?.phone || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">App No</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{emi.application_no}</Typography>
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          {details.remainingMonths > 0 && details.computedStatus !== 'completed' && (
            <Button
              size="small"
              variant="contained"
              startIcon={<PayIcon />}
              onClick={() => onPay(emi)}
              sx={{ flex: 1, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: 2, textTransform: 'none' }}
            >
              Pay
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => onHistory(emi)}
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none' }}
          >
            History
          </Button>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// ============================================================
//  MAIN EMI COMPONENT
// ============================================================
export default function EMI() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState(0);
  const [emis, setEmis] = useState([]);
  const [emiPayments, setEmiPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGuarantor, setFilterGuarantor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Payments Tab Filters & Delete State
  const [payFilterCustomer, setPayFilterCustomer] = useState('');
  const [payFilterProduct, setPayFilterProduct] = useState('');
  const [payFilterMode, setPayFilterMode] = useState('all');
  const [payFilterDateFrom, setPayFilterDateFrom] = useState('');
  const [payFilterDateTo, setPayFilterDateTo] = useState('');
  const [deletePaymentDialog, setDeletePaymentDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);
  const [payPage, setPayPage] = useState(1);
  const [payRowsPerPage, setPayRowsPerPage] = useState(isMobile ? 10 : 25);

  const [trackSKU, setTrackSKU] = useState('');
  const [trackHistoryResult, setTrackHistoryResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [openCalculator, setOpenCalculator] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState([]);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectedGuarantors, setSelectedGuarantors] = useState([]);
  const [selectedVisits, setSelectedVisits] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const [calc, setCalc] = useState({
    productVariantId: '',
    productName: '', productSKU: '', totalAmount: 0, downPayment: 0,
    downPaymentMode: 'cash',
    downPaymentAccountId: '',
    interestRate: 0, months: 12, customerId: '',
    shopLocation: '', notes: '', agreementSigned: false
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '', penaltyAmount: 0, discountAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'cash', accountId: '', bankName: '', chequeNo: '', chequeDate: '',
    notes: '', receiptNo: ''
  });

  const [historyTab, setHistoryTab] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
    const [products, setProducts] = useState([]);
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', cnic: '', address: '', district: '', province: ''
  });

  // Guarantor modal state
  const [guarantorDialog, setGuarantorDialog] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({
    name: '', phone: '', cnic: '', address: '', occupation: '',
    monthly_income: 0, relation_to_customer: '', guarantor_type: 1,
    passport_photo_path: null, blank_check_photo_path: null,
    cnic_front_photo_path: null, cnic_back_photo_path: null
  });
  // Inline guarantors during EMI creation
  const [newGuarantors, setNewGuarantors] = useState([]);
  const [showInlineGuarantor, setShowInlineGuarantor] = useState(false);
  
  // Guarantor system-wide
  const [allGuarantors, setAllGuarantors] = useState([]);
  const [guarantorEditDialog, setGuarantorEditDialog] = useState(false);
  const [editingGuarantor, setEditingGuarantor] = useState(null);
  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [guarantorDetailDialog, setGuarantorDetailDialog] = useState(false);
  const [selectedGuarantorDetail, setSelectedGuarantorDetail] = useState(null);
  const [previewImage, setPreviewImage] = useState({ open: false, url: '', title: '' });

  // ==================== DATABASE REF ====================
  const dbRef = useRef(null);
  const customersRef = useRef([]);

  const getDB = useCallback(() => {
    if (dbRef.current) return dbRef.current;
    try {
      const db = require('../database/db').default;
      dbRef.current = db;
      return db;
    } catch {
      return null;
    }
  }, []);

  // Auto-select down payment account based on selected mode
  useEffect(() => {
    if (!accounts.length || !calc.downPaymentMode) return;
    const mode = (calc.downPaymentMode || 'cash').toLowerCase();
    const map = {
      cash: 'cash',
      bank: 'bank',
      bank_transfer: 'bank',
      jazzcash: 'jazzcash',
      easypaisa: 'easypaisa',
      card: 'bank',
      cheque: 'cheque'
    };
    const targetType = map[mode] || mode;
    const matched = accounts.find(a => a.status === 'active' && a.type === targetType) || accounts.find(a => a.status === 'active');
    if (matched && (!calc.downPaymentAccountId || !accounts.some(a => a.id === calc.downPaymentAccountId && a.type === targetType))) {
      setCalc(prev => ({ ...prev, downPaymentAccountId: matched.id }));
    }
  }, [calc.downPaymentMode, accounts]);

  // Auto-select installment payment account based on selected mode
  useEffect(() => {
    if (!accounts.length || !paymentForm.paymentMode) return;
    const mode = (paymentForm.paymentMode || 'cash').toLowerCase();
    const map = {
      cash: 'cash',
      bank: 'bank',
      bank_transfer: 'bank',
      jazzcash: 'jazzcash',
      easypaisa: 'easypaisa',
      card: 'bank',
      cheque: 'cheque'
    };
    const targetType = map[mode] || mode;
    const matched = accounts.find(a => a.status === 'active' && a.type === targetType) || accounts.find(a => a.status === 'active');
    if (matched && (!paymentForm.accountId || !accounts.some(a => a.id === paymentForm.accountId && a.type === targetType))) {
      setPaymentForm(prev => ({ ...prev, accountId: matched.id }));
    }
  }, [paymentForm.paymentMode, accounts]);

  // ==================== LOAD ALL GUARANTORS ====================
  const loadAllGuarantors = useCallback(async () => {
    const db = getDB();
    if (!db) { console.log('[DEBUG] DB not available'); return; }
    try {
      let data = [];
      
      // Method 0: Unified getAllGuarantors (IndexedDB & SQLite)
      if (db.getAllGuarantors) {
        try {
          const list = await db.getAllGuarantors();
          if (Array.isArray(list) && list.length > 0) {
            data = list;
          }
        } catch (gErr) {
          console.warn('[DEBUG] getAllGuarantors error:', gErr);
        }
      }
      
      // Method 1: Try mixin getGuarantors on each EMI (fallback)
      if (data.length === 0 && db.getGuarantors && db.getEMIs) {
        const emisList = await db.getEMIs().catch(() => []);
        const allG = [];
        for (const e of (emisList || [])) {
          const gList = await db.getGuarantors(e.id).catch(() => []);
          if (Array.isArray(gList) && gList.length > 0) {
            for (const g of gList) {
              allG.push({
                ...g,
                application_no: e.application_no,
                product_name: e.product_name,
                product_sku: e.product_sku,
                customer_name: e.customer_name || e._customer_name,
                customer_phone: e.customer_phone || e._customer_phone,
                customer_cnic: e.customer_cnic || e._customer_cnic
              });
            }
          }
        }
        data = allG;
      }
      
      // Method 2: If mixin empty, try raw SQL (Electron only)
      if (data.length === 0 && window?.electronAPI && db.electronQuery) {
        try {
          const sqlData = await db.electronQuery(`
            SELECT g.*, e.application_no, e.product_name, e.product_sku,
                   c.name as customer_name, c.phone as customer_phone, c.cnic as customer_cnic
            FROM emi_guarantors g
            JOIN emi_records e ON g.emi_id = e.id
            LEFT JOIN customers c ON e.customer_id = c.id
            WHERE g.status = 'active' AND e.is_deleted = 0
            ORDER BY g.created_at DESC
          `);
          data = Array.isArray(sqlData) ? sqlData : [];
        } catch (sqlErr) {
          console.error('[DEBUG] Raw SQL failed:', sqlErr.message);
        }
      }

      // Method 3: Direct IndexedDB fallback
      if (data.length === 0 && !window?.electronAPI) {
        try {
          const { idbGetAll } = await import('../database/core/idb-core.js');
          const rawG = await idbGetAll('emi_guarantors').catch(() => []);
          data = (rawG || []).filter(x => x.status !== 'deleted');
        } catch (idbErr) {
          console.warn('[DEBUG] Direct IDB fallback failed:', idbErr);
        }
      }

      // Enrich with customer and product data, and unify multiple guarantees per guarantor person
      const [allEmis, allCustomers] = await Promise.all([
        db.getEMIs ? db.getEMIs().catch(() => []) : [],
        db.getCustomers ? db.getCustomers().catch(() => []) : []
      ]);

      const rawList = Array.isArray(data) ? data : [];

      // Group all guarantee records by unique person identifier (CNIC preferred, then phone, then id)
      const personMap = new Map();

      for (const g of rawList) {
        const cnicClean = (g.cnic || '').trim();
        const phoneClean = (g.phone || '').trim();
        const key = cnicClean || phoneClean || `id_${g.id}`;

        if (!personMap.has(key)) {
          personMap.set(key, {
            primaryRecord: { ...g },
            rawRecords: [g]
          });
        } else {
          const entry = personMap.get(key);
          entry.rawRecords.push(g);
          // Prefer record with more complete details / documents
          if ((!entry.primaryRecord.address && g.address) || 
              (!entry.primaryRecord.phone && g.phone) ||
              (!entry.primaryRecord.passport_photo_path && g.passport_photo_path) ||
              (!entry.primaryRecord.monthly_income && g.monthly_income)) {
            entry.primaryRecord = { ...entry.primaryRecord, ...g };
          }
        }
      }

      // Build unified guarantor objects with ALL their linked EMIs across all customers
      const unifiedGuarantors = [];

      for (const [, { primaryRecord, rawRecords }] of personMap.entries()) {
        const linkedEmiMap = new Map();

        // 1. From rawRecords
        for (const r of rawRecords) {
          if (r.emi_id && String(r.emi_id) !== 'null' && String(r.emi_id) !== '0') {
            linkedEmiMap.set(String(r.emi_id), r.application_no || null);
          }
          if (r.application_no) {
            const emiMatch = (allEmis || []).find(e => e.application_no === r.application_no);
            if (emiMatch) {
              linkedEmiMap.set(String(emiMatch.id), r.application_no);
            }
          }
        }

        // 2. From allEmis direct association if any
        if (primaryRecord.cnic) {
          for (const e of (allEmis || [])) {
            if (e.guarantor_cnic === primaryRecord.cnic || (Array.isArray(e.guarantors) && e.guarantors.some(eg => eg.cnic === primaryRecord.cnic))) {
              linkedEmiMap.set(String(e.id), e.application_no);
            }
          }
        }

        // Build array of full linked agreements
        const linkedEmis = [];
        const seenEmiIds = new Set();

        for (const [emiIdStr, appNoFallback] of linkedEmiMap.entries()) {
          if (seenEmiIds.has(emiIdStr)) continue;
          seenEmiIds.add(emiIdStr);

          const emi = (allEmis || []).find(e => String(e.id) === emiIdStr) || 
                      (appNoFallback ? (allEmis || []).find(e => e.application_no === appNoFallback) : null);
          
          if (emi) {
            const cust = (allCustomers || []).find(c => String(c.id) === String(emi.customer_id) || (emi.customer_phone && c.phone === emi.customer_phone));
            const totalAmt = Number(emi.total_amount || 0);
            const rate = Number(emi.interest_rate || 0);
            const retailPrice = Number(emi.product_retail_price || 0);
            const markupAmt = rate > 0
              ? (retailPrice > 0 ? Math.round(retailPrice * (rate / 100)) : Math.round(totalAmt - (totalAmt / (1 + rate / 100))))
              : 0;

            linkedEmis.push({
              emi_id: emi.id,
              application_no: emi.application_no || appNoFallback || '—',
              product_name: emi.product_name || '—',
              product_sku: emi.product_sku || '',
              customer_name: emi.customer_name || emi._customer_name || cust?.name || 'N/A',
              customer_phone: emi.customer_phone || emi._customer_phone || cust?.phone || '',
              customer_cnic: emi.customer_cnic || cust?.cnic || '',
              total_amount: totalAmt,
              interest_rate: rate,
              interest_amount: markupAmt,
              down_payment: Number(emi.down_payment || 0),
              down_payment_mode: emi.down_payment_mode || 'cash',
              status: emi.status || 'active'
            });
          }
        }

        // Summary labels for multi-customer / multi-product guarantees
        const uniqueCustomers = [...new Set(linkedEmis.map(le => le.customer_name).filter(n => n && n !== 'N/A'))];
        const uniqueProducts = [...new Set(linkedEmis.map(le => le.product_name).filter(Boolean))];

        unifiedGuarantors.push({
          ...primaryRecord,
          linked_emis: linkedEmis,
          total_guarantees: linkedEmis.length,
          customer_name: uniqueCustomers.length > 0 ? uniqueCustomers.join(', ') : (primaryRecord.customer_name || ''),
          customer_names: uniqueCustomers,
          product_name: uniqueProducts.length > 0 ? uniqueProducts.join(', ') : (primaryRecord.product_name || ''),
          product_names: uniqueProducts,
          emi_ids: Array.from(seenEmiIds)
        });
      }

      setAllGuarantors(unifiedGuarantors);
      console.log('[DEBUG] Final unified multi-guarantors count:', unifiedGuarantors.length);
    } catch (err) {
      console.error('loadAllGuarantors error:', err);
    }
  }, [getDB]);

  // ==================== LOAD DATA ====================
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const db = getDB();
      if (!db) {
        setSnackbar({ open: true, message: 'Database not available', severity: 'warning' });
        setEmis([]); setCustomers([]); setEmiPayments([]); setSalesmen([]);
        return;
      }

      // Try mixin methods first, fallback to raw query
      let emisData = [];
      let customersData = [];
      let paymentsData = [];
      let salesmenData = [];

      if (db.getEMIs) {
        emisData = await db.getEMIs() || [];
      } else if (window?.electronAPI && db.electronQuery) {
        emisData = await db.electronQuery(`
          SELECT e.*, c.name as customer_name, c.phone as customer_phone, c.cnic as customer_cnic,
                 s.name as salesman_name
          FROM emi_records e
          LEFT JOIN customers c ON e.customer_id = c.id
          WHERE e.is_deleted = 0
          ORDER BY e.id DESC
        `).catch(() => []);
      }

      if (db.getCustomers) {
        customersData = await db.getCustomers().catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        customersData = await db.electronQuery(`SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name`).catch(() => []);
      }

      if (db.getAllEMIPayments) {
        paymentsData = await db.getAllEMIPayments().catch(() => []);
      } else if (db.getEMIPayments) {
        paymentsData = await db.getEMIPayments().catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        paymentsData = await db.electronQuery(`SELECT * FROM emi_payments WHERE is_reversal = 0 ORDER BY id DESC`).catch(() => []);
      } else {
        const { idbGetAll } = await import('../database/core/idb-core.js');
        paymentsData = await idbGetAll('emi_payments').catch(() => []);
      }

      let accountsData = [];
      if (db.getAccounts) {
        accountsData = await db.getAccounts({ status: 'active' }).catch(() => []);
      }
      setAccounts(Array.isArray(accountsData) ? accountsData : []);

      if (window?.electronAPI && db.electronQuery) {
        salesmenData = await db.electronQuery(`SELECT * FROM salesmen WHERE is_deleted = 0 ORDER BY name`).catch(() => []);
      }

      let productsData = [];
      if (db.getAllVariants) {
        productsData = await db.getAllVariants().catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        productsData = await db.electronQuery(`
          SELECT pv.id, pv.sku, pv.variant_name, pv.retail_price, p.name as product_name
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          WHERE pv.is_deleted = 0 AND p.is_deleted = 0
          ORDER BY p.name, pv.variant_name
        `).catch(() => []);
      }

      // Preserve joined customer data from getEMIs query or join with customersData
      const custList = Array.isArray(customersData) ? customersData : [];
      const enrichedEmis = (Array.isArray(emisData) ? emisData : []).map(e => {
        let c = custList.find(cust => String(cust.id) === String(e.customer_id) || (e.customer_phone && cust.phone === e.customer_phone));
        // Auto heal: if customer not found by id/phone but customer_name is missing/N/A
        if (!c && (!e.customer_name || e.customer_name === 'N/A') && custList.length > 0) {
          const matchingLink = (allGuarantors || []).flatMap(g => g.linked_emis || []).find(ge => String(ge.emi_id) === String(e.id) || (e.application_no && ge.application_no === e.application_no));
          if (matchingLink?.customer_name && matchingLink.customer_name !== 'N/A') {
            c = custList.find(cust => cust.name?.toLowerCase() === matchingLink.customer_name.toLowerCase());
          }
          if (!c && custList.length === 1) {
            c = custList[0];
          }
        }
        const custName = (e.customer_name && e.customer_name !== 'N/A') ? e.customer_name : (c?.name || 'N/A');
        const custPhone = e.customer_phone || c?.phone || '';
        const custCnic = e.customer_cnic || c?.cnic || '';
        const custId = (e.customer_id && e.customer_id !== 'NaN' && !isNaN(e.customer_id)) ? e.customer_id : (c?.id || e.customer_id);

        if (c && (!e.customer_name || e.customer_name === 'N/A') && !window?.electronAPI) {
          import('../database/core/idb-core.js').then(({ idbPut }) => {
            idbPut('emis', { ...e, customer_id: c.id, customer_name: c.name, customer_phone: c.phone || '', customer_cnic: c.cnic || '' }).catch(() => {});
          });
        }

        return {
          ...e,
          customer_id: custId,
          customer_name: custName,
          customer_phone: custPhone,
          customer_cnic: custCnic,
          _customer_name: custName,
          _customer_phone: custPhone,
          _customer_cnic: custCnic
        };
      });
      setEmis(enrichedEmis);
      setCustomers(custList);
      customersRef.current = custList;
      setEmiPayments(Array.isArray(paymentsData) ? paymentsData.filter(p => !p.is_reversal) : []);
      setSalesmen(Array.isArray(salesmenData) ? salesmenData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      console.log('[DEBUG] Emis loaded:', enrichedEmis.length, enrichedEmis[0]?.customer_id, enrichedEmis[0]?._customer_name);
    } catch (err) {
      console.error('Data loading error:', err);
      setSnackbar({ open: true, message: 'Failed to load data: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [getDB, allGuarantors]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Separate effect for guarantors (runs once, then on demand)
  useEffect(() => {
    loadAllGuarantors();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== PRECOMPUTED PAYMENTS MAP (Performance) ====================
  const paymentsMap = useMemo(() => {
    const map = new Map();
    for (const p of emiPayments) {
      if (p.is_reversal) continue;
      const key = String(p.emi_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }, [emiPayments]);

  // ==================== EMI DETAILS CALCULATOR ====================
  const getEMIDetails = useCallback((emi) => {
    const payments = paymentsMap.get(String(emi.id)) || [];
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPenalty = payments.reduce((sum, p) => sum + Number(p.penalty_amount || 0), 0);
    const totalDiscount = payments.reduce((sum, p) => sum + Number(p.discount_amount || 0), 0);
    const totalDue = Math.max(0, Number(emi.remaining_amount || 0));
    const principal = Number(emi.total_amount || 0) - Number(emi.down_payment || 0);
    const progress = principal > 0 ? Math.min(100, (totalPaid / principal) * 100) : 0;
    const daysOverdue = getDaysOverdue(emi.next_due_date);
    const isOverdue = daysOverdue > 0 && emi.status === 'active';
    const remainingMonths = Math.max(0, Number(emi.total_months || 0) - Number(emi.paid_months || 0));
    const computedStatus = isOverdue ? 'overdue' : (emi.status || 'active');

    return { totalPaid, totalDue, progress, daysOverdue, isOverdue, remainingMonths, computedStatus, totalPenalty, totalDiscount, principal };
  }, [emiPayments]);

  // ==================== EMI CALCULATOR ====================
  const calculatedMetrics = useMemo(() => {
    const principal = Math.max(0, Number(calc.totalAmount || 0) - Number(calc.downPayment || 0));
    const interestRate = Number(calc.interestRate || 0);
    const months = Number(calc.months || 12);

    // Flat Surcharge / Markup (Standard in Pakistani retail installment businesses)
    // Formula: Total Interest = Total Amount * (Rate / 100)
    // Total Amount with Interest = Total Amount + Total Interest
    // Net Remaining after Down Payment = Total Amount with Interest - Down Payment
    // Monthly EMI = Net Remaining / Months
    const totalInterest = Math.round(Number(calc.totalAmount || 0) * (interestRate / 100));
    const totalWithInterest = Number(calc.totalAmount || 0) + totalInterest;
    const remainingPayable = Math.max(0, totalWithInterest - Number(calc.downPayment || 0));
    const emiAmount = months > 0 ? Math.ceil(remainingPayable / months) : 0;

    return {
      principal,
      totalInterest: Math.max(0, totalInterest),
      totalWithInterest,
      totalPayable: remainingPayable,
      emiAmount: Math.max(0, emiAmount)
    };
  }, [calc]);

  // ==================== SORTING ====================
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ==================== FILTERS ====================
  const filteredEMIs = useMemo(() => {
    let result = emis.filter(emi => {
      const customer = customers.find(c => String(c.id) === String(emi.customer_id));
      const details = getEMIDetails(emi);

      const matchesSearch = !searchQuery.trim() ||
        (emi.application_no || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (emi.product_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (emi.product_sku || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (customer?.phone || '').includes(searchQuery.trim()) ||
        (customer?.cnic || '').includes(searchQuery.trim());

      const matchStatus = filterStatus === 'all' ||
        (filterStatus === 'overdue' && details.isOverdue) ||
        (filterStatus === 'active' && emi.status === 'active' && !details.isOverdue) ||
        (filterStatus === 'completed' && (emi.status === 'completed' || emi.status === 'closed' || emi.status === 'settled')) ||
        (filterStatus === 'defaulted' && emi.status === 'defaulted') ||
        (filterStatus === 'legal' && emi.status === 'legal');

      const matchGuarantor = !filterGuarantor || allGuarantors.some(g => {
        const isTarget = String(g.id) === String(filterGuarantor) || (g.cnic && g.cnic === filterGuarantor);
        if (!isTarget) return false;
        return String(g.emi_id) === String(emi.id) || 
               (emi.application_no && g.application_no === emi.application_no) ||
               (Array.isArray(g.emi_ids) && g.emi_ids.includes(String(emi.id))) ||
               (Array.isArray(g.linked_emis) && g.linked_emis.some(le => String(le.emi_id) === String(emi.id) || (emi.application_no && le.application_no === emi.application_no)));
      });

      const matchDate = (!filterDateFrom || !emi.start_date || emi.start_date >= filterDateFrom) &&
                        (!filterDateTo || !emi.start_date || emi.start_date <= filterDateTo);

      return matchesSearch && matchStatus && matchGuarantor && matchDate;
    });

    // Sort
    result.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'customer_name') {
        const ca = customers.find(c => c.id === a.customer_id)?.name || '';
        const cb = customers.find(c => c.id === b.customer_id)?.name || '';
        return ca.localeCompare(cb) * dir;
      }
      if (sortConfig.key === 'remaining') {
        return ((a.remaining_amount || 0) - (b.remaining_amount || 0)) * dir;
      }
      if (sortConfig.key === 'next_due') {
        const da = a.next_due_date || '9999-12-31';
        const db = b.next_due_date || '9999-12-31';
        return da.localeCompare(db) * dir;
      }
      return ((a[sortConfig.key] || 0) - (b[sortConfig.key] || 0)) * dir;
    });

    return result;
  }, [emis, customers, allGuarantors, searchQuery, filterStatus, filterGuarantor, filterDateFrom, filterDateTo, sortConfig, getEMIDetails]);

  const paginatedEMIs = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredEMIs.slice(start, start + rowsPerPage);
  }, [filteredEMIs, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredEMIs.length / rowsPerPage) || 1;

  // ==================== STATS ====================
  const stats = useMemo(() => {
    const active = emis.filter(e => e.status === 'active');
    const completed = emis.filter(e => e.status === 'completed' || e.status === 'closed' || e.status === 'settled');
    const defaulted = emis.filter(e => e.status === 'defaulted');
    const legal = emis.filter(e => e.status === 'legal');
    const overdue = emis.filter(e => {
      const d = getEMIDetails(e);
      return d.isOverdue;
    });

    const totalPortfolio = emis.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
    const totalDown = emis.reduce((sum, e) => sum + Number(e.down_payment || 0), 0);
    const totalOutstanding = emis.reduce((sum, e) => sum + Number(e.remaining_amount || 0), 0);
    const totalCollected = emiPayments.filter(p => !p.is_reversal).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPenalty = emiPayments.filter(p => !p.is_reversal).reduce((sum, p) => sum + Number(p.penalty_amount || 0), 0);

    const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const thisMonthDue = active.filter(e => String(e.next_due_date).substring(5, 7) === thisMonth).length;

    return {
      total: emis.length, active: active.length, completed: completed.length,
      defaulted: defaulted.length, legal: legal.length, overdue: overdue.length,
      totalPortfolio, totalDown, totalOutstanding, totalCollected, totalPenalty, thisMonthDue
    };
  }, [emis, emiPayments, getEMIDetails]);

  // ==================== PAYMENTS TAB FILTER & METRICS ====================
  const filteredPayments = useMemo(() => {
    return emiPayments.filter(p => {
      if (p.is_reversal) return false;
      const boundEmi = emis.find(e => String(e.id) === String(p.emi_id));
      const boundCustomer = customers.find(c => String(c.id) === String(boundEmi?.customer_id || p.customer_id));
      const custName = (p.customer_name || boundCustomer?.name || boundEmi?.customer_name || boundEmi?._customer_name || '').toLowerCase();
      const prodName = (p.product_name || boundEmi?.product_name || '').toLowerCase();
      const prodSku = (boundEmi?.product_sku || '').toLowerCase();

      // Customer filter
      if (payFilterCustomer) {
        const query = String(payFilterCustomer).toLowerCase().trim();
        const matchesId = boundCustomer && String(boundCustomer.id) === String(payFilterCustomer);
        const matchesName = custName.includes(query);
        if (!matchesId && !matchesName) return false;
      }

      // Product filter
      if (payFilterProduct) {
        const query = payFilterProduct.toLowerCase().trim();
        if (!prodName.includes(query) && !prodSku.includes(query)) return false;
      }

      // Payment Mode filter
      if (payFilterMode && payFilterMode !== 'all') {
        if (String(p.payment_mode || '').toLowerCase() !== payFilterMode.toLowerCase()) return false;
      }

      // Date Range filter
      const pDate = (p.payment_date || '').split('T')[0];
      if (payFilterDateFrom && pDate && pDate < payFilterDateFrom) return false;
      if (payFilterDateTo && pDate && pDate > payFilterDateTo) return false;

      return true;
    });
  }, [emiPayments, emis, customers, payFilterCustomer, payFilterProduct, payFilterMode, payFilterDateFrom, payFilterDateTo]);

  const paymentMetrics = useMemo(() => {
    const totalCollected = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPenalty = filteredPayments.reduce((s, p) => s + Number(p.penalty_amount || 0), 0);
    const totalDiscount = filteredPayments.reduce((s, p) => s + Number(p.discount_amount || 0), 0);
    const totalCount = filteredPayments.length;
    return { totalCollected, totalPenalty, totalDiscount, totalCount };
  }, [filteredPayments]);

  const paginatedPayments = useMemo(() => {
    const start = (payPage - 1) * payRowsPerPage;
    return filteredPayments.slice(start, start + payRowsPerPage);
  }, [filteredPayments, payPage, payRowsPerPage]);

  // ==================== SAVE EMI ====================
  const saveEMI = async () => {
    if (!calc.customerId || !calc.productName || calc.totalAmount <= 0) {
      setSnackbar({ open: true, message: 'Please fill Customer, Product, and Total Amount!', severity: 'warning' });
      return;
    }
    if (calculatedMetrics.emiAmount <= 0) {
      setSnackbar({ open: true, message: 'EMI amount must be greater than 0!', severity: 'warning' });
      return;
    }

    const db = getDB();
    if (!db) {
      setSnackbar({ open: true, message: 'Database not available', severity: 'error' });
      return;
    }

    const startDate = new Date().toISOString().split('T')[0];
    const nextDate = new Date();
    const originalDay = nextDate.getDate();
    nextDate.setMonth(nextDate.getMonth() + 1);
    if (nextDate.getDate() !== originalDay) nextDate.setDate(0);
    const appNo = generateApplicationNo();
    const customerObj = customers.find(c => String(c.id) === String(calc.customerId));

    const emiPayload = {
      application_no: appNo,
      customer_id: calc.customerId,
      customer_name: customerObj?.name || '',
      customer_phone: customerObj?.phone || '',
      customer_cnic: customerObj?.cnic || '',
      product_variant_id: calc.productVariantId ? Number(calc.productVariantId) : null,
      product_name: calc.productName,
      product_sku: calc.productSKU || '',
      product_retail_price: Number(calc.totalAmount),
      product_cost_price: 0,
      total_amount: calculatedMetrics.totalWithInterest || Number(calc.totalAmount),
      down_payment: Number(calc.downPayment),
      down_payment_mode: calc.downPaymentMode || 'cash',
      down_payment_account_id: calc.downPaymentAccountId || null,
      remaining_amount: calculatedMetrics.totalPayable,
      emi_amount: calculatedMetrics.emiAmount,
      interest_rate: Number(calc.interestRate),
      total_months: Number(calc.months),
      paid_months: 0,
      start_date: startDate,
      next_due_date: nextDate.toISOString().split('T')[0],
      due_day: nextDate.getDate(),
      status: 'active',
      salesman_id: null,
      shop_location: calc.shopLocation || '',
      notes: calc.notes || '',
      agreement_signed: calc.agreementSigned ? 1 : 0,
      created_by: null
    };

    try {
      let newEmiId = null;

      // Try mixin method first
      if (db.createEMI) {
        try {
          const res = await db.createEMI(emiPayload);
          newEmiId = res.lastInsertRowid || res.record?.id || res.id;
        } catch (innerErr) {
          console.warn('createEMI mixin failed, trying fallback:', innerErr.message);
          if (!window?.electronAPI) throw innerErr;
        }
      }

      // Fallback: raw SQL (Electron mode)
      if (!newEmiId && window?.electronAPI && db.electronQuery) {
        const res = await db.electronQuery(`
          INSERT INTO emi_records (
            application_no, customer_id, product_variant_id, product_name, product_sku,
            total_amount, down_payment, remaining_amount, emi_amount, interest_rate,
            total_months, paid_months, start_date, next_due_date, due_day, status,
            salesman_id, shop_location, notes, agreement_signed, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          emiPayload.application_no, emiPayload.customer_id, emiPayload.product_variant_id,
          emiPayload.product_name, emiPayload.product_sku, emiPayload.total_amount,
          emiPayload.down_payment, emiPayload.remaining_amount, emiPayload.emi_amount,
          emiPayload.interest_rate, emiPayload.total_months, emiPayload.paid_months,
          emiPayload.start_date, emiPayload.next_due_date, emiPayload.due_day,
          'active', emiPayload.salesman_id, emiPayload.shop_location,
          emiPayload.notes, emiPayload.agreement_signed
        ]);
        newEmiId = res.lastInsertRowid;
      }

      if (!newEmiId) {
        throw new Error('Failed to obtain new EMI record ID');
      }

      // Financial Integration: Post Down Payment to Financial Account
      if (Number(calc.downPayment) > 0 && calc.downPaymentAccountId && typeof db.createTransaction === 'function') {
        try {
          await db.createTransaction({
            account_id: calc.downPaymentAccountId,
            transaction_type: 'credit',
            amount: Number(calc.downPayment),
            description: `EMI Down Payment — ${customerObj?.name || 'Customer'} [${appNo}]`,
            payment_mode: calc.downPaymentMode || 'cash',
            reference_no: appNo,
            reference_type: 'emi_down_payment',
            date: new Date().toISOString()
          });
        } catch (accErr) {
          console.warn('Down payment transaction logging failed:', accErr.message);
        }
      }

      // Auto-generate Schedule
      if (newEmiId) {
        try {
          await db.generateEMISchedule({
            id: newEmiId,
            total_amount: Number(calc.totalAmount),
            down_payment: Number(calc.downPayment),
            interestRate: calc.interestRate,
            total_months: Number(calc.months),
            emi_amount: calculatedMetrics.emiAmount,
            start_date: startDate
          });
        } catch (schedErr) {
          console.warn('Schedule generation failed:', schedErr.message);
        }
      }

      // Save or Link guarantors (DO NOT duplicate pre-registered ones)
      if (newEmiId && newGuarantors.length > 0) {
        const customerObj = customers.find(c => String(c.id) === String(calc.customerId));
        for (const g of newGuarantors) {
          try {
            const gp = {
              emi_id: newEmiId,
              guarantor_type: Number(g.guarantor_type) || 1,
              name: g.name.trim(),
              phone: g.phone || '',
              cnic: g.cnic.trim(),
              address: g.address || '',
              occupation: g.occupation || '',
              monthly_income: Number(g.monthly_income) || 0,
              relation_to_customer: g.relation_to_customer || '',
              passport_photo_path: g.passport_photo_path || null,
              blank_check_photo_path: g.blank_check_photo_path || null,
              cnic_front_photo_path: g.cnic_front_photo_path || null,
              cnic_back_photo_path: g.cnic_back_photo_path || null,
              application_no: appNo,
              product_name: calc.productName || '',
              product_sku: calc.productSKU || '',
              customer_name: customerObj?.name || '',
              customer_phone: customerObj?.phone || '',
              customer_cnic: customerObj?.cnic || '',
              status: 'active'
            };

            // Check if there is an unassigned standalone guarantor record to link (only if NO prior EMI attached)
            const standaloneExisting = allGuarantors?.find(x => 
              ((g.id && String(x.id) === String(g.id)) || (x.cnic && x.cnic.trim() === gp.cnic)) &&
              (!x.emi_id || x.emi_id === 'null' || x.emi_id === 0) &&
              (!x.linked_emis || x.linked_emis.length === 0)
            );

            if (standaloneExisting && standaloneExisting.id) {
              const targetId = standaloneExisting.id;
              if (db.updateGuarantor) {
                await db.updateGuarantor(targetId, gp);
              } else if (window?.electronAPI && db.electronQuery) {
                await db.electronQuery(
                  `UPDATE emi_guarantors SET emi_id = ?, guarantor_type = ?, name = ?, phone = ?, address = ?, occupation = ?, monthly_income = ?, relation_to_customer = ?, passport_photo_path = COALESCE(?, passport_photo_path), blank_check_photo_path = COALESCE(?, blank_check_photo_path), cnic_front_photo_path = COALESCE(?, cnic_front_photo_path), cnic_back_photo_path = COALESCE(?, cnic_back_photo_path), status = 'active', updated_at = datetime('now') WHERE id = ?`,
                  [gp.emi_id, gp.guarantor_type, gp.name, gp.phone, gp.address, gp.occupation, gp.monthly_income, gp.relation_to_customer, gp.passport_photo_path, gp.blank_check_photo_path, gp.cnic_front_photo_path, gp.cnic_back_photo_path, targetId]
                );
              }
            } else {
              // Create a brand new guarantee record for this EMI agreement (supports multi-customer / multi-product guarantees)
              if (db.createGuarantor) {
                await db.createGuarantor(gp);
              } else if (window?.electronAPI && db.electronQuery) {
                await db.electronQuery(
                  `INSERT INTO emi_guarantors (emi_id, guarantor_type, name, phone, cnic, address, occupation, monthly_income, relation_to_customer, passport_photo_path, blank_check_photo_path, cnic_front_photo_path, cnic_back_photo_path, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
                  [gp.emi_id, gp.guarantor_type, gp.name, gp.phone, gp.cnic, gp.address, gp.occupation, gp.monthly_income, gp.relation_to_customer, gp.passport_photo_path, gp.blank_check_photo_path, gp.cnic_front_photo_path, gp.cnic_back_photo_path]
                );
              }
            }
          } catch (gErr) {
            console.warn('Guarantor save/link failed:', gErr.message);
          }
        }
      }

      setOpenCalculator(false);
      setNewGuarantors([]);
      setShowInlineGuarantor(false);
      setCalc({
        productVariantId: '',
        productName: '', productSKU: '', totalAmount: 0, downPayment: 0,
        downPaymentMode: 'cash',
        interestRate: 0, months: 12, customerId: '',
        shopLocation: '', notes: '', agreementSigned: false
      });
      await loadData();
      await loadAllGuarantors();
      setSnackbar({ open: true, message: `EMI ${appNo} created successfully!`, severity: 'success' });
    } catch (err) {
      console.error('saveEMI error:', err);
      setSnackbar({ open: true, message: 'Error creating EMI: ' + err.message, severity: 'error' });
    }
  };

  // ==================== PAYMENT FUNCTIONS ====================
  const openPaymentDialog = (emi) => {
    setSelectedEMI(emi);
    setPaymentForm({
      amount: emi.emi_amount || '',
      penaltyAmount: 0,
      discountAmount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'cash',
      bankName: '',
      chequeNo: '',
      chequeDate: '',
      notes: '',
      receiptNo: `RCP-${Date.now().toString(36).toUpperCase()}`
    });
    setPaymentDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedEMI || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setSnackbar({ open: true, message: 'Please enter a valid amount!', severity: 'warning' });
      return;
    }

    const db = getDB();
    if (!db) {
      setSnackbar({ open: true, message: 'Database not available', severity: 'error' });
      return;
    }

    try {
      const payVal = Number(paymentForm.amount);
      const penaltyVal = Number(paymentForm.penaltyAmount || 0);
      const discountVal = Number(paymentForm.discountAmount || 0);
      const totalReceived = payVal + penaltyVal - discountVal;
      let paymentInserted = false;

      const paymentObj = {
        emi_id: selectedEMI.id,
        amount: payVal,
        penalty_amount: penaltyVal,
        discount_amount: discountVal,
        total_received: totalReceived,
        payment_date: paymentForm.paymentDate,
        payment_mode: paymentForm.paymentMode,
        account_id: paymentForm.accountId || null,
        customer_name: selectedEMI.customer_name || selectedEMI._customer_name || 'Customer',
        bank_name: paymentForm.bankName || null,
        cheque_no: paymentForm.chequeNo || null,
        cheque_date: paymentForm.chequeDate || null,
        cheque_status: paymentForm.paymentMode === 'cheque' ? 'pending' : null,
        receipt_no: paymentForm.receiptNo,
        notes: paymentForm.notes,
        created_by: null
      };

      // Try mixin method first
      if (db.addEMIPayment) {
        try {
          await db.addEMIPayment(paymentObj);
          paymentInserted = true;
        } catch (innerErr) {
          console.warn('addEMIPayment mixin failed, trying fallback:', innerErr.message);
          if (!window?.electronAPI) throw innerErr;
        }
      }

      // Fallback: raw SQL (Electron mode only)
      if (!paymentInserted && window?.electronAPI && db.electronQuery) {
        await db.electronQuery(`
          INSERT INTO emi_payments (emi_id, amount, penalty_amount, discount_amount, total_received,
            payment_date, payment_mode, bank_name, cheque_no, cheque_date, receipt_no, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          selectedEMI.id, payVal, penaltyVal, discountVal, totalReceived,
          paymentForm.paymentDate, paymentForm.paymentMode,
          paymentForm.bankName || null, paymentForm.chequeNo || null,
          paymentForm.chequeDate || null, paymentForm.receiptNo, paymentForm.notes
        ]);
        paymentInserted = true;
      }

      // Fallback: direct IDB add
      if (!paymentInserted && !window?.electronAPI) {
        const { idbAdd } = await import('../database/core/idb-core.js');
        await idbAdd('emi_payments', {
          ...paymentObj,
          created_at: new Date().toISOString()
        });
        paymentInserted = true;
      }

      if (!paymentInserted) {
        throw new Error('Failed to record payment');
      }

      // If account transaction was not run by mixin, ensure it is recorded now
      if (paymentForm.accountId && typeof db.createTransaction === 'function') {
        try {
          await db.createTransaction({
            account_id: paymentForm.accountId,
            transaction_type: 'credit',
            amount: totalReceived,
            description: `EMI Installment — ${selectedEMI.customer_name || 'Customer'} [${paymentForm.receiptNo || selectedEMI.application_no}]`,
            payment_mode: paymentForm.paymentMode,
            reference_no: paymentForm.receiptNo || selectedEMI.application_no,
            reference_type: 'emi_payment',
            date: paymentForm.paymentDate
          });
        } catch (accErr) {
          console.warn('[EMI Payment] Account transaction notice:', accErr.message);
        }
      }

      // Recalculate EMI state from all payments (bulletproof for Electron & Browser)
      let allPayments = [];
      if (window?.electronAPI && db.electronQuery) {
        allPayments = await db.electronQuery(
          `SELECT amount, payment_date FROM emi_payments WHERE emi_id = ? AND is_reversal = 0 ORDER BY payment_date DESC`,
          [selectedEMI.id]
        ).catch(() => []);
      } else if (db.getEMIPayments) {
        allPayments = await db.getEMIPayments(selectedEMI.id).catch(() => []);
      } else {
        const { idbGetAll } = await import('../database/core/idb-core.js');
        const idbPayments = await idbGetAll('emi_payments').catch(() => []);
        allPayments = (idbPayments || []).filter(p => String(p.emi_id) === String(selectedEMI.id) && !p.is_reversal);
      }

      const totalPaid = (allPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const monthsPaid = selectedEMI.emi_amount > 0
        ? Math.min(Number(selectedEMI.total_months || 0), Math.floor(totalPaid / selectedEMI.emi_amount))
        : (allPayments || []).length;
      const principal = Number(selectedEMI.total_amount || 0) - Number(selectedEMI.down_payment || 0);
      const newRemaining = Math.max(0, principal - totalPaid);
      const isCompleted = newRemaining <= 0 || monthsPaid >= Number(selectedEMI.total_months || 0);
      const newStatus = isCompleted ? 'completed' : 'active';
      const lastPayment = (allPayments || [])[0];
      let nextDueStr = null;
      if (!isCompleted) {
        const baseDate = selectedEMI.start_date ? new Date(selectedEMI.start_date) : (lastPayment ? new Date(lastPayment.payment_date) : new Date());
        const nextDue = new Date(baseDate);
        const originalDay = nextDue.getDate();
        nextDue.setMonth(nextDue.getMonth() + (monthsPaid || 0) + 1);
        if (nextDue.getDate() !== originalDay) nextDue.setDate(0);
        nextDueStr = nextDue.toISOString().split('T')[0];
      }

      let emiUpdated = false;
      if (db.updateEMI) {
        try {
          await db.updateEMI(selectedEMI.id, {
            paid_months: monthsPaid,
            next_due_date: nextDueStr,
            status: newStatus,
            remaining_amount: newRemaining,
            last_payment_date: lastPayment ? lastPayment.payment_date : null
          });
          emiUpdated = true;
        } catch (updateErr) {
          console.warn('updateEMI mixin failed, trying fallback:', updateErr.message);
        }
      }
      if (!emiUpdated && window?.electronAPI && db.electronQuery) {
        await db.electronQuery(
          `UPDATE emi_records SET paid_months = ?, next_due_date = ?, status = ?, remaining_amount = ?, last_payment_date = ? WHERE id = ?`,
          [monthsPaid, nextDueStr, newStatus, newRemaining, lastPayment ? lastPayment.payment_date : null, selectedEMI.id]
        );
        emiUpdated = true;
      }
      if (!emiUpdated && !window?.electronAPI) {
        const { idbGetById, idbGetAll, idbPut } = await import('../database/core/idb-core.js');
        let emiRec = await idbGetById('emis', selectedEMI.id);
        if (!emiRec) {
          const allE = await idbGetAll('emis');
          emiRec = allE.find(x => String(x.id) === String(selectedEMI.id) || x.application_no === selectedEMI.application_no);
        }
        if (emiRec) {
          await idbPut('emis', {
            ...emiRec,
            paid_months: monthsPaid,
            next_due_date: nextDueStr,
            status: newStatus,
            remaining_amount: newRemaining,
            last_payment_date: lastPayment ? lastPayment.payment_date : null,
            updated_at: new Date().toISOString()
          });
          emiUpdated = true;
        }
      }

      setPaymentDialog(false);
      setSelectedEMI(null);
      await loadData();
      setSnackbar({ open: true, message: `Payment of ${formatCurrency(payVal)} recorded!`, severity: 'success' });
    } catch (err) {
      console.error('handlePayment error:', err);
      setSnackbar({ open: true, message: 'Payment failed: ' + err.message, severity: 'error' });
    }
  };

  const handleInitiateDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setDeletePaymentDialog(true);
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return;
    const db = getDB();
    if (!db) {
      setSnackbar({ open: true, message: 'Database not available', severity: 'error' });
      return;
    }

    try {
      const payment = paymentToDelete;
      const emiId = payment.emi_id;

      // 1. Reverse Account Transaction if recorded
      if (payment.account_id && typeof db.createTransaction === 'function') {
        try {
          const revAmount = Number(payment.total_received || payment.amount || 0);
          if (revAmount > 0) {
            await db.createTransaction({
              account_id: payment.account_id,
              transaction_type: 'debit',
              amount: revAmount,
              description: `Void/Reversal of EMI Payment [${payment.receipt_no || payment.id}]`,
              payment_mode: payment.payment_mode || 'cash',
              reference_no: payment.receipt_no || String(payment.id),
              reference_type: 'emi_reversal',
              date: new Date().toISOString().split('T')[0]
            });
          }
        } catch (accErr) {
          console.warn('[EMI Payment Reversal] Account error:', accErr.message);
        }
      }

      // 2. Delete payment record using db.deleteEMIPayment
      if (typeof db.deleteEMIPayment === 'function') {
        await db.deleteEMIPayment(payment.id);
      } else {
        if (window?.electronAPI && db.electronQuery) {
          await db.electronQuery('DELETE FROM emi_payments WHERE id = ?', [payment.id]);
        } else {
          const { idbDelete } = await import('../database/core/idb-core.js');
          await idbDelete('emi_payments', payment.id).catch(() => {});
        }
      }

      // 3. Sync EMI remaining balance & months
      if (emiId) {
        if (db._syncElectronEMIAfterPayment && window?.electronAPI) {
          await db._syncElectronEMIAfterPayment(emiId).catch(() => {});
        } else if (db._syncIDBEMIAfterPayment && !window?.electronAPI) {
          await db._syncIDBEMIAfterPayment(emiId).catch(() => {});
        }
      }

      setDeletePaymentDialog(false);
      setPaymentToDelete(null);
      await loadData();
      setSnackbar({ open: true, message: 'Payment voided/deleted and EMI balance restored!', severity: 'success' });
    } catch (err) {
      console.error('handleConfirmDeletePayment error:', err);
      setSnackbar({ open: true, message: 'Failed to delete payment: ' + err.message, severity: 'error' });
    }
  };

  const handleClearCheque = async (payment) => {
    const db = getDB();
    if (!db) return;
    try {
      if (typeof db.clearCheque === 'function') {
        await db.clearCheque(payment.id);
      } else if (window?.electronAPI && db.electronQuery) {
        await db.electronQuery("UPDATE emi_payments SET cheque_status = 'cleared' WHERE id = ?", [payment.id]);
      } else {
        const { idbGetById, idbPut } = await import('../database/core/idb-core.js');
        const pRec = await idbGetById('emi_payments', payment.id);
        if (pRec) {
          await idbPut('emi_payments', { ...pRec, cheque_status: 'cleared' });
        }
      }
      await loadData();
      setSnackbar({ open: true, message: 'Cheque marked as cleared!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to clear cheque: ' + err.message, severity: 'error' });
    }
  };

  // ==================== HISTORY / VIEW ====================
  const openHistoryDialog = async (emi) => {
    setSelectedEMI(emi);
    const db = getDB();
    let payments = [];
    let schedule = [];
    let guarantors = [];
    let visits = [];

    if (db) {
      if (db.getEMIPayments) {
        payments = await db.getEMIPayments(emi.id).catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        payments = await db.electronQuery(`SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY payment_date DESC`, [emi.id]).catch(() => []);
      }
      if (db.getSchedule) {
        schedule = await db.getSchedule(emi.id).catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        schedule = await db.electronQuery(`SELECT * FROM emi_schedule WHERE emi_id = ? ORDER BY installment_no`, [emi.id]).catch(() => []);
      }
      if (db.getGuarantors) {
        guarantors = await db.getGuarantors(emi.id).catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        guarantors = await db.electronQuery(`SELECT * FROM emi_guarantors WHERE emi_id = ? AND status = 'active'`, [emi.id]).catch(() => []);
      }
      if (!guarantors || guarantors.length === 0) {
        guarantors = allGuarantors.filter(g => 
          String(g.emi_id) === String(emi.id) || 
          (emi.application_no && g.application_no === emi.application_no) ||
          (Array.isArray(g.emi_ids) && g.emi_ids.includes(String(emi.id))) ||
          (Array.isArray(g.linked_emis) && g.linked_emis.some(le => String(le.emi_id) === String(emi.id) || (emi.application_no && le.application_no === emi.application_no)))
        );
      }
      if (db.getVisitLogs) {
        visits = await db.getVisitLogs(emi.id).catch(() => []);
      } else if (window?.electronAPI && db.electronQuery) {
        visits = await db.electronQuery(`SELECT * FROM emi_visit_log WHERE emi_id = ? ORDER BY visit_date DESC`, [emi.id]).catch(() => []);
      }
    }

    // Filter and sort all valid payments for this EMI chronologically (earliest first)
    let validPayments = (payments || []).filter(p => !p.is_reversal);
    if (validPayments.length === 0) {
      validPayments = emiPayments.filter(p => String(p.emi_id) === String(emi.id) && !p.is_reversal);
    }
    validPayments = [...validPayments].sort((a, b) => new Date(a.payment_date || 0) - new Date(b.payment_date || 0));

    const baseDate = new Date(emi.start_date || new Date());
    const totalMonths = Number(emi.total_months || 0);
    const instEmiAmount = Number(emi.emi_amount || 0);

    let baseSchedule = [];
    if (schedule && schedule.length > 0) {
      baseSchedule = schedule;
    } else {
      for (let i = 0; i < totalMonths; i++) {
        const stepDueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i + 1, baseDate.getDate());
        if (stepDueDate.getDate() !== baseDate.getDate()) stepDueDate.setDate(0);
        baseSchedule.push({
          installment_no: i + 1,
          due_date: stepDueDate.toISOString().split('T')[0],
          planned_amount: instEmiAmount,
          paid_amount: 0,
          paid_date: null,
          penalty_amount: 0,
          discount_amount: 0,
          status: 'pending'
        });
      }
    }

    // Allocate real payments chronologically across installments
    let paymentQueue = validPayments.map(p => ({
      amountRemaining: Number(p.amount || 0),
      payment_date: p.payment_date,
      penalty_amount: Number(p.penalty_amount || 0),
      discount_amount: Number(p.discount_amount || 0),
      receipt_no: p.receipt_no
    }));

    let qIdx = 0;
    const finalSchedule = baseSchedule.map((inst, idx) => {
      let instPlanned = Number(inst.planned_amount || instEmiAmount);
      let instPaid = 0;
      let lastPayDate = null;
      let instPenalty = 0;
      let instDiscount = 0;
      let instReceipt = null;

      while (qIdx < paymentQueue.length && instPaid < instPlanned) {
        const curPay = paymentQueue[qIdx];
        const needed = instPlanned - instPaid;
        const take = Math.min(needed, curPay.amountRemaining);
        instPaid += take;
        curPay.amountRemaining -= take;
        lastPayDate = curPay.payment_date;
        if (curPay.penalty_amount > 0) {
          instPenalty += curPay.penalty_amount;
          curPay.penalty_amount = 0;
        }
        if (curPay.discount_amount > 0) {
          instDiscount += curPay.discount_amount;
          curPay.discount_amount = 0;
        }
        instReceipt = curPay.receipt_no;
        if (curPay.amountRemaining <= 0) {
          qIdx++;
        }
      }

      // If full amount wasn't covered but this installment index corresponds to a paid record
      if (instPaid === 0 && idx < validPayments.length) {
        const fallbackPay = validPayments[idx];
        instPaid = Number(fallbackPay.amount || instPlanned);
        lastPayDate = fallbackPay.payment_date;
        instPenalty = Number(fallbackPay.penalty_amount || 0);
        instDiscount = Number(fallbackPay.discount_amount || 0);
        instReceipt = fallbackPay.receipt_no;
      }

      const isSettled = instPaid >= instPlanned || (instPaid > 0 && idx < validPayments.length);
      const isOverdue = !isSettled && new Date() > new Date(inst.due_date);

      return {
        ...inst,
        planned_amount: instPlanned,
        paid_amount: instPaid,
        paid_date: isSettled || instPaid > 0 ? lastPayDate : null,
        penalty_amount: instPenalty,
        discount_amount: instDiscount,
        receipt_no: instReceipt,
        status: isSettled ? 'paid' : (instPaid > 0 ? 'partial' : (isOverdue ? 'overdue' : 'pending'))
      };
    });

    setSelectedPayments(Array.isArray(payments) ? payments : []);
    setSelectedSchedule(finalSchedule);
    setSelectedGuarantors(Array.isArray(guarantors) ? guarantors : []);
    setSelectedVisits(Array.isArray(visits) ? visits : []);
    setHistoryTab(0);
    setHistoryDialog(true);
  };

  const openViewDialog = async (emi) => {
    setSelectedEMI(emi);
    await openHistoryDialog(emi);
    setViewDialog(true);
  };

  // ==================== DELETE EMI ====================
  const confirmDeleteEMI = (emi) => {
    setSelectedEMI(emi);
    setDeleteDialog(true);
  };

  const handleDeleteEMI = async () => {
    if (!selectedEMI) return;
    const db = getDB();
    if (!db) return;

    try {
      if (db.deleteEMI) {
        await db.deleteEMI(selectedEMI.id);
      } else if (window?.electronAPI && db.electronQuery) {
        await db.electronQuery(`UPDATE emi_records SET is_deleted = 1, deleted_at = datetime('now'), status = 'closed' WHERE id = ?`, [selectedEMI.id]);
      }
      setDeleteDialog(false);
      setSelectedEMI(null);
      await loadData();
      setSnackbar({ open: true, message: 'EMI deleted successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== TRACKER ====================
  const handleDeepTrackSourcedHistory = async () => {
    if (!trackSKU.trim()) return;
    setTrackingLoading(true);
    const db = getDB();
    if (!db || (!window?.electronAPI && !db.getAllVariants)) {
      setTrackingLoading(false);
      setSnackbar({ open: true, message: 'Tracker requires database access', severity: 'warning' });
      return;
    }

    try {
      const historyQuery = `
        SELECT pv.sku, pv.variant_name, pv.purchase_price as current_cost_rate,
               pv.retail_price as current_retail_rate, pv.current_stock,
               p.name as item_name,
               pi.purchase_price as sourced_vendor_rate, pur.purchase_no as batch_inflow_slip,
               pur.purchase_date as sourced_on_timestamp, sup.name as supplier_name,
               s.invoice_no as distributed_sale_invoice, s.date as customer_sold_on,
               s.customer_name as buyer_party, s.grand_total as bill_valuation_rate
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN purchase_items pi ON pi.product_variant_id = pv.id
        LEFT JOIN purchases pur ON pi.purchase_id = pur.id
        LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
        LEFT JOIN sale_items si ON si.product_variant_id = pv.id
        LEFT JOIN sales s ON si.sale_id = s.id
        WHERE LOWER(pv.sku) = LOWER(?) OR LOWER(pv.barcode) = LOWER(?)
        ORDER BY s.id DESC LIMIT 1
      `;
      const datasetRows = await db.electronQuery(historyQuery, [trackSKU.trim(), trackSKU.trim()]);
      setTrackHistoryResult(datasetRows.length > 0 ? datasetRows[0] : null);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Track failed: ' + err.message, severity: 'error' });
    } finally {
      setTrackingLoading(false);
    }
  };

  // ==================== EXPORT FUNCTIONS ====================
  const handleExportCSV = () => {
    const headers = ['Application No', 'Customer', 'Phone', 'CNIC', 'Product', 'SKU', 'Total Amount', 'Down Payment', 'EMI Amount', 'Interest %', 'Months', 'Paid Months', 'Remaining', 'Status', 'Next Due', 'Salesman', 'Shop', 'Start Date'];
    const rows = filteredEMIs.map(emi => {
      const c = customers.find(x => x.id === emi.customer_id) || {};
      const d = getEMIDetails(emi);
      return [
        emi.application_no || '', c.name || '', c.phone || '', c.cnic || '',
        emi.product_name || '', emi.product_sku || '', emi.total_amount || 0,
        emi.down_payment || 0, emi.emi_amount || 0, emi.interest_rate || 0,
        emi.total_months || 0, emi.paid_months || 0, emi.remaining_amount || 0,
        d.computedStatus, emi.next_due_date || '',
        salesmen.find(s => s.id === emi.salesman_id)?.name || '',
        emi.shop_location || '', emi.start_date || ''
      ];
    });
    downloadCSV(`EMI_Records_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    setExportMenuAnchor(null);
    setSnackbar({ open: true, message: 'CSV downloaded successfully!', severity: 'success' });
  };

  const handleExportPaymentsCSV = () => {
    const headers = ['Receipt No', 'Date', 'Customer', 'Product', 'Amount', 'Penalty', 'Discount', 'Total Received', 'Mode', 'Bank', 'Cheque No', 'Cheque Status', 'Notes'];
    const rows = filteredPayments.map(p => {
      const boundEmi = emis.find(x => String(x.id) === String(p.emi_id)) || {};
      const boundCustomer = customers.find(x => String(x.id) === String(boundEmi.customer_id || p.customer_id)) || {};
      const custName = p.customer_name || boundCustomer.name || boundEmi.customer_name || boundEmi._customer_name || 'Walk-in';
      const prodName = p.product_name || boundEmi.product_name || '-';
      const prodSku = boundEmi.product_sku ? ` [${boundEmi.product_sku}]` : '';
      return [
        p.receipt_no || `PAY-${p.id}`, p.payment_date || '', custName, `${prodName}${prodSku}`,
        p.amount || 0, p.penalty_amount || 0, p.discount_amount || 0, p.total_received || 0,
        p.payment_mode || '', p.bank_name || '', p.cheque_no || '', p.cheque_status || '', p.notes || ''
      ];
    });
    downloadCSV(`EMI_Payments_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    setExportMenuAnchor(null);
    setSnackbar({ open: true, message: 'Payments CSV downloaded!', severity: 'success' });
  };

  const handleExportPDF = () => {
    const statusBadge = (status) => {
      const cfg = statusColors[status] || statusColors.active;
      return `<span class="badge" style="background:${cfg.bg};color:${cfg.text}">${status.toUpperCase()}</span>`;
    };

    let tableRows = filteredEMIs.map(emi => {
      const c = customers.find(x => x.id === emi.customer_id) || {};
      const d = getEMIDetails(emi);
      return `
        <tr>
          <td><strong>${emi.application_no || '-'}</strong><br><small>${c.name || 'Walk-in'}</small></td>
          <td>${emi.product_name || '-'}<br><small>${emi.product_sku || ''}</small></td>
          <td class="text-right">${formatCurrency(emi.total_amount)}</td>
          <td class="text-right">${formatCurrency(emi.down_payment)}</td>
          <td class="text-right"><strong>${formatCurrency(emi.emi_amount)}</strong></td>
          <td class="text-center">${emi.paid_months || 0}/${emi.total_months || 0}</td>
          <td class="text-right">${formatCurrency(emi.remaining_amount)}</td>
          <td class="text-center">${statusBadge(d.computedStatus)}</td>
          <td>${formatDate(emi.next_due_date)}</td>
          <td>${salesmen.find(s => s.id === emi.salesman_id)?.name || '-'}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <h1>EMI Records Report</h1>
      <div>
        <div class="summary-box">
          <div class="summary-label">Total EMIs</div>
          <div class="summary-value">${stats.total}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Active</div>
          <div class="summary-value">${stats.active}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Overdue</div>
          <div class="summary-value">${stats.overdue}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Outstanding</div>
          <div class="summary-value">${formatCurrency(stats.totalOutstanding)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Collected</div>
          <div class="summary-value">${formatCurrency(stats.totalCollected)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Application / Customer</th>
            <th>Product</th>
            <th class="text-right">Total</th>
            <th class="text-right">Down</th>
            <th class="text-right">EMI</th>
            <th class="text-center">Progress</th>
            <th class="text-right">Remaining</th>
            <th class="text-center">Status</th>
            <th>Next Due</th>
            <th>Salesman</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;

    downloadPDF('EMI_Records_Report', html);
    setExportMenuAnchor(null);
    setSnackbar({ open: true, message: 'PDF report opened in new tab!', severity: 'success' });
  };

  const handleExportPaymentsPDF = () => {
    let tableRows = filteredPayments.map(p => {
      const boundEmi = emis.find(x => String(x.id) === String(p.emi_id)) || {};
      const boundCustomer = customers.find(x => String(x.id) === String(boundEmi.customer_id || p.customer_id)) || {};
      const custName = p.customer_name || boundCustomer.name || boundEmi.customer_name || boundEmi._customer_name || 'Walk-in';
      const prodName = p.product_name || boundEmi.product_name || '-';
      const prodSku = boundEmi.product_sku ? ` [${boundEmi.product_sku}]` : '';
      return `
        <tr>
          <td>${p.receipt_no || `PAY-${p.id}`}</td>
          <td>${formatDate(p.payment_date)}</td>
          <td>${custName}</td>
          <td>${prodName}${prodSku}</td>
          <td class="text-right"><strong style="color:#10b981">${formatCurrency(p.amount)}</strong></td>
          <td class="text-right">${formatCurrency(p.penalty_amount)}</td>
          <td class="text-right">${formatCurrency(p.discount_amount)}</td>
          <td class="text-right">${formatCurrency(p.total_received)}</td>
          <td>${(p.payment_mode || 'cash').toUpperCase()}</td>
          <td>${p.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <h1>EMI Payment History Report</h1>
      <div>
        <div class="summary-box">
          <div class="summary-label">Total Transactions</div>
          <div class="summary-value">${paymentMetrics.totalCount}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Collected</div>
          <div class="summary-value">${formatCurrency(paymentMetrics.totalCollected)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Penalty</div>
          <div class="summary-value">${formatCurrency(paymentMetrics.totalPenalty)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Total Discount</div>
          <div class="summary-value">${formatCurrency(paymentMetrics.totalDiscount)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Product</th>
            <th class="text-right">Amount</th>
            <th class="text-right">Penalty</th>
            <th class="text-right">Discount</th>
            <th class="text-right">Total</th>
            <th>Mode</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;

    downloadPDF('EMI_Payments_Report', html);
    setExportMenuAnchor(null);
    setSnackbar({ open: true, message: 'Payments PDF opened in new tab!', severity: 'success' });
  };
  // ==================== CUSTOMER & PRODUCT HANDLERS ====================

  const handleCustomerChange = (e) => {
    const val = e.target.value;
    if (val === 'new') {
      setOpenCustomerModal(true);
      return;
    }
    setCalc(prev => ({ ...prev, customerId: val }));
  };

  const saveNewCustomer = async () => {
    if (!customerForm.name.trim()) {
      setSnackbar({ open: true, message: 'Customer name is required!', severity: 'warning' });
      return;
    }
    const db = getDB();
    if (!db) {
      setSnackbar({ open: true, message: 'Database not available', severity: 'error' });
      return;
    }
    try {
      let newId;
      if (db.createCustomer) {
        const res = await db.createCustomer({
          ...customerForm,
          is_deleted: 0,
          created_at: new Date().toISOString()
        });
        newId = res.lastInsertRowid || res.record?.id || res.id;
      } else if (window?.electronAPI && db.electronQuery) {
        const res = await db.electronQuery(
          `INSERT INTO customers (name, phone, cnic, address, district, province, is_deleted, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
          [customerForm.name, customerForm.phone, customerForm.cnic, customerForm.address, customerForm.district, customerForm.province]
        );
        newId = res.lastInsertRowid;
      } else {
        throw new Error('No DB method available');
      }

      setOpenCustomerModal(false);
      setCustomerForm({ name: '', phone: '', cnic: '', address: '', district: '', province: '' });
      await loadData(true);
      if (newId) setCalc(prev => ({ ...prev, customerId: String(newId) }));
      setSnackbar({ open: true, message: 'Customer added & selected!', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to add customer: ' + err.message, severity: 'error' });
    }
  };

  const handleProductSelect = (product) => {
    if (!product || !product.id) {
      setCalc(prev => ({
        ...prev,
        productVariantId: '',
        productName: '',
        productSKU: '',
        totalAmount: 0
      }));
      return;
    }
    setCalc(prev => ({
      ...prev,
      productVariantId: String(product.id),
      productName: product.product_name + (product.variant_name ? ` - ${product.variant_name}` : ''),
      productSKU: product.sku || '',
      totalAmount: Number(product.retail_price || 0)
    }));
  };

  // ==================== GUARANTOR FUNCTIONS ====================
  const pushInlineGuarantor = () => {
    if (!guarantorForm.name.trim() || !guarantorForm.cnic.trim()) {
      setSnackbar({ open: true, message: 'Name and CNIC required!', severity: 'warning' });
      return;
    }
    setNewGuarantors(prev => [...prev, { ...guarantorForm, tempId: Date.now() }]);
    setShowInlineGuarantor(false);
  };

  const removeInlineGuarantor = (tempId) => {
    setNewGuarantors(prev => prev.filter(g => g.tempId !== tempId));
  };

  const openGuarantorDialog = (emi) => {
    setSelectedEMI(emi);
    setGuarantorForm({
      name: '', phone: '', cnic: '', address: '', occupation: '',
      monthly_income: 0, relation_to_customer: '', guarantor_type: 1,
      passport_photo_path: null, blank_check_photo_path: null,
      cnic_front_photo_path: null, cnic_back_photo_path: null
    });
    setGuarantorDialog(true);
  };

  const saveGuarantor = async () => {
    if (!guarantorForm.name.trim() || !guarantorForm.cnic.trim()) {
      setSnackbar({ open: true, message: 'Name and CNIC are required!', severity: 'warning' });
      return;
    }
    const db = getDB();
    if (!db) {
      setSnackbar({ open: true, message: 'Database not available', severity: 'error' });
      return;
    }
    try {
      const payload = {
        emi_id: selectedEMI ? selectedEMI.id : null,
        guarantor_type: Number(guarantorForm.guarantor_type) || 1,
        name: guarantorForm.name.trim(),
        phone: guarantorForm.phone || '',
        cnic: guarantorForm.cnic.trim(),
        address: guarantorForm.address || '',
        occupation: guarantorForm.occupation || '',
        monthly_income: Number(guarantorForm.monthly_income) || 0,
        relation_to_customer: guarantorForm.relation_to_customer || '',
        passport_photo_path: guarantorForm.passport_photo_path,
        blank_check_photo_path: guarantorForm.blank_check_photo_path,
        cnic_front_photo_path: guarantorForm.cnic_front_photo_path,
        cnic_back_photo_path: guarantorForm.cnic_back_photo_path
      };
      let success = false;
      if (db.createGuarantor) {
        await db.createGuarantor(payload);
        success = true;
      } else if (window?.electronAPI && db.electronQuery) {
        await db.electronQuery(
          `INSERT INTO emi_guarantors (
            emi_id, guarantor_type, name, phone, cnic, address, occupation,
            monthly_income, relation_to_customer, passport_photo_path,
            blank_check_photo_path, cnic_front_photo_path, cnic_back_photo_path,
            status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
          [
            payload.emi_id, payload.guarantor_type, payload.name, payload.phone,
            payload.cnic, payload.address, payload.occupation, payload.monthly_income,
            payload.relation_to_customer, payload.passport_photo_path,
            payload.blank_check_photo_path, payload.cnic_front_photo_path,
            payload.cnic_back_photo_path
          ]
        );
        success = true;
      }
      if (!success) throw new Error('No DB method available');
      setGuarantorDialog(false);
      // Refresh guarantors if view/history is open
      if ((viewDialog || historyDialog) && selectedEMI) {
        const fresh = [];
        if (db.getGuarantors) {
          const g = await db.getGuarantors(selectedEMI.id).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        } else if (window?.electronAPI && db.electronQuery) {
          const g = await db.electronQuery(
            `SELECT * FROM emi_guarantors WHERE emi_id = ? AND status = 'active'`,
            [selectedEMI.id]
          ).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        }
        setSelectedGuarantors(fresh);
      }
      await loadAllGuarantors();
      setSnackbar({ open: true, message: 'Guarantor saved successfully!', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to save guarantor: ' + err.message, severity: 'error' });
    }
  };

  // ==================== FILE UPLOAD HANDLER ====================
  const handleGuarantorFileUpload = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (editingGuarantor) {
        setEditingGuarantor(prev => ({ ...prev, [field]: e.target.result }));
      } else {
        setGuarantorForm(prev => ({ ...prev, [field]: e.target.result }));
      }
    };
    reader.readAsDataURL(file);
  };



  // ==================== UPDATE GUARANTOR ====================
  const handleUpdateGuarantor = async () => {
    if (!editingGuarantor || !editingGuarantor.name.trim() || !editingGuarantor.cnic.trim()) {
      setSnackbar({ open: true, message: 'Name and CNIC required!', severity: 'warning' });
      return;
    }
    const db = getDB();
    if (!db) return;
    try {
      const payload = {
        name: editingGuarantor.name.trim(),
        phone: editingGuarantor.phone || '',
        cnic: editingGuarantor.cnic.trim(),
        address: editingGuarantor.address || '',
        occupation: editingGuarantor.occupation || '',
        monthly_income: Number(editingGuarantor.monthly_income) || 0,
        relation_to_customer: editingGuarantor.relation_to_customer || '',
        guarantor_type: Number(editingGuarantor.guarantor_type) || 1,
        passport_photo_path: editingGuarantor.passport_photo_path,
        blank_check_photo_path: editingGuarantor.blank_check_photo_path,
        cnic_front_photo_path: editingGuarantor.cnic_front_photo_path,
        cnic_back_photo_path: editingGuarantor.cnic_back_photo_path
      };
      if (db.updateGuarantor) {
        await db.updateGuarantor(editingGuarantor.id, payload);
      } else if (window?.electronAPI && db.electronQuery) {
        await db.electronQuery(
          `UPDATE emi_guarantors SET name=?, phone=?, cnic=?, address=?, occupation=?, monthly_income=?, relation_to_customer=?, guarantor_type=?, passport_photo_path=?, blank_check_photo_path=?, cnic_front_photo_path=?, cnic_back_photo_path=?, updated_at=datetime('now') WHERE id=?`,
          [payload.name, payload.phone, payload.cnic, payload.address, payload.occupation, payload.monthly_income, payload.relation_to_customer, payload.guarantor_type, payload.passport_photo_path, payload.blank_check_photo_path, payload.cnic_front_photo_path, payload.cnic_back_photo_path, editingGuarantor.id]
        );
      }
      setGuarantorEditDialog(false);
      setEditingGuarantor(null);
      await loadAllGuarantors();
      if (selectedEMI) {
        const fresh = [];
        if (db.getGuarantors) {
          const g = await db.getGuarantors(selectedEMI.id).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        } else if (window?.electronAPI && db.electronQuery) {
          const g = await db.electronQuery(`SELECT * FROM emi_guarantors WHERE emi_id = ? AND status = 'active'`, [selectedEMI.id]).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        }
        setSelectedGuarantors(fresh);
      }
      await loadAllGuarantors();
      setSnackbar({ open: true, message: 'Guarantor updated!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Update failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== DELETE GUARANTOR ====================
  const handleDeleteGuarantor = async (id) => {
    if (!window.confirm('Delete this guarantor permanently?')) return;
    const db = getDB();
    if (!db) return;
    try {
      if (db.deleteGuarantor) {
        await db.deleteGuarantor(id);
      } else if (window?.electronAPI && db.electronQuery) {
        await db.electronQuery(`DELETE FROM emi_guarantors WHERE id = ?`, [id]);
      }
      await loadAllGuarantors();
      if (selectedEMI) {
        const fresh = [];
        if (db.getGuarantors) {
          const g = await db.getGuarantors(selectedEMI.id).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        } else if (window?.electronAPI && db.electronQuery) {
          const g = await db.electronQuery(`SELECT * FROM emi_guarantors WHERE emi_id = ? AND status = 'active'`, [selectedEMI.id]).catch(() => []);
          if (Array.isArray(g)) fresh.push(...g);
        }
        setSelectedGuarantors(fresh);
      }
      setSnackbar({ open: true, message: 'Guarantor deleted!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Delete failed: ' + err.message, severity: 'error' });
    }
  };

  // ==================== OPEN GUARANTOR EDIT ====================
  const openGuarantorEdit = (g) => {
    setEditingGuarantor({ ...g });
    setGuarantorEditDialog(true);
  };

  // ==================== OPEN GUARANTOR DETAIL ====================
  const openGuarantorDetail = (g) => {
    setSelectedGuarantorDetail(g);
    setGuarantorDetailDialog(true);
  };
  // ==================== RENDER: STATS CARDS ====================
  const renderStatsCards = () => (
    <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: 2 }}>
      {[
        { label: 'Total EMIs', value: stats.total, sub: 'All records' },
        { label: 'Active', value: stats.active, sub: 'Running plans' },
        { label: 'Overdue', value: stats.overdue, sub: 'Pending installments' },
        { label: 'Defaulted', value: stats.defaulted, sub: 'Late status' },
        { label: 'Completed', value: stats.completed, sub: 'Fully paid' },
        { label: 'Portfolio', value: formatCurrency(stats.totalPortfolio), sub: 'Total value' },
      ].map((stat, idx) => (
        <Grid item xs={isMobile ? 6 : 2} key={idx}>
          <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
                {stat.label}
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
                {stat.sub}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
      <Grid item xs={isMobile ? 6 : 3}>
        <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
            <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
              Outstanding
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
              {formatCurrency(stats.totalOutstanding)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
              Balance to recover
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={isMobile ? 6 : 3}>
        <Card sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderTop: '4px solid #1c2580', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
            <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>
              Collected
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2, mb: 0.5 }} noWrap>
              {formatCurrency(stats.totalCollected)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500 }}>
              Total recoveries
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // ==================== RENDER: FILTERS ====================
  const renderFilters = () => (
    <Paper sx={{
      p: isMobile ? 1.5 : 2,
      mb: 2,
      border: '1px solid #10b98140',
      bgcolor: '#fbfdfb',
      borderRadius: 2
    }}>
      <Grid container spacing={isMobile ? 1.5 : 2} alignItems="center">
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Search"
            placeholder="Name, Phone, CNIC, SKU, App No..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: '#10b981', fontSize: 20 }} />,
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchQuery(''); setPage(1); }}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} label="Status">
              <MenuItem value="all">All Records</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="defaulted">Defaulted</MenuItem>
              <MenuItem value="legal">Legal</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            fullWidth
            size="small"
            options={allGuarantors}
            getOptionLabel={(g) => g ? `${g.name} ${g.phone ? `[${g.phone}]` : ''} ${g.cnic ? `(${g.cnic})` : ''}` : ''}
            value={allGuarantors.find(g => (filterGuarantor && (String(g.id) === String(filterGuarantor) || g.cnic === filterGuarantor))) || null}
            onChange={(e, val) => {
              setFilterGuarantor(val ? (val.cnic || val.id) : '');
              setPage(1);
            }}
            isOptionEqualToValue={(opt, val) => String(opt.id) === String(val?.id) || opt.cnic === val?.cnic}
            renderOption={(props, option) => (
              <li {...props} key={option.id || option.cnic}>
                <Box sx={{ py: 0.3 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {option.name}
                    {option.total_guarantees > 1 && (
                      <Chip size="small" label={`${option.total_guarantees} Guarantees`} sx={{ ml: 1, height: 16, fontSize: '0.6rem', bgcolor: '#ecfdf5', color: '#065f46', fontWeight: 'bold' }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.phone ? `${option.phone} • ` : ''}{option.cnic || 'No CNIC'}
                    {option.customer_names?.length > 0 ? ` • For: ${option.customer_names.join(', ')}` : ''}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Guarantor Filter" placeholder="Search guarantor..." />
            )}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField
            fullWidth size="small" type="date" label="From"
            value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth size="small" type="date" label="To"
              value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
            />
            <Tooltip title="Clear Filters">
              <IconButton size="small" onClick={() => {
                setSearchQuery(''); setFilterStatus('all'); setFilterGuarantor('');
                setFilterDateFrom(''); setFilterDateTo(''); setPage(1);
              }} sx={{ border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );

  // ==================== RENDER: EMI LIST (MOBILE) ====================
  const renderMobileList = () => (
    <Box>
      {loading && initialLoad ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : paginatedEMIs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Timeline sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
          <Typography color="text.secondary" gutterBottom>No EMI records found</Typography>
          <Button variant="contained" startIcon={<CalcIcon />} onClick={() => setOpenCalculator(true)} sx={{ mt: 2, bgcolor: '#10b981', borderRadius: 2 }}>
            Create New EMI
          </Button>
        </Paper>
      ) : (
        <>
          {paginatedEMIs.map((emi) => {
            const details = getEMIDetails(emi);
            const customer = customers.find(c => String(c.id) === String(emi.customer_id));
            return (
              <MobileEMICard
                key={emi.id}
                emi={emi}
                customer={customer}
                details={details}
                onPay={openPaymentDialog}
                onHistory={openHistoryDialog}
                onView={openViewDialog}
                onDelete={confirmDeleteEMI}
              />
            );
          })}
          <UnifiedPagination
            count={filteredEMIs.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(newR) => {
              setRowsPerPage(newR);
              setPage(1);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </>
      )}
    </Box>
  );

  // ==================== RENDER: EMI LIST (DESKTOP) ====================
  const renderDesktopTable = () => (
    <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {[
                { key: 'application_no', label: 'App No / Customer', width: '18%' },
                { key: 'product_name', label: 'Product', width: '14%' },
                { key: 'emi_amount', label: 'Monthly EMI', width: '10%', align: 'right' },
                { key: 'progress', label: 'Progress', width: '10%' },
                { key: 'totalPaid', label: 'Paid', width: '10%', align: 'right' },
                { key: 'remaining', label: 'Remaining', width: '10%', align: 'right' },
                { key: 'status', label: 'Status', width: '8%', align: 'center' },
                { key: 'next_due', label: 'Next Due', width: '10%' },
                { key: 'actions', label: 'Actions', width: '10%', align: 'center' },
              ].map((col) => (
                <TableCell
                  key={col.key}
                  sx={{
                    bgcolor: '#1c2580',
                    color: 'white',
                    fontWeight: 'bold',
                    py: 1.5,
                    fontSize: '0.85rem',
                    cursor: col.key !== 'actions' && col.key !== 'progress' ? 'pointer' : 'default',
                    width: col.width,
                    textAlign: col.align || 'left'
                  }}
                  onClick={() => col.key !== 'actions' && col.key !== 'progress' && handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 10 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && initialLoad ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton height={30} /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedEMIs.map((emi) => {
              const details = getEMIDetails(emi);
              const customer = customers.find(c => String(c.id) === String(emi.customer_id));
              const statusCfg = statusColors[details.computedStatus] || statusColors.active;
              return (
                <TableRow key={emi.id} hover sx={{
                  bgcolor: details.isOverdue ? '#fef2f2' : 'inherit',
                  transition: 'background 0.15s'
                }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace', color: '#374151' }}>
                      {emi.application_no}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {emi._customer_name || customer?.name || customer?.customer_name || 'Walk-in'}
                    </Typography>
                    {(emi._customer_phone || customer?.phone) && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                        <Phone sx={{ fontSize: 10, verticalAlign: 'middle', mr: 0.5 }} />
                        {emi._customer_phone || customer?.phone}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{emi.product_name}</Typography>
                    {emi.product_sku && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{emi.product_sku}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.9rem' }}>
                    {formatCurrency(emi.emi_amount)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(details.progress, 100)}
                        sx={{
                          width: 60, height: 8, borderRadius: 4,
                          bgcolor: '#e5e7eb',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: details.progress >= 100 ? '#10b981' : details.isOverdue ? '#ef4444' : '#3b82f6',
                            borderRadius: 4
                          }
                        }}
                      />
                      <Typography variant="caption" fontWeight="bold">{emi.paid_months || 0}/{emi.total_months || 0}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 500 }}>
                    {formatCurrency(details.totalPaid)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: details.isOverdue ? 'error.main' : 'warning.main', fontWeight: 'bold' }}>
                    {formatCurrency(emi.remaining_amount)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={details.computedStatus.toUpperCase()}
                      sx={{
                        height: 22,
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        bgcolor: statusCfg.bg,
                        color: statusCfg.text,
                        border: `1px solid ${statusCfg.text}30`
                      }}
                    />
                    {details.daysOverdue > 0 && (
                      <Typography variant="caption" color="error" display="block" sx={{ fontSize: '0.6rem', mt: 0.3 }}>
                        {details.daysOverdue} days late
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {formatDate(emi.next_due_date)}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openViewDialog(emi)}>
                          <Visibility fontSize="small" sx={{ color: '#6b7280' }} />
                        </IconButton>
                      </Tooltip>
                      {details.remainingMonths > 0 && details.computedStatus !== 'completed' && (
                        <Tooltip title="Record Payment">
                          <IconButton size="small" sx={{ color: '#10b981' }} onClick={() => openPaymentDialog(emi)}>
                            <PayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Payment History">
                        <IconButton size="small" sx={{ color: '#3b82f6' }} onClick={() => openHistoryDialog(emi)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" sx={{ color: '#ef4444' }} onClick={() => confirmDeleteEMI(emi)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {paginatedEMIs.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Timeline sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                  <Typography color="text.secondary">No EMI records match your filters</Typography>
                  <Button variant="outlined" size="small" onClick={() => {
                    setSearchQuery(''); setFilterStatus('all'); setFilterGuarantor('');
                    setFilterDateFrom(''); setFilterDateTo('');
                  }} sx={{ mt: 1 }}>
                    Clear Filters
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <UnifiedPagination
        count={filteredEMIs.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(newR) => {
          setRowsPerPage(newR);
          setPage(1);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
    </Paper>
  );

  // ==================== RENDER: PAYMENT HISTORY TAB ====================
  const renderPaymentHistory = () => (
    <Box>
      {/* 1. Payment Summary KPI Cards */}
      <Grid container spacing={isMobile ? 1.5 : 2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Total Collected</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>
                {formatCurrency(paymentMetrics.totalCollected)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Total Penalties</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>
                {formatCurrency(paymentMetrics.totalPenalty)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Total Discounts</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>
                {formatCurrency(paymentMetrics.totalDiscount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#ffffff', borderTop: '4px solid #1c2580', border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 0.5 }} noWrap>Transactions</Typography>
              <Typography variant="h6" fontWeight="bold" color="#1c2580" sx={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.2 }} noWrap>
                {paymentMetrics.totalCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 2. Filter Bar */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, border: '1px solid #e5e7eb', borderRadius: 2, bgcolor: '#fafafa' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              fullWidth
              size="small"
              options={customers}
              getOptionLabel={(c) => c ? `${c.name || ''} ${c.phone ? `(${c.phone})` : ''}` : ''}
              value={customers.find(c => String(c.id) === String(payFilterCustomer)) || null}
              onChange={(e, val) => setPayFilterCustomer(val ? val.id : '')}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ py: 0.3 }}>
                    <Typography variant="body2" fontWeight="bold">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.phone ? `${option.phone} • ` : ''}{option.cnic || 'No CNIC'}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Filter Customer" placeholder="Search customer..." InputLabelProps={{ shrink: true }} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Product / SKU"
              placeholder="Search product or SKU..."
              value={payFilterProduct}
              onChange={(e) => setPayFilterProduct(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Mode</InputLabel>
              <Select value={payFilterMode} onChange={(e) => setPayFilterMode(e.target.value)} label="Mode">
                <MenuItem value="all">All Modes</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="bank">Bank / Transfer</MenuItem>
                <MenuItem value="jazzcash">JazzCash</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                <MenuItem value="card">Card</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From"
              value={payFilterDateFrom}
              onChange={(e) => setPayFilterDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To"
              value={payFilterDateTo}
              onChange={(e) => setPayFilterDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={12} md={1} sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => {
                setPayFilterCustomer('');
                setPayFilterProduct('');
                setPayFilterMode('all');
                setPayFilterDateFrom('');
                setPayFilterDateTo('');
              }}
              sx={{ height: 40 }}
              startIcon={<Refresh />}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 3. Table & Export */}
      <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <Typography variant="subtitle2" fontWeight="bold">
            <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#4b5563' }} />
            Filtered Payments ({filteredPayments.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<TableChart />} onClick={handleExportPaymentsCSV}>
              CSV
            </Button>
            <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={handleExportPaymentsPDF}>
              PDF
            </Button>
          </Stack>
        </Box>
        <TableContainer sx={{ maxHeight: isMobile ? 'calc(100vh - 420px)' : 'calc(100vh - 440px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: '#1c2580' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Receipt</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Date</TableCell>
                {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Customer</TableCell>}
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Product</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Amount</TableCell>
                {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Penalty</TableCell>}
                {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Discount</TableCell>}
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Mode</TableCell>
                {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Notes</TableCell>}
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isMobile ? 6 : 10} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No payments matching current filters</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment, idx) => {
                  const boundEmi = emis.find(e => String(e.id) === String(payment.emi_id));
                  const boundCustomer = customers.find(c => String(c.id) === String(boundEmi?.customer_id || payment.customer_id));
                  const custName = payment.customer_name || boundCustomer?.name || boundEmi?.customer_name || boundEmi?._customer_name || 'Walk-in';
                  const prodName = payment.product_name || boundEmi?.product_name || '-';
                  const prodSku = boundEmi?.product_sku ? ` [${boundEmi.product_sku}]` : '';
                  const modeIcon = paymentModeIcons[payment.payment_mode] || paymentModeIcons.cash;

                  return (
                    <TableRow key={payment.id || idx} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
                        {payment.receipt_no || `PAY-${payment.id}`}
                      </TableCell>
                      <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{formatDate(payment.payment_date)}</TableCell>
                      {!isMobile && (
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {custName}
                        </TableCell>
                      )}
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {prodName}{prodSku}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      {!isMobile && <TableCell align="right" sx={{ color: 'error.main', fontSize: '0.8rem' }}>{formatCurrency(payment.penalty_amount)}</TableCell>}
                      {!isMobile && <TableCell align="right" sx={{ color: 'warning.main', fontSize: '0.8rem' }}>{formatCurrency(payment.discount_amount)}</TableCell>}
                      <TableCell>
                        <Chip
                          size="small"
                          icon={modeIcon}
                          label={String(payment.payment_mode || 'cash').toUpperCase()}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.6rem' }}
                        />
                        {payment.cheque_status && (
                          <Chip
                            size="small"
                            label={payment.cheque_status.toUpperCase()}
                            color={payment.cheque_status === 'cleared' ? 'success' : payment.cheque_status === 'bounced' ? 'error' : 'warning'}
                            sx={{ height: 18, fontSize: '0.55rem', ml: 0.5 }}
                          />
                        )}
                      </TableCell>
                      {!isMobile && <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', maxWidth: 150 }}>{payment.notes || '-'}</TableCell>}
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {payment.payment_mode === 'cheque' && payment.cheque_status !== 'cleared' && (
                            <Tooltip title="Mark Cheque Cleared">
                              <IconButton size="small" color="success" onClick={() => handleClearCheque(payment)}>
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Void / Delete Payment">
                            <IconButton size="small" color="error" onClick={() => handleInitiateDeletePayment(payment)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <UnifiedPagination
          count={filteredPayments.length}
          page={payPage}
          rowsPerPage={payRowsPerPage}
          onPageChange={setPayPage}
          onRowsPerPageChange={(newR) => {
            setPayRowsPerPage(newR);
            setPayPage(1);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );

  // ==================== RENDER: TRACKER TAB ====================
  const renderTracker = () => (
    <Paper sx={{ p: isMobile ? 1.5 : 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" gutterBottom>
        <Search sx={{ verticalAlign: 'middle', mr: 1, color: '#10b981' }} />
        Product Lifecycle Tracker
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Enter SKU / Barcode..."
          value={trackSKU}
          onChange={(e) => setTrackSKU(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleDeepTrackSourcedHistory(); }}
          InputProps={{
            startAdornment: <QrCode sx={{ mr: 1, color: '#10b981' }} />
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Button
          variant="contained"
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, minWidth: isMobile ? '100%' : 120, borderRadius: 2 }}
          onClick={handleDeepTrackSourcedHistory}
          disabled={trackingLoading}
          startIcon={trackingLoading ? <CircularProgress size={16} color="inherit" /> : <Search />}
        >
          {trackingLoading ? 'Tracking...' : 'Track'}
        </Button>
      </Box>

      {trackHistoryResult ? (
        <Card variant="outlined" sx={{ bgcolor: '#f9fafb', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>
              {trackHistoryResult.item_name} [{trackHistoryResult.variant_name || 'Default'}]
            </Typography>
            <Grid container spacing={isMobile ? 2 : 3}>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                  <Store sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Inventory
                </Typography>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>SKU:</strong> <span style={{ fontFamily: 'monospace' }}>{trackHistoryResult.sku}</span></Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Retail:</strong> {formatCurrency(trackHistoryResult.current_retail_rate)}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Cost:</strong> {formatCurrency(trackHistoryResult.current_cost_rate)}</Typography>
                <Typography variant="body2"><strong>Stock:</strong> {trackHistoryResult.current_stock} units</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="success.main" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                  <AccountBalance sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Supplier Source
                </Typography>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Vendor:</strong> {trackHistoryResult.supplier_name || '-'}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Invoice:</strong> {trackHistoryResult.batch_inflow_slip || '-'}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Date:</strong> {formatDate(trackHistoryResult.sourced_on_timestamp)}</Typography>
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                  <strong>Vendor Rate:</strong> {formatCurrency(trackHistoryResult.sourced_vendor_rate || trackHistoryResult.current_cost_rate)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                  <Receipt sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Sales History
                </Typography>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Invoice:</strong> {trackHistoryResult.distributed_sale_invoice || 'Unsold'}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Customer:</strong> {trackHistoryResult.buyer_party || '-'}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Sold On:</strong> {formatDate(trackHistoryResult.customer_sold_on)}</Typography>
                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  <strong>Sold For:</strong> {formatCurrency(trackHistoryResult.bill_valuation_rate)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : trackSKU && !trackingLoading && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
          No product found with SKU/Barcode "{trackSKU}". Try scanning or entering a valid code.
        </Alert>
      )}
    </Paper>
  );

  // ==================== RENDER: VIEW DIALOG ====================
  const renderViewDialog = () => {
    if (!selectedEMI) return null;
    const details = getEMIDetails(selectedEMI);
    const customer = customers.find(c => String(c.id) === String(selectedEMI.customer_id));
    const salesman = salesmen.find(s => s.id === selectedEMI.salesman_id);

    return (
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Visibility sx={{ verticalAlign: 'middle', mr: 1 }} />
            EMI Details — {selectedEMI.application_no}
          </Box>
          <Chip
            size="small"
            label={details.computedStatus.toUpperCase()}
            sx={{ bgcolor: 'white', color: '#10b981', fontWeight: 'bold' }}
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>Customer Information</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="body1" fontWeight="bold">{customer?.name || 'Walk-in Customer'}</Typography>
                <Typography variant="body2" color="text.secondary">{customer?.phone || 'No phone'}</Typography>
                <Typography variant="body2" color="text.secondary">{customer?.cnic || 'No CNIC'}</Typography>
                <Typography variant="body2" color="text.secondary">{customer?.address || ''}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>Product & EMI</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="body1" fontWeight="bold">{selectedEMI.product_name}</Typography>
                {selectedEMI.product_sku && <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>SKU: {selectedEMI.product_sku}</Typography>}
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Total Amount</Typography><Typography variant="body2" fontWeight="bold">{formatCurrency(selectedEMI.total_amount)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Down Payment</Typography><Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(selectedEMI.down_payment)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Monthly EMI</Typography><Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(selectedEMI.emi_amount)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Interest Rate</Typography><Typography variant="body2" fontWeight="bold">{selectedEMI.interest_rate}%</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Duration</Typography><Typography variant="body2" fontWeight="bold">{selectedEMI.total_months} months</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Progress</Typography><Typography variant="body2" fontWeight="bold">{selectedEMI.paid_months}/{selectedEMI.total_months} paid</Typography></Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>Financial Summary</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(details.totalPaid)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Remaining</Typography>
                    <Typography variant="h6" fontWeight="bold" color={details.isOverdue ? 'error' : 'warning.main'}>{formatCurrency(selectedEMI.remaining_amount)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Penalties</Typography>
                    <Typography variant="h6" fontWeight="bold" color="error.main">{formatCurrency(details.totalPenalty)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Discounts</Typography>
                    <Typography variant="h6" fontWeight="bold" color="warning.main">{formatCurrency(details.totalDiscount)}</Typography>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(details.progress, 100)}
                    sx={{ height: 10, borderRadius: 5, bgcolor: '#e5e7eb' }}
                  />
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                    {Math.round(details.progress)}% Complete
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary">Guarantors ({selectedGuarantors.length})</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => openGuarantorDialog(selectedEMI)}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Add Guarantor
                </Button>
              </Box>
              {selectedGuarantors.length > 0 ? (
                <Grid container spacing={1}>
                  {selectedGuarantors.map((g, i) => (
                    <Grid item xs={12} md={6} key={i}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight="bold">{g.name} <Chip size="small" label={`Type ${g.guarantor_type}`} sx={{ height: 18, fontSize: '0.6rem' }} /></Typography>
                        <Typography variant="caption" color="text.secondary">{g.phone} | CNIC: {g.cnic}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{g.relation_to_customer} | Income: {formatCurrency(g.monthly_income)}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No guarantors recorded. Click "Add Guarantor" to add one.</Alert>
              )}
            </Grid>
            {selectedVisits.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>Visit Log ({selectedVisits.length})</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                  <Table size="small">
                    <TableHead><TableRow sx={{ bgcolor: '#1c2580' }}><TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell><TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell><TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Staff</TableCell><TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Outcome</TableCell><TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Collected</TableCell></TableRow></TableHead>
                    <TableBody>
                      {selectedVisits.map((v, i) => (
                        <TableRow key={i}><TableCell>{formatDate(v.visit_date)}</TableCell><TableCell>{v.visit_type}</TableCell><TableCell>{v.staff_name}</TableCell><TableCell>{v.outcome || '-'}</TableCell><TableCell align="right">{formatCurrency(v.amount_collected)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {details.remainingMonths > 0 && details.computedStatus !== 'completed' && (
            <Button variant="contained" sx={{ bgcolor: '#10b981' }} onClick={() => { setViewDialog(false); openPaymentDialog(selectedEMI); }}>
              Record Payment
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  // ==================== RENDER: HISTORY DIALOG ====================
  const renderHistoryDialog = () => {
    if (!selectedEMI) return null;
    const customer = customers.find(c => String(c.id) === String(selectedEMI.customer_id));

    return (
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
          <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          EMI History — {selectedEMI.application_no}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
              {selectedEMI.product_name} | {customer?.name || 'Walk-in'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total: {formatCurrency(selectedEMI.total_amount)} | EMI: {formatCurrency(selectedEMI.emi_amount)} | {selectedEMI.paid_months}/{selectedEMI.total_months} months
            </Typography>
          </Box>

          <Tabs value={historyTab} onChange={(e, v) => setHistoryTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, minHeight: 36 }}>
            <Tab label={`Schedule (${selectedSchedule.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
            <Tab label={`Payments (${selectedPayments.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
            <Tab label={`Guarantors (${selectedGuarantors.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
            <Tab label={`Visits (${selectedVisits.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
          </Tabs>

          {historyTab === 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1c2580' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Due Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Planned</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Paid</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Penalty</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="center">Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Paid Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedSchedule.map((row, i) => {
                    const statusColor = row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'error' : row.status === 'partial' ? 'warning' : 'default';
                    return (
                      <TableRow key={row.id || row.installment_no || `sched-${i}`} sx={{
                        bgcolor: row.status === 'paid' ? '#f0fdf4' : row.status === 'overdue' ? '#fef2f2' : 'inherit'
                      }}>
                        <TableCell>{row.installment_no || row.monthIndex || i + 1}</TableCell>
                        <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.85rem' }}>{formatDate(row.due_date)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.planned_amount || row.amount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: row.paid_amount > 0 ? 'bold' : 'normal', color: row.paid_amount > 0 ? 'success.main' : 'inherit' }}>
                          {formatCurrency(row.paid_amount || 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: row.penalty_amount > 0 ? 'error.main' : 'text.secondary', fontWeight: row.penalty_amount > 0 ? 'bold' : 'normal' }}>
                          {row.penalty_amount > 0 ? formatCurrency(row.penalty_amount) : '—'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={(row.status || 'PENDING').toUpperCase()} color={statusColor} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: row.paid_date ? 'bold' : 'normal', color: row.paid_date ? '#059669' : 'text.secondary' }}>
                          {row.paid_date ? formatDate(row.paid_date) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {historyTab === 1 && (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow sx={{ bgcolor: '#1c2580' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Receipt</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Amount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Penalty</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Discount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Mode</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Notes</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {selectedPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No payments yet</TableCell></TableRow>
                  ) : selectedPayments.map((p, i) => (
                    <TableRow key={i} hover sx={{ bgcolor: p.is_reversal ? '#fef2f2' : 'inherit' }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.receipt_no || `PAY-${p.id}`}</TableCell>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell align="right" sx={{ color: p.is_reversal ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                        {p.is_reversal ? '-' : ''}{formatCurrency(Math.abs(p.amount))}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(p.penalty_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'warning.main' }}>{formatCurrency(p.discount_amount)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={(p.payment_mode || 'cash').toUpperCase()} variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{p.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {historyTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold">Guarantors ({selectedGuarantors.length})</Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => openGuarantorDialog(selectedEMI)}
                  sx={{ bgcolor: '#10b981', borderRadius: 2, textTransform: 'none' }}
                >
                  Add Guarantor
                </Button>
              </Box>
              {selectedGuarantors.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No guarantors recorded for this EMI.</Alert>
              ) : (
                <Grid container spacing={1.5}>
                  {selectedGuarantors.map((g, i) => (
                    <Grid item xs={12} md={6} key={i}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, position: 'relative' }}>
                        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => openGuarantorEdit(g)}><Edit fontSize="small" sx={{ color: '#3b82f6' }} /></IconButton>
                          <IconButton size="small" onClick={() => handleDeleteGuarantor(g.id)}><Delete fontSize="small" sx={{ color: '#ef4444' }} /></IconButton>
                        </Box>
                        <Typography variant="body1" fontWeight="bold">{g.name} <Chip size="small" label={`Type ${g.guarantor_type}`} sx={{ height: 18, fontSize: '0.6rem', ml: 0.5 }} /></Typography>
                        <Typography variant="body2" color="text.secondary">{g.phone}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>CNIC: {g.cnic}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{g.relation_to_customer} | {g.occupation}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">Income: {formatCurrency(g.monthly_income)}</Typography>
                        {(g.passport_photo_path || g.cnic_front_photo_path) && (
                          <Typography variant="caption" color="success.main" fontWeight="bold" display="block" sx={{ mt: 0.5 }}>Documents Attached</Typography>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {historyTab === 3 && (
            selectedVisits.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>No visit logs for this EMI.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow sx={{ bgcolor: '#1c2580' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Type</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Staff</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Location</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Outcome</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Collected</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {selectedVisits.map((v, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{formatDate(v.visit_date)}</TableCell>
                        <TableCell><Chip size="small" label={v.visit_type} sx={{ height: 18, fontSize: '0.6rem' }} /></TableCell>
                        <TableCell>{v.staff_name || '-'}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{v.location || '-'}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{v.outcome || '-'}</TableCell>
                        <TableCell align="right" sx={{ color: v.amount_collected > 0 ? 'success.main' : 'text.secondary', fontWeight: 'bold' }}>
                          {formatCurrency(v.amount_collected)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // ==================== RENDER: PAYMENT DIALOG ====================
  const renderPaymentDialog = () => (
    <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <PayIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Record Payment — {selectedEMI?.application_no}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {selectedEMI && (
          <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f9fafb', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="bold">{selectedEMI.product_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Remaining: {formatCurrency(selectedEMI.remaining_amount)} | Monthly EMI: {formatCurrency(selectedEMI.emi_amount)} | Progress: {selectedEMI.paid_months || 0}/{selectedEMI.total_months || 0} Months
              </Typography>
            </Paper>

            {/* Quick Installment Selectors */}
            {selectedEMI && selectedEMI.emi_amount > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.8 }}>
                  Quick Select Installments (One-Click Multi-Month):
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.8 }}>
                  <Chip
                    clickable
                    color={Number(paymentForm.amount) === Number(selectedEMI.emi_amount) ? 'primary' : 'default'}
                    label={`1 Month (${formatCurrency(selectedEMI.emi_amount)})`}
                    onClick={() => {
                      setPaymentForm(prev => ({ ...prev, amount: selectedEMI.emi_amount, discountAmount: 0 }));
                    }}
                    size="small"
                  />
                  {Number(selectedEMI.remaining_amount) >= Number(selectedEMI.emi_amount) * 2 && (
                    <Chip
                      clickable
                      color={Number(paymentForm.amount) === Number(selectedEMI.emi_amount) * 2 ? 'primary' : 'default'}
                      label={`2 Months (${formatCurrency(selectedEMI.emi_amount * 2)})`}
                      onClick={() => {
                        setPaymentForm(prev => ({ ...prev, amount: selectedEMI.emi_amount * 2 }));
                      }}
                      size="small"
                    />
                  )}
                  {Number(selectedEMI.remaining_amount) >= Number(selectedEMI.emi_amount) * 3 && (
                    <Chip
                      clickable
                      color={Number(paymentForm.amount) === Number(selectedEMI.emi_amount) * 3 ? 'primary' : 'default'}
                      label={`3 Months (${formatCurrency(selectedEMI.emi_amount * 3)})`}
                      onClick={() => {
                        const threeMonths = selectedEMI.emi_amount * 3;
                        const suggestedDiscount = Math.round(threeMonths * 0.02);
                        setPaymentForm(prev => ({
                          ...prev,
                          amount: threeMonths,
                          discountAmount: prev.discountAmount > 0 ? prev.discountAmount : suggestedDiscount
                        }));
                      }}
                      size="small"
                    />
                  )}
                  {Number(selectedEMI.remaining_amount) > 0 && (
                    <Chip
                      clickable
                      color={Number(paymentForm.amount) === Number(selectedEMI.remaining_amount) ? 'success' : 'default'}
                      label={`Full Remaining (${formatCurrency(selectedEMI.remaining_amount)})`}
                      onClick={() => {
                        const fullRem = selectedEMI.remaining_amount;
                        const suggestedDiscount = Math.round(fullRem * 0.05);
                        setPaymentForm(prev => ({
                          ...prev,
                          amount: fullRem,
                          discountAmount: prev.discountAmount > 0 ? prev.discountAmount : suggestedDiscount
                        }));
                      }}
                      size="small"
                    />
                  )}
                </Stack>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" type="number" label="Amount *"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', mr: 0.5 }}>Rs.</Typography></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" type="date" label="Payment Date *"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" type="number" label="Penalty Amount"
                  value={paymentForm.penaltyAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, penaltyAmount: Number(e.target.value) })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444', mr: 0.5 }}>Rs.</Typography></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" type="number" label="Discount Amount"
                  value={paymentForm.discountAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, discountAmount: Number(e.target.value) })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', mr: 0.5 }}>Rs.</Typography></InputAdornment> }}
                  helperText={paymentForm.discountAmount > 0 ? 'Advance / Early Settlement Discount Applied' : ''}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} label="Payment Mode">
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                    <MenuItem value="cheque">Cheque</MenuItem>
                    <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                    <MenuItem value="jazzcash">JazzCash</MenuItem>
                    <MenuItem value="card">Card / POS</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="payment-acc-sel">Deposit To Account *</InputLabel>
                  <Select
                    labelId="payment-acc-sel"
                    value={paymentForm.accountId || ''}
                    onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                    label="Deposit To Account *"
                  >
                    <MenuItem value="" disabled><em>Select account</em></MenuItem>
                    {accounts
                      .filter(a => {
                        const m = (paymentForm.paymentMode || 'cash').toLowerCase();
                        const targetType = (m === 'bank_transfer' || m === 'card') ? 'bank' : m;
                        return a.status === 'active' && (!targetType || a.type === targetType);
                      })
                      .map(a => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name} ({a.type?.toUpperCase()}) • Bal: {formatCurrency(a.current_balance)}
                        </MenuItem>
                      ))}
                    {accounts.filter(a => {
                      const m = (paymentForm.paymentMode || 'cash').toLowerCase();
                      const targetType = (m === 'bank_transfer' || m === 'card') ? 'bank' : m;
                      return a.status === 'active' && a.type === targetType;
                    }).length === 0 && accounts.map(a => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.name} ({a.type?.toUpperCase()}) • Bal: {formatCurrency(a.current_balance)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {paymentForm.accountId && (
              <Box sx={{ p: 1, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Receiving Financial Account:</Typography>
                <Typography variant="caption" color="success.dark" fontWeight="bold">
                  {accounts.find(a => String(a.id) === String(paymentForm.accountId))?.name || 'Selected Account'}
                </Typography>
              </Box>
            )}
            {paymentForm.paymentMode === 'cheque' && (
              <>
                <TextField fullWidth size="small" label="Bank Name" value={paymentForm.bankName} onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })} />
                <TextField fullWidth size="small" label="Cheque Number" value={paymentForm.chequeNo} onChange={(e) => setPaymentForm({ ...paymentForm, chequeNo: e.target.value })} />
                <TextField fullWidth size="small" type="date" label="Cheque Date" value={paymentForm.chequeDate} onChange={(e) => setPaymentForm({ ...paymentForm, chequeDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              </>
            )}
            {paymentForm.paymentMode === 'bank_transfer' && (
              <TextField fullWidth size="small" label="Bank Name / Reference" value={paymentForm.bankName} onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })} />
            )}
            <TextField fullWidth size="small" label="Receipt Number" value={paymentForm.receiptNo} onChange={(e) => setPaymentForm({ ...paymentForm, receiptNo: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><Receipt fontSize="small" /></InputAdornment> }} />
            <TextField fullWidth size="small" label="Notes" multiline rows={2} value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                Total Received: {formatCurrency((Number(paymentForm.amount) || 0) + (Number(paymentForm.penaltyAmount) || 0) - (Number(paymentForm.discountAmount) || 0))}
              </Typography>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, p: 2 }}>
        <Button fullWidth={isMobile} variant="outlined" onClick={() => setPaymentDialog(false)}>Cancel</Button>
        <Button fullWidth={isMobile} variant="contained" color="success" onClick={handlePayment} disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0}>
          Post Payment
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: NEW EMI DIALOG ====================
   // ==================== RENDER: NEW EMI DIALOG ====================
  const renderNewEMIDialog = () => (
    <Dialog open={openCalculator} onClose={() => setOpenCalculator(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <CalcIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        New EMI Agreement
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
          
          {/* CUSTOMER SEARCHABLE SELECT */}
          <Autocomplete
            fullWidth
            size="small"
            options={[
              { id: 'new', name: '+ Add New Customer', phone: '', isNewAction: true },
              ...customers
            ]}
            getOptionLabel={(c) => {
              if (!c) return '';
              if (c.isNewAction) return c.name;
              return `${c.name || ''} ${c.phone ? `[${c.phone}]` : ''} ${c.cnic ? `(${c.cnic})` : ''}`.trim();
            }}
            value={customers.find(c => String(c.id) === String(calc.customerId)) || null}
            onChange={(e, val) => {
              if (val?.isNewAction) {
                setOpenCustomerModal(true);
              } else {
                setCalc(prev => ({ ...prev, customerId: val ? val.id : '' }));
              }
            }}
            isOptionEqualToValue={(opt, val) => String(opt.id) === String(val?.id)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.isNewAction ? (
                  <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                    + Add New Customer
                  </Typography>
                ) : (
                  <Box sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight="bold">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Phone: {option.phone || 'N/A'} {option.cnic ? `| CNIC: ${option.cnic}` : ''}
                    </Typography>
                  </Box>
                )}
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Select Customer *" placeholder="Search customer by name, phone or CNIC..." required />
            )}
          />

          {/* PRODUCT AUTOCOMPLETE */}
          <Autocomplete
            fullWidth
            size="small"
            options={products}
            getOptionLabel={(option) => {
              if (!option || !option.id) return '';
              return `${option.product_name || ''}${option.variant_name ? ` - ${option.variant_name}` : ''} [${option.sku || 'No SKU'}]`;
            }}
            value={products.find(p => String(p.id) === String(calc.productVariantId)) || null}
            onChange={(e, newValue) => handleProductSelect(newValue)}
            isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {option.product_name}{option.variant_name ? ` - ${option.variant_name}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    SKU: {option.sku || 'N/A'} | Retail: {formatCurrency(option.retail_price)}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Select Product from Inventory *" placeholder="Search product by name or SKU..." />
            )}
          />

          <TextField 
            fullWidth 
            size="small" 
            label="Product Name *" 
            value={calc.productName} 
            onChange={(e) => setCalc({ ...calc, productName: e.target.value })} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Product SKU" 
            value={calc.productSKU} 
            onChange={(e) => setCalc({ ...calc, productSKU: e.target.value })} 
          />

          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Total Amount *" 
                value={calc.totalAmount || ''} 
                onChange={(e) => setCalc({ ...calc, totalAmount: Number(e.target.value) })} 
                InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6b7280', mr: 0.5 }}>Rs.</Typography></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Down Payment" 
                value={calc.downPayment || ''} 
                onChange={(e) => setCalc({ ...calc, downPayment: Number(e.target.value) })} 
                InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', mr: 0.5 }}>Rs.</Typography></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Down Payment Mode</InputLabel>
                <Select
                  value={calc.downPaymentMode || 'cash'}
                  label="Down Payment Mode"
                  onChange={(e) => setCalc({ ...calc, downPaymentMode: e.target.value })}
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                  <MenuItem value="card">Card / POS</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {Number(calc.downPayment) > 0 && (
            <FormControl fullWidth size="small" required>
              <InputLabel id="down-payment-acc-sel">Deposit Down Payment To Account *</InputLabel>
              <Select
                labelId="down-payment-acc-sel"
                value={calc.downPaymentAccountId || ''}
                onChange={(e) => setCalc({ ...calc, downPaymentAccountId: e.target.value })}
                label="Deposit Down Payment To Account *"
              >
                <MenuItem value="" disabled><em>Select receiving account...</em></MenuItem>
                {accounts
                  .filter(a => {
                    const m = (calc.downPaymentMode || 'cash').toLowerCase();
                    const targetType = (m === 'bank' || m === 'bank_transfer' || m === 'card') ? 'bank' : m;
                    return a.status === 'active' && (!targetType || a.type === targetType);
                  })
                  .map(a => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name} ({a.type?.toUpperCase()}) • Bal: {formatCurrency(a.current_balance)}
                    </MenuItem>
                  ))}
                {accounts.filter(a => {
                  const m = (calc.downPaymentMode || 'cash').toLowerCase();
                  const targetType = (m === 'bank' || m === 'bank_transfer' || m === 'card') ? 'bank' : m;
                  return a.status === 'active' && a.type === targetType;
                }).length === 0 && accounts.map(a => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({a.type?.toUpperCase()}) • Bal: {formatCurrency(a.current_balance)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {Number(calc.downPayment) > 0 && calc.downPaymentAccountId && (
            <Box sx={{ p: 1, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold' }}>
                Receiving Down Payment Account: {accounts.find(a => a.id === calc.downPaymentAccountId)?.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 'bold' }}>
                +{formatCurrency(calc.downPayment)}
              </Typography>
            </Box>
          )}

          <Grid container spacing={isMobile ? 1 : 2}>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Interest Rate %" 
                value={calc.interestRate || ''} 
                onChange={(e) => setCalc({ ...calc, interestRate: Number(e.target.value) })} 
              />
            </Grid>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                type="number" 
                label="Months *" 
                value={calc.months || ''} 
                onChange={(e) => setCalc({ ...calc, months: Number(e.target.value) })} 
              />
            </Grid>
          </Grid>

          <TextField 
            fullWidth 
            size="small" 
            label="Shop Location" 
            value={calc.shopLocation} 
            onChange={(e) => setCalc({ ...calc, shopLocation: e.target.value })} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Notes" 
            multiline 
            rows={2} 
            value={calc.notes} 
            onChange={(e) => setCalc({ ...calc, notes: e.target.value })} 
          />

          {/* GUARANTORS SECTION */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f9fafb', border: '1px dashed #10b98150' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary">
                <People sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Guarantors ({newGuarantors.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  setGuarantorForm({
                    name: '', phone: '', cnic: '', address: '', occupation: '',
                    monthly_income: 0, relation_to_customer: '', guarantor_type: 1,
                    passport_photo_path: null, blank_check_photo_path: null,
                    cnic_front_photo_path: null, cnic_back_photo_path: null
                  });
                  setShowInlineGuarantor(true);
                }}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                + Add New Guarantor
              </Button>
            </Box>

            {/* Quick Load Existing Guarantor Dropdown */}
            {allGuarantors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  size="small"
                  options={allGuarantors.filter((ag) => 
                    ag.cnic && !newGuarantors.some(ng => ng.cnic === ag.cnic)
                  )}
                  getOptionLabel={(option) => {
                    const count = option.total_guarantees || (option.linked_emis ? option.linked_emis.length : 0);
                    const tag = count > 0 ? ` [${count} Active Guarantee${count > 1 ? 's' : ''}]` : ' [Pre-registered]';
                    return `${option.name} (${option.cnic || option.phone || 'No CNIC'})${tag}`;
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select Existing Guarantor (Auto-Load)" 
                      placeholder="Search existing guarantor by name or CNIC..." 
                      helperText="Pehle se registered guarantor select karein (ek guarantor multiple customers / agreements ke liye allow hai)"
                    />
                  )}
                  onChange={(e, val) => {
                    if (val) {
                      setNewGuarantors(prev => [
                        ...prev,
                        {
                          id: val.id,
                          tempId: Date.now(),
                          name: val.name,
                          phone: val.phone || '',
                          cnic: val.cnic || '',
                          address: val.address || '',
                          occupation: val.occupation || '',
                          monthly_income: val.monthly_income || 0,
                          relation_to_customer: '',
                          guarantor_type: 1,
                          passport_photo_path: val.passport_photo_path || null,
                          blank_check_photo_path: val.blank_check_photo_path || null,
                          cnic_front_photo_path: val.cnic_front_photo_path || null,
                          cnic_back_photo_path: val.cnic_back_photo_path || null
                        }
                      ]);
                      const count = val.total_guarantees || (val.linked_emis ? val.linked_emis.length : 0);
                      const msg = count > 0 
                        ? `Guarantor ${val.name} added! (Already guarantees ${count} agreement${count > 1 ? 's' : ''})`
                        : `Guarantor ${val.name} selected!`;
                      setSnackbar({ open: true, message: msg, severity: 'success' });
                    }
                  }}
                />
              </Box>
            )}

            {showInlineGuarantor && (
              <Box sx={{ mb: 2, p: 2, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e5e7eb' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>New Guarantor</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Full Name *" value={guarantorForm.name} onChange={(e) => setGuarantorForm({ ...guarantorForm, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="CNIC *" 
                      value={guarantorForm.cnic} 
                      onChange={(e) => {
                        const inputCnic = e.target.value;
                        const match = allGuarantors.find(ag => ag.cnic && ag.cnic.trim() === inputCnic.trim());
                        if (match && inputCnic.length >= 13) {
                          setGuarantorForm(prev => ({
                            ...prev,
                            cnic: inputCnic,
                            name: prev.name || match.name || '',
                            phone: prev.phone || match.phone || '',
                            address: prev.address || match.address || '',
                            occupation: prev.occupation || match.occupation || '',
                            monthly_income: prev.monthly_income || match.monthly_income || 0,
                            passport_photo_path: prev.passport_photo_path || match.passport_photo_path || null,
                            blank_check_photo_path: prev.blank_check_photo_path || match.blank_check_photo_path || null,
                            cnic_front_photo_path: prev.cnic_front_photo_path || match.cnic_front_photo_path || null,
                            cnic_back_photo_path: prev.cnic_back_photo_path || match.cnic_back_photo_path || null
                          }));
                          setSnackbar({ open: true, message: `Existing guarantor ${match.name} recognized! Adding new guarantee for this customer.`, severity: 'info' });
                        } else {
                          setGuarantorForm(prev => ({ ...prev, cnic: inputCnic }));
                        }
                      }} 
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Phone" value={guarantorForm.phone} onChange={(e) => setGuarantorForm({ ...guarantorForm, phone: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select value={guarantorForm.guarantor_type} onChange={(e) => setGuarantorForm({ ...guarantorForm, guarantor_type: e.target.value })} label="Type">
                        <MenuItem value={1}>Primary</MenuItem>
                        <MenuItem value={2}>Secondary</MenuItem>
                        <MenuItem value={3}>Tertiary</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" label="Address" value={guarantorForm.address} onChange={(e) => setGuarantorForm({ ...guarantorForm, address: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Occupation" value={guarantorForm.occupation} onChange={(e) => setGuarantorForm({ ...guarantorForm, occupation: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Relation to Customer" value={guarantorForm.relation_to_customer} onChange={(e) => setGuarantorForm({ ...guarantorForm, relation_to_customer: e.target.value })} placeholder="e.g. Father, Brother" />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" type="number" label="Monthly Income" value={guarantorForm.monthly_income || ''} onChange={(e) => setGuarantorForm({ ...guarantorForm, monthly_income: Number(e.target.value) })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
                  </Grid>
                  
                  {/* FILE UPLOADS */}
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>Documents</Typography>
                    <Grid container spacing={2}>
                      {[
                        { field: 'passport_photo_path', label: 'Passport Photo' },
                        { field: 'cnic_front_photo_path', label: 'CNIC Front' },
                        { field: 'cnic_back_photo_path', label: 'CNIC Back' },
                        { field: 'blank_check_photo_path', label: 'Blank Cheque' }
                      ].map((doc) => (
                        <Grid item xs={12} md={6} key={doc.field}>
                          <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            fullWidth
                            sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: 1.5, py: 0.8 }}
                          >
                            {guarantorForm[doc.field] ? <Check sx={{ mr: 1, color: 'success.main', fontSize: 18 }} /> : <Add sx={{ mr: 1, fontSize: 18 }} />}
                            {guarantorForm[doc.field] ? `${doc.label} Added` : doc.label}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => handleGuarantorFileUpload(doc.field, e.target.files[0])}
                            />
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => setShowInlineGuarantor(false)}>Cancel</Button>
                  <Button size="small" variant="contained" sx={{ bgcolor: '#10b981' }} onClick={pushInlineGuarantor} disabled={!guarantorForm.name.trim() || !guarantorForm.cnic.trim()}>Add to List</Button>
                </Stack>
              </Box>
            )}

            {newGuarantors.length > 0 && (
              <Stack spacing={1}>
                {newGuarantors.map((g) => (
                  <Paper key={g.tempId} variant="outlined" sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 1.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{g.name} <Chip size="small" label={`Type ${g.guarantor_type}`} sx={{ height: 16, fontSize: '0.6rem' }} /></Typography>
                      <Typography variant="caption" color="text.secondary">{g.phone} | CNIC: {g.cnic} | {g.relation_to_customer}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => removeInlineGuarantor(g.tempId)} sx={{ color: 'error.main' }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
          
          <FormControlLabel
            control={<Checkbox checked={calc.agreementSigned} onChange={(e) => setCalc({ ...calc, agreementSigned: e.target.checked })} />}
            label="Agreement Signed"
          />

          <Paper sx={{ p: 2, bgcolor: '#f0fdf4', textAlign: 'center', border: '1px solid #10b98130', borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" display="block">Product Price</Typography>
                <Typography variant="body2" fontWeight="bold">{formatCurrency(calc.totalAmount)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" display="block">Markup / Interest ({calc.interestRate || 0}%)</Typography>
                <Typography variant="body2" fontWeight="bold" color="warning.main">+{formatCurrency(calculatedMetrics.totalInterest)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" display="block">Total with Markup</Typography>
                <Typography variant="body2" fontWeight="bold" color="primary.main">{formatCurrency(calculatedMetrics.totalWithInterest)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary" display="block">Monthly EMI</Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">{formatCurrency(calculatedMetrics.emiAmount)}</Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 1.2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Down Payment: <strong>{formatCurrency(calc.downPayment)}</strong> {calc.downPaymentMode ? `(${calc.downPaymentMode})` : ''}
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="#be123c">
                Net Remaining Payable: {formatCurrency(calculatedMetrics.totalPayable)} over {calc.months} months
              </Typography>
            </Box>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, p: 2 }}>
        <Button fullWidth={isMobile} variant="outlined" onClick={() => { setOpenCalculator(false); setNewGuarantors([]); setShowInlineGuarantor(false); }}>Cancel</Button>
        <Button 
          fullWidth={isMobile} 
          variant="contained" 
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }} 
          onClick={saveEMI}
        >
          Create EMI Agreement
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: DELETE DIALOG ====================
  const renderDeleteDialog = () => (
    <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#ef4444', color: 'white' }}>
        <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
        Confirm Delete
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography>Are you sure you want to delete EMI <strong>{selectedEMI?.application_no}</strong>?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This will soft-delete the record. All payment history will be preserved.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleDeleteEMI}>Delete EMI</Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: DELETE / VOID PAYMENT DIALOG ====================
  const renderDeletePaymentDialog = () => (
    <Dialog open={deletePaymentDialog} onClose={() => setDeletePaymentDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#ef4444', color: 'white' }}>
        <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
        Void / Delete Payment
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography>
          Are you sure you want to void / delete payment receipt <strong>{paymentToDelete?.receipt_no || `PAY-${paymentToDelete?.id}`}</strong>?
        </Typography>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fee2e2' }}>
          <Typography variant="body2" color="error.dark">
            <strong>Amount:</strong> {formatCurrency(paymentToDelete?.amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Deleting this payment will recalculate the EMI installment balance, reduce paid months count, and reverse any linked account transaction.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeletePaymentDialog(false)}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleConfirmDeletePayment}>
          Confirm & Void
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: GUARANTOR DIALOG ====================
  const renderGuarantorDialog = () => (
    <Dialog open={guarantorDialog} onClose={() => setGuarantorDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <People sx={{ verticalAlign: 'middle', mr: 1 }} />
        {selectedEMI ? `Add Guarantor — ${selectedEMI.application_no}` : 'Add New Guarantor (Standalone Profile)'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="Full Name *"
                value={guarantorForm.name}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="CNIC *"
                value={guarantorForm.cnic}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, cnic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="Phone"
                value={guarantorForm.phone}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Guarantor Type</InputLabel>
                <Select
                  value={guarantorForm.guarantor_type}
                  onChange={(e) => setGuarantorForm({ ...guarantorForm, guarantor_type: e.target.value })}
                  label="Guarantor Type"
                >
                  <MenuItem value={1}>Primary (Type 1)</MenuItem>
                  <MenuItem value={2}>Secondary (Type 2)</MenuItem>
                  <MenuItem value={3}>Tertiary (Type 3)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Address"
                multiline rows={2}
                value={guarantorForm.address}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="Occupation"
                value={guarantorForm.occupation}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, occupation: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" type="number" label="Monthly Income"
                value={guarantorForm.monthly_income || ''}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, monthly_income: Number(e.target.value) })}
                InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="Relation to Customer"
                value={guarantorForm.relation_to_customer}
                onChange={(e) => setGuarantorForm({ ...guarantorForm, relation_to_customer: e.target.value })}
                placeholder="e.g. Father, Brother, Friend"
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ mt: 2, mb: 1 }}>
            Guarantor Documents (Upload photos & view clearly)
          </Typography>
          <Grid container spacing={2}>
            {[
              { field: 'passport_photo_path', label: 'Passport Photo' },
              { field: 'cnic_front_photo_path', label: 'CNIC Front Photo' },
              { field: 'cnic_back_photo_path', label: 'CNIC Back Photo' },
              { field: 'blank_check_photo_path', label: 'Blank Cheque Photo' }
            ].map((doc) => {
              const imgUrl = guarantorForm[doc.field];
              return (
                <Grid item xs={12} sm={6} key={doc.field}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: imgUrl ? '#f0fdf4' : '#ffffff',
                      borderColor: imgUrl ? '#86efac' : '#cbd5e1',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: imgUrl ? 1 : 0.5 }}>
                      <Typography variant="caption" fontWeight="bold" color={imgUrl ? 'success.dark' : 'text.primary'}>
                        {doc.label} {imgUrl ? '(Uploaded)' : ''}
                      </Typography>
                      {imgUrl && (
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Remove Photo"
                          onClick={() => setGuarantorForm(prev => ({ ...prev, [doc.field]: null }))}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Box>

                    {imgUrl ? (
                      <Box sx={{ textAlign: 'center' }}>
                        <Box 
                          component="img"
                          src={imgUrl}
                          alt={doc.label}
                          onClick={() => setPreviewImage({ open: true, url: imgUrl, title: `${guarantorForm.name || 'Guarantor'} — ${doc.label}` })}
                          sx={{ 
                            width: '100%', 
                            height: 110, 
                            objectFit: 'cover', 
                            borderRadius: 1.5, 
                            cursor: 'pointer',
                            border: '1px solid #cbd5e1',
                            '&:hover': { opacity: 0.88 }
                          }}
                        />
                        <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'center' }}>
                          <Button 
                            size="small" 
                            variant="text" 
                            startIcon={<Visibility sx={{ fontSize: '15px !important' }} />}
                            onClick={() => setPreviewImage({ open: true, url: imgUrl, title: `${guarantorForm.name || 'Guarantor'} — ${doc.label}` })}
                            sx={{ fontSize: '0.75rem', py: 0.2 }}
                          >
                            View Clear
                          </Button>
                          <Button component="label" size="small" variant="text" color="primary" sx={{ fontSize: '0.75rem', py: 0.2 }}>
                            Change
                            <input type="file" accept="image/*" hidden onChange={(e) => handleGuarantorFileUpload(doc.field, e.target.files[0])} />
                          </Button>
                        </Stack>
                      </Box>
                    ) : (
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<UploadFile />}
                        sx={{
                          borderStyle: 'dashed',
                          borderRadius: 1.5,
                          py: 1.5,
                          textTransform: 'none',
                          bgcolor: '#fafafa',
                          borderColor: '#cbd5e1',
                          '&:hover': { bgcolor: '#f1f5f9', borderColor: '#10b981' }
                        }}
                      >
                        Upload {doc.label}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => handleGuarantorFileUpload(doc.field, e.target.files[0])}
                        />
                      </Button>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
        <Button fullWidth={isMobile} variant="outlined" onClick={() => setGuarantorDialog(false)}>Cancel</Button>
        <Button
          fullWidth={isMobile}
          variant="contained"
          sx={{ bgcolor: '#10b981' }}
          onClick={saveGuarantor}
          disabled={!guarantorForm.name.trim() || !guarantorForm.cnic.trim()}
        >
          Save Guarantor
        </Button>
      </DialogActions>
    </Dialog>
  );
  // ==================== RENDER: GUARANTOR EDIT DIALOG ====================
  const renderGuarantorEditDialog = () => (
    <Dialog open={guarantorEditDialog} onClose={() => setGuarantorEditDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#3b82f6', color: 'white' }}>
        <Edit sx={{ verticalAlign: 'middle', mr: 1 }} />
        Edit Guarantor
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {editingGuarantor && (
          <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Full Name *" value={editingGuarantor.name || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="CNIC *" value={editingGuarantor.cnic || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, cnic: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Phone" value={editingGuarantor.phone || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select value={editingGuarantor.guarantor_type || 1} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, guarantor_type: e.target.value })} label="Type">
                    <MenuItem value={1}>Primary</MenuItem>
                    <MenuItem value={2}>Secondary</MenuItem>
                    <MenuItem value={3}>Tertiary</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Address" value={editingGuarantor.address || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, address: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Occupation" value={editingGuarantor.occupation || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, occupation: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Relation" value={editingGuarantor.relation_to_customer || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, relation_to_customer: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" type="number" label="Monthly Income" value={editingGuarantor.monthly_income || ''} onChange={(e) => setEditingGuarantor({ ...editingGuarantor, monthly_income: Number(e.target.value) })} InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ mb: 1 }}>Guarantor Documents (Upload photos & view clearly)</Typography>
                <Grid container spacing={2}>
                  {[
                    { field: 'passport_photo_path', label: 'Passport Photo' },
                    { field: 'cnic_front_photo_path', label: 'CNIC Front Photo' },
                    { field: 'cnic_back_photo_path', label: 'CNIC Back Photo' },
                    { field: 'blank_check_photo_path', label: 'Blank Cheque Photo' }
                  ].map((doc) => {
                    const imgUrl = editingGuarantor[doc.field];
                    return (
                      <Grid item xs={12} sm={6} key={doc.field}>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 1.5, 
                            borderRadius: 2, 
                            bgcolor: imgUrl ? '#f0fdf4' : '#ffffff',
                            borderColor: imgUrl ? '#86efac' : '#cbd5e1',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: imgUrl ? 1 : 0.5 }}>
                            <Typography variant="caption" fontWeight="bold" color={imgUrl ? 'success.dark' : 'text.primary'}>
                              {doc.label} {imgUrl ? '(Uploaded)' : ''}
                            </Typography>
                            {imgUrl && (
                              <IconButton 
                                size="small" 
                                color="error" 
                                title="Remove Photo"
                                onClick={() => setEditingGuarantor(prev => ({ ...prev, [doc.field]: null }))}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )}
                          </Box>

                          {imgUrl ? (
                            <Box sx={{ textAlign: 'center' }}>
                              <Box 
                                component="img"
                                src={imgUrl}
                                alt={doc.label}
                                onClick={() => setPreviewImage({ open: true, url: imgUrl, title: `${editingGuarantor.name || 'Guarantor'} — ${doc.label}` })}
                                sx={{ 
                                  width: '100%', 
                                  height: 110, 
                                  objectFit: 'cover', 
                                  borderRadius: 1.5, 
                                  cursor: 'pointer',
                                  border: '1px solid #cbd5e1',
                                  '&:hover': { opacity: 0.88 }
                                }}
                              />
                              <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'center' }}>
                                <Button 
                                  size="small" 
                                  variant="text" 
                                  startIcon={<Visibility sx={{ fontSize: '15px !important' }} />}
                                  onClick={() => setPreviewImage({ open: true, url: imgUrl, title: `${editingGuarantor.name || 'Guarantor'} — ${doc.label}` })}
                                  sx={{ fontSize: '0.75rem', py: 0.2 }}
                                >
                                  View Clear
                                </Button>
                                <Button component="label" size="small" variant="text" color="primary" sx={{ fontSize: '0.75rem', py: 0.2 }}>
                                  Change
                                  <input type="file" accept="image/*" hidden onChange={(e) => handleGuarantorFileUpload(doc.field, e.target.files[0])} />
                                </Button>
                              </Stack>
                            </Box>
                          ) : (
                            <Button
                              component="label"
                              variant="outlined"
                              size="small"
                              fullWidth
                              startIcon={<UploadFile />}
                              sx={{
                                borderStyle: 'dashed',
                                borderRadius: 1.5,
                                py: 1.5,
                                textTransform: 'none',
                                bgcolor: '#fafafa',
                                borderColor: '#cbd5e1',
                                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#10b981' }
                              }}
                            >
                              Upload {doc.label}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => handleGuarantorFileUpload(doc.field, e.target.files[0])}
                              />
                            </Button>
                          )}
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            </Grid>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={() => setGuarantorEditDialog(false)}>Cancel</Button>
        <Button variant="contained" sx={{ bgcolor: '#3b82f6' }} onClick={handleUpdateGuarantor} disabled={!editingGuarantor?.name?.trim() || !editingGuarantor?.cnic?.trim()}>Save Changes</Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: GUARANTOR DETAIL DIALOG ====================
  const renderGuarantorDetailDialog = () => {
    if (!selectedGuarantorDetail) return null;
    const g = selectedGuarantorDetail;

    // Find all linked guarantees for this person
    let guarantees = [];
    if (Array.isArray(g.linked_emis) && g.linked_emis.length > 0) {
      guarantees = g.linked_emis.map(item => {
        const emiMatch = emis.find(e => String(e.id) === String(item.emi_id) || (e.application_no && e.application_no === item.application_no));
        const custMatch = emiMatch ? customers.find(c => String(c.id) === String(emiMatch.customer_id)) : null;
        const totalAmt = Number(item.total_amount || emiMatch?.total_amount || 0);
        const rate = Number(item.interest_rate || emiMatch?.interest_rate || 0);
        const retailPrice = Number(emiMatch?.product_retail_price || 0);
        const markupAmt = item.interest_amount !== undefined && item.interest_amount > 0
          ? item.interest_amount
          : (rate > 0 ? (retailPrice > 0 ? Math.round(retailPrice * (rate / 100)) : Math.round(totalAmt - (totalAmt / (1 + rate / 100)))) : 0);

        return {
          ...item,
          customer_name: item.customer_name && item.customer_name !== 'N/A' ? item.customer_name : (emiMatch?.customer_name || custMatch?.name || 'N/A'),
          customer_phone: item.customer_phone || emiMatch?.customer_phone || custMatch?.phone || '',
          product_name: item.product_name || emiMatch?.product_name || '—',
          product_sku: item.product_sku || emiMatch?.product_sku || '',
          total_amount: totalAmt,
          interest_rate: rate,
          interest_amount: markupAmt,
          down_payment: item.down_payment !== undefined ? item.down_payment : (emiMatch?.down_payment || 0),
          down_payment_mode: item.down_payment_mode || emiMatch?.down_payment_mode || 'cash'
        };
      });
    } else {
      // Find all matching in allGuarantors by CNIC or emi_id or name
      const matching = allGuarantors.filter(item => 
        (g.cnic && item.cnic && item.cnic.trim() === g.cnic.trim()) || 
        (g.id && String(item.id) === String(g.id)) ||
        (g.name && item.name?.toLowerCase().trim() === g.name?.toLowerCase().trim())
      );
      const emiIds = new Set(matching.map(m => String(m.emi_id)).filter(id => id && id !== 'null' && id !== 'undefined'));
      if (g.emi_id) emiIds.add(String(g.emi_id));

      guarantees = emis.filter(e => 
        emiIds.has(String(e.id)) || 
        (e.application_no && matching.some(m => m.application_no === e.application_no))
      ).map(e => {
        const cust = customers.find(c => String(c.id) === String(e.customer_id));
        const totalAmt = Number(e.total_amount || 0);
        const rate = Number(e.interest_rate || 0);
        const retailPrice = Number(e.product_retail_price || 0);
        const markupAmt = rate > 0
          ? (retailPrice > 0 ? Math.round(retailPrice * (rate / 100)) : Math.round(totalAmt - (totalAmt / (1 + rate / 100))))
          : 0;

        return {
          emi_id: e.id,
          application_no: e.application_no,
          product_name: e.product_name,
          product_sku: e.product_sku,
          customer_name: e.customer_name || e._customer_name || cust?.name || 'N/A',
          customer_phone: e.customer_phone || e._customer_phone || cust?.phone || '',
          customer_cnic: e.customer_cnic || cust?.cnic || '',
          total_amount: totalAmt,
          interest_rate: rate,
          interest_amount: markupAmt,
          down_payment: e.down_payment || 0,
          down_payment_mode: e.down_payment_mode || 'cash'
        };
      });

      // If still empty but g has direct fields:
      if (guarantees.length === 0 && (g.application_no || g.product_name || g.customer_name || g.emi_id)) {
        const matchedEmi = emis.find(e => String(e.id) === String(g.emi_id) || (e.application_no && e.application_no === g.application_no));
        const matchedCust = customers.find(c => String(c.id) === String(matchedEmi?.customer_id));
        const totalAmt = Number(g.total_amount || matchedEmi?.total_amount || 0);
        const rate = Number(matchedEmi?.interest_rate || g.interest_rate || 0);
        const retailPrice = Number(matchedEmi?.product_retail_price || 0);
        const markupAmt = rate > 0
          ? (retailPrice > 0 ? Math.round(retailPrice * (rate / 100)) : Math.round(totalAmt - (totalAmt / (1 + rate / 100))))
          : 0;

        guarantees.push({
          emi_id: matchedEmi?.id,
          application_no: g.application_no || matchedEmi?.application_no || '—',
          product_name: g.product_name || matchedEmi?.product_name || '—',
          product_sku: g.product_sku || matchedEmi?.product_sku || '',
          customer_name: g.customer_name || matchedCust?.name || matchedEmi?.customer_name || '—',
          customer_phone: g.customer_phone || matchedCust?.phone || matchedEmi?.customer_phone || '',
          customer_cnic: matchedCust?.cnic || matchedEmi?.customer_cnic || '',
          total_amount: totalAmt,
          interest_rate: rate,
          interest_amount: markupAmt,
          down_payment: matchedEmi?.down_payment || g.down_payment || 0,
          down_payment_mode: matchedEmi?.down_payment_mode || 'cash'
        });
      }
    }

    return (
      <Dialog open={guarantorDetailDialog} onClose={() => setGuarantorDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ verticalAlign: 'middle' }} />
            <Typography variant="h6" fontWeight="bold" component="span" color="inherit">
              Guarantor Profile — {g.name}
            </Typography>
          </Box>
          <Chip label={`Type ${g.guarantor_type || 1}`} size="small" sx={{ bgcolor: 'white', color: '#10b981', fontWeight: 'bold' }} />
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2.5}>
            {/* Personal Information */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f9fafb' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Full Name</Typography>
                  <Typography variant="subtitle1" fontWeight="bold">{g.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" display="block">CNIC Number</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>{g.cnic || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Contact Phone</Typography>
                  <Typography variant="body2" fontWeight={500}>{g.phone || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Occupation</Typography>
                  <Typography variant="body2" fontWeight={500}>{g.occupation || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Monthly Income</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(g.monthly_income)}</Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Typography variant="caption" color="text.secondary" display="block">Residential Address</Typography>
                  <Typography variant="body2">{g.address || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Relation to Customer</Typography>
                  <Typography variant="body2">{g.relation_to_customer || '—'}</Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Linked Guarantees & Products */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Receipt fontSize="small" /> Active Guarantees & Products Under Guarantee ({guarantees.length})
              </Typography>
              {guarantees.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    No active EMI agreements linked yet (Standalone Guarantor Record)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Yeh guarantor new EMI banate waqt "Select Existing Guarantor" dropdown se select kiya ja sakta hai.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#1c2580' }}>
                      <TableRow>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Product Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Customer Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Total Bill</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Interest (Markup)</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }} align="right">Down Payment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {guarantees.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{item.product_name || '—'}</Typography>
                            {item.product_sku && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                SKU: {item.product_sku}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{item.customer_name || '—'}</Typography>
                            {item.customer_phone && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {item.customer_phone}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="primary.main">
                              {formatCurrency(item.total_amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="warning.dark">
                              {item.interest_rate ? `${item.interest_rate}%` : '0%'}
                              {item.interest_amount > 0 && (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  ({formatCurrency(item.interest_amount)})
                                </Typography>
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatCurrency(item.down_payment)}
                            </Typography>
                            {item.down_payment_mode && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                ({item.down_payment_mode.toUpperCase()})
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            {/* Uploaded Documents */}
            {(g.passport_photo_path || g.cnic_front_photo_path || g.cnic_back_photo_path || g.blank_check_photo_path) && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" color="primary" sx={{ mb: 1 }}>Documents & Verification Photos (Click to view full photo)</Typography>
                <Grid container spacing={2}>
                  {[
                    { field: 'passport_photo_path', label: 'Passport Photo' },
                    { field: 'cnic_front_photo_path', label: 'CNIC Front' },
                    { field: 'cnic_back_photo_path', label: 'CNIC Back' },
                    { field: 'blank_check_photo_path', label: 'Blank Cheque' }
                  ].map((doc) => {
                    const imgUrl = g[doc.field];
                    if (!imgUrl) return null;
                    return (
                      <Grid item xs={6} sm={3} key={doc.field}>
                        <Paper 
                          variant="outlined" 
                          onClick={() => setPreviewImage({ open: true, url: imgUrl, title: `${g.name || 'Guarantor'} — ${doc.label}` })}
                          sx={{ 
                            p: 1, 
                            textAlign: 'center', 
                            borderRadius: 2, 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.12)', borderColor: '#10b981' }
                          }}
                        >
                          <Typography variant="caption" fontWeight="bold" display="block" color="text.primary">
                            {doc.label}
                          </Typography>
                          <Box 
                            component="img" 
                            src={imgUrl} 
                            alt={doc.label} 
                            sx={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 1.5, mt: 0.8 }} 
                          />
                          <Button size="small" variant="text" startIcon={<Visibility sx={{ fontSize: '14px !important' }} />} sx={{ fontSize: '0.7rem', mt: 0.5, py: 0 }}>
                            View Full
                          </Button>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setGuarantorDetailDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Edit />} onClick={() => { setGuarantorDetailDialog(false); openGuarantorEdit(g); }}>Edit Profile</Button>
        </DialogActions>
      </Dialog>
    );
  };
  // ==================== RENDER: ADD CUSTOMER MODAL ====================
  const renderCustomerModal = () => (
    <Dialog open={openCustomerModal} onClose={() => setOpenCustomerModal(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <Person sx={{ verticalAlign: 'middle', mr: 1 }} />
        Add New Customer
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField 
            fullWidth 
            size="small" 
            label="Full Name *" 
            required
            value={customerForm.name} 
            onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Phone" 
            value={customerForm.phone} 
            onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="CNIC" 
            value={customerForm.cnic} 
            onChange={(e) => setCustomerForm({ ...customerForm, cnic: e.target.value })} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Address" 
            multiline 
            rows={2} 
            value={customerForm.address} 
            onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} 
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="District" 
                value={customerForm.district} 
                onChange={(e) => setCustomerForm({ ...customerForm, district: e.target.value })} 
              />
            </Grid>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Province" 
                value={customerForm.province} 
                onChange={(e) => setCustomerForm({ ...customerForm, province: e.target.value })} 
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={() => setOpenCustomerModal(false)}>Cancel</Button>
        <Button 
          variant="contained" 
          sx={{ bgcolor: '#10b981' }} 
          onClick={saveNewCustomer} 
          disabled={!customerForm.name.trim()}
        >
          Save & Select Customer
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== RENDER: IMAGE PREVIEW DIALOG ====================
  const renderImagePreviewDialog = () => (
    <Dialog 
      open={previewImage.open} 
      onClose={() => setPreviewImage({ open: false, url: '', title: '' })} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ bgcolor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ color: 'white' }}>
          {previewImage.title || 'Document Preview'}
        </Typography>
        <IconButton size="small" onClick={() => setPreviewImage({ open: false, url: '', title: '' })} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 380, p: 2 }}>
        {previewImage.url ? (
          <Box 
            component="img"
            src={previewImage.url} 
            alt="Document" 
            sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 2, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} 
          />
        ) : (
          <Typography color="white">No image available</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#0f172a', justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          High resolution document photo view
        </Typography>
        <Stack direction="row" spacing={1}>
          {previewImage.url && (
            <Button
              size="small"
              variant="outlined"
              sx={{ color: 'white', borderColor: '#475569' }}
              onClick={() => {
                const w = window.open('');
                w.document.write(`<body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;"><img src="${previewImage.url}" style="max-width:100%;max-height:100vh;"/></body>`);
                setTimeout(() => { w.print(); }, 300);
              }}
            >
              Print Photo
            </Button>
          )}
          <Button variant="contained" sx={{ bgcolor: '#10b981' }} onClick={() => setPreviewImage({ open: false, url: '', title: '' })}>
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
  // ==================== MAIN RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 10 : 2, minHeight: '100vh', bgcolor: '#fafafa' }}>

      {/* HEADER */}
      <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2, borderRadius: 2, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: '#10b981', width: isMobile ? 36 : 44, height: isMobile ? 36 : 44 }}>
            <Timeline sx={{ fontSize: isMobile ? 20 : 24 }} />
          </Avatar>
          <Box>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="#111827" sx={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
              EMI Dashboard
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.active} active | {stats.overdue} overdue | {formatCurrency(stats.totalOutstanding)} outstanding
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<FilterList />} onClick={() => setMobileDrawer(true)} fullWidth>
              Menu
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={() => loadData()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            TransitionComponent={Fade}
          >
            <MenuItem onClick={handleExportCSV}><ListItemIcon><TableChart fontSize="small" /></ListItemIcon>Export EMI Records (CSV)</MenuItem>
            <MenuItem onClick={handleExportPDF}><ListItemIcon><PictureAsPdf fontSize="small" /></ListItemIcon>Export EMI Records (PDF)</MenuItem>
            <Divider />
            <MenuItem onClick={handleExportPaymentsCSV}><ListItemIcon><TableChart fontSize="small" /></ListItemIcon>Export Payments (CSV)</MenuItem>
            <MenuItem onClick={handleExportPaymentsPDF}><ListItemIcon><PictureAsPdf fontSize="small" /></ListItemIcon>Export Payments (PDF)</MenuItem>
          </Menu>
          <Button
            variant="contained"
            size="small"
            startIcon={<CalcIcon />}
            onClick={() => setOpenCalculator(true)}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, whiteSpace: 'nowrap' }}
          >
            {isMobile ? 'New EMI' : 'New Agreement'}
          </Button>
        </Stack>
      </Paper>

      {/* STATS */}
      {renderStatsCards()}

      {/* TABS */}
      <Paper sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant={isMobile ? 'fullWidth' : 'standard'}
          sx={{ minHeight: isMobile ? 44 : 48, bgcolor: '#fff' }}
        >
          <Tab
            icon={isMobile ? <Timeline /> : undefined}
            iconPosition="start"
            label={`EMI Accounts (${filteredEMIs.length})`}
            sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: isMobile ? 44 : 48 }}
          />
          <Tab
            icon={isMobile ? <HistoryIcon /> : undefined}
            iconPosition="start"
            label={`Payments (${filteredPayments.length})`}
            sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: isMobile ? 44 : 48 }}
          />
                   <Tab
            icon={isMobile ? <Search /> : undefined}
            iconPosition="start"
            label="Tracker"
            sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: isMobile ? 44 : 48 }}
          />
          <Tab
            icon={isMobile ? <People /> : undefined}
            iconPosition="start"
            label={`Guarantors (${allGuarantors.length})`}
            onClick={() => loadAllGuarantors()}
            sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: isMobile ? 44 : 48, cursor: 'pointer' }}
          />
        </Tabs>
      </Paper>

      {/* TAB CONTENT */}
      {activeTab === 0 && (
        <>
          {renderFilters()}
          {isMobile ? renderMobileList() : renderDesktopTable()}
        </>
      )}

      {activeTab === 1 && renderPaymentHistory()}

      {activeTab === 2 && renderTracker()}

      {activeTab === 3 && (
        <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              <People sx={{ verticalAlign: 'middle', mr: 1, color: '#4b5563' }} />
              All Guarantors ({allGuarantors.length})
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Search guarantor..."
                value={guarantorSearch}
                onChange={(e) => setGuarantorSearch(e.target.value)}
                sx={{ width: { xs: '100%', sm: 220 } }}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#9ca3af', fontSize: 18 }} /> }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => openGuarantorDialog(null)}
                sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                + Add Guarantor
              </Button>
            </Stack>
          </Box>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#1c2580' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Guarantor</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>CNIC / Phone</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Linked Customer</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Product (EMI)</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Type</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Income</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allGuarantors.filter(g => 
                  !guarantorSearch || 
                  g.name?.toLowerCase().includes(guarantorSearch.toLowerCase()) ||
                  g.cnic?.includes(guarantorSearch) ||
                  g.customer_name?.toLowerCase().includes(guarantorSearch.toLowerCase())
                ).length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No guarantors found</Typography></TableCell></TableRow>
                ) : (
                  allGuarantors.filter(g => 
                    !guarantorSearch || 
                    g.name?.toLowerCase().includes(guarantorSearch.toLowerCase()) ||
                    g.cnic?.includes(guarantorSearch) ||
                    g.customer_name?.toLowerCase().includes(guarantorSearch.toLowerCase())
                  ).map((g, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight="bold">{g.name}</Typography>
                          {(g.total_guarantees > 1 || (g.linked_emis && g.linked_emis.length > 1)) && (
                            <Chip 
                              size="small" 
                              label={`${g.total_guarantees || g.linked_emis.length} Guarantees`} 
                              sx={{ bgcolor: '#ecfdf5', color: '#065f46', fontWeight: 'bold', height: 18, fontSize: '0.62rem' }} 
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {g.relation_to_customer || ((g.total_guarantees > 1 || (g.linked_emis && g.linked_emis.length > 1)) ? 'Multiple Customers' : '')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{g.cnic}</Typography>
                        <Typography variant="caption" color="text.secondary">{g.phone}</Typography>
                      </TableCell>
                      <TableCell>
                        {g.customer_names && g.customer_names.length > 1 ? (
                          <Box>
                            <Typography variant="body2" fontWeight="bold" color="primary.main">
                              {g.customer_names.join(', ')}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={`${g.customer_names.length} Customers Linked`} 
                              sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, mt: 0.2 }} 
                            />
                          </Box>
                        ) : (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {g.customer_name || ((g.total_guarantees > 0 || (g.linked_emis && g.linked_emis.length > 0)) ? 'Customer' : 'Standalone (Pre-registered)')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {g.customer_phone || ((g.total_guarantees > 0 || (g.linked_emis && g.linked_emis.length > 0)) ? '' : 'Ready for EMI')}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        {g.product_names && g.product_names.length > 1 ? (
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {g.product_names.join(', ')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {g.total_guarantees || g.linked_emis?.length} Active Products
                            </Typography>
                          </Box>
                        ) : (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {g.product_name || ((g.total_guarantees > 0 || (g.linked_emis && g.linked_emis.length > 0)) ? 'Agreement' : 'Unassigned')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {g.application_no || ''}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell><Chip size="small" label={`Type ${g.guarantor_type}`} sx={{ height: 20, fontSize: '0.6rem' }} /></TableCell>
                      <TableCell align="right">{formatCurrency(g.monthly_income)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton size="small" onClick={() => openGuarantorDetail(g)}><Visibility fontSize="small" sx={{ color: '#6b7280' }} /></IconButton>
                          <IconButton size="small" onClick={() => openGuarantorEdit(g)}><Edit fontSize="small" sx={{ color: '#3b82f6' }} /></IconButton>
                          <IconButton size="small" onClick={() => handleDeleteGuarantor(g.id)}><Delete fontSize="small" sx={{ color: '#ef4444' }} /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* FLOATING ACTION BUTTON (Mobile) */}
      {isMobile && (
        <Fab
          color="success"
          sx={{ position: 'fixed', bottom: 20, right: 20, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={() => setOpenCalculator(true)}
        >
          <Add />
        </Fab>
      )}

      {/* MOBILE DRAWER */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)} PaperProps={{ sx: { borderRadius: '16px 16px 0 0' } }}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Quick Actions</Typography>
          <List>
            <ListItem button onClick={() => { setMobileDrawer(false); setShowFilters(!showFilters); }}>
              <ListItemIcon><FilterList /></ListItemIcon>
              <ListItemText primary={showFilters ? 'Hide Filters' : 'Show Filters'} />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); setOpenCalculator(true); }}>
              <ListItemIcon><CalcIcon color="success" /></ListItemIcon>
              <ListItemText primary="New EMI Agreement" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); loadData(); }}>
              <ListItemIcon><Refresh /></ListItemIcon>
              <ListItemText primary="Refresh Data" />
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem button onClick={() => { setMobileDrawer(false); handleExportCSV(); }}>
              <ListItemIcon><TableChart /></ListItemIcon>
              <ListItemText primary="Export CSV" />
            </ListItem>
            <ListItem button onClick={() => { setMobileDrawer(false); handleExportPDF(); }}>
              <ListItemIcon><PictureAsPdf /></ListItemIcon>
              <ListItemText primary="Export PDF" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* DIALOGS */}
      {renderNewEMIDialog()}
      {renderPaymentDialog()}
      {renderHistoryDialog()}
      {renderViewDialog()}
      {renderDeleteDialog()}
      {renderDeletePaymentDialog()}
      {renderGuarantorDialog()}
      {renderGuarantorEditDialog()}
      {renderGuarantorDetailDialog()}
      {renderCustomerModal()}
      {renderImagePreviewDialog()}

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 2 }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2, boxShadow: 3 }}
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
