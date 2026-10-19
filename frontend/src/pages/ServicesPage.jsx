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
import RepairJobCardModal from '../components/mobile/RepairJobCardModal';
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
  const rawParts = order.parts_used;
  const partsUsed = Array.isArray(rawParts) 
    ? rawParts 
    : (typeof rawParts === 'string' ? (() => { try { return JSON.parse(rawParts); } catch (_) { return []; } })() : []);
  
  const billablePartsCost = partsUsed.reduce((sum, p) => {
    if (p.is_included) return sum;
    return sum + (Number(p.cost || 0) * Number(p.quantity || 1));
  }, 0);
  const grandTotal = Number(order.total_cost || 0);
  
  const serviceFee = order.service_fee !== undefined && order.service_fee !== null 
    ? Number(order.service_fee) 
    : (order.labor_amount !== undefined && order.labor_amount !== null ? Number(order.labor_amount) : Math.max(0, grandTotal - billablePartsCost));

  const totalPaid = Number(order.paid_amount !== undefined && order.paid_amount !== null ? order.paid_amount : (order.advance_amount || 0));
  const dueAmount = Math.max(0, grandTotal - totalPaid);

  const items = [];
  if (serviceFee > 0 || partsUsed.length === 0) {
    items.push({
      name: `Service: ${order.service_name || 'Repair Service'}`,
      title: `Service: ${order.service_name || 'Repair Service'}`,
      qty: 1,
      quantity: 1,
      price: serviceFee > 0 ? serviceFee : grandTotal,
      total: serviceFee > 0 ? serviceFee : grandTotal
    });
  }

  partsUsed.forEach(p => {
    const pName = p.name || p.product_name || 'Part';
    const isInc = Boolean(p.is_included);
    items.push({
      name: `Part: ${pName}${p.is_external ? ' (Market)' : ' (Stock)'}${isInc ? ' [Package Included]' : ''}`,
      title: `Part: ${pName}${p.is_external ? ' (Market)' : ' (Stock)'}${isInc ? ' [Package Included]' : ''}`,
      qty: Number(p.quantity || 1),
      quantity: Number(p.quantity || 1),
      price: isInc ? 0 : Number(p.cost || 0),
      total: isInc ? 0 : (Number(p.cost || 0) * Number(p.quantity || 1))
    });
  });

  const serviceDetails = {
    customer_name: order.customer_name || 'Walk-in Customer',
    customer_phone: order.customer_phone || '',
    device_model: order.device_model || order.machine_name || 'N/A',
    imei: order.imei || '',
    problem_description: order.problem_description || '',
    service_name: order.service_name || 'Repair Service',
    staff_name: order.staff_name || (staff ? staff.name : ''),
    parts_used: partsUsed,
    service_fee: serviceFee,
    advance_amount: Number(order.advance_amount || 0),
    paid_amount: totalPaid,
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
          paid_amount: totalPaid,
          due_amount: dueAmount,
          payment_mode: order.payment_mode || (dueAmount <= 0 ? 'PAID' : 'PENDING'),
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
  
  // 1. Load exact Shop Profile and Settings from all storage sources
  let shop = {};
  try {
    const rawShop = localStorage.getItem('shop_profile');
    if (rawShop) shop = JSON.parse(rawShop);
  } catch (_) {}

  let currentUser = {};
  try {
    const rawUser = localStorage.getItem('current_user');
    if (rawUser) currentUser = JSON.parse(rawUser);
  } catch (_) {}

  const settings = getEffectiveReceiptSettings();
  const fallbackShop = getEffectiveShopProfile();

  const shopName = currentUser.shop_name || shop.name || shop.shopName || fallbackShop.name || 'MOBILE REPAIR & WORKSHOP';
  const shopTagline = shop.tagline || fallbackShop.tagline || '';
  const shopAddress = [shop.address || currentUser.shop_address || fallbackShop.address, shop.city || fallbackShop.city].filter(Boolean).join(', ');
  const shopPhone = currentUser.phone || shop.phone || fallbackShop.phone || '';
  const shopEmail = currentUser.email || shop.email || fallbackShop.email || '';
  const shopWebsite = shop.website || fallbackShop.website || '';
  const shopNTN = shop.taxNumber || shop.registrationNumber || fallbackShop.taxNumber || '';
  const shopLogo = (settings.showLogo !== false && (shop.logoPreview || shop.logo || fallbackShop.logoPreview || fallbackShop.logo)) || null;

  const footerTerms = settings.footerText || shop.receiptFooter || fallbackShop.receiptFooter || 
    "1. Please bring this original token slip at the time of delivery.\n2. Devices not claimed within 30 days are not the responsibility of the shop.\n3. Backup your data before giving the device. Shop is not liable for data loss.";
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
        ${shopLogo ? `<div style="margin-bottom: 4px;"><img src="${shopLogo}" style="max-height: 48px; max-width: 140px; object-fit: contain;" alt="Logo" /></div>` : ''}
        <div class="title">${shopName}</div>
        ${shopTagline ? `<div class="subtitle" style="font-style: italic; font-weight: 500; margin-bottom: 2px;">${shopTagline}</div>` : ''}
        ${shopAddress ? `<div class="subtitle">${shopAddress}</div>` : ''}
        ${shopPhone ? `<div class="subtitle"><strong>Tel:</strong> ${shopPhone}</div>` : ''}
        ${[shopEmail ? 'Email: ' + shopEmail : '', shopWebsite].filter(Boolean).length > 0 ? `<div style="font-size: 8.5px; margin-bottom: 2px;">${[shopEmail ? 'Email: ' + shopEmail : '', shopWebsite].filter(Boolean).join(' | ')}</div>` : ''}
        ${shopNTN ? `<div style="font-size: 8.5px; margin-bottom: 2px;"><strong>NTN:</strong> ${shopNTN}</div>` : ''}
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

      <div class="row"><span class="label">Est. Total Amount:</span> <span>Rs. ${order.total_cost || order.service_fee || 0}</span></div>
      <div class="row"><span class="label">Advance Paid:</span> <span class="bold">Rs. ${order.advance_amount || 0}</span></div>
      <div class="row"><span class="label">Remaining Due:</span> <span class="bold">Rs. ${Math.max(0, (Number(order.total_cost || order.service_fee || 0)) - (Number(order.advance_amount || 0)))}</span></div>
      <div class="row"><span class="label">Payment Mode:</span> <span>${(order.payment_mode || 'Cash').toUpperCase()}</span></div>

      <div class="divider"></div>

      <div class="terms">
        <strong>Terms & Conditions:</strong><br>
        ${footerTerms.split('\n').filter(Boolean).map((t, idx) => `<div>${t.match(/^\d+[\.\)]/) ? t : (idx + 1) + '. ' + t}</div>`).join('')}
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
const WorkOrderCard = ({ wo, onEdit, onDelete, onStatusChange, onViewHistory, onPrint, onPrintToken, onAssignRepair, onDeliverSettle }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending;
  
  const totalPaid = Number(wo.paid_amount !== undefined && wo.paid_amount !== null ? wo.paid_amount : (wo.advance_amount || 0));
  const dueAmount = Math.max(0, Number(wo.total_cost || 0) - totalPaid);
  const paymentColor = dueAmount <= 0 && Number(wo.total_cost || 0) > 0 ? 'success' : (totalPaid > 0 ? 'info' : 'error');
  const paymentLabel = dueAmount <= 0 && Number(wo.total_cost || 0) > 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'UNPAID');

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const billablePartsCost = useMemo(() => {
    if (!wo.parts_used || wo.parts_used.length === 0) return 0;
    return wo.parts_used.reduce((sum, p) => {
      if (p.is_included) return sum;
      return sum + (Number(p.cost || 0) * Number(p.quantity || 1));
    }, 0);
  }, [wo.parts_used]);

  const includedPartsCost = useMemo(() => {
    if (!wo.parts_used || wo.parts_used.length === 0) return 0;
    return wo.parts_used.reduce((sum, p) => {
      if (!p.is_included) return sum;
      return sum + (Number(p.cost || 0) * Number(p.quantity || 1));
    }, 0);
  }, [wo.parts_used]);

  const serviceFee = Number(
    wo.service_fee !== undefined && wo.service_fee !== null 
      ? wo.service_fee 
      : (wo.labor_amount !== undefined && wo.labor_amount !== null 
          ? wo.labor_amount 
          : Math.max(0, (Number(wo.total_cost) || 0) - billablePartsCost))
  );

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
          status.color === 'info' ? '#1c2580' : 
          status.color === 'success' ? '#10b981' : '#ef4444'
        }` 
      }}
    >
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {(wo.token_no || wo.order_number) && (
                <Chip size="small" label={wo.token_no || wo.order_number} sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
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
            <Typography variant="body2" color="text.secondary"><strong>Service:</strong> {wo.service_name || 'General Repair'}</Typography>
            <Typography variant="body2" color="text.secondary"><strong>Technician:</strong> {wo.staff_name || 'Unassigned'}</Typography>
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
              <Payment fontSize="inherit" /> <strong>Mode:</strong> {wo.payment_mode ? wo.payment_mode.toUpperCase() : 'CASH'}
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
                        label={`${p.name} (${p.is_external ? 'Market' : 'Stock'}${p.is_included ? ' - Pkg' : ''}) ×${p.quantity} = Rs.${p.is_included ? 0 : Number(p.cost) * Number(p.quantity)}`} 
                        variant={p.is_included ? "filled" : "outlined"}
                        color={p.is_included ? "success" : "default"}
                        sx={{ fontSize: '0.62rem', height: 20, fontWeight: 500 }} 
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
                  Service / Labor: <strong>Rs. {serviceFee}</strong>
                </Typography>
                {billablePartsCost > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Extra Parts: <strong>Rs. {billablePartsCost}</strong>
                  </Typography>
                )}
                {includedPartsCost > 0 && (
                  <Typography variant="caption" color="success.main" display="block">
                    Package Parts (Stock): Rs. {includedPartsCost} (Rs. 0 billed)
                  </Typography>
                )}
                <Typography variant="subtitle2" color="primary.main" fontWeight={700} sx={{ mt: 0.5 }}>
                  Total: Rs. {wo.total_cost || 0}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: '#f0fdf4', p: 1.5, borderRadius: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Payment fontSize="small" /> Payment Status
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Advance: <strong>Rs. {wo.advance_amount || wo.paid_amount || 0}</strong>
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
          {/* Total Cost Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Cost</Typography>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Rs. {wo.total_cost || 0}</Typography>
          </Box>

          {/* Main Action Button Row */}
          <Box sx={{ mb: 1.2 }}>
            {wo.status === 'pending' && (
              <Button
                fullWidth
                size="small"
                variant="contained"
                startIcon={<Build fontSize="small" />}
                onClick={() => onAssignRepair(wo)}
                sx={{
                  py: 0.8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#1c2580',
                  '&:hover': { bgcolor: '#151c60' }
                }}
              >
                Add to Repairing
              </Button>
            )}

            {wo.status === 'in-progress' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Build fontSize="small" />}
                  onClick={() => onAssignRepair(wo)}
                  sx={{
                    flex: 1,
                    py: 0.7,
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderColor: '#1c2580',
                    color: '#1c2580'
                  }}
                >
                  Parts / Tech
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Payment fontSize="small" />}
                  onClick={() => onDeliverSettle(wo)}
                  sx={{
                    flex: 1.3,
                    py: 0.7,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    bgcolor: '#10b981',
                    '&:hover': { bgcolor: '#059669' }
                  }}
                >
                  {dueAmount > 0 ? `Deliver & Collect (Rs. ${dueAmount})` : 'Deliver & Complete'}
                </Button>
              </Box>
            )}

            {wo.status === 'completed' && (
              dueAmount > 0 ? (
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  startIcon={<Payment fontSize="small" />}
                  onClick={() => onDeliverSettle(wo)}
                  sx={{
                    py: 0.8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    bgcolor: '#f59e0b',
                    '&:hover': { bgcolor: '#d97706' }
                  }}
                >
                  Deliver & Collect Balance (Rs. {dueAmount})
                </Button>
              ) : (
                <Box sx={{ p: 0.8, textAlign: 'center', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
                  <CheckCircle sx={{ color: '#16a34a', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 700 }}>
                    Completed & Fully Paid
                  </Typography>
                </Box>
              )
            )}

            {wo.status === 'cancelled' && (
              <Chip label="Cancelled" color="error" size="small" sx={{ fontWeight: 600, width: '100%' }} />
            )}
          </Box>

          {/* Action Icons Utility Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.8, borderTop: '1px dashed #e2e8f0' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Print Customer Token Slip">
                <IconButton size="small" sx={{ color: '#10b981' }} onClick={() => onPrintToken(wo)}>
                  <ReceiptLong fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print Bill">
                <IconButton size="small" color="primary" onClick={() => onPrint(wo)}>
                  <Print fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit Order">
                <IconButton size="small" color="primary" onClick={() => onEdit(wo)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Order">
                <IconButton size="small" color="error" onClick={() => onDelete(wo.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={expanded ? "Less details" : "More details"}>
                <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                  {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
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
  const [accounts, setAccounts] = useState([]);
  const [customerHistory, setCustomerHistory] = useState({ open: false, customer: null, orders: [] });
  const [stockAlert, setStockAlert] = useState({ open: false, message: '', parts: [] });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: null, id: null });
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [assignRepairOrder, setAssignRepairOrder] = useState(null);
  const [deliverSettleOrder, setDeliverSettleOrder] = useState(null);
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
      const [wo, sv, st, cu, pr, cat, accs] = await Promise.all([
        db.getWorkOrders ? db.getWorkOrders() : [],
        db.getServices ? db.getServices() : [],
        db.getStaff ? db.getStaff() : [],
        db.getCustomers ? db.getCustomers() : [],
        db.getAllVariants ? db.getAllVariants() : [],
        db.getCategories ? db.getCategories() : [],
        db.getAccounts ? db.getAccounts() : []
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
        setAccounts((accs || []).filter(a => !a.is_deleted && a.status !== 'inactive'));
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
    // Use MUI dialog instead of window.confirm (which hangs automated browsers)
    setDeleteConfirm({ open: true, type, id });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;
    setDeleteConfirm({ open: false, type: null, id: null });
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
        
        // ====== 1. CALCULATE AND ADD COMMISSION (Strictly on Labor, NEVER on parts) ======
        const staff = staffList.find(s => String(s.id) === String(order.staff_id));
        
        const rawLabor = order.service_fee !== undefined && order.service_fee !== null 
          ? Number(order.service_fee) 
          : (order.labor_amount !== undefined && order.labor_amount !== null ? Number(order.labor_amount) : Number(order.total_cost || 0));
        
        if (order.commission_amount !== undefined && order.commission_amount !== null && Number(order.commission_amount) >= 0) {
          commissionAmount = Number(order.commission_amount);
        } else if (staff) {
          if (staff.salary_type === 'monthly') {
            commissionAmount = 0;
          } else if (staff.salary_type === 'per_job') {
            commissionAmount = Number(staff.per_job_rate || 0);
          } else if (Number(staff.commission_rate) > 0 && rawLabor > 0) {
            commissionAmount = Math.round((rawLabor * Number(staff.commission_rate)) / 100);
          }
        }
        
        updatePayload.commission_amount = commissionAmount;
        
        if (staff && commissionAmount > 0 && !order.commission_credited) {
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
              updatePayload.commission_credited = 1;
              console.log(`[Services] Commission Rs. ${commissionAmount} added to ${staff.name} (Calculated on Labor: Rs. ${rawLabor})`);
              console.log(`   Total: ${currentTotalCommission} → ${newTotalCommission}`);
            }
          } catch (err) {
            console.error('Commission update error:', err);
          }
        }

        // ====== 2. DEDUCT STOCK FROM VARIANTS ======
        if (order?.parts_used?.length > 0) {
          console.log(`[Services] Processing ${order.parts_used.length} parts...`);
          
          const stockParts = (order.parts_used || []).filter(p => !p.is_external && !p.deducted);
          
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
          
          if (stockDeductions.length > 0) {
            updatePayload.parts_used = (order.parts_used || []).map(p => (!p.is_external ? { ...p, deducted: true } : p));
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

  // ==================== FAST REPAIR INTAKE / WORK ORDER FORM ====================
  const WorkOrderForm = () => {
    // Customer modes: 'walkin' (default, instant), 'existing' (search), 'new' (inline create)
    const [customerMode, setCustomerMode] = useState(
      editingItem?.customer_id ? 'existing' : 'walkin'
    );
    const [selectedCustomer, setSelectedCustomer] = useState(
      customers.find(c => String(c.id) === String(editingItem?.customer_id)) || null
    );

    const [quickServiceModal, setQuickServiceModal] = useState(false);
    const [quickServiceForm, setQuickServiceForm] = useState({ name: '', base_price: '', description: '' });

    const [form, setForm] = useState({
      token_no: editingItem?.token_no || ('TKN-' + Math.floor(100000 + Math.random() * 900000)),
      booking_date: editingItem?.booking_date ? String(editingItem.booking_date).slice(0, 10) : new Date().toISOString().split('T')[0],
      expected_delivery_date: editingItem?.expected_delivery_date ? String(editingItem.expected_delivery_date).slice(0, 10) : '',
      customer_id: editingItem?.customer_id || '',
      customer_name: editingItem?.customer_name || 'Walk-in Customer',
      customer_phone: editingItem?.customer_phone || '',
      customer_address: '',
      device_model: editingItem?.device_model || editingItem?.machine_name || '',
      imei: editingItem?.imei || '',
      problem_description: editingItem?.problem_description || '',
      device_condition: editingItem?.device_condition || editingItem?.condition_notes || '',
      passcode: editingItem?.passcode || editingItem?.passcode_encrypted || '',
      service_id: editingItem?.service_id || '',
      service_fee: editingItem?.service_fee || editingItem?.labor_amount || editingItem?.total_cost || '',
      advance_amount: editingItem?.advance_amount || '',
      payment_mode: editingItem?.payment_mode || 'cash',
      account_id: editingItem?.account_id || '',
      notes: editingItem?.notes || ''
    });

    const [saving, setSaving] = useState(false);

    // Auto-select matching financial account based on payment_mode
    useEffect(() => {
      if (!form.account_id && accounts.length > 0) {
        let match = accounts.find(a => {
          const type = (a.type || '').toLowerCase();
          const name = (a.name || '').toLowerCase();
          if (form.payment_mode === 'cash') return type === 'cash' || name.includes('cash');
          if (form.payment_mode === 'bank') return type === 'bank' || name.includes('bank');
          if (form.payment_mode === 'easypaisa') return name.includes('easypaisa');
          if (form.payment_mode === 'jazzcash') return name.includes('jazzcash');
          return false;
        });
        if (!match) match = accounts[0];
        if (match) {
          setForm(prev => ({ ...prev, account_id: match.id }));
        }
      }
    }, [form.payment_mode, accounts]);

    const estimatedTotal = Number(form.service_fee) || 0;
    const advancePaid = Number(form.advance_amount) || 0;
    const dueAmount = Math.max(0, estimatedTotal - advancePaid);

    const handleCustomerModeChange = (mode) => {
      setCustomerMode(mode);
      if (mode === 'walkin') {
        setSelectedCustomer(null);
        setForm(prev => ({
          ...prev,
          customer_id: '',
          customer_name: 'Walk-in Customer',
          customer_phone: ''
        }));
      } else if (mode === 'new') {
        setSelectedCustomer(null);
        setForm(prev => ({
          ...prev,
          customer_id: '',
          customer_name: '',
          customer_phone: '',
          customer_address: ''
        }));
      }
    };

    const handleSelectExistingCustomer = (cust) => {
      setSelectedCustomer(cust);
      if (cust) {
        setForm(prev => ({
          ...prev,
          customer_id: cust.id,
          customer_name: cust.name || '',
          customer_phone: cust.phone || ''
        }));
      } else {
        setForm(prev => ({
          ...prev,
          customer_id: '',
          customer_name: '',
          customer_phone: ''
        }));
      }
    };

    const handleQuickAddService = async (e) => {
      e.preventDefault();
      if (!quickServiceForm.name.trim()) return;
      try {
        const payload = {
          name: quickServiceForm.name.trim(),
          base_price: Number(quickServiceForm.base_price) || 0,
          description: quickServiceForm.description.trim()
        };
        const res = await db.createService(payload);
        const newS = res?.data || res || { ...payload, id: Date.now() };
        setServices(prev => [...prev, newS]);
        setForm(prev => ({
          ...prev,
          service_id: newS.id,
          service_fee: newS.base_price || prev.service_fee
        }));
        setQuickServiceModal(false);
        setQuickServiceForm({ name: '', base_price: '', description: '' });
        setSnackbar({ open: true, message: `Service "${newS.name}" added and selected!`, severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to add service: ' + err.message, severity: 'error' });
      }
    };

    const handleSave = async (shouldPrintToken = false) => {
      if (!form.device_model.trim()) {
        setSnackbar({ open: true, message: 'Please enter Device Name / Model', severity: 'error' });
        return;
      }
      if (!form.problem_description.trim()) {
        setSnackbar({ open: true, message: 'Please enter Reported Fault / Problem', severity: 'error' });
        return;
      }

      setSaving(true);
      try {
        let finalCustomerId = form.customer_id;
        let finalCustomerName = form.customer_name.trim() || 'Walk-in Customer';
        let finalCustomerPhone = form.customer_phone.trim();

        // If new customer mode, automatically register into customers directory
        if (customerMode === 'new' && finalCustomerName && finalCustomerName !== 'Walk-in Customer') {
          try {
            if (db.createCustomer) {
              const created = await db.createCustomer({
                name: finalCustomerName,
                phone: finalCustomerPhone,
                address: form.customer_address || ''
              });
              if (created && created.id) {
                finalCustomerId = created.id;
              }
            }
          } catch (custErr) {
            console.warn('[Services] Auto customer creation note:', custErr);
          }
        }

        const selectedService = services.find(s => String(s.id) === String(form.service_id));

        const payload = {
          token_no: form.token_no,
          order_number: form.token_no,
          booking_date: form.booking_date,
          expected_delivery_date: form.expected_delivery_date || null,
          customer_id: finalCustomerId || null,
          customer_name: finalCustomerName,
          customer_phone: finalCustomerPhone,
          device_model: form.device_model.trim(),
          machine_name: form.device_model.trim(),
          imei: form.imei ? form.imei.replace(/\D/g, '') : null,
          problem_description: form.problem_description.trim(),
          condition_notes: form.device_condition.trim(),
          device_condition: form.device_condition.trim(),
          passcode: form.passcode.trim(),
          passcode_encrypted: form.passcode.trim(),
          service_id: form.service_id || null,
          service_name: selectedService?.name || 'General Repair',
          service_fee: estimatedTotal,
          labor_amount: estimatedTotal,
          total_cost: estimatedTotal,
          total_amount: estimatedTotal,
          advance_amount: advancePaid,
          paid_amount: advancePaid,
          payment_mode: form.payment_mode,
          status: editingItem?.status || 'pending',
          payment_status: dueAmount <= 0 && estimatedTotal > 0 ? 'paid' : (advancePaid > 0 ? 'partial' : 'unpaid'),
          notes: form.notes
        };

        let savedOrder = null;
        if (editingItem) {
          savedOrder = await db.updateWorkOrder(editingItem.id, payload);
          if (!savedOrder) savedOrder = { ...payload, id: editingItem.id };
        } else {
          payload.created_at = new Date().toISOString();
          savedOrder = await db.createWorkOrder(payload);
          if (!savedOrder || !savedOrder.id) {
            savedOrder = { ...payload, id: Date.now() };
          }
        }

        // Record Advance Payment in Account Ledger
        if (!editingItem && advancePaid > 0 && form.account_id) {
          try {
            await db.createAccountTransaction({
              account_id: form.account_id,
              transaction_type: 'credit',
              amount: advancePaid,
              description: `Advance for Repair Token #${form.token_no} (${finalCustomerName})`,
              payment_mode: form.payment_mode,
              reference_no: form.token_no,
              reference_type: 'repair_advance'
            });
            console.log(`[Services] Advance Rs. ${advancePaid} recorded in account ${form.account_id}`);
          } catch (accErr) {
            console.error('[Services] Failed to record advance transaction:', accErr);
          }
        }

        await loadAll();
        closeModal();

        setSnackbar({
          open: true,
          message: editingItem ? 'Repair order updated!' : `Intake Token #${form.token_no} created successfully!`,
          severity: 'success'
        });

        if (shouldPrintToken) {
          setTimeout(() => {
            printBookingToken({ ...payload, ...savedOrder });
          }, 350);
        }
      } catch (err) {
        console.error('[Services] Error saving repair order:', err);
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <DialogTitle sx={{ 
          bgcolor: '#1c2580', 
          color: 'white', 
          py: 1.5, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Smartphone />
            <Typography variant="h6" fontWeight={700}>
              {editingItem ? 'Edit Repair Order' : 'Fast Repair Intake & Token'}
            </Typography>
          </Box>
          <Chip 
            label={form.token_no} 
            sx={{ 
              bgcolor: 'white', 
              color: '#1c2580', 
              fontWeight: 800, 
              fontFamily: 'monospace',
              fontSize: '0.85rem' 
            }} 
          />
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
          {/* SECTION 1: CUSTOMER SELECTION (3 WAYS) */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#1e293b' }}>
                <Person fontSize="small" /> Customer Intake Mode
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, bgcolor: '#e2e8f0', p: 0.5, borderRadius: 1.5 }}>
                <Button 
                  size="small" 
                  variant={customerMode === 'walkin' ? 'contained' : 'text'}
                  onClick={() => handleCustomerModeChange('walkin')}
                  sx={{ 
                    fontSize: '0.75rem', 
                    py: 0.4, 
                    px: 1.5, 
                    textTransform: 'none', 
                    fontWeight: 600,
                    bgcolor: customerMode === 'walkin' ? '#1c2580' : 'transparent',
                    color: customerMode === 'walkin' ? 'white' : 'text.primary',
                    '&:hover': { bgcolor: customerMode === 'walkin' ? '#151c60' : '#cbd5e1' }
                  }}
                >
                  Walk-in Customer
                </Button>
                <Button 
                  size="small" 
                  variant={customerMode === 'existing' ? 'contained' : 'text'}
                  onClick={() => handleCustomerModeChange('existing')}
                  sx={{ 
                    fontSize: '0.75rem', 
                    py: 0.4, 
                    px: 1.5, 
                    textTransform: 'none', 
                    fontWeight: 600,
                    bgcolor: customerMode === 'existing' ? '#1c2580' : 'transparent',
                    color: customerMode === 'existing' ? 'white' : 'text.primary',
                    '&:hover': { bgcolor: customerMode === 'existing' ? '#151c60' : '#cbd5e1' }
                  }}
                >
                  Existing Customer
                </Button>
                <Button 
                  size="small" 
                  variant={customerMode === 'new' ? 'contained' : 'text'}
                  onClick={() => handleCustomerModeChange('new')}
                  sx={{ 
                    fontSize: '0.75rem', 
                    py: 0.4, 
                    px: 1.5, 
                    textTransform: 'none', 
                    fontWeight: 600,
                    bgcolor: customerMode === 'new' ? '#1c2580' : 'transparent',
                    color: customerMode === 'new' ? 'white' : 'text.primary',
                    '&:hover': { bgcolor: customerMode === 'new' ? '#151c60' : '#cbd5e1' }
                  }}
                >
                  + New Customer
                </Button>
              </Box>
            </Box>

            {customerMode === 'walkin' && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Customer Name" 
                    value={form.customer_name} 
                    onChange={e => setForm({...form, customer_name: e.target.value})}
                    placeholder="Walk-in Customer"
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Customer Phone (Optional)" 
                    value={form.customer_phone} 
                    onChange={e => setForm({...form, customer_phone: e.target.value})}
                    placeholder="0300-1234567"
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </Grid>
            )}

            {customerMode === 'existing' && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={customers}
                    getOptionLabel={c => `${c.name || ''} ${c.phone ? `(${c.phone})` : ''}`}
                    value={selectedCustomer}
                    onChange={(e, val) => handleSelectExistingCustomer(val)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        size="small" 
                        label="Search Existing Customer" 
                        placeholder="Search by name or phone..." 
                        sx={{ bgcolor: 'white' }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Customer Phone" 
                    value={form.customer_phone} 
                    InputProps={{ readOnly: true }}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </Grid>
            )}

            {customerMode === 'new' && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Customer Full Name" 
                    required
                    value={form.customer_name} 
                    onChange={e => setForm({...form, customer_name: e.target.value})}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Phone Number" 
                    required
                    value={form.customer_phone} 
                    onChange={e => setForm({...form, customer_phone: e.target.value})}
                    placeholder="03XX-XXXXXXX"
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Address / City" 
                    value={form.customer_address} 
                    onChange={e => setForm({...form, customer_address: e.target.value})}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
              </Grid>
            )}
          </Paper>

          {/* SECTION 2: DEVICE & FAULT DETAILS */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#1e293b', mb: 1.5 }}>
              <Build fontSize="small" /> Device & Problem Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Device Name / Model" 
                  required 
                  value={form.device_model} 
                  onChange={e => setForm({...form, device_model: e.target.value})} 
                  placeholder="e.g. iPhone 13 Pro Max, Samsung A32"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Reported Fault / Problem" 
                  required 
                  value={form.problem_description} 
                  onChange={e => setForm({...form, problem_description: e.target.value})} 
                  placeholder="e.g. Touch screen replacement, charging port dead"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Physical Condition & Accessories" 
                  value={form.device_condition} 
                  onChange={e => setForm({...form, device_condition: e.target.value})} 
                  placeholder="e.g. Minor scratches, no charger"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Screen Lock / Passcode" 
                  value={form.passcode} 
                  onChange={e => setForm({...form, passcode: e.target.value})} 
                  placeholder="e.g. 1234 or Pattern"
                  helperText="Required for testing after repair"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="IMEI / Serial (Optional)" 
                  value={form.imei} 
                  onChange={e => setForm({...form, imei: e.target.value})} 
                  placeholder="15-digit IMEI"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* SECTION 3: TIMING & PROMISED RETURN */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#1e293b', mb: 1.5 }}>
              <AccessTime fontSize="small" /> Dates & Scheduling
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Receiving / Booking Date" 
                  type="date"
                  value={form.booking_date} 
                  onChange={e => setForm({...form, booking_date: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Promised Return Date" 
                  type="date"
                  value={form.expected_delivery_date} 
                  onChange={e => setForm({...form, expected_delivery_date: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                  helperText="Estimated return date printed on customer token"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* SECTION 4: ESTIMATED PRICING, ADVANCE & FINANCIAL ACCOUNT */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#166534', mb: 1.5 }}>
              <Payment fontSize="small" /> Service, Pricing, Advance Payment & Account
            </Typography>

            <Grid container spacing={2}>
              {/* Service Selection + Add New Service */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                    <InputLabel>Repair Service / Job</InputLabel>
                    <Select 
                      value={form.service_id} 
                      onChange={e => {
                        const sId = e.target.value;
                        const s = services.find(x => String(x.id) === String(sId));
                        setForm(prev => ({
                          ...prev,
                          service_id: sId,
                          service_fee: s ? s.base_price : prev.service_fee
                        }));
                      }} 
                      label="Repair Service / Job"
                    >
                      <MenuItem value="">Custom / General Inspection</MenuItem>
                      {services.map(s => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name} (Rs. {Number(s.base_price || 0).toLocaleString()})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => setQuickServiceModal(true)}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap', height: 40, fontWeight: 600 }}
                  >
                    + New Service
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Estimated Total Amount (Rs.)" 
                  type="number"
                  value={form.service_fee} 
                  onChange={e => setForm({...form, service_fee: e.target.value})}
                  sx={{ bgcolor: 'white' }}
                  InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Advance Paid (Rs.)" 
                  type="number"
                  value={form.advance_amount} 
                  onChange={e => setForm({...form, advance_amount: e.target.value})}
                  sx={{ bgcolor: 'white' }}
                  InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  bgcolor: 'white', 
                  p: 1.2, 
                  borderRadius: 1, 
                  border: '1px solid #cbd5e1' 
                }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Remaining Balance Due
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color={dueAmount > 0 ? '#ef4444' : '#10b981'}>
                    Rs. {dueAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>

              {advancePaid > 0 && (
                <>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
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

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                      <InputLabel>Deposit Account</InputLabel>
                      <Select 
                        value={form.account_id} 
                        onChange={e => setForm({...form, account_id: e.target.value})}
                        label="Deposit Account"
                      >
                        {accounts.map(acc => (
                          <MenuItem key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type?.toUpperCase() || 'ACC'}) — Bal: Rs.{Number(acc.current_balance || 0).toLocaleString()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={closeModal} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button 
              variant="outlined" 
              onClick={() => handleSave(false)} 
              disabled={saving}
              sx={{ fontWeight: 600, textTransform: 'none', px: 2.5 }}
            >
              Save Order Only
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Print />}
              onClick={() => handleSave(true)} 
              disabled={saving}
              sx={{ 
                bgcolor: '#10b981', 
                '&:hover': { bgcolor: '#059669' }, 
                fontWeight: 700, 
                textTransform: 'none', 
                px: 3,
                boxShadow: 2
              }}
            >
              Save & Print Token Slip
            </Button>
          </Box>
        </DialogActions>

        {/* QUICK ADD SERVICE MODAL */}
        <Dialog open={quickServiceModal} onClose={() => setQuickServiceModal(false)} maxWidth="xs" fullWidth>
          <form onSubmit={handleQuickAddService}>
            <DialogTitle sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 700, py: 1.5 }}>
              + Add New Service
            </DialogTitle>
            <DialogContent sx={{ pt: 2.5 }}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Service Name" 
                  required 
                  value={quickServiceForm.name} 
                  onChange={e => setQuickServiceForm({...quickServiceForm, name: e.target.value})} 
                  placeholder="e.g. Screen Replacement, Battery Change"
                />
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Base Labor Price (Rs.)" 
                  type="number" 
                  value={quickServiceForm.base_price} 
                  onChange={e => setQuickServiceForm({...quickServiceForm, base_price: e.target.value})} 
                  placeholder="e.g. 1500"
                />
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Description / Notes" 
                  multiline 
                  rows={2}
                  value={quickServiceForm.description} 
                  onChange={e => setQuickServiceForm({...quickServiceForm, description: e.target.value})} 
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setQuickServiceModal(false)}>Cancel</Button>
              <Button type="submit" variant="contained" sx={{ bgcolor: '#1c2580', '&:hover': { bgcolor: '#151c60' } }}>
                Save Service
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    );
  };

  // ==================== ASSIGN REPAIR / WORKSHOP DIALOG ====================
  const AssignRepairDialog = () => {
    if (!assignRepairOrder) return null;

    const bookedServiceName = assignRepairOrder.service_name || 'General Repair';

    const [serviceLaborFee, setServiceLaborFee] = useState(() => {
      if (assignRepairOrder.service_fee !== undefined && assignRepairOrder.service_fee !== null) {
        return Number(assignRepairOrder.service_fee);
      }
      if (assignRepairOrder.labor_amount !== undefined && assignRepairOrder.labor_amount !== null) {
        return Number(assignRepairOrder.labor_amount);
      }
      return Number(assignRepairOrder.total_cost || 0);
    });

    const [techId, setTechId] = useState(assignRepairOrder.staff_id || '');
    const initialTech = staffList.find(s => String(s.id) === String(assignRepairOrder.staff_id));

    const [commissionMode, setCommissionMode] = useState(() => {
      if (assignRepairOrder.commission_type) return assignRepairOrder.commission_type;
      if (initialTech?.salary_type === 'monthly') return 'salary';
      if (initialTech?.salary_type === 'per_job') return 'fixed';
      if (initialTech?.salary_type === 'commission' || initialTech?.salary_type === 'hybrid') return 'percent';
      if (Number(assignRepairOrder.commission_amount) > 0) return 'fixed';
      return 'percent';
    });

    const [commissionRate, setCommissionRate] = useState(() => {
      if (assignRepairOrder.commission_percent !== undefined && assignRepairOrder.commission_percent !== null) {
        return Number(assignRepairOrder.commission_percent);
      }
      return Number(initialTech?.commission_rate || 50);
    });

    const [customCommission, setCustomCommission] = useState(() => {
      return Number(assignRepairOrder.commission_amount || initialTech?.per_job_rate || 0);
    });

    const [selectedParts, setSelectedParts] = useState(() => {
      const raw = assignRepairOrder.parts_used;
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (_) { return []; }
      }
      return [];
    });

    const [partSearch, setPartSearch] = useState('');
    const [extPart, setExtPart] = useState({ name: '', cost: '', quantity: 1, supplier: '' });
    const [categoryFilter, setCategoryFilter] = useState('');
    const [saving, setSaving] = useState(false);

    const [quickStockModal, setQuickStockModal] = useState(false);
    const [quickStockForm, setQuickStockForm] = useState({
      name: '',
      category_id: '',
      cost_price: '',
      sale_price: '',
      stock: 5,
      sku: ''
    });

    const getProductName = (p) => {
      if (!p) return 'Unknown Part';
      const prodName = p.product_name || p.name || '';
      const varName = p.variant_name || '';
      if (varName && varName !== 'Default' && prodName && prodName !== varName) {
        return `${prodName} (${varName})`;
      }
      if (prodName && prodName !== 'Default') {
        return prodName;
      }
      return p.name && p.name !== 'Default' ? p.name : (p.sku || 'Part');
    };
    const getProductCategory = (p) => p.category_name || p.category || 'Uncategorized';
    const getProductStock = (p) => Number(p.current_stock || 0);

    const filteredStockParts = useMemo(() => {
      let list = products;
      if (categoryFilter) {
        list = list.filter(p => getProductCategory(p) === categoryFilter);
      }
      if (partSearch.trim()) {
        const q = partSearch.toLowerCase();
        list = list.filter(p =>
          getProductName(p).toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
      }
      return list.filter(p => getProductStock(p) > 0).slice(0, 20);
    }, [partSearch, categoryFilter, products]);

    const handleTechChange = (newTechId) => {
      setTechId(newTechId);
      const tech = staffList.find(s => String(s.id) === String(newTechId));
      if (tech) {
        if (tech.salary_type === 'monthly') {
          setCommissionMode('salary');
        } else if (tech.salary_type === 'per_job') {
          setCommissionMode('fixed');
          setCustomCommission(Number(tech.per_job_rate || 0));
        } else {
          setCommissionMode('percent');
          setCommissionRate(Number(tech.commission_rate || 50));
        }
      }
    };

    const laborFeeNum = Math.max(0, Number(serviceLaborFee) || 0);

    const calculatedCommission = useMemo(() => {
      if (!techId) return 0;
      if (commissionMode === 'salary') return 0;
      if (commissionMode === 'full_labor') return laborFeeNum;
      if (commissionMode === 'fixed') return Math.max(0, Number(customCommission) || 0);
      if (commissionMode === 'percent') {
        return Math.round((laborFeeNum * (Number(commissionRate) || 0)) / 100);
      }
      return 0;
    }, [techId, commissionMode, laborFeeNum, commissionRate, customCommission]);

    const handleQuickAddStockPart = async (e) => {
      e.preventDefault();
      if (!quickStockForm.name.trim()) return;
      try {
        const sku = quickStockForm.sku.trim() || ('PRT-' + Math.floor(100000 + Math.random() * 900000));
        const payload = {
          name: quickStockForm.name.trim(),
          category_id: quickStockForm.category_id || (categories[0]?.id || null),
          purchase_price: Number(quickStockForm.cost_price) || 0,
          cost_price: Number(quickStockForm.cost_price) || 0,
          sale_price: Number(quickStockForm.sale_price) || Number(quickStockForm.cost_price) || 0,
          retail_price: Number(quickStockForm.sale_price) || Number(quickStockForm.cost_price) || 0,
          stock: Number(quickStockForm.stock) || 1,
          current_stock: Number(quickStockForm.stock) || 1,
          sku: sku
        };
        const res = await db.createProduct(payload);
        const created = res?.data || res || { ...payload, id: Date.now() };
        const variant = {
          ...created,
          id: created.variant_id || created.id || Date.now(),
          product_name: created.name,
          current_stock: Number(payload.stock),
          sku: sku
        };
        setProducts(prev => [variant, ...prev]);
        addStockPart(variant);
        setQuickStockModal(false);
        setQuickStockForm({ name: '', category_id: '', cost_price: '', sale_price: '', stock: 5, sku: '' });
        setSnackbar({ open: true, message: `Part "${variant.product_name}" added to stock & repair!`, severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to add stock item: ' + err.message, severity: 'error' });
      }
    };

    const addStockPart = (product) => {
      const stock = getProductStock(product);
      const partKey = product.sku || product.id;
      const existing = selectedParts.find(p => p.part_id === partKey && !p.is_external);
      if (existing) {
        if (existing.quantity + 1 > stock) {
          setSnackbar({ open: true, message: `Only ${stock} items available in stock!`, severity: 'warning' });
          return;
        }
        setSelectedParts(selectedParts.map(p =>
          p.part_id === existing.part_id && !p.is_external ? { ...p, quantity: p.quantity + 1 } : p
        ));
      } else {
        if (stock <= 0) {
          setSnackbar({ open: true, message: 'Item is out of stock!', severity: 'error' });
          return;
        }
        setSelectedParts(prev => [...prev, {
          part_id: partKey,
          variant_id: product.id,
          name: getProductName(product),
          cost: Number(product.purchase_price || product.cost_price || product.retail_price || 0),
          quantity: 1,
          is_external: false,
          is_included: false,
          available_stock: stock
        }]);
      }
    };

    const addExternalPart = () => {
      if (!extPart.name.trim() || Number(extPart.cost) <= 0) {
        setSnackbar({ open: true, message: 'Please enter valid external part name and cost', severity: 'warning' });
        return;
      }
      setSelectedParts(prev => [...prev, {
        part_id: 'EXT-' + Date.now(),
        name: extPart.name.trim(),
        cost: Number(extPart.cost),
        quantity: Number(extPart.quantity) || 1,
        is_external: true,
        is_included: false,
        supplier: extPart.supplier.trim() // QA-014: market part ka source
      }]);
      setExtPart({ name: '', cost: '', quantity: 1, supplier: '' });
    };

    const togglePartIncluded = (partKey) => {
      setSelectedParts(prev => prev.map(p => {
        if (p.part_id === partKey) {
          return { ...p, is_included: !p.is_included };
        }
        return p;
      }));
    };

    const updatePartQty = (partId, qty) => {
      if (qty <= 0) {
        setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
      } else {
        setSelectedParts(selectedParts.map(p => p.part_id === partId ? { ...p, quantity: qty } : p));
      }
    };

    const billablePartsCost = useMemo(() => {
      return selectedParts.reduce((sum, p) => {
        if (p.is_included) return sum;
        return sum + (Number(p.cost || 0) * Number(p.quantity || 1));
      }, 0);
    }, [selectedParts]);

    const internalPartsCost = useMemo(() => {
      return selectedParts.reduce((sum, p) => {
        if (!p.is_included) return sum;
        return sum + (Number(p.cost || 0) * Number(p.quantity || 1));
      }, 0);
    }, [selectedParts]);

    const updatedTotalCost = laborFeeNum + billablePartsCost;
    const advanceReceived = Number(assignRepairOrder.advance_amount || assignRepairOrder.paid_amount || 0);
    const balanceDue = Math.max(0, updatedTotalCost - advanceReceived);

    const handleSaveRepairing = async () => {
      setSaving(true);
      try {
        const assignedTech = staffList.find(s => String(s.id) === String(techId));
        
        // 1. Deduct newly added stock parts from inventory
        let deductedSummary = [];
        for (const part of selectedParts) {
          if (!part.is_external && part.variant_id && !part.deducted) {
            const variant = products.find(p => String(p.id) === String(part.variant_id));
            if (variant) {
              const currentStock = Number(variant.current_stock) || 0;
              const newStock = Math.max(0, currentStock - Number(part.quantity || 1));
              if (db.updateVariantStock) {
                await db.updateVariantStock(variant.id, newStock);
              }
              deductedSummary.push({
                name: getProductName(variant),
                before: currentStock,
                used: Number(part.quantity || 1),
                after: newStock
              });
            }
          }
        }

        // 2. Update order status to in-progress with Service and Parts
        const updatePayload = {
          ...assignRepairOrder,
          service_fee: laborFeeNum,
          labor_amount: laborFeeNum,
          parts_amount: billablePartsCost,
          staff_id: techId || null,
          staff_name: assignedTech ? assignedTech.name : (techId ? assignRepairOrder.staff_name : null),
          commission_type: commissionMode,
          commission_percent: commissionMode === 'percent' ? Number(commissionRate) : (commissionMode === 'full_labor' ? 100 : 0),
          commission_amount: calculatedCommission,
          parts_used: selectedParts.map(p => ({ ...p, deducted: true })),
          total_cost: updatedTotalCost,
          total_amount: updatedTotalCost,
          status: 'in-progress'
        };

        if (db.updateWorkOrder) {
          await db.updateWorkOrder(assignRepairOrder.id, updatePayload);
        }

        await loadAll();
        setAssignRepairOrder(null);

        if (deductedSummary.length > 0) {
          setStockAlert({
            open: true,
            message: `Parts Deducted from Stock (${deductedSummary.length} items)`,
            parts: deductedSummary
          });
        }

        setSnackbar({
          open: true,
          message: `Order #${assignRepairOrder.token_no || assignRepairOrder.id} moved to In Progress!`,
          severity: 'success'
        });
      } catch (err) {
        console.error('[Services] Assign repair error:', err);
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog 
        open={Boolean(assignRepairOrder)} 
        onClose={() => setAssignRepairOrder(null)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#1c2580', color: 'white', py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Build />
            <Typography variant="h6" fontWeight={700}>
              Workshop: Assign Tech & Parts
            </Typography>
          </Box>
          <Chip 
            label={`Token #${assignRepairOrder.token_no || assignRepairOrder.id}`} 
            sx={{ bgcolor: 'white', color: '#1c2580', fontWeight: 800 }} 
          />
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {/* Order Brief */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Device Model</Typography>
                <Typography variant="subtitle2" fontWeight={700}>
                  {assignRepairOrder.device_model || assignRepairOrder.machine_name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Reported Fault</Typography>
                <Typography variant="subtitle2" color="error.main" fontWeight={700}>
                  {assignRepairOrder.problem_description || 'General Fault'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Customer</Typography>
                <Typography variant="subtitle2" fontWeight={600}>
                  {assignRepairOrder.customer_name || 'Walk-in'} {assignRepairOrder.customer_phone ? `(${assignRepairOrder.customer_phone})` : ''}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Section 1: Booked Service & Labor Charge (Streamlined - No Duplicate Select Service) */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Build fontSize="small" color="primary" /> Booked Service & Labor Charge
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={7}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip 
                    label="Intake Service" 
                    size="small" 
                    sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.7rem' }} 
                  />
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                    {bookedServiceName}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Service package booked at Fast Intake for this customer.
                </Typography>
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Service Labor Charge (Rs.)" 
                  type="number" 
                  value={serviceLaborFee} 
                  onChange={e => setServiceLaborFee(e.target.value)}
                  helperText="Edit if extra labor was needed for repair"
                  InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
                  sx={{ bgcolor: 'white' }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Section 2: Technician Assignment & Flexible Commission Structure */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Person fontSize="small" color="primary" /> Select Technician & Commission Structure
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={techId ? 6 : 12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Assigned Technician</InputLabel>
                  <Select 
                    value={techId} 
                    onChange={e => handleTechChange(e.target.value)} 
                    label="Assigned Technician"
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {staffList.map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.role}) — {s.salary_type === 'monthly' ? `Salary: Rs.${s.base_salary || 0}` : s.salary_type === 'per_job' ? `Per Job: Rs.${s.per_job_rate || 0}` : `Comm: ${s.commission_rate || 0}%`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {techId && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Compensation Model</InputLabel>
                    <Select 
                      value={commissionMode} 
                      onChange={e => setCommissionMode(e.target.value)} 
                      label="Compensation Model"
                    >
                      <MenuItem value="full_labor">Full Labor (100% to Tech)</MenuItem>
                      <MenuItem value="percent">% Commission on Labor Charges</MenuItem>
                      <MenuItem value="salary">Monthly Salary (Rs. 0 / Job)</MenuItem>
                      <MenuItem value="fixed">Fixed Amount (Rs. / Job)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>

            {techId && (
              <Box sx={{ mt: 2, p: 1.8, bgcolor: '#f1f5f9', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  {commissionMode === 'percent' && (
                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Commission Rate (%)" 
                        type="number" 
                        value={commissionRate} 
                        onChange={e => setCommissionRate(e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        helperText={`Calculates: ${commissionRate}% of Rs. ${laborFeeNum} Labor`}
                        sx={{ bgcolor: 'white' }}
                      />
                    </Grid>
                  )}
                  {commissionMode === 'fixed' && (
                    <Grid item xs={12} sm={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Fixed Payout Amount (Rs.)" 
                        type="number" 
                        value={customCommission} 
                        onChange={e => setCustomCommission(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
                        sx={{ bgcolor: 'white' }}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={commissionMode === 'full_labor' || commissionMode === 'salary' ? 12 : 6}>
                    <Box sx={{ p: 1.2, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Technician Job Payout:</Typography>
                        <Typography variant="subtitle1" fontWeight={800} color="#1d4ed8">
                          Rs. {calculatedCommission.toLocaleString()}
                        </Typography>
                      </Box>
                      <Chip 
                        size="small" 
                        label="Labor Only (Parts Excluded)" 
                        sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: '0.68rem' }} 
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>

          {/* Section 3: Parts Used in Repair (Inventory Stock & Market + Package vs Billable Toggle) */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Inventory fontSize="small" color="primary" /> Add Parts Used in Repair
              </Typography>
              <Button 
                variant="contained" 
                size="small"
                startIcon={<Add />}
                onClick={() => setQuickStockModal(true)}
                sx={{ 
                  bgcolor: '#1c2580', 
                  '&:hover': { bgcolor: '#151c60' }, 
                  textTransform: 'none', 
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                + New Stock Item
              </Button>
            </Box>

            {/* Store Stock Instant Autocomplete */}
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                options={products.filter(p => getProductStock(p) > 0)}
                getOptionLabel={(p) => `${getProductName(p)} [SKU: ${p.sku || 'N/A'}] (Stock: ${getProductStock(p)}, Cost: Rs.${p.purchase_price || p.cost_price || 0})`}
                onChange={(e, val) => {
                  if (val) addStockPart(val);
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    label="Search & Pick Store Inventory Part" 
                    placeholder="Click to browse or type part name, SKU..." 
                  />
                )}
              />

              {/* Category Filter Chips */}
              <Box sx={{ display: 'flex', gap: 0.8, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Browse Category:
                </Typography>
                <Chip 
                  size="small" 
                  label="All" 
                  clickable 
                  color={!categoryFilter ? 'primary' : 'default'} 
                  onClick={() => setCategoryFilter('')} 
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
                {categories.slice(0, 7).map(c => (
                  <Chip 
                    key={c.id} 
                    size="small" 
                    label={c.name} 
                    clickable 
                    color={categoryFilter === c.name ? 'primary' : 'default'} 
                    onClick={() => setCategoryFilter(categoryFilter === c.name ? '' : c.name)} 
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                ))}
              </Box>

              {/* Show matching Category Stock Items */}
              {categoryFilter && (
                <Paper variant="outlined" sx={{ mt: 1, p: 1, maxHeight: 130, overflowY: 'auto' }}>
                  {filteredStockParts.length === 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>No stock available in this category</Typography>
                  ) : (
                    <Grid container spacing={1}>
                      {filteredStockParts.map(p => (
                        <Grid item xs={12} sm={6} key={p.id}>
                          <Box 
                            onClick={() => addStockPart(p)}
                            sx={{ 
                              p: 1, 
                              border: '1px solid #e2e8f0', 
                              borderRadius: 1, 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#f1f5f9' }
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{getProductName(p)}</Typography>
                              <Typography variant="caption" color="text.secondary">Rs. {p.purchase_price || p.cost_price || 0}</Typography>
                            </Box>
                            <Chip size="small" label={`Qty: ${getProductStock(p)}`} color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
              )}
            </Box>

            {/* External Market Part Input */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                Or Add External / Market Part (Not from Store Stock):
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField 
                  size="small" 
                  placeholder="External / Market Part Name (e.g. touch screen)" 
                  value={extPart.name} 
                  onChange={e => setExtPart({...extPart, name: e.target.value})} 
                  sx={{ flex: 3, bgcolor: 'white' }} 
                />
                <TextField 
                  size="small" 
                  placeholder="Cost (Rs.)" 
                  type="number"
                  value={extPart.cost} 
                  onChange={e => setExtPart({...extPart, cost: e.target.value})} 
                  sx={{ flex: 1.5, bgcolor: 'white' }} 
                />
                {/* QA-014: external part ka supplier/source */}
                <TextField 
                  size="small" 
                  placeholder="Supplier / Source" 
                  value={extPart.supplier} 
                  onChange={e => setExtPart({...extPart, supplier: e.target.value})} 
                  sx={{ flex: 2, bgcolor: 'white' }} 
                />
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={addExternalPart}
                  sx={{ textTransform: 'none', fontWeight: 600, height: 40, whiteSpace: 'nowrap' }}
                >
                  Add Market Part
                </Button>
              </Box>
            </Paper>

            {/* Selected Parts List */}
            {selectedParts.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No parts added to this repair yet</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {selectedParts.map((p, idx) => (
                  <Paper key={p.part_id || idx} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, border: p.is_included ? '1px solid #86efac' : '1px solid #cbd5e1' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{p.name}</Typography>
                          <Chip 
                            size="small" 
                            label={p.is_external ? 'Market' : 'Stock'} 
                            color={p.is_external ? 'secondary' : 'primary'} 
                            sx={{ height: 20, fontSize: '0.65rem' }} 
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Unit Cost: Rs. {p.cost}
                          {/* QA-014: external part ka supplier/source dikhao */}
                          {p.is_external && p.supplier && <> · Source: {p.supplier}</>}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        {/* Package Included Toggle Chip */}
                        <Chip 
                          clickable
                          size="small"
                          icon={p.is_included ? <Check fontSize="small" /> : <Add fontSize="small" />}
                          label={p.is_included ? "Included in Package (Rs. 0)" : `Bill to Customer (+Rs. ${Number(p.cost) * Number(p.quantity)})`}
                          color={p.is_included ? "success" : "default"}
                          variant={p.is_included ? "filled" : "outlined"}
                          onClick={() => togglePartIncluded(p.part_id)}
                          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                        />

                        <TextField 
                          type="number" 
                          size="small" 
                          value={p.quantity} 
                          onChange={e => updatePartQty(p.part_id, Math.max(1, parseInt(e.target.value) || 1))}
                          sx={{ width: 65 }} 
                          inputProps={{ min: 1 }} 
                        />

                        <Typography variant="subtitle2" fontWeight={700} sx={{ minWidth: 75, textAlign: 'right' }}>
                          {p.is_included ? (
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>Rs. 0</span>
                          ) : (
                            `Rs. ${Number(p.cost) * Number(p.quantity)}`
                          )}
                        </Typography>

                        <IconButton size="small" color="error" onClick={() => updatePartQty(p.part_id, 0)}>
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}

            {/* Cost Summary Banner */}
            <Box sx={{ mt: 2, p: 2, bgcolor: '#e0f2fe', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="body2" color="#0369a1" fontWeight={600}>
                  Service / Labor: <strong>Rs. {laborFeeNum}</strong>
                  {billablePartsCost > 0 && <span> + Extra Parts: <strong>Rs. {billablePartsCost}</strong></span>}
                  {internalPartsCost > 0 && <span style={{ color: '#047857' }}> (Package Parts: Rs. {internalPartsCost} covered)</span>}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Advance Paid: Rs. {advanceReceived} | Balance Due: <strong style={{ color: balanceDue > 0 ? '#ef4444' : '#10b981' }}>Rs. {balanceDue}</strong>
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Total Customer Bill</Typography>
                <Typography variant="h5" fontWeight={800} color="#0369a1">
                  Rs. {updatedTotalCost.toLocaleString()}
                </Typography>
                {techId && (
                  <Typography variant="caption" color="#1d4ed8" fontWeight={700} display="block">
                    Tech Earning: Rs. {calculatedCommission.toLocaleString()} ({commissionMode === 'full_labor' ? '100% Labor' : commissionMode === 'salary' ? 'Salary (Rs. 0)' : commissionMode === 'percent' ? `${commissionRate}% Labor` : 'Fixed'})
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setAssignRepairOrder(null)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Build />} 
            onClick={handleSaveRepairing} 
            disabled={saving}
            sx={{ 
              bgcolor: '#1c2580', 
              '&:hover': { bgcolor: '#151c60' }, 
              fontWeight: 700, 
              textTransform: 'none', 
              px: 3 
            }}
          >
            Start Repairing (In Progress)
          </Button>
        </DialogActions>

        {/* QUICK ADD STOCK ITEM MODAL */}
        <Dialog open={quickStockModal} onClose={() => setQuickStockModal(false)} maxWidth="xs" fullWidth>
          <form onSubmit={handleQuickAddStockPart}>
            <DialogTitle sx={{ bgcolor: '#1c2580', color: 'white', fontWeight: 700, py: 1.5 }}>
              + Add New Inventory Part
            </DialogTitle>
            <DialogContent sx={{ pt: 2.5 }}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Part / Product Name" 
                  required 
                  value={quickStockForm.name} 
                  onChange={e => setQuickStockForm({...quickStockForm, name: e.target.value})} 
                  placeholder="e.g. Infinix Hot 10 Touch Screen"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select 
                    value={quickStockForm.category_id} 
                    onChange={e => setQuickStockForm({...quickStockForm, category_id: e.target.value})} 
                    label="Category"
                  >
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Cost Price (Rs.)" 
                      type="number" 
                      value={quickStockForm.cost_price} 
                      onChange={e => setQuickStockForm({...quickStockForm, cost_price: e.target.value})} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Initial Stock Qty" 
                      type="number" 
                      value={quickStockForm.stock} 
                      onChange={e => setQuickStockForm({...quickStockForm, stock: e.target.value})} 
                    />
                  </Grid>
                </Grid>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="SKU / Barcode (Optional)" 
                  value={quickStockForm.sku} 
                  onChange={e => setQuickStockForm({...quickStockForm, sku: e.target.value})} 
                  placeholder="Auto-generated if left blank"
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setQuickStockModal(false)}>Cancel</Button>
              <Button type="submit" variant="contained" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
                Save & Add to Repair
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Dialog>
    );
  };

// ==================== DELIVER & SETTLE BALANCE DIALOG ====================
  const DeliverSettleDialog = () => {
    if (!deliverSettleOrder) return null;

    const totalCost = Number(deliverSettleOrder.total_cost || deliverSettleOrder.total_amount || 0);
    const advancePaid = Number(deliverSettleOrder.advance_amount || 0);
    const currentPaid = Number(deliverSettleOrder.paid_amount !== undefined && deliverSettleOrder.paid_amount !== null ? deliverSettleOrder.paid_amount : advancePaid);
    const remainingDue = Math.max(0, totalCost - currentPaid);

    const [amountPaying, setAmountPaying] = useState(remainingDue.toString());
    const [payMode, setPayMode] = useState('cash');
    const [accId, setAccId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (!accId && accounts.length > 0) {
        let match = accounts.find(a => {
          const type = (a.type || '').toLowerCase();
          const name = (a.name || '').toLowerCase();
          if (payMode === 'cash') return type === 'cash' || name.includes('cash');
          if (payMode === 'bank') return type === 'bank' || name.includes('bank');
          if (payMode === 'easypaisa') return name.includes('easypaisa');
          if (payMode === 'jazzcash') return name.includes('jazzcash');
          return false;
        });
        if (!match) match = accounts[0];
        if (match) setAccId(match.id);
      }
    }, [payMode, accounts]);

    const handleDeliverOrder = async () => {
      const payingNow = Number(amountPaying) || 0;
      if (remainingDue > 0 && payingNow <= 0) {
        setSnackbar({ open: true, message: 'Please enter the collected payment amount before completing.', severity: 'warning' });
        return;
      }

      setSaving(true);
      try {
        // 1. Record credit transaction in financial account for remaining balance
        if (payingNow > 0 && accId) {
          try {
            await db.createAccountTransaction({
              account_id: accId,
              transaction_type: 'credit',
              amount: payingNow,
              description: `Settlement for Repair #${deliverSettleOrder.token_no || deliverSettleOrder.id} (${deliverSettleOrder.customer_name})`,
              payment_mode: payMode,
              reference_no: deliverSettleOrder.token_no || deliverSettleOrder.id,
              reference_type: 'repair_delivery'
            });
            console.log(`[Services] Recorded settlement Rs. ${payingNow} into account ${accId}`);
          } catch (accErr) {
            console.error('[Services] Failed to record settlement transaction:', accErr);
          }
        }

        // 2. Mark order completed & paid
        const totalPaid = currentPaid + payingNow;
        const newDue = Math.max(0, totalCost - totalPaid);

        const updatePayload = {
          ...deliverSettleOrder,
          status: newDue <= 0 ? 'completed' : 'in-progress',
          payment_status: newDue <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid'),
          paid_amount: totalPaid,
          advance_amount: advancePaid,
          payment_mode: payMode,
          completed_at: newDue <= 0 ? new Date().toISOString() : null
        };

        // If order completed, credit technician commission if not already credited
        if (newDue <= 0 && deliverSettleOrder.staff_id && !deliverSettleOrder.commission_credited) {
          const staff = staffList.find(s => String(s.id) === String(deliverSettleOrder.staff_id));
          const commAmt = Number(deliverSettleOrder.commission_amount) || 0;
          if (staff && commAmt > 0) {
            try {
              const currentStaff = await db.getStaffById(staff.id);
              if (currentStaff) {
                const currentTotal = Number(currentStaff.total_commission) || 0;
                await db.updateStaff(staff.id, {
                  ...currentStaff,
                  total_commission: currentTotal + commAmt
                });
                updatePayload.commission_credited = 1;
                console.log(`[DeliverSettle] Added commission Rs. ${commAmt} to ${staff.name}`);
              }
            } catch (commErr) {
              console.error('[DeliverSettle] Commission crediting error:', commErr);
            }
          }
        }

        if (db.updateWorkOrder) {
          await db.updateWorkOrder(deliverSettleOrder.id, updatePayload);
        }

        // 3. Print final bill
        setTimeout(() => {
          printBill(updatePayload, staffList);
        }, 300);

        await loadAll();
        setDeliverSettleOrder(null);

        // QA-012: "settled" sirf jab fully paid ho; partial par sahi message
        setSnackbar({
          open: true,
          message: newDue <= 0
            ? `Order #${deliverSettleOrder.token_no || deliverSettleOrder.id} delivered and settled successfully!`
            : `Partial payment of Rs. ${Number(payingNow).toLocaleString()} recorded for Order #${deliverSettleOrder.token_no || deliverSettleOrder.id}. Remaining due: Rs. ${Number(newDue).toLocaleString()}.`,
          severity: 'success'
        });
      } catch (err) {
        console.error('[Services] Deliver settle error:', err);
        setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog 
        open={Boolean(deliverSettleOrder)} 
        onClose={() => setDeliverSettleOrder(null)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#f59e0b', color: 'white', py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment />
            <Typography variant="h6" fontWeight={700}>
              Deliver & Settle Balance
            </Typography>
          </Box>
          <Chip 
            label={`Token #${deliverSettleOrder.token_no || deliverSettleOrder.id}`} 
            sx={{ bgcolor: 'white', color: '#b45309', fontWeight: 800 }} 
          />
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {/* Summary Box */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#fef3c7', borderColor: '#fde68a' }}>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Customer</Typography>
                <Typography variant="subtitle2" fontWeight={700}>
                  {deliverSettleOrder.customer_name || 'Walk-in'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Device Model</Typography>
                <Typography variant="subtitle2" fontWeight={700}>
                  {deliverSettleOrder.device_model || deliverSettleOrder.machine_name}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  Rs. {totalCost.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Advance Paid</Typography>
                <Typography variant="subtitle1" fontWeight={700} color="success.main">
                  Rs. {advancePaid.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Remaining Due</Typography>
                <Typography variant="subtitle1" fontWeight={800} color="error.main">
                  Rs. {remainingDue.toLocaleString()}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Payment Form */}
          <Stack spacing={2}>
            <TextField 
              fullWidth 
              size="small" 
              label="Amount Collecting Now (Rs.)" 
              type="number"
              value={amountPaying} 
              onChange={e => setAmountPaying(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Payment Mode</InputLabel>
              <Select 
                value={payMode} 
                onChange={e => setPayMode(e.target.value)} 
                label="Payment Mode"
              >
                {PAYMENT_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Deposit Account</InputLabel>
              <Select 
                value={accId} 
                onChange={e => setAccId(e.target.value)} 
                label="Deposit Account"
              >
                {accounts.map(acc => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type?.toUpperCase() || 'ACC'}) — Bal: Rs.{Number(acc.current_balance || 0).toLocaleString()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setDeliverSettleOrder(null)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Print />}
            onClick={handleDeliverOrder} 
            disabled={saving}
            sx={{ 
              bgcolor: '#f59e0b', 
              '&:hover': { bgcolor: '#d97706' }, 
              fontWeight: 700, 
              textTransform: 'none', 
              px: 3 
            }}
          >
            Collect & Deliver (Print Final Bill)
          </Button>
        </DialogActions>
      </Dialog>
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
                  • <strong>Commission:</strong> Percentage of labor charges only (parts excluded) on every completed order.
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
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => openModal('workorder')}
              sx={{
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
                borderRadius: 2,
                fontWeight: 700,
                boxShadow: 2
              }}
            >
              + New Repair Intake / Job Card
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
              <Grid item xs={12} sm={6} md={6} lg={4} xl={3} key={wo.id}>
                <WorkOrderCard 
                  wo={wo} 
                  onEdit={(item) => openModal('workorder', item)} 
                  onDelete={(id) => handleDelete('workorder', id)} 
                  onStatusChange={updateWorkOrderStatus} 
                  onViewHistory={openCustomerHistory}
                  onPrint={(order) => printBill(order, staffList)}
                  onPrintToken={(order) => printBookingToken(order)}
                  onAssignRepair={(order) => setAssignRepairOrder(order)}
                  onDeliverSettle={(order) => setDeliverSettleOrder(order)}
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
                    {/* QA-017: audit trail — receipt no, itemized payments, shop share, creator/assigner */}
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed #e5e7eb' }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Receipt: {o.order_number || o.token_no || `#${o.id}`} · Advance: Rs.{o.advance_amount || 0} · Paid: Rs.{o.paid_amount || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Shop Share: Rs.{Number(o.total_amount || o.total_cost || 0) - Number(o.commission_amount || 0)}
                        {o.created_by_name && <> · Created by: {o.created_by_name}</>}
                        {o.assigned_by_name && <> · Assigned by: {o.assigned_by_name}</>}
                      </Typography>
                    </Box>
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

      {/* Workshop: Assign Tech & Parts Modal */}
      <AssignRepairDialog />

      {/* Workshop: Deliver & Collect Settle Modal */}
      <DeliverSettleDialog />

      {/* DELETE CONFIRM DIALOG (replaces window.confirm which hangs browsers) */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: null, id: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent dividers>
          <Typography>Are you sure you want to delete this? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, type: null, id: null })}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}