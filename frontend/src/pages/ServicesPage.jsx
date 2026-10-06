import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Card, CardContent, IconButton, Stack, Divider,
  Snackbar, Alert, CircularProgress, Avatar, Tooltip,
  useMediaQuery, useTheme, Tabs, Tab, Collapse, InputAdornment,
  FormControlLabel, Autocomplete
} from '../components/ui/tailwind-mui';
import {
  Add, Edit, Delete, Search, CheckCircle, Cancel, Schedule,
  Build, Person, Store, Inventory, Refresh, Close,
  ArrowUpward, ArrowDownward, Smartphone, Payment, AccessTime,
  Category, Print, Receipt, TrendingUp, Warning, Check, Assessment,
  QrCode, Palette, DesignServices, ReceiptLong, Info
} from '../components/ui/icons';
import db from '../database/db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printReceiptDirect, getEffectiveReceiptSettings, getEffectiveShopProfile, getThermalDimensions, formatCleanId, isHashId } from '../utils/receiptGenerator';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'warning' },
  'in-progress': { label: 'In Progress', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' }
};

const STATUS_FLOW = {
  pending: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const ROLES = ['technician', 'tailor', 'manager', 'helper'];
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'card', label: 'Card / POS' },
  { value: 'credit', label: 'Credit / Due' },
  { value: 'pending', label: 'Pending / Unpaid' }
];

// ==================== PRINT BILL FUNCTION ====================
// ==================== PRINT BILL FUNCTION ====================
const printBill = async (order, staffList = []) => {
  if (!order) return;
  
  const settings = getEffectiveReceiptSettings();
  const shop = getEffectiveShopProfile();
  
  const staff = (staffList || []).find(s => String(s.id) === String(order.staff_id));
  const totalPartsCost = order.parts_used?.reduce((sum, p) => sum + (Number(p.cost || 0) * Number(p.quantity || 1)), 0) || 0;
  const grandTotal = Number(order.total_cost || 0);
  const serviceFee = Math.max(0, grandTotal - totalPartsCost);
  const advance = Number(order.advance_amount || 0);
  const dueAmount = Math.max(0, grandTotal - advance);

  const items = [
    {
      name: `Service: ${order.service_name || 'Repair Service'}`,
      title: `Service: ${order.service_name || 'Repair Service'}`,
      qty: 1,
      quantity: 1,
      price: serviceFee > 0 ? serviceFee : grandTotal,
      total: serviceFee > 0 ? serviceFee : grandTotal
    },
    ...(order.parts_used || []).map(p => ({
      name: `Part: ${p.name} ${p.is_external ? '(Market)' : '(Stock)'}`,
      title: `Part: ${p.name} ${p.is_external ? '(Market)' : '(Stock)'}`,
      qty: Number(p.quantity || 1),
      quantity: Number(p.quantity || 1),
      price: Number(p.cost || 0),
      total: Number(p.cost || 0) * Number(p.quantity || 1)
    }))
  ];

  const serviceDetails = {
    customer_name: order.customer_name || 'Walk-in Customer',
    customer_phone: order.customer_phone || '',
    device_model: order.device_model || order.machine_name || 'N/A',
    imei: order.imei || '',
    problem_description: order.problem_description || '',
    service_name: order.service_name || 'Repair Service',
    staff_name: order.staff_name || (staff ? staff.name : ''),
    advance_amount: advance,
    due_amount: dueAmount
  };

  try {
    await printReceiptDirect(
      {
        order: {
          id: order.id,
          invoice_no: `SRV-${String(order.id).padStart(5, '0')}`,
          created_at: order.created_at,
          date: order.created_at,
          customer_name: serviceDetails.customer_name,
          customer_phone: serviceDetails.customer_phone,
          subtotal: grandTotal,
          grand_total: grandTotal,
          paid_amount: advance,
          due_amount: dueAmount,
          payment_mode: order.payment_mode || 'PENDING',
          items: items
        },
        items,
        serviceDetails,
        type: 'service'
      },
      {
        receiptSettings: settings,
        shopProfile: shop,
        design: settings.design
      }
    );
  } catch (err) {
    console.error('Service bill print error:', err);
    alert('Print error: ' + err.message);
  }
};

// ==================== PRINT BOOKING TOKEN FUNCTION ====================
const printBookingToken = async (order) => {
  if (!order) return;
  const settings = getEffectiveReceiptSettings();
  const shop = getEffectiveShopProfile();
  const tokenNo = order.token_no || ('TKN-' + String(order.id).padStart(5, '0'));
  const dims = getThermalDimensions(settings);
  
  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const fmtDateOnly = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const tokenHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Slip - ${tokenNo}</title>
      <style>
        @page { size: ${dims.paperWidthMm}mm auto; margin: ${dims.marginTop}mm ${dims.marginRight}mm ${dims.marginBottom}mm ${dims.marginLeft}mm; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; color: #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; width: ${dims.printableWidthMm || 70}mm; max-width: ${dims.printableWidthMm || 70}mm; margin: 0 auto; padding: ${dims.paddingMm}mm 1mm; font-size: ${dims.fontSizePx}px; font-weight: 600; line-height: 1.3; color: #000000 !important; background: #ffffff; -webkit-font-smoothing: antialiased; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .title { font-size: ${dims.titleSizePx}px; font-weight: 800; margin-bottom: 2px; text-transform: uppercase; }
        .subtitle { font-size: ${dims.smallSizePx}px; color: #000000; font-weight: 600; margin-bottom: 6px; }
        .token-box { border: 1.5px solid #000000; padding: 6px; text-align: center; margin: 8px 0; }
        .token-num { font-size: ${dims.titleSizePx + 4}px; font-weight: 800; letter-spacing: 1px; }
        .divider { border-bottom: 1.5px dashed #000000; margin: 6px 0; }
        .solid-divider { border-bottom: 1.5px solid #000000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: 600; }
        .label { font-weight: 700; }
        .terms { font-size: ${dims.smallSizePx}px; color: #000000; font-weight: 600; margin-top: 8px; line-height: 1.2; }
        .signatures { display: flex; justify-content: space-between; margin-top: 25px; padding-top: 5px; font-size: ${dims.smallSizePx}px; font-weight: 600; }
        .sig-line { border-top: 1.5px solid #000000; width: 42%; text-align: center; padding-top: 2px; font-weight: 700; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="title">${shop.name || 'WORKSHOP'}</div>
        <div class="subtitle">${shop.address || 'Workshop & Service Center'}<br>${shop.phone ? 'Tel: ' + shop.phone : ''}</div>
      </div>
      
      <div class="token-box">
        <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">CUSTOMER INTAKE TOKEN</div>
        <div class="token-num">${tokenNo}</div>
        <div style="font-size: 9px;">Booking: ${fmtDate(order.booking_date || order.created_at)}</div>
      </div>

      <div class="divider"></div>

      <div class="row"><span class="label">Customer:</span> <span>${order.customer_name || 'Walk-in'}</span></div>
      ${order.customer_phone ? `<div class="row"><span class="label">Phone:</span> <span>${order.customer_phone}</span></div>` : ''}
      <div class="row"><span class="label">Device:</span> <span class="bold">${order.device_model || order.machine_name || 'N/A'}</span></div>
      ${order.imei ? `<div class="row"><span class="label">IMEI / SN:</span> <span>${order.imei}</span></div>` : ''}
      <div class="row"><span class="label">Promised:</span> <span class="bold">${fmtDateOnly(order.expected_delivery_date) || 'To be confirmed'}</span></div>
      ${order.staff_name ? `<div class="row"><span class="label">Technician:</span> <span>${order.staff_name}</span></div>` : ''}

      <div class="divider"></div>

      <div style="margin-bottom: 3px;"><span class="label">Reported Fault:</span></div>
      <div style="border: 1px solid #000; padding: 4px; margin-bottom: 4px;">${order.problem_description || 'General Inspection / Repair'}</div>

      ${order.device_condition ? `
      <div style="margin-bottom: 3px;"><span class="label">Physical Condition:</span></div>
      <div style="border: 1px dashed #000; padding: 4px; margin-bottom: 4px;">${order.device_condition}</div>
      ` : ''}

      <div class="divider"></div>

      <div class="row"><span class="label">Est. Service Fee:</span> <span>Rs. ${order.service_fee || order.total_cost || 0}</span></div>
      <div class="row"><span class="label">Advance Paid:</span> <span class="bold">Rs. ${order.advance_amount || 0}</span></div>
      <div class="row"><span class="label">Payment Mode:</span> <span>${(order.payment_mode || 'Cash').toUpperCase()}</span></div>

      <div class="divider"></div>

      <div class="terms">
        <strong>Terms & Conditions:</strong><br>
        1. Please bring this original token slip at the time of delivery.<br>
        2. Devices not claimed within 30 days are not the responsibility of the shop.<br>
        3. Backup your data before giving the device. Shop is not liable for data loss.
      </div>

      <div class="signatures">
        <div class="sig-line">Customer Signature</div>
        <div class="sig-line">Authorized Signature</div>
      </div>
      ${Array.from({ length: dims.feedLines }).map(() => '<div style="height: 8px;">&nbsp;</div>').join('')}
    </body>
    </html>
  `;

  if (window.electronAPI && typeof window.electronAPI.printReceipt === 'function') {
    try {
      await window.electronAPI.printReceipt(tokenHTML, {
        printerName: settings.printerName || undefined,
        pageSize: settings.paperSize || '80mm',
        copies: 1,
        silent: true
      });
      return;
    } catch (e) {
      console.warn('Electron print token fallback:', e);
    }
  }

  const printWindow = window.open('', '_blank', `width=${dims.paperWidthMm === 58 ? 320 : 420},height=600`);
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(tokenHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => { printWindow.close(); }, 500);
    }, 400);
  } else {
    alert('Please allow popups to print booking token');
  }
};

// ==================== WORK ORDER CARD ====================
const WorkOrderCard = ({ wo, onEdit, onDelete, onStatusChange, onViewHistory, onPrint, onPrintToken }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
  const nextStatuses = STATUS_FLOW[wo.status] || [];
  
  const paymentColor = wo.payment_status === 'paid' ? 'success' : 'error';
  const paymentLabel = wo.payment_status === 'paid' ? 'PAID' : 'UNPAID';

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalPartsCost = useMemo(() => {
    if (!wo.parts_used || wo.parts_used.length === 0) return 0;
    return wo.parts_used.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
  }, [wo.parts_used]);

  const serviceFee = wo.total_cost - totalPartsCost;
  const dueAmount = wo.total_cost - (wo.advance_amount || 0);

  return (
    <Card 
      elevation={2}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        borderRadius: 2,
        transition: '0.2s',
        '&:hover': { boxShadow: 4 },
        borderLeft: `5px solid ${
          status.color === 'warning' ? '#f59e0b' : 
          status.color === 'info' ? '#3b82f6' : 
          status.color === 'success' ? '#10b981' : '#ef4444'
        }` 
      }}
    >
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {wo.token_no && (
                <Chip size="small" label={wo.token_no} sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
              )}
              <Chip size="small" label={status.label} color={status.color} sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
              <Chip size="small" label={paymentLabel} color={paymentColor} sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>{wo.token_no ? `#${wo.token_no}` : formatCleanId(wo)}</Typography>
          </Box>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, lineHeight: 1.2 }}>
            {wo.device_model || wo.machine_name || 'Unnamed Device'}
          </Typography>

          {wo.imei && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
              IMEI: <strong>{wo.imei}</strong>
            </Typography>
          )}

          <Stack spacing={0.5} sx={{ my: 1.5 }}>
            <Typography variant="body2" color="text.secondary"><strong>Service:</strong> {wo.service_name || '—'}</Typography>
            <Typography variant="body2" color="text.secondary"><strong>Staff:</strong> {wo.staff_name || '—'}</Typography>
            {wo.customer_name && (
              <Typography 
                variant="body2" 
                color="primary.main" 
                sx={{ cursor: 'pointer', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
                onClick={() => onViewHistory(wo.customer_id)}
              >
                {wo.customer_name} {wo.customer_phone ? `(${wo.customer_phone})` : ''}
              </Typography>
            )}
            {wo.booking_date && (
              <Typography variant="caption" color="text.secondary" display="block">
                Booked: {wo.booking_date} {wo.expected_delivery_date ? `| Promised: ${wo.expected_delivery_date}` : ''}
              </Typography>
            )}
            {wo.device_condition && (
              <Typography variant="caption" color="warning.dark" display="block" sx={{ fontStyle: 'italic' }}>
                Condition: {wo.device_condition}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Payment fontSize="inherit" /> <strong>Mode:</strong> {wo.payment_mode ? wo.payment_mode.toUpperCase() : 'PENDING'}
            </Typography>
          </Stack>

          <Collapse in={expanded}>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              {wo.problem_description && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Problem / Fault</Typography>
                  <Typography variant="body2">{wo.problem_description}</Typography>
                </Box>
              )}
              {wo.device_condition && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Physical Condition</Typography>
                  <Typography variant="body2">{wo.device_condition}</Typography>
                </Box>
              )}
              {wo.parts_used?.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom>Parts Used</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {wo.parts_used.map((p, i) => (
                      <Chip 
                        key={i} 
                        size="small" 
                        label={`${p.name} (${p.is_external ? 'Market' : 'Stock'}) ×${p.quantity} = Rs.${p.cost * p.quantity}`} 
                        variant="outlined" 
                        sx={{ fontSize: '0.6rem', height: 20 }} 
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Payment fontSize="small" /> Cost Breakdown
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Service Fee: <strong>Rs. {serviceFee}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Parts Cost: <strong>Rs. {totalPartsCost}</strong>
                </Typography>
                <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                  Total: Rs. {wo.total_cost || 0}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: '#f0fdf4', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Payment fontSize="small" /> Payment Status
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Advance: <strong>Rs. {wo.advance_amount || 0}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Due: <strong style={{ color: dueAmount > 0 ? '#ef4444' : '#10b981' }}>Rs. {dueAmount}</strong>
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime fontSize="small" /> Timestamps
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  Created: {fmtDate(wo.created_at)}
                </Typography>
                {wo.status === 'completed' && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Completed: {fmtDate(wo.completed_at)}
                  </Typography>
                )}
                {wo.commission_amount > 0 && (
                  <Typography variant="caption" display="block" color="success.main" fontWeight={600}>
                    Staff Commission: Rs. {wo.commission_amount}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Collapse>
        </Box>

        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Cost</Typography>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Rs. {wo.total_cost || 0}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {nextStatuses.map(ns => (
              <Button
                key={ns} size="small" variant="contained"
                onClick={() => onStatusChange(wo.id, ns)}
                sx={{
                  flex: 1, fontSize: '0.7rem', py: 0.6, textTransform: 'none',
                  bgcolor: ns === 'completed' ? '#10b981' : ns === 'in-progress' ? '#3b82f6' : '#ef4444',
                  '&:hover': { bgcolor: ns === 'completed' ? '#059669' : ns === 'in-progress' ? '#2563eb' : '#dc2626' }
                }}
              >
                {ns === 'completed' ? 'Complete' : ns === 'in-progress' ? 'Start' : 'Cancel'}
              </Button>
            ))}
            <Tooltip title="Print Customer Booking Token Slip"><IconButton size="small" sx={{ color: '#10b981' }} onClick={() => onPrintToken(wo)}><ReceiptLong fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Print Bill"><IconButton size="small" color="primary" onClick={() => onPrint(wo)}><Print fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Edit Order"><IconButton size="small" color="primary" onClick={() => onEdit(wo)}><Edit fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Delete Order"><IconButton size="small" color="error" onClick={() => onDelete(wo.id)}><Delete fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={expanded ? "Less details" : "More details"}><IconButton size="small" onClick={() => setExpanded(!expanded)}>{expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}</IconButton></Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== INDEXEDDB HELPERS (DIRECT ACCESS) ====================
const idbGetById = (storeName, id) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RAATH_POS_DEMO', 17);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const getRequest = store.get(id);
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const idbPut = (storeName, data) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RAATH_POS_DEMO', 17);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const putRequest = store.put(data);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

// ==================== MAIN COMPONENT ====================
export default function ServicesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeTab, setActiveTab] = useState('workorders');
  const [workOrders, setWorkOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customerHistory, setCustomerHistory] = useState({ open: false, customer: null, orders: [] });
  const [stockAlert, setStockAlert] = useState({ open: false, message: '', parts: [] });
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    loadAll();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadAll = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    setLoading(true);
    try {
      const [wo, sv, st, cu, pr, cat] = await Promise.all([
        db.getWorkOrders ? db.getWorkOrders() : [],
        db.getServices ? db.getServices() : [],
        db.getStaff ? db.getStaff() : [],
        db.getCustomers ? db.getCustomers() : [],
        db.getAllVariants ? db.getAllVariants() : [],
        db.getCategories ? db.getCategories() : []
      ]);
      
      const categoryMap = {};
      (cat || []).forEach(c => {
        categoryMap[c.id] = c.name;
      });
      
      const productsWithCategory = (pr || []).map(p => {
        const catId = p.category_id || p.parent_category_id;
        return {
          ...p,
          category_name: categoryMap[catId] || p.category_name || 'Uncategorized',
          category_id: catId || p.category_id || null,
          current_stock: Number(p.current_stock) || 0
        };
      });
      
      if (isMounted.current) {
        setWorkOrders(wo || []);
        setServices(sv || []);
        setStaffList(st || []);
        setCustomers(cu || []);
        setProducts(productsWithCategory);
        setCategories(cat || []);
      }
    } catch (e) {
      console.error('Load error:', e);
      if (isMounted.current) {
        setSnackbar({ open: true, message: 'Error loading data: ' + e.message, severity: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  };

  const filteredWorkOrders = useMemo(() => {
    let result = [...workOrders];
    if (statusFilter) result = result.filter(w => w.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => 
        (w.device_model || w.machine_name || '').toLowerCase().includes(q) ||
        (w.imei || '').toLowerCase().includes(q) ||
        (w.service_name || '').toLowerCase().includes(q) ||
        (w.staff_name || '').toLowerCase().includes(q) ||
        (w.customer_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, statusFilter, searchQuery]);

  const reportData = useMemo(() => {
    const totalOrders = workOrders.length;
    const completedOrders = workOrders.filter(w => w.status === 'completed');
    const pendingOrders = workOrders.filter(w => w.status === 'pending');
    const inProgressOrders = workOrders.filter(w => w.status === 'in-progress');
    const cancelledOrders = workOrders.filter(w => w.status === 'cancelled');
    
    const totalRevenue = workOrders.reduce((sum, w) => sum + (w.total_cost || 0), 0);
    const totalCommission = workOrders.reduce((sum, w) => sum + (w.commission_amount || 0), 0);
    const totalAdvance = workOrders.reduce((sum, w) => sum + (w.advance_amount || 0), 0);
    const totalDue = workOrders.reduce((sum, w) => sum + (w.total_cost - (w.advance_amount || 0)), 0);
    
    const revenueByStatus = {
      pending: workOrders.filter(w => w.status === 'pending').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      'in-progress': workOrders.filter(w => w.status === 'in-progress').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      completed: workOrders.filter(w => w.status === 'completed').reduce((sum, w) => sum + (w.total_cost || 0), 0),
      cancelled: workOrders.filter(w => w.status === 'cancelled').reduce((sum, w) => sum + (w.total_cost || 0), 0)
    };
    
    const staffPerformance = staffList.map(staff => {
      const staffOrders = workOrders.filter(w => String(w.staff_id) === String(staff.id));
      const completedStaffOrders = staffOrders.filter(w => w.status === 'completed');
      const totalStaffCommission = staffOrders.reduce((sum, w) => sum + (w.commission_amount || 0), 0);
      const totalStaffRevenue = staffOrders.reduce((sum, w) => sum + (w.total_cost || 0), 0);
      const totalStaffAdvance = staffOrders.reduce((sum, w) => sum + (w.advance_amount || 0), 0);
      
      return {
        ...staff,
        totalOrders: staffOrders.length,
        completedOrders: completedStaffOrders.length,
        totalCommission: totalStaffCommission,
        totalRevenue: totalStaffRevenue,
        totalAdvance: totalStaffAdvance,
        totalPayout: (Number(staff.base_salary) || 0) + totalStaffCommission
      };
    }).sort((a, b) => b.totalCommission - a.totalCommission);

    const recentCompleted = [...completedOrders]
      .sort((a, b) => new Date(b.completed_at || b.updated_at || 0) - new Date(a.completed_at || a.updated_at || 0))
      .slice(0, 10);

    return {
      totalOrders,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      inProgressOrders: inProgressOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      totalCommission,
      totalAdvance,
      totalDue,
      revenueByStatus,
      staffPerformance,
      recentCompleted,
      completionRate: totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0
    };
  }, [workOrders, staffList]);

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setModalType('');
  };

  const openCustomerHistory = (customerId) => {
    const cust = customers.find(c => c.id === customerId);
    const historyOrders = workOrders.filter(w => w.customer_id === customerId);
    setCustomerHistory({ open: true, customer: cust, orders: historyOrders });
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      if (type === 'service') await db.deleteService(id);
      else if (type === 'staff') await db.deleteStaff(id);
      else if (type === 'workorder') await db.deleteWorkOrder(id);
      await loadAll();
      setSnackbar({ open: true, message: 'Deleted successfully!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Error: ' + e.message, severity: 'error' });
    }
  };

  // ==================== UPDATE WORK ORDER STATUS (FINAL FIXED VERSION) ====================
  const updateWorkOrderStatus = async (id, newStatus) => {
    let stockDeductions = [];
    let commissionAmount = 0;
    let commissionAdded = false;
    
    try {
      console.log(`[Services] Starting status update for order ${id} to ${newStatus}`);
      
      const order = workOrders.find(w => String(w.id) === String(id));
      if (!order) {
        console.error('[Services] Order not found:', id);
        return;
      }

      const updatePayload = { status: newStatus };

      if (newStatus === 'completed') {
        console.log('[Services] Order completing - processing stock and commission');
        
        updatePayload.completed_at = new Date().toISOString();
        
        // ====== 1. CALCULATE AND ADD COMMISSION ======
        const staff = staffList.find(s => String(s.id) === String(order.staff_id));
        
        if (staff && staff.commission_rate > 0 && order.total_cost > 0) {
          commissionAmount = Math.round((order.total_cost * staff.commission_rate) / 100);
          updatePayload.commission_amount = commissionAmount;
          
          try {
            const currentStaff = await db.getStaffById(staff.id);
            if (currentStaff) {
              const currentTotalCommission = Number(currentStaff.total_commission) || 0;
              const newTotalCommission = currentTotalCommission + commissionAmount;
              
              await db.updateStaff(staff.id, {
                ...currentStaff,
                total_commission: newTotalCommission
              });
              
              commissionAdded = true;
              console.log(`[Services] Commission Rs. ${commissionAmount} added to ${staff.name}`);
              console.log(`   Total: ${currentTotalCommission} → ${newTotalCommission}`);
            }
          } catch (err) {
            console.error('Commission update error:', err);
          }
        }

        // ====== 2. DEDUCT STOCK FROM VARIANTS ======
        if (order?.parts_used?.length > 0) {
          console.log(`[Services] Processing ${order.parts_used.length} parts...`);
          
          const stockParts = order.parts_used.filter(p => !p.is_external);
          
          for (const part of stockParts) {
            console.log(`[Services] Processing part:`, part);
            
            // CRITICAL: Find VARIANT by SKU
            let variant = null;
            
            // Try by SKU first
            if (part.part_id) {
              variant = products.find(p => p.sku === part.part_id);
            }
            
            // Try by ID if SKU not found
            if (!variant && part.part_id) {
              variant = products.find(p => String(p.id) === String(part.part_id));
            }
            
            // Try by name as last resort
            if (!variant && part.name) {
              variant = products.find(p => 
                (p.product_name || p.name || '').toLowerCase() === part.name.toLowerCase()
              );
            }
            
            console.log(`[Services] Found variant:`, variant ? {
              id: variant.id,
              sku: variant.sku,
              name: variant.product_name || variant.name,
              current_stock: variant.current_stock,
              variant_name: variant.variant_name
            } : 'NOT FOUND');
            
            if (variant) {
              const currentStock = Number(variant.current_stock) || 0;
              const usedQty = Number(part.quantity) || 0;
              
              // STRICT SUBTRACTION
              const deductedStock = Math.max(0, currentStock - usedQty);
              
              console.log(`[Services] Stock Calculation:`);
              console.log(`   Variant: ${variant.product_name || variant.name} (${variant.sku})`);
              console.log(`   Current: ${currentStock} - Used: ${usedQty} = After: ${deductedStock}`);
              
              let updateSuccess = false;
              
              try {
                // METHOD 1: Direct SQL (Electron)
                if (window.electronAPI && window.electronAPI.dbQuery) {
                  console.log(`[Services] Using SQL UPDATE for variant: ${variant.id}`);
                  await window.electronAPI.dbQuery(
                    "UPDATE product_variants SET current_stock = ? WHERE id = ?",
                    [deductedStock, variant.id]
                  );
                  updateSuccess = true;
                }
                // METHOD 2: db.updateVariantStock
                else if (db.updateVariantStock) {
                  console.log(`[Services] Using db.updateVariantStock for variant: ${variant.id}`);
                  await db.updateVariantStock(variant.id, deductedStock);
                  updateSuccess = true;
                }
                // METHOD 3: db.updateVariant
                else if (db.updateVariant) {
                  console.log(`[Services] Using db.updateVariant for variant: ${variant.id}`);
                  const updatedVariant = {
                    ...variant,
                    current_stock: deductedStock
                  };
                  await db.updateVariant(variant.id, updatedVariant);
                  updateSuccess = true;
                }
                // METHOD 4: db.query
                else if (db.query) {
                  console.log(`[Services] Using db.query for variant: ${variant.id}`);
                  await db.query(
                    "UPDATE product_variants SET current_stock = ? WHERE id = ?",
                    [deductedStock, variant.id]
                  );
                  updateSuccess = true;
                }
                // METHOD 5: Direct IndexedDB
                else {
                  console.log(`[Services] Using direct IndexedDB for variant: ${variant.id}`);
                  const idbVariant = await idbGetById('product_variants', variant.id);
                  if (idbVariant) {
                    idbVariant.current_stock = deductedStock;
                    await idbPut('product_variants', idbVariant);
                    updateSuccess = true;
                  }
                }
              } catch (err) {
                console.error(`[Services] Stock update failed for ${part.name}:`, err);
              }
              
              if (updateSuccess) {
                // Update local state
                const localVariant = products.find(p => String(p.id) === String(variant.id));
                if (localVariant) {
                  localVariant.current_stock = deductedStock;
                  console.log(`[Services] Local state updated for ${localVariant.product_name || localVariant.name}`);
                }
                
                stockDeductions.push({
                  name: variant.product_name || variant.name || part.name,
                  sku: variant.sku || part.part_id,
                  before: currentStock,
                  after: deductedStock,
                  used: usedQty,
                  variantId: variant.id
                });
                
                console.log(`[Services] Stock updated: ${part.name} = ${deductedStock}`);
              } else {
                console.error(`[Services] ALL STOCK UPDATE METHODS FAILED for ${part.name}!`);
              }
            } else {
              console.error(`[Services] VARIANT NOT FOUND for part:`, part);
              console.log(`   Available variants:`, products.map(p => ({
                id: p.id,
                sku: p.sku,
                name: p.product_name || p.name,
                stock: p.current_stock
              })));
            }
          }
          
          if (stockDeductions.length > 0 && isMounted.current) {
            setStockAlert({
              open: true,
              message: `Stock Deducted Successfully (${stockDeductions.length} parts)`,
              parts: stockDeductions
            });
          }
        }
      }

      // ====== 3. UPDATE WORK ORDER STATUS ======
      console.log(`[Services] Updating work order status to ${newStatus}...`);
      
      try {
        if (db.updateWorkOrder) {
          await db.updateWorkOrder(id, updatePayload);
        } else if (db.updateWorkOrderStatus) {
          await db.updateWorkOrderStatus(id, newStatus);
        } else if (db.query) {
          await db.query(
            "UPDATE work_orders SET status = ?, completed_at = ?, commission_amount = ? WHERE id = ?",
            [newStatus, updatePayload.completed_at || null, updatePayload.commission_amount || 0, id]
          );
        }
        
        console.log('[Services] Work order updated, reloading data...');
        
        // Clear cache
        if (db._cache) {
          db._cache.clear();
          console.log('[Cache] Cache cleared');
        }
        
        await loadAll();
        
        // Verify stock
        console.log(`[Services] Verifying stock after reload...`);
        const verifiedProducts = await db.getAllVariants ? await db.getAllVariants() : [];
        console.log(`[Services] Stock after verification:`,  verifiedProducts.map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.product_name || p.name,
          stock: p.current_stock
        })));
        
        let message = `Order ${newStatus === 'completed' ? 'completed' : 'updated'}!`;
        if (stockDeductions.length > 0) {
          message += ` ${stockDeductions.length} parts deducted`;
        }
        if (commissionAmount > 0 && commissionAdded) {
          message += `, Commission: Rs. ${commissionAmount} added to staff`;
        }
        
        setSnackbar({ 
          open: true, 
          message: message, 
          severity: 'success' 
        });
        
      } catch (err) {
        console.error('[Services] Work order update error:', err);
        setSnackbar({ 
          open: true, 
          message: 'Error updating order: ' + err.message, 
          severity: 'error' 
        });
      }
      
    } catch (e) {
      console.error('[Services] Status update error:', e);
      setSnackbar({ 
        open: true, 
        message: 'Error: ' + e.message, 
        severity: 'error' 
      });
    }
  };

  // ==================== WORK ORDER FORM ====================
  const WorkOrderForm = () => {
    const [form, setForm] = useState({
      token_no: editingItem?.token_no || ('TKN-' + Math.floor(100000 + Math.random() * 900000)),
      booking_date: editingItem?.booking_date || new Date().toISOString().split('T')[0],
      expected_delivery_date: editingItem?.expected_delivery_date || '',
      device_condition: editingItem?.device_condition || '',
      device_image: editingItem?.device_image || null,
      service_id: editingItem?.service_id || '',
      staff_id: editingItem?.staff_id || '',
      customer_id: editingItem?.customer_id || '',
      device_model: editingItem?.device_model || editingItem?.machine_name || '',
      imei: editingItem?.imei || '',
      problem_description: editingItem?.problem_description || '',
      status: editingItem?.status || 'pending',
      notes: editingItem?.notes || '',
      service_fee: editingItem?.service_fee || '',
      advance_amount: editingItem?.advance_amount || '',
      total_cost: editingItem?.total_cost || '',
      payment_status: editingItem?.payment_status || 'unpaid',
      payment_mode: editingItem?.payment_mode || 'cash'
    });
    const [selectedParts, setSelectedParts] = useState(editingItem?.parts_used || []);
    const [partSearch, setPartSearch] = useState('');
    const [extPart, setExtPart] = useState({ name: '', cost: '' });
    const [categoryFilter, setCategoryFilter] = useState('');

    const handleImageUpload = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm(prev => ({ ...prev, device_image: e.target.result }));
      };
      reader.readAsDataURL(file);
    };

    const getProductName = (p) => p.name || p.product_name || p.variant_name || 'Unknown';
    const getProductCategory = (p) => p.category_name || p.category || 'Uncategorized';
    const getProductStock = (p) => p.current_stock || 0;

    const productsByCategory = useMemo(() => {
      const grouped = {};
      products.forEach(p => {
        const category = getProductCategory(p);
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(p);
      });
      return grouped;
    }, [products]);

    const categoriesList = useMemo(() => {
      return Object.keys(productsByCategory).sort();
    }, [productsByCategory]);

    const calculatedTotal = useMemo(() => {
      const partsTotal = selectedParts.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0);
      const serviceFee = Number(form.service_fee) || 0;
      return partsTotal + serviceFee;
    }, [selectedParts, form.service_fee]);

    const commissionPreview = useMemo(() => {
      const staff = staffList.find(s => String(s.id) === String(form.staff_id));
      if (!staff || !calculatedTotal) return 0;
      return Math.round((calculatedTotal * (staff.commission_rate || 0)) / 100);
    }, [form.staff_id, calculatedTotal, staffList]);

    useEffect(() => {
      setForm(prev => ({ ...prev, total_cost: calculatedTotal.toString() }));
    }, [calculatedTotal]);

    const availableParts = useMemo(() => {
      let filtered = products;
      
      if (categoryFilter) {
        filtered = filtered.filter(p => getProductCategory(p) === categoryFilter);
      }
      
      if (partSearch) {
        const q = partSearch.toLowerCase();
        filtered = filtered.filter(p => 
          getProductName(p).toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
      }
      
      filtered = filtered.filter(p => getProductStock(p) > 0);
      
      return filtered.slice(0, 20);
    }, [partSearch, categoryFilter, products]);

    const addStockPart = (product) => {
      const productName = getProductName(product);
      const category = getProductCategory(product);
      const currentStock = getProductStock(product);
      
      const exists = selectedParts.find(p => p.part_id === product.sku && !p.is_external);
      
      if (exists) {
        if (exists.quantity + 1 > currentStock) {
          setSnackbar({ 
            open: true, 
            message: `Not enough stock! Only ${currentStock} available.`, 
            severity: 'warning' 
          });
          return;
        }
        setSelectedParts(selectedParts.map(p => 
          p.part_id === product.sku && !p.is_external 
            ? { ...p, quantity: p.quantity + 1 } 
            : p
        ));
      } else {
        if (currentStock <= 0) {
          setSnackbar({ 
            open: true, 
            message: `${productName} is out of stock!`,  
            severity: 'error' 
          });
          return;
        }
        setSelectedParts([...selectedParts, { 
          part_id: product.sku, 
          name: productName,
          category: category,
          quantity: 1, 
          cost: Number(product.purchase_price) || Number(product.cost_price) || 0, 
          is_external: false,
          stock_before: currentStock
        }]);
      }
      setPartSearch('');
    };

    const addExternalPart = () => {
      if (!extPart.name || !extPart.cost) return;
      setSelectedParts([...selectedParts, { 
        part_id: 'EXT-' + Date.now(), 
        name: extPart.name,
        category: 'External',
        quantity: 1, 
        cost: Number(extPart.cost) || 0, 
        is_external: true 
      }]);
      setExtPart({ name: '', cost: '' });
    };

    const updatePartQty = (partId, qty) => {
      const num = parseInt(qty) || 0;
      if (num <= 0) {
        setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
      } else {
        const part = selectedParts.find(p => p.part_id === partId);
        if (part && !part.is_external) {
          const product = products.find(p => p.sku === partId);
          if (product && num > (product.current_stock || 0)) {
            setSnackbar({ 
              open: true, 
              message: `Not enough stock! Only ${product.current_stock} available.`, 
              severity: 'warning' 
            });
            return;
          }
        }
        setSelectedParts(selectedParts.map(p => 
          p.part_id === partId ? { ...p, quantity: num } : p
        ));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const service = services.find(s => String(s.id) === String(form.service_id));
        const staff = staffList.find(s => String(s.id) === String(form.staff_id));
        const customer = customers.find(c => String(c.id) === String(form.customer_id));
        
        const payload = { 
          ...form, 
          machine_name: form.device_model,
          service_name: service?.name || '',
          staff_name: staff?.name || '',
          customer_name: customer?.name || '',
          customer_phone: customer?.phone || '',
          total_cost: Number(calculatedTotal) || 0,
          parts_used: selectedParts,
          advance_amount: Number(form.advance_amount) || 0,
          commission_amount: 0
        };

        if (!editingItem) {
          payload.created_at = new Date().toISOString();
        }

        if (editingItem) {
          await db.updateWorkOrder(editingItem.id, payload);
        } else {
          await db.createWorkOrder(payload);
        }
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Work order saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600, py: 1.5 }}>
          {editingItem ? 'Edit Repair Order' : 'New Repair Order'}
        </DialogTitle>
        <DialogContent 
          dividers 
          sx={{ 
            maxHeight: { xs: 'calc(100vh - 130px)', sm: 'calc(85vh - 130px)' }, 
            overflowY: 'auto',
            p: { xs: 2, sm: 3 },
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f5f9',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#10b981',
              borderRadius: '4px',
              '&:hover': {
                background: '#059669',
              },
            },
          }}
        >
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth size="small" 
                label="Token #" 
                value={form.token_no} 
                onChange={e => setForm({...form, token_no: e.target.value})} 
                InputProps={{ sx: { fontFamily: 'monospace', fontWeight: 'bold' } }}
                helperText="Auto-generated intake token"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth size="small" 
                label="Booking Date" 
                type="date"
                value={form.booking_date} 
                onChange={e => setForm({...form, booking_date: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth size="small" 
                label="Expected Return Date" 
                type="date"
                value={form.expected_delivery_date} 
                onChange={e => setForm({...form, expected_delivery_date: e.target.value})}
                InputLabelProps={{ shrink: true }}
                helperText="Customer promised date"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Repair Service</InputLabel>
                <Select value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} label="Repair Service">
                  <MenuItem value="">Select Service</MenuItem>
                  {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name} (Rs.{s.base_price})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Assign Technician</InputLabel>
                <Select value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} label="Assign Technician">
                  <MenuItem value="">Assign Staff</MenuItem>
                  {staffList.filter(s => s.active !== false).map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.role})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Device Model / Name" required value={form.device_model} onChange={e => setForm({...form, device_model: e.target.value})} placeholder="e.g. iPhone 13" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="IMEI / Serial Number" value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer</InputLabel>
                <Select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} label="Customer">
                  <MenuItem value="">Select Customer</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.phone})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Service Fee (Rs.)" 
                type="number" 
                value={form.service_fee} 
                onChange={e => setForm({...form, service_fee: e.target.value})} 
                placeholder="Enter service charge"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth size="small" 
                multiline rows={2} 
                label="Problem Description / Fault Details" 
                value={form.problem_description} 
                onChange={e => setForm({...form, problem_description: e.target.value})} 
                placeholder="e.g. Screen broken, battery draining..."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth size="small" 
                multiline rows={2} 
                label="Device Physical Condition" 
                value={form.device_condition} 
                onChange={e => setForm({...form, device_condition: e.target.value})} 
                placeholder="e.g. Minor scratches on back, dent on corner..."
              />
            </Grid>

            {/* DEVICE PHOTO */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px dashed #cbd5e1', borderRadius: 2 }}>
                <Button component="label" variant="outlined" size="small" startIcon={<Smartphone />}>
                  {form.device_image ? 'Change Device Photo' : 'Upload Device Photo'}
                  <input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e.target.files[0])} />
                </Button>
                {form.device_image && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img src={form.device_image} alt="Device" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                    <Button size="small" color="error" onClick={() => setForm(prev => ({ ...prev, device_image: null }))}>Remove</Button>
                  </Box>
                )}
                {!form.device_image && (
                  <Typography variant="caption" color="text.secondary">Optional: Attach photo of physical condition when received</Typography>
                )}
              </Box>
            </Grid>

            {/* PAYMENT SECTION */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Payment fontSize="small" color="primary" /> Payment Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Mode</InputLabel>
                      <Select 
                        value={form.payment_mode} 
                        onChange={e => setForm({...form, payment_mode: e.target.value})} 
                        label="Payment Mode"
                      >
                        {PAYMENT_MODES.map(m => (
                          <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Status</InputLabel>
                      <Select 
                        value={form.payment_status} 
                        onChange={e => setForm({...form, payment_status: e.target.value})} 
                        label="Payment Status"
                      >
                        <MenuItem value="paid">PAID</MenuItem>
                        <MenuItem value="unpaid">UNPAID</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Advance Amount (Rs.)" 
                      type="number" 
                      value={form.advance_amount} 
                      onChange={e => setForm({...form, advance_amount: e.target.value})} 
                      placeholder="Enter advance payment"
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #10b981' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Service Fee</Typography>
                      <Typography variant="h6" fontWeight={600}>Rs. {Number(form.service_fee) || 0}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Parts Cost</Typography>
                      <Typography variant="h6" fontWeight={600}>Rs. {selectedParts.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                      <Typography variant="h6" fontWeight={700} color="primary.main">Rs. {calculatedTotal}</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Advance Paid</Typography>
                        <Typography variant="subtitle1" fontWeight={600} color="success.main">Rs. {Number(form.advance_amount) || 0}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Due Amount</Typography>
                        <Typography variant="subtitle1" fontWeight={700} color={calculatedTotal - (Number(form.advance_amount) || 0) > 0 ? 'error' : 'success'}>
                          Rs. {calculatedTotal - (Number(form.advance_amount) || 0)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
                
                {form.staff_id && calculatedTotal > 0 && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1, border: '1px solid #10b981' }}>
                    <Typography variant="caption" color="success.main" fontWeight={600}>
                      Auto Commission Preview: Rs. {commissionPreview} 
                      ({staffList.find(s => String(s.id) === String(form.staff_id))?.commission_rate || 0}% of Rs. {calculatedTotal})
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      Ye commission automatically add hoga jab order <strong>"Completed"</strong> hoga.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* PARTS SECTION */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Inventory fontSize="small" color="primary" /> Parts Used (Stock & External Market)
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Search stock parts by name or SKU..." 
                    value={partSearch} 
                    onChange={e => setPartSearch(e.target.value)} 
                    sx={{ bgcolor: 'white', flex: 1, minWidth: 150 }} 
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} 
                  />
                  <FormControl size="small" sx={{ minWidth: 180, bgcolor: 'white' }}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categoriesList.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                {availableParts.length > 0 ? (
                  <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, mb: 2, bgcolor: 'white' }}>
                    {availableParts.map(p => {
                      const productName = getProductName(p);
                      const category = getProductCategory(p);
                      const stock = getProductStock(p);
                      
                      return (
                        <Box 
                          key={p.id} 
                          sx={{ 
                            p: 1.5, 
                            borderBottom: '1px solid #f0f0f0', 
                            '&:hover': { bgcolor: '#f5f5f5' }, 
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }} 
                          onClick={() => addStockPart(p)}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {productName}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.secondary">
                                SKU: {p.sku || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="primary.main" fontWeight={500}>
                                Category: {category}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Price: Rs.{p.purchase_price || p.cost_price || 0}
                              </Typography>
                              <Typography variant="caption" color={stock > 10 ? 'success.main' : stock > 5 ? 'warning.main' : 'error.main'}>
                                Stock: {stock}
                              </Typography>
                            </Box>
                          </Box>
                          {stock <= 5 && (
                            <Warning fontSize="small" color="warning" sx={{ ml: 0.5, fontSize: 14 }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa', borderRadius: 1, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {categoryFilter ? `No products available in "${categoryFilter}" category` : 'No stock products available'}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField 
                    size="small" 
                    placeholder="External Part Name" 
                    value={extPart.name} 
                    onChange={e => setExtPart({...extPart, name: e.target.value})} 
                    sx={{ flex: 2, bgcolor: 'white' }} 
                  />
                  <TextField 
                    size="small" 
                    type="number" 
                    placeholder="Cost (Rs.)" 
                    value={extPart.cost} 
                    onChange={e => setExtPart({...extPart, cost: e.target.value})} 
                    sx={{ flex: 1, bgcolor: 'white' }} 
                  />
                  <Button variant="outlined" size="small" onClick={addExternalPart} sx={{ textTransform: 'none' }}>
                    Add Ext.
                  </Button>
                </Box>

                {selectedParts.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Selected Parts ({selectedParts.length})
                    </Typography>
                    {selectedParts.map((p, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #e0e0e0' }}>
                        <Chip size="small" label={p.is_external ? 'Market' : 'Stock'} color={p.is_external ? 'warning' : 'success'} sx={{ fontSize: '0.55rem', height: 18 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                          {p.category && !p.is_external && (
                            <Typography variant="caption" color="primary.main">{p.category}</Typography>
                          )}
                        </Box>
                        <TextField 
                          type="number" 
                          size="small" 
                          value={p.cost} 
                          onChange={e => setSelectedParts(selectedParts.map(sp => sp.part_id === p.part_id ? {...sp, cost: Number(e.target.value)} : sp))} 
                          sx={{ width: 85 }} 
                          label="Price" 
                        />
                        <TextField 
                          type="number" 
                          size="small" 
                          value={p.quantity} 
                          onChange={e => updatePartQty(p.part_id, e.target.value)} 
                          sx={{ width: 65 }} 
                          label="Qty" 
                          inputProps={{ min: 1 }} 
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                          = Rs.{Number(p.cost) * Number(p.quantity)}
                        </Typography>
                        <IconButton size="small" color="error" onClick={() => updatePartQty(p.part_id, 0)}>
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fafafa' }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
            {editingItem ? 'Update Order' : 'Create Order'}
          </Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== SERVICE FORM ====================
  const ServiceForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      description: editingItem?.description || '',
      base_price: editingItem?.base_price || '',
      estimated_time: editingItem?.estimated_time || '',
      status: editingItem?.status || 'active'
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = { ...form, base_price: Number(form.base_price) || 0 };
        if (editingItem && db.updateService) await db.updateService(editingItem.id, payload);
        else if (db.createService) await db.createService(payload);
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Service saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>
          {editingItem ? 'Edit Service' : 'Add Service'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Service Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Base Price (Rs.)" type="number" value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Estimated Time" value={form.estimated_time} onChange={e => setForm({...form, estimated_time: e.target.value})} placeholder="e.g. 1 hour" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>Save</Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== STAFF FORM ====================
  const StaffForm = () => {
    const [form, setForm] = useState({
      name: editingItem?.name || '',
      phone: editingItem?.phone || '',
      role: editingItem?.role || 'technician',
      salary_type: editingItem?.salary_type || 'monthly',
      base_salary: editingItem?.base_salary || 0,
      commission_rate: editingItem?.commission_rate || 0,
      per_job_rate: editingItem?.per_job_rate || 0,
      active: editingItem?.active !== false,
      total_commission: editingItem?.total_commission || 0
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = { 
          ...form,
          base_salary: Number(form.base_salary) || 0,
          commission_rate: Number(form.commission_rate) || 0,
          per_job_rate: Number(form.per_job_rate) || 0
        };
        if (editingItem) {
          if (!payload.total_commission) {
            payload.total_commission = editingItem.total_commission || 0;
          }
          if (db.updateStaff) await db.updateStaff(editingItem.id, payload);
        } else {
          payload.total_commission = 0;
          if (db.createStaff) await db.createStaff(payload);
        }
        await loadAll();
        closeModal();
        setSnackbar({ open: true, message: 'Staff saved successfully!', severity: 'success' });
      } catch (err) { 
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>
          {editingItem ? 'Edit Staff' : 'Add Staff'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Staff Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Phone Number" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={form.role} onChange={e => setForm({...form, role: e.target.value})} label="Role">
                  {ROLES.map(r => <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Compensation / Salary Model</InputLabel>
                <Select value={form.salary_type} onChange={e => setForm({...form, salary_type: e.target.value})} label="Compensation / Salary Model">
                  <MenuItem value="monthly">Monthly Fixed Salary</MenuItem>
                  <MenuItem value="commission">Commission % on Repairs</MenuItem>
                  <MenuItem value="per_job">Flat Rate Per Repair Job</MenuItem>
                  <MenuItem value="hybrid">Hybrid (Monthly Salary + Commission %)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {(form.salary_type === 'monthly' || form.salary_type === 'hybrid') && (
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Base Monthly Salary (Rs.)" type="number" value={form.base_salary} onChange={e => setForm({...form, base_salary: e.target.value})} />
              </Grid>
            )}

            {(form.salary_type === 'commission' || form.salary_type === 'hybrid') && (
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Commission Rate (%)" 
                  type="number" 
                  value={form.commission_rate} 
                  onChange={e => setForm({...form, commission_rate: e.target.value})}
                  helperText="Order complete hone par auto-calculate hoga"
                />
              </Grid>
            )}

            {form.salary_type === 'per_job' && (
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Per Repair Job Rate (Rs.)" 
                  type="number" 
                  value={form.per_job_rate} 
                  onChange={e => setForm({...form, per_job_rate: e.target.value})}
                  helperText="Har repair job par fixed payment (e.g. Rs. 200 per phone)"
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                size="small" 
                label="Total Commission Earned (Auto)" 
                type="number" 
                value={form.total_commission} 
                disabled
                helperText="Auto-calculated from completed orders"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Commission automatically adds when orders complete">
                        <Info fontSize="small" color="success" />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #10b981' }}>
                <Typography variant="caption" color="success.main" fontWeight={600}>
                  Compensation Rules:
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  • <strong>Monthly:</strong> Fixed monthly base salary payable to the staff.
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  • <strong>Commission:</strong> Percentage of total repair bill on every completed order.
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  • <strong>Per Job:</strong> Fixed amount per repaired device.
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  • <strong>Hybrid:</strong> Fixed monthly salary + percentage commission per repair.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeModal} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981' }}>Save</Button>
        </DialogActions>
      </form>
    );
  };

  // ==================== REPORTS TAB ====================
  const ReportsTab = () => {
    const [reportDateFrom, setReportDateFrom] = useState('');
    const [reportDateTo, setReportDateTo] = useState('');
    const [reportStatusFilter, setReportStatusFilter] = useState('');
    const [reportStaffFilter, setReportStaffFilter] = useState('');

    const filteredReportOrders = useMemo(() => {
      return workOrders.filter(w => {
        if (reportStatusFilter && w.status !== reportStatusFilter) return false;
        if (reportStaffFilter && String(w.staff_id) !== String(reportStaffFilter)) return false;
        const orderDate = (w.booking_date || w.created_at || '').substring(0, 10);
        if (reportDateFrom && orderDate < reportDateFrom) return false;
        if (reportDateTo && orderDate > reportDateTo) return false;
        return true;
      });
    }, [workOrders, reportStatusFilter, reportStaffFilter, reportDateFrom, reportDateTo]);

    const totalOrders = filteredReportOrders.length;
    const completedOrders = filteredReportOrders.filter(w => w.status === 'completed');
    const pendingOrders = filteredReportOrders.filter(w => w.status === 'pending');
    const inProgressOrders = filteredReportOrders.filter(w => w.status === 'in-progress');
    const cancelledOrders = filteredReportOrders.filter(w => w.status === 'cancelled');
    
    const totalRevenue = filteredReportOrders.reduce((sum, w) => sum + (Number(w.total_cost) || 0), 0);
    const totalCommission = filteredReportOrders.reduce((sum, w) => sum + (Number(w.commission_amount) || 0), 0);
    const totalAdvance = filteredReportOrders.reduce((sum, w) => sum + (Number(w.advance_amount) || 0), 0);
    const totalDue = totalRevenue - totalAdvance;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0;

    const revenueByStatus = {
      pending: filteredReportOrders.filter(w => w.status === 'pending').reduce((sum, w) => sum + (Number(w.total_cost) || 0), 0),
      'in-progress': filteredReportOrders.filter(w => w.status === 'in-progress').reduce((sum, w) => sum + (Number(w.total_cost) || 0), 0),
      completed: filteredReportOrders.filter(w => w.status === 'completed').reduce((sum, w) => sum + (Number(w.total_cost) || 0), 0),
      cancelled: filteredReportOrders.filter(w => w.status === 'cancelled').reduce((sum, w) => sum + (Number(w.total_cost) || 0), 0)
    };

    const exportWorkshopPDF = () => {
      try {
        const doc = new jsPDF('l', 'mm', 'a4');
        const shop = JSON.parse(localStorage.getItem('shop_profile') || '{}');
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(16, 185, 129);
        doc.text(shop.name || 'Raath Workshop & Mobile Repair', 14, 18);
        
        doc.setFontSize(11);
        doc.setTextColor(50);
        doc.text('Workshop Service & Repair Report', 14, 25);
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        const filterInfo = `Period: ${reportDateFrom || 'All'} to ${reportDateTo || 'All'} | Status: ${reportStatusFilter || 'All'} | Technician: ${reportStaffFilter ? (staffList.find(s => String(s.id) === String(reportStaffFilter))?.name || 'Selected') : 'All'} | Generated: ${new Date().toLocaleString()}`;
        doc.text(filterInfo, 14, 31);
        
        // Summary KPI Box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 35, 269, 14, 2, 2, 'FD');
        doc.setFontSize(9);
        doc.setTextColor(30);
        doc.text(`Total Orders: ${totalOrders}   |   Completed: ${completedOrders.length}   |   Total Revenue: Rs. ${totalRevenue.toLocaleString()}   |   Advance: Rs. ${totalAdvance.toLocaleString()}   |   Total Due: Rs. ${totalDue.toLocaleString()}`, 18, 44);

        // Table
        const tableData = filteredReportOrders.map((o, idx) => [
          idx + 1,
          o.token_no || ('TKN-' + o.id),
          o.device_model || o.machine_name || 'N/A',
          o.customer_name || 'Walk-in',
          o.staff_name || '—',
          (o.status || 'pending').toUpperCase(),
          `Rs. ${o.total_cost || 0}`,
          `Rs. ${o.advance_amount || 0}`,
          `Rs. ${(Number(o.total_cost) || 0) - (Number(o.advance_amount) || 0)}`,
          (o.booking_date || o.created_at || '').substring(0, 10)
        ]);

        autoTable(doc, {
          startY: 53,
          head: [['#', 'Token #', 'Device', 'Customer', 'Technician', 'Status', 'Total Cost', 'Advance', 'Due', 'Date']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 26 },
            2: { cellWidth: 35 },
            3: { cellWidth: 32 },
            4: { cellWidth: 28 },
            5: { cellWidth: 24 },
            6: { cellWidth: 26, halign: 'right' },
            7: { cellWidth: 26, halign: 'right' },
            8: { cellWidth: 26, halign: 'right' },
            9: { cellWidth: 25 }
          }
        });

        doc.save(`Workshop_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        setSnackbar({ open: true, message: 'PDF report downloaded successfully!', severity: 'success' });
      } catch (err) {
        console.error('PDF export error:', err);
        setSnackbar({ open: true, message: 'Failed to export PDF: ' + err.message, severity: 'error' });
      }
    };

    const statCards = [
      { label: 'Total Revenue', value: `Rs. ${totalRevenue.toLocaleString()}`, icon: <TrendingUp />, color: '#10b981' },
      { label: 'Total Orders', value: totalOrders, icon: <Receipt />, color: '#3b82f6' },
      { label: 'Completed', value: completedOrders.length, icon: <CheckCircle />, color: '#10b981' },
      { label: 'Pending', value: pendingOrders.length, icon: <Schedule />, color: '#f59e0b' },
      { label: 'In Progress', value: inProgressOrders.length, icon: <Build />, color: '#3b82f6' },
      { label: 'Cancelled', value: cancelledOrders.length, icon: <Cancel />, color: '#ef4444' },
      { label: 'Total Commission', value: `Rs. ${totalCommission.toLocaleString()}`, icon: <Payment />, color: '#8b5cf6' },
      { label: 'Total Advance', value: `Rs. ${totalAdvance.toLocaleString()}`, icon: <Payment />, color: '#06b6d4' },
      { label: 'Total Due', value: `Rs. ${totalDue.toLocaleString()}`, icon: <Payment />, color: '#ef4444' },
      { label: 'Completion Rate', value: `${completionRate}%`, icon: <TrendingUp />, color: '#10b981' }
    ];

    return (
      <Box>
        {/* INTERACTIVE FILTERS & PDF EXPORT */}
        <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" /> Workshop Analytics & Reports
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Print />}
              onClick={exportWorkshopPDF}
              sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              Export Workshop PDF Report
            </Button>
          </Box>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                fullWidth size="small" 
                label="From Date" 
                type="date" 
                value={reportDateFrom} 
                onChange={e => setReportDateFrom(e.target.value)} 
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                fullWidth size="small" 
                label="To Date" 
                type="date" 
                value={reportDateTo} 
                onChange={e => setReportDateTo(e.target.value)} 
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                <InputLabel>Status Filter</InputLabel>
                <Select value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value)} label="Status Filter">
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                <InputLabel>Technician</InputLabel>
                <Select value={reportStaffFilter} onChange={e => setReportStaffFilter(e.target.value)} label="Technician">
                  <MenuItem value="">All Technicians</MenuItem>
                  {staffList.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.role})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12} md={1}>
              <Button 
                fullWidth 
                variant="outlined" 
                size="small" 
                onClick={() => { setReportDateFrom(''); setReportDateTo(''); setReportStatusFilter(''); setReportStaffFilter(''); }}
                sx={{ height: 40, borderRadius: 1 }}
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statCards.map((stat, idx) => (
            <Grid item xs={6} sm={4} md={3} lg={2.4} key={idx}>
              <Paper sx={{ p: 2, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ 
                  bgcolor: `${stat.color}15`, 
                  borderRadius: '50%', 
                  p: 0.8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: stat.color,
                  mb: 0.5
                }}>
                  {stat.icon}
                </Box>
                <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Revenue Breakdown by Status</Typography>
          <Grid container spacing={3}>
            {Object.entries(revenueByStatus).map(([status, amount]) => {
              const config = STATUS_CONFIG[status] || { label: status, color: 'default' };
              return (
                <Grid item xs={6} sm={3} key={status}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip size="small" label={config.label} color={config.color} sx={{ fontWeight: 500 }} />
                    <Typography variant="body2" fontWeight={600}>Rs. {amount.toLocaleString()}</Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Staff Performance</Typography>
          {reportData.staffPerformance.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No staff data available</Typography>
          ) : (
            <Grid container spacing={2}>
              {reportData.staffPerformance.map((staff, idx) => (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#10b981', fontWeight: 700 }}>{staff.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{staff.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {staff.role} {staff.salary_type ? `• ${staff.salary_type}` : ''}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 1.5 }} />
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">Orders:</Typography>
                      <Typography variant="body2" fontWeight={500}>{staff.totalOrders}</Typography>
                      <Typography variant="body2" color="text.secondary">Completed:</Typography>
                      <Typography variant="body2" fontWeight={500} color="success.main">{staff.completedOrders}</Typography>
                      <Typography variant="body2" color="text.secondary">Commission:</Typography>
                      <Typography variant="body2" fontWeight={500} color="primary.main">Rs. {staff.totalCommission}</Typography>
                      <Typography variant="body2" color="text.secondary">Revenue:</Typography>
                      <Typography variant="body2" fontWeight={500}>Rs. {staff.totalRevenue}</Typography>
                      <Typography variant="body2" color="text.secondary">Total Payout:</Typography>
                      <Typography variant="body2" fontWeight={700} color="#10b981">Rs. {staff.totalPayout}</Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Filtered Repair Orders ({filteredReportOrders.length})
          </Typography>
          {filteredReportOrders.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No orders match the selected filters</Typography>
          ) : (
            <Stack spacing={1.5}>
              {filteredReportOrders.slice(0, 20).map(order => {
                const staff = staffList.find(s => String(s.id) === String(order.staff_id));
                const dueAmount = (Number(order.total_cost) || 0) - (Number(order.advance_amount) || 0);
                
                return (
                  <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>{order.token_no || ('#' + order.id)}</Typography>
                        <Typography variant="body2">{order.device_model || order.machine_name}</Typography>
                        <Chip size="small" label={order.payment_status === 'paid' ? 'Paid' : 'Unpaid'} color={order.payment_status === 'paid' ? 'success' : 'error'} sx={{ height: 20, fontSize: '0.6rem' }} />
                        <Chip size="small" label={(order.status || 'pending').toUpperCase()} color={STATUS_CONFIG[order.status]?.color || 'default'} sx={{ height: 20, fontSize: '0.6rem' }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Customer: <strong>{order.customer_name || 'Walk-in'}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Tech: <strong>{order.staff_name || '—'}</strong>
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          Rs. {order.total_cost || 0}
                        </Typography>
                        <Tooltip title="Print Token">
                          <IconButton size="small" sx={{ color: '#10b981' }} onClick={() => printBookingToken(order)}>
                            <ReceiptLong fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Bill">
                          <IconButton size="small" color="primary" onClick={() => printBill(order, staffList)}>
                            <Print fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {order.commission_amount > 0 && (
                      <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.5 }}>
                        Commission: Rs. {order.commission_amount} 
                        {staff && ` (${staff.commission_rate || 0}%)`}
                      </Typography>
                    )}
                    {dueAmount > 0 && (
                      <Typography variant="caption" color="error" display="block">
                        Due: Rs. {dueAmount} | Advance: Rs. {order.advance_amount || 0}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>
    );
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      pb: { xs: 10, sm: 4 }, 
      maxWidth: 1400, 
      mx: 'auto',
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      '&::-webkit-scrollbar': { width: '8px' },
      '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
      '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
    }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700} color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Smartphone color="primary" /> Mobile Repair & Workshop
        </Typography>
        <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={loadAll} sx={{ borderRadius: 2 }}>
          Refresh
        </Button>
      </Box>

      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} elevation={1}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Build fontSize="small" />} iconPosition="start" label={`Work Orders (${workOrders.length})`} value="workorders" sx={{ fontWeight: 600 }} />
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label={`Services (${services.length})`} value="services" sx={{ fontWeight: 600 }} />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label={`Staff & Payroll`} value="staff" sx={{ fontWeight: 600 }} />
          <Tab icon={<Assessment fontSize="small" />} iconPosition="start" label="Reports" value="reports" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {activeTab === 'workorders' && (
          <>
            <Button variant="contained" startIcon={<Add />} onClick={() => openModal('workorder')} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: 2 }}>
              New Repair Order
            </Button>
            <TextField size="small" placeholder="Search by model, IMEI, customer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} sx={{ flex: 1, minWidth: 220, bgcolor: 'background.paper', borderRadius: 2 }} />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
        {activeTab === 'services' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('service')} sx={{ bgcolor: '#10b981', borderRadius: 2 }}>Add Service</Button>}
        {activeTab === 'staff' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('staff')} sx={{ bgcolor: '#10b981', borderRadius: 2 }}>Add Staff</Button>}
        {activeTab === 'reports' && (
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadAll} sx={{ borderRadius: 2 }}>
            Refresh Report
          </Button>
        )}
      </Box>

      {loading && <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>}

      {!loading && activeTab === 'workorders' && (
        <Grid container spacing={2.5}>
          {filteredWorkOrders.length === 0 ? (
            <Grid item xs={12}><Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}><Typography color="text.secondary">No repair orders found</Typography></Paper></Grid>
          ) : (
            filteredWorkOrders.map(wo => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={wo.id}>
                <WorkOrderCard 
                  wo={wo} 
                  onEdit={(item) => openModal('workorder', item)} 
                  onDelete={(id) => handleDelete('workorder', id)} 
                  onStatusChange={updateWorkOrderStatus} 
                  onViewHistory={openCustomerHistory}
                  onPrint={(order) => printBill(order, staffList)}
                  onPrintToken={(order) => printBookingToken(order)}
                />
              </Grid>
            ))
          )}
        </Grid>
      )}

      {!loading && activeTab === 'services' && (
        <Grid container spacing={2.5}>
          {services.map(s => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
              <Card sx={{ height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{s.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>{s.description || 'No description provided'}</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight={700}>Rs. {s.base_price}</Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" sx={{ flex: 1 }} onClick={() => openModal('service', s)}>Edit</Button>
                  <Button size="small" variant="outlined" color="error" sx={{ flex: 1 }} onClick={() => handleDelete('service', s.id)}>Delete</Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && activeTab === 'staff' && (
        <Grid container spacing={2.5}>
          {staffList.map(s => {
            const staffOrders = workOrders.filter(w => String(w.staff_id) === String(s.id) && w.status === 'completed');
            const calculatedCommission = staffOrders.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0);
            const totalPayable = (Number(s.base_salary) || 0) + calculatedCommission;

            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                <Card sx={{ height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: '#10b981', fontWeight: 700 }}>{s.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{s.role}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack spacing={0.8}>
                      <Typography variant="body2" color="text.secondary">Base Salary: <strong>Rs. {s.base_salary || 0}</strong></Typography>
                      <Typography variant="body2" color="text.secondary">Commission Rate: <strong>{s.commission_rate || 0}%</strong></Typography>
                      <Typography variant="body2" color="success.main" fontWeight={500}>Completed Jobs: {staffOrders.length}</Typography>
                      <Typography variant="body2" color="primary.main" fontWeight={500}>Total Commission: Rs. {calculatedCommission}</Typography>
                    </Stack>
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" color="text.secondary">Total Payout</Typography>
                      <Typography variant="h6" fontWeight={700} color="primary.main">Rs. {totalPayable}</Typography>
                    </Box>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button size="small" variant="outlined" fullWidth onClick={() => openModal('staff', s)}>Edit Profile</Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {!loading && activeTab === 'reports' && <ReportsTab />}

      {/* CUSTOMER HISTORY DIALOG */}
      <Dialog open={customerHistory.open} onClose={() => setCustomerHistory({ open: false, customer: null, orders: [] })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600 }}>Customer Repair History</DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          {customerHistory.customer && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>{customerHistory.customer.name}</Typography>
              <Typography variant="body2" color="text.secondary">Phone: {customerHistory.customer.phone}</Typography>
            </Box>
          )}
          <Divider sx={{ mb: 2 }} />
          {customerHistory.orders.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No previous repairs recorded.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {customerHistory.orders.map(o => {
                const totalPartsCost = o.parts_used?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0;
                const serviceFee = o.total_cost - totalPartsCost;
                const dueAmount = o.total_cost - (o.advance_amount || 0);
                
                return (
                  <Paper key={o.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>{o.device_model}</Typography>
                      <Chip size="small" label={o.status} color={o.status === 'completed' ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.6rem' }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fault: {o.problem_description || '—'}</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                      Service Fee: Rs.{serviceFee} | Parts: Rs.{totalPartsCost}
                    </Typography>
                    <Typography variant="body2" color="primary.main" fontWeight={700}>Total: Rs. {o.total_cost}</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Advance: Rs.{o.advance_amount || 0}</Typography>
                      <Typography variant="caption" color={dueAmount > 0 ? 'error' : 'success'}>
                        Due: Rs.{dueAmount}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Payment: {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'} ({o.payment_mode?.toUpperCase() || 'PENDING'})
                    </Typography>
                    {o.commission_amount > 0 && (
                      <Typography variant="caption" color="success.main" display="block">
                        Staff Commission: Rs. {o.commission_amount}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCustomerHistory({ open: false, customer: null, orders: [] })} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      {/* STOCK ALERT DIALOG */}
      <Dialog open={stockAlert.open} onClose={() => setStockAlert({ open: false, message: '', parts: [] })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Check /> Stock Deducted Successfully
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            The following parts have been deducted from inventory:
          </Alert>
          <Stack spacing={1.5}>
            {stockAlert.parts.map((part, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>{part.name}</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Before: <strong>{part.before}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Used: <strong style={{ color: '#ef4444' }}>{part.used}</strong>
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    After: <strong>{part.after}</strong>
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setStockAlert({ open: false, message: '', parts: [] })} variant="contained" sx={{ bgcolor: '#10b981' }}>
            OK, Got it!
          </Button>
        </DialogActions>
      </Dialog>

      {/* GENERAL MODAL */}
      <Dialog 
        open={showModal} 
        onClose={closeModal} 
        maxWidth="md" 
        fullWidth 
        fullScreen={isMobile} 
        PaperProps={{ 
          sx: { 
            borderRadius: { xs: 0, sm: 2 },
            maxHeight: { xs: '100vh', sm: '90vh' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          } 
        }}
      >
        {modalType === 'workorder' && <WorkOrderForm />}
        {modalType === 'service' && <ServiceForm />}
        {modalType === 'staff' && <StaffForm />}
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}