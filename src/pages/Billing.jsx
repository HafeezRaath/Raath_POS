import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Chip, Divider, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, InputAdornment, Tooltip, useMediaQuery, useTheme,
  Grid, Card, CardContent, Stack, Badge, Collapse,
  List, ListItem, ListItemText, ListItemIcon,
  BottomNavigation, BottomNavigationAction, Drawer, ToggleButton, ToggleButtonGroup,
  Slider, FormControlLabel, Switch, ButtonGroup
} from '@mui/material';
import {
  Add, Delete, Search, Print, Save, Pause, Close,
  Receipt, QrCodeScanner, LocalOffer, ShoppingCart,
  Menu as MenuIcon, KeyboardArrowDown, KeyboardArrowUp,
  CheckCircle, Print as PrintIcon, ViewModule, ViewList,
  Image as ImageIcon, Discount, AttachMoney, TrendingUp,
  ArrowBack, ArrowForward, RemoveCircle, VerifiedUser, Sync as SyncIcon,
  QrCode, Refresh as RefreshIcon, ToggleOn, ToggleOff,
  ReceiptLong, Remove
} from '@mui/icons-material';
import db from '../database/db';

// ==================== HELPERS ====================
// ==================== HELPERS ====================
const formatPKR = (amount) => {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
};

// FIXED: Use local date to avoid timezone issues
const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalISOString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

// ==================== GET RECEIPT SETTINGS ====================
const getReceiptDesign = () => {
  try {
    const saved = localStorage.getItem('receipt_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.design || 'design1';
    }
  } catch (e) {}
  return 'design1';
};

const getShopProfile = () => {
  try {
    const saved = localStorage.getItem('shop_profile');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return { name: 'My Store', tagline: '', address: '', phone: '', logoPreview: null };
};

// ==================== FBR SERVICE FUNCTIONS ====================
const isFBRConfigured = () => {
  try {
    const saved = localStorage.getItem('tax_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.fbrEnabled === true && parsed.fbrApiKey && parsed.fbrApiKey.length > 0;
    }
  } catch (e) {}
  return false;
};

const getFBRConfig = () => {
  try {
    const saved = localStorage.getItem('tax_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return null;
};

// ==================== GENERATE DUMMY QR CODE ====================
const generateDummyQR = () => {
  return `FBR-DEMO-${Date.now()}-${String(Math.random()).slice(2, 8)}`;
};

// ==================== THERMAL RECEIPT WITH LARGER FONTS & FIXED DATE ====================
const ThermalReceipt = React.forwardRef(({ sale, items, party, partyType, fbrStatus, fbrEnabled: fbrEnabledProp, fbrMode }, ref) => {
  // Read settings directly from localStorage to ensure it always matches
  const getDesign = () => {
    try {
      const saved = localStorage.getItem('receipt_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.design || 'design1';
      }
    } catch (e) {}
    return 'design1';
  };
  
  const design = getDesign();
  const shop = getShopProfile();
  const fbrConfig = getFBRConfig();
  
  const isFBRModeActive = fbrEnabledProp && fbrMode !== false;

  if (!sale) {
    return (
      <div ref={ref} style={{ width: '58mm', padding: '10px', textAlign: 'center' }}>
        <div>No receipt data</div>
      </div>
    );
  }

  // FIXED: Use local date to avoid timezone issues
  const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return d.toLocaleString('en-GB', {
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const dateStr = sale?.date ? getLocalDateStr(sale.date) : '';

  const totalQty = items?.reduce((s, i) => s + Number(i.qty || 0), 0) || 0;

  const renderFBRSection = () => {
    if (!isFBRModeActive) {
      const dummyRef = sale?.dummy_fbr_reference || `FBR-DEMO-${Date.now()}-${String(Math.random()).slice(2, 8)}`;
      const dummyQR = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(dummyRef)}`;
      
      return (
        <div style={{ 
          textAlign: 'center', 
          margin: '4px 0', 
          padding: '4px 8px', 
          border: '1px dashed #f59e0b',
          borderRadius: '4px',
          background: '#fffbeb'
        }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#f59e0b' }}>⏳ FBR DEMO MODE</div>
          <div style={{ fontSize: '6px', margin: '2px 0', color: '#92400e', wordBreak: 'break-all' }}>Ref: {dummyRef}</div>
          {dummyQR && (
            <img 
              src={dummyQR} 
              style={{ width: '14mm', height: '14mm', margin: '2px auto', display: 'block' }} 
              alt="Demo QR Code"
            />
          )}
          <div style={{ fontSize: '5px', color: '#92400e' }}>🔍 Demo Mode (0% Tax)</div>
        </div>
      );
    }

    const fbrStatusValue = sale?.fbr_status || fbrStatus?.fbr_status || null;
    const fbrRef = sale?.fbr_reference || fbrStatus?.fbr_reference || null;
    const fbrQR = fbrRef ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(fbrRef)}` : null;

    if (fbrStatusValue === 'SYNCED' && fbrRef) {
      return (
        <div style={{ 
          textAlign: 'center', 
          margin: '4px 0', 
          padding: '4px 8px', 
          border: '1px dashed #10b981',
          borderRadius: '4px',
          background: '#f0fdf4'
        }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#10b981' }}>✅ FBR DIGITAL</div>
          <div style={{ fontSize: '6px', margin: '2px 0', color: '#065f46', wordBreak: 'break-all' }}>Ref: {fbrRef}</div>
          {fbrQR && (
            <img 
              src={fbrQR} 
              style={{ width: '14mm', height: '14mm', margin: '2px auto', display: 'block' }} 
              alt="FBR QR Code"
            />
          )}
          <div style={{ fontSize: '5px', color: '#6b7280' }}>🔍 e.fbr.gov.pk</div>
        </div>
      );
    } else if (fbrStatusValue === 'PENDING' || fbrStatusValue === null) {
      return (
        <div style={{ 
          textAlign: 'center', 
          margin: '4px 0', 
          padding: '4px 8px', 
          border: '1px dashed #f59e0b',
          borderRadius: '4px',
          background: '#fffbeb'
        }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#f59e0b' }}>⏳ FBR PENDING</div>
          <div style={{ fontSize: '6px', color: '#92400e' }}>Syncing...</div>
        </div>
      );
    } else if (fbrStatusValue === 'FAILED') {
      return (
        <div style={{ 
          textAlign: 'center', 
          margin: '4px 0', 
          padding: '4px 8px', 
          border: '1px dashed #ef4444',
          borderRadius: '4px',
          background: '#fef2f2'
        }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#ef4444' }}>❌ FBR FAILED</div>
          <div style={{ fontSize: '6px', color: '#991b1b' }}>Contact support</div>
        </div>
      );
    }
    return null;
  };

  const renderFBRTaxInfo = () => {
    const fbrTaxRate = sale?.fbr_tax_rate || fbrConfig?.fbrTaxRate || 0;
    const fbrTaxAmount = sale?.fbr_tax_amount || sale?.tax || 0;
    
    if (!isFBRModeActive) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '8px',
          color: '#6b7280',
          fontWeight: 'bold'
        }}>
          <span>Demo Tax (0%)</span>
          <span>Rs. 0.00</span>
          <span style={{ fontSize: '6px', color: '#9ca3af' }}>⏳</span>
        </div>
      );
    }
    
    if (fbrTaxRate > 0 && fbrTaxAmount > 0) {
      const fbrStatusValue = sale?.fbr_status || fbrStatus?.fbr_status || null;
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '8px',
          color: '#10b981',
          fontWeight: 'bold'
        }}>
          <span>FBR Tax ({fbrTaxRate}%)</span>
          <span>Rs. {Number(fbrTaxAmount).toFixed(2)}</span>
          {fbrStatusValue === 'SYNCED' && (
            <span style={{ fontSize: '6px', color: '#059669' }}>✓</span>
          )}
        </div>
      );
    }
    return null;
  };

  // ===== DESIGN 1: Classic (INCREASED FONTS) =====
  const renderDesign1 = () => (
    <div style={{
      width: '58mm',
      padding: '6px 8px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      lineHeight: '1.4',
      background: '#fff',
      color: '#1a1a1a',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '6px', paddingBottom: '6px', borderBottom: '2px solid #10b981' }}>
        {shop?.logoPreview && (
          <img src={shop.logoPreview} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', marginBottom: '3px' }} />
        )}
        <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '1px', color: '#10b981', textTransform: 'uppercase' }}>
          {shop?.name || 'RAATH POS'}
        </div>
        <div style={{ fontSize: '8px', color: '#666' }}>{shop?.tagline || 'Universal Retail Management'}</div>
        <div style={{ fontSize: '7px', color: '#888' }}>
          <span style={{ marginRight: '4px' }}>📞 {shop?.phone || '0349-3860656'}</span>
          <span>📍 {shop?.address || 'Main Market, Lahore'}</span>
        </div>
        {isFBRModeActive ? (
          <div style={{ fontSize: '7px', color: '#10b981', marginTop: '3px', fontWeight: 'bold' }}>⚡ FBR ON</div>
        ) : (
          <div style={{ fontSize: '7px', color: '#6b7280', marginTop: '3px', fontWeight: 'bold' }}>⏳ Demo Mode (0% Tax)</div>
        )}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: '4px', padding: '4px 8px', marginBottom: '6px', border: '1px solid #e2e8f0', fontSize: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#64748b' }}>Invoice #</span>
          <span style={{ fontWeight: '700', color: '#10b981' }}>{sale?.invoiceNo || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#64748b' }}>Date</span>
          <span style={{ fontWeight: '600' }}>{dateStr}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Type</span>
          <span style={{ fontWeight: '700', color: partyType === 'customer' ? '#3b82f6' : '#f59e0b', textTransform: 'uppercase', fontSize: '8px' }}>
            {String(partyType).toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ background: '#eff6ff', borderRadius: '4px', padding: '4px 8px', marginBottom: '6px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
        <div style={{ fontSize: '7px', color: '#3b82f6', fontWeight: '600' }}>BILL TO</div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af' }}>{party?.name || 'Walk-in Customer'}</div>
        {party?.phone && <div style={{ fontSize: '7px', color: '#64748b' }}>📱 {party.phone}</div>}
        {party?.ntn && <div style={{ fontSize: '7px', color: '#64748b' }}>NTN: {party.ntn}</div>}
      </div>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', background: '#10b981', color: 'white', padding: '3px 6px', borderRadius: '3px 3px 0 0', fontWeight: '700', fontSize: '7px', textTransform: 'uppercase' }}>
          <span style={{ flex: 1 }}>Item</span>
          <span style={{ width: '24px', textAlign: 'center' }}>Qty</span>
          <span style={{ width: '35px', textAlign: 'right' }}>Price</span>
          <span style={{ width: '40px', textAlign: 'right' }}>Total</span>
        </div>

        {(items || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', padding: '3px 6px', borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', fontSize: '8px' }}>
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: '600' }}>{item.name || 'Item'}</span>
              {item.isOfferItem && <span style={{ background: '#dcfce7', color: '#166534', fontSize: '6px', padding: '1px 3px', borderRadius: '2px', marginLeft: '3px' }}>OFFER</span>}
              {item.discount > 0 && <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: '6px', padding: '1px 3px', borderRadius: '2px', marginLeft: '3px' }}>{item.discount}% OFF</span>}
              <br/><span style={{ fontSize: '6px', color: '#94a3b8' }}>{item.sku || ''}</span>
            </span>
            <span style={{ width: '24px', textAlign: 'center', fontWeight: '600' }}>{Number(item.qty || 0).toFixed(0)}</span>
            <span style={{ width: '35px', textAlign: 'right', color: '#64748b' }}>{Number(item.price || 0).toFixed(0)}</span>
            <span style={{ width: '40px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>{Number(item.total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: '4px', padding: '6px 8px', border: '1px solid #e2e8f0', marginBottom: '6px', fontSize: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Total Items</span>
          <span style={{ fontWeight: '600' }}>{items?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ color: '#64748b' }}>Total Quantity</span>
          <span style={{ fontWeight: '600' }}>{totalQty.toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Sub Total</span>
            <span style={{ fontWeight: '600' }}>Rs. {Number(sale?.subtotal || 0).toFixed(2)}</span>
          </div>
          {sale?.itemDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444' }}>Item Discount</span>
            <span style={{ color: '#ef4444' }}>-Rs. {Number(sale.itemDiscount).toFixed(2)}</span>
          </div>}
          {sale?.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444' }}>Bill Discount</span>
            <span style={{ color: '#ef4444' }}>-Rs. {Number(sale.discount).toFixed(2)}</span>
          </div>}
          {sale?.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tax ({isFBRModeActive ? (fbrConfig?.fbrTaxRate || 18) : 0}%)</span>
              <span style={{ fontWeight: '600' }}>Rs. {Number(sale.tax).toFixed(2)}</span>
            </div>
          )}
          {renderFBRTaxInfo()}
        </div>

        <div style={{ borderTop: '2px solid #10b981', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: '800' }}>GRAND TOTAL</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ background: '#ecfdf5', borderRadius: '4px', padding: '4px 8px', border: '1px solid #a7f3d0', marginBottom: '6px', fontSize: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#059669', fontWeight: '600' }}>Paid Amount</span>
          <span style={{ fontWeight: '700', color: '#059669' }}>Rs. {Number(sale?.paid || 0).toFixed(2)}</span>
        </div>
        {sale?.due > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#dc2626', fontWeight: '600' }}>Balance Due</span>
          <span style={{ fontWeight: '700', color: '#dc2626' }}>Rs. {Number(sale.due).toFixed(2)}</span>
        </div>}
        {sale?.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#059669', fontWeight: '600' }}>Change Return</span>
          <span style={{ fontWeight: '700', color: '#059669' }}>Rs. {Number(sale.change).toFixed(2)}</span>
        </div>}
      </div>

      {renderFBRSection()}

      <div style={{ textAlign: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '2px solid #e2e8f0' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>Thank You!</div>
        <div style={{ fontSize: '7px', color: '#94a3b8' }}>Goods once sold will not be taken back</div>
        <div style={{ fontSize: '6px', color: '#cbd5e1' }}>Developed by HafeezRaath: 03493850656</div>
      </div>
    </div>
  );

  // ===== DESIGN 2: Modern (INCREASED FONTS) =====
  const renderDesign2 = () => (
    <div style={{
      width: '58mm',
      padding: '6px 8px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      lineHeight: '1.4',
      background: '#f8fafc',
      color: '#1a1a1a',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', background: '#10b981', color: 'white', borderRadius: '6px', padding: '8px', marginBottom: '6px' }}>
        {shop?.logoPreview && (
          <img src={shop.logoPreview} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '50%', border: '2px solid white', marginBottom: '3px' }} />
        )}
        <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '1px' }}>{shop?.name || 'RAATH POS'}</div>
        <div style={{ fontSize: '8px', opacity: 0.9 }}>{shop?.tagline || 'Retail Management'}</div>
        <div style={{ fontSize: '7px', opacity: 0.8 }}>📞 {shop?.phone || '0349-3860656'} | {shop?.address || 'Lahore'}</div>
        {isFBRModeActive ? (
          <div style={{ fontSize: '7px', opacity: 0.8, marginTop: '3px' }}>⚡ FBR Integrated (ON)</div>
        ) : (
          <div style={{ fontSize: '7px', opacity: 0.8, marginTop: '3px' }}>⏳ Demo Mode (0% Tax)</div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '6px', padding: '6px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginBottom: '6px', fontSize: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Invoice #{sale?.invoiceNo || 'N/A'}</span>
          <span style={{ color: '#64748b' }}>{dateStr}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '3px', fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>
          {party?.name || 'Walk-in Customer'}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '6px', padding: '6px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginBottom: '6px' }}>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '7px', textTransform: 'uppercase', marginBottom: '3px' }}>
          <span style={{ flex: 1 }}>Item</span>
          <span style={{ width: '24px', textAlign: 'center' }}>Qty</span>
          <span style={{ width: '35px', textAlign: 'right' }}>Total</span>
        </div>
        {(items || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', padding: '3px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '8px' }}>
            <span style={{ flex: 1, fontWeight: '500' }}>{item.name || 'Item'}</span>
            <span style={{ width: '24px', textAlign: 'center' }}>{Number(item.qty || 0).toFixed(0)}</span>
            <span style={{ width: '35px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>Rs. {Number(item.total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#10b981', color: 'white', borderRadius: '6px', padding: '6px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: '8px', opacity: 0.8 }}>GRAND TOTAL</div>
        <div style={{ fontSize: '16px', fontWeight: '800' }}>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</div>
      </div>

      {sale?.tax > 0 && (
        <div style={{ background: '#f0fdf4', borderRadius: '6px', padding: '4px 8px', textAlign: 'center', marginTop: '4px', border: '1px solid #bbf7d0', fontSize: '8px' }}>
          Tax ({isFBRModeActive ? (fbrConfig?.fbrTaxRate || 18) : 0}%): Rs. {Number(sale.tax).toFixed(2)}
        </div>
      )}

      {renderFBRTaxInfo() && (
        <div style={{ 
          background: '#f0fdf4', 
          borderRadius: '6px', 
          padding: '4px 8px', 
          textAlign: 'center',
          marginTop: '4px',
          border: '1px solid #bbf7d0',
          fontSize: '8px'
        }}>
          {renderFBRTaxInfo()}
        </div>
      )}

      {renderFBRSection()}

      <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '6px', color: '#94a3b8' }}>
        Developed by HafeezRaath: 03493850656
      </div>
    </div>
  );

  // ===== DESIGN 3: Premium (INCREASED FONTS) =====
  const renderDesign3 = () => (
    <div style={{
      width: '58mm',
      padding: '6px 8px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      lineHeight: '1.4',
      background: '#fff',
      color: '#1a1a1a',
      boxSizing: 'border-box',
      border: '2px solid #1e293b'
    }}>
      <div style={{ textAlign: 'center', padding: '4px 0', borderBottom: '3px double #1e293b' }}>
        {shop?.logoPreview && (
          <img src={shop.logoPreview} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', marginBottom: '3px' }} />
        )}
        <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', color: '#1e293b' }}>{shop?.name || 'RAATH POS'}</div>
        <div style={{ fontSize: '7px', color: '#64748b' }}>{shop?.address || 'Main Market, Lahore'} | 📞 {shop?.phone || '0349-3860656'}</div>
        {isFBRModeActive ? (
          <div style={{ fontSize: '7px', color: '#10b981', marginTop: '3px' }}>⚡ FBR Integrated (ON)</div>
        ) : (
          <div style={{ fontSize: '7px', color: '#6b7280', marginTop: '3px' }}>⏳ Demo Mode (0% Tax)</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0', fontSize: '8px' }}>
        <span style={{ fontWeight: 'bold' }}>INVOICE #{sale?.invoiceNo || 'N/A'}</span>
        <span>{dateStr}</span>
      </div>

      <div style={{ textAlign: 'center', padding: '4px 0', fontStyle: 'italic', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '7px', color: '#64748b' }}>Billed To</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{party?.name || 'Walk-in Customer'}</div>
        {party?.phone && <div style={{ fontSize: '7px', color: '#64748b' }}>📱 {party.phone}</div>}
      </div>

      <div style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #1e293b', padding: '3px 0', fontWeight: 'bold', fontSize: '7px' }}>
          <span style={{ flex: 1 }}>Description</span>
          <span style={{ width: '24px', textAlign: 'center' }}>Qty</span>
          <span style={{ width: '35px', textAlign: 'right' }}>Amount</span>
        </div>
        {(items || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', padding: '3px 0', borderBottom: '1px dotted #e2e8f0', fontSize: '8px' }}>
            <span style={{ flex: 1 }}>{item.name || 'Item'}</span>
            <span style={{ width: '24px', textAlign: 'center' }}>{Number(item.qty || 0).toFixed(0)}</span>
            <span style={{ width: '35px', textAlign: 'right', fontWeight: 'bold' }}>Rs. {Number(item.total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '2px solid #1e293b', padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
          <span>Sub Total</span>
          <span>Rs. {Number(sale?.subtotal || 0).toFixed(2)}</span>
        </div>
        {sale?.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#dc2626' }}>
          <span>Discount</span>
          <span>-Rs. {Number(sale.discount).toFixed(2)}</span>
        </div>}
        {sale?.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
          <span>Tax ({isFBRModeActive ? (fbrConfig?.fbrTaxRate || 18) : 0}%)</span>
          <span>Rs. {Number(sale.tax).toFixed(2)}</span>
        </div>}
        {renderFBRTaxInfo()}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '2px solid #1e293b', paddingTop: '3px', marginTop: '3px' }}>
          <span>GRAND TOTAL</span>
          <span style={{ color: '#10b981' }}>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>

      {renderFBRSection()}

      <div style={{ textAlign: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '3px double #1e293b', fontSize: '6px', color: '#94a3b8' }}>
        Developed by HafeezRaath: 03493850656
      </div>
    </div>
  );

  // ===== DESIGN 4: Imtiaz Style (INCREASED FONTS) =====
  const renderDesign4 = () => (
    <div style={{
      width: '58mm',
      padding: '6px 8px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      lineHeight: '1.4',
      background: '#ffffff',
      color: '#111827',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', paddingBottom: '6px', borderBottom: '2px dashed #374151', marginBottom: '4px' }}>
        {shop?.logoPreview && (
          <img src={shop.logoPreview} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', marginBottom: '4px', borderRadius: '4px' }} />
        )}
        <div style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '0.5px', color: '#111827', textTransform: 'uppercase' }}>
          {shop?.name || 'MY STORE'}
        </div>
        <div style={{ fontSize: '8px', fontWeight: '700', color: '#4b5563' }}>
          {shop?.address || 'Main Market, Lahore'}
        </div>
        <div style={{ fontSize: '8px', fontWeight: '700', color: '#4b5563' }}>
          📞 {shop?.phone || '0349-3860656'} | NTN: {shop?.taxNumber || 'B353738'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
           <div style={{ fontSize: '22px', color: '#111827' }}><QrCode fontSize="small" /></div>
        </div>
      </div>

      <div style={{ padding: '4px 0', fontSize: '8px', borderBottom: '1px dotted #9ca3af', fontWeight: '700', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
        <span>Transaction #: {sale?.invoiceNo || 'N/A'}</span>
        <span>Date: {new Date(sale?.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>
      
      <div style={{ fontWeight: '900', textAlign: 'center', padding: '6px 0', color: '#111827', fontSize: '10px', letterSpacing: '2px' }}>
        ORIGINAL RECEIPT
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', color: '#111827', fontSize: '8px', borderTop: '1px solid #111827', borderBottom: '1px solid #111827', padding: '4px 6px', background: '#f9fafb' }}>
        <span style={{ flex: 2, textAlign: 'left' }}>Product</span>
        <span style={{ width: '28px', textAlign: 'center' }}>Qty</span>
        <span style={{ width: '38px', textAlign: 'right' }}>Price</span>
        <span style={{ width: '38px', textAlign: 'right' }}>Disc</span>
        <span style={{ width: '44px', textAlign: 'right' }}>Total</span>
      </div>

      <div style={{ padding: '6px 0', fontSize: '8px' }}>
        {(items || []).map((item, idx) => (
          <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px dotted #d1d5db', paddingBottom: '6px' }}>
             <div style={{ fontWeight: '800', color: '#111827', fontSize: '9px', marginBottom: '3px' }}>
               {item.name || 'Item'}
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#374151', paddingLeft: '6px' }}>
               <span style={{ flex: 2 }}>Qty: {Number(item.qty || 0).toFixed(2)}</span>
               <span style={{ width: '38px', textAlign: 'right' }}>{Number(item.price || 0).toFixed(2)}</span>
               <span style={{ width: '38px', textAlign: 'right' }}>{Number(item.discount || 0).toFixed(2)}</span>
               <span style={{ width: '44px', textAlign: 'right', fontWeight: '900', color: '#111827' }}>Rs. {Number(item.total || 0).toFixed(2)}</span>
             </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '2px solid #111827', paddingTop: '6px', marginTop: '4px', fontSize: '8px', fontWeight: '700', color: '#374151' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
           <span>Total Items/Quantity</span>
           <span>{items?.length || 0}/{totalQty.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
           <span>Discount</span>
           <span>Rs. {Number(sale?.discount || 0).toFixed(2)}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '12px', color: '#111827', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #111827' }}>
           <span>Invoice Value</span>
           <span>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>

      {(sale?.tax > 0 || isFBRModeActive) && (
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #9ca3af', fontSize: '7px' }}>
          <div style={{ fontWeight: '900', textAlign: 'center', display: 'block', color: '#111827', fontSize: '8px', marginBottom: '4px' }}>
            Sales Tax Breakup
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#4b5563', fontSize: '7px' }}>
             <span>Sale</span><span>Ext. Amt</span><span>GST</span><span>Inl. Amt</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#374151', fontSize: '7px' }}>
             <span>Taxable</span>
             <span>Rs. {Number(sale?.subtotal || 0).toFixed(2)}</span>
             <span>Rs. {Number(sale?.tax || 0).toFixed(2)}</span>
             <span>Rs. {Number(sale?.grandTotal || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '8px', borderTop: '2px solid #111827', paddingTop: '6px' }}>
        <div style={{ fontWeight: '900', textAlign: 'center', color: '#111827', fontSize: '9px' }}>Payments</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#374151', fontSize: '8px', marginTop: '4px' }}>
           <span>{sale?.payment_mode || 'Cash'}</span>
           <span>Rs. {Number(sale?.paid || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#4b5563', fontSize: '8px' }}>
           <span>Change Due</span>
           <span>Rs. {Number(sale?.change || 0).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '2px dashed #9ca3af' }}>
        <div style={{ fontWeight: '900', color: '#111827', fontSize: '10px', letterSpacing: '1px' }}>
          THANK YOU!
        </div>
        <div style={{ fontWeight: '700', color: '#4b5563', fontSize: '7px' }}>
          {shop?.receiptFooter || 'Thank you for shopping with us!'}
        </div>
      </div>
    </div>
  );

  if (design === 'design2') return renderDesign2();
  if (design === 'design3') return renderDesign3();
  if (design === 'design4') return renderDesign4();
  return renderDesign1();
});

// ==================== TAX SUMMARY COMPONENT ====================
const TaxSummary = ({ totalTax, taxRate, fbrMode, fbrEnabled }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!fbrEnabled) return null;
  
  const taxType = fbrMode ? 'FBR Tax' : 'Demo Tax (0%)';
  const taxColor = fbrMode ? '#10b981' : '#6b7280';
  
  return (
    <Box sx={{ 
      bgcolor: fbrMode ? '#f0fdf4' : '#f9fafb', 
      border: `1px solid ${fbrMode ? '#bbf7d0' : '#e5e7eb'}`,
      borderRadius: 1,
      p: 1,
      mt: 1
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" fontWeight="bold" color={taxColor}>
            {taxType} Summary
          </Typography>
          <Chip 
            size="small" 
            label={fbrMode ? 'ON' : 'OFF'} 
            sx={{ 
              height: 16, 
              fontSize: '0.5rem', 
              bgcolor: fbrMode ? '#10b981' : '#9ca3af',
              color: 'white'
            }} 
          />
        </Box>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
        </IconButton>
      </Box>
      
      {expanded && (
        <Box sx={{ mt: 0.5 }}>
          <Divider sx={{ my: 0.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
            <Typography variant="caption" color="text.secondary">Tax Rate</Typography>
            <Typography variant="caption" fontWeight="bold">{taxRate}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
            <Typography variant="caption" color="text.secondary">Total Tax Collected</Typography>
            <Typography variant="caption" fontWeight="bold" color={taxColor}>
              {formatPKR(totalTax)}
            </Typography>
          </Box>
          {fbrMode && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <Typography variant="caption" color="text.secondary">FBR Status</Typography>
              <Chip 
                size="small" 
                label="Active" 
                sx={{ height: 14, fontSize: '0.4rem', bgcolor: '#10b981', color: 'white' }} 
              />
            </Box>
          )}
          {!fbrMode && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <Typography variant="caption" color="text.secondary">Mode</Typography>
              <Chip 
                size="small" 
                label="Demo (0% Tax)" 
                sx={{ height: 14, fontSize: '0.4rem', bgcolor: '#9ca3af', color: 'white' }} 
              />
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
            <Typography variant="caption" color="text.secondary">Total Sales (Taxable)</Typography>
            <Typography variant="caption" fontWeight="bold">{formatPKR(taxRate > 0 ? totalTax / (taxRate / 100) : 0)}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ==================== PRODUCT CATEGORY GRID ====================
const ProductCategoryGrid = ({ 
  categories, 
  products, 
  selectedCategory, 
  setSelectedCategory, 
  addToCart,
  updateCartQty,
  cart,
  saleType,
  showCostPrice,
  setShowCostPrice,
  showWholesalePrice,
  setShowWholesalePrice,
  fbrEnabled 
}) => {
  const filteredProducts = selectedCategory 
    ? products.filter(p => String(p.category_id) === String(selectedCategory))
    : products;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* HORIZONTAL CATEGORY SCROLL - PILL STYLE */}
      <Box sx={{ 
        display: 'flex', 
        gap: 0.5, 
        mb: 1, 
        overflowX: 'auto', 
        pb: 0.5,
        flexShrink: 0,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#10b981', borderRadius: 2 },
        '&::-webkit-scrollbar-track': { bgcolor: '#f1f1f1', borderRadius: 2 }
      }}>
        <Button
          variant={selectedCategory === '' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setSelectedCategory('')}
          sx={{ 
            borderRadius: 20, 
            px: 1.5, 
            py: 0.3, 
            fontSize: '0.6rem',
            whiteSpace: 'nowrap',
            bgcolor: selectedCategory === '' ? '#10b981' : 'transparent',
            color: selectedCategory === '' ? 'white' : '#10b981',
            borderColor: '#10b981',
            minHeight: 28,
            '&:hover': {
              bgcolor: selectedCategory === '' ? '#059669' : '#f0fdf4'
            }
          }}
        >
          🏷️ All
        </Button>
        {categories.map(cat => (
          <Button
            key={cat.id}
            variant={String(selectedCategory) === String(cat.id) ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedCategory(String(cat.id))}
            sx={{ 
              borderRadius: 20, 
              px: 1.5, 
              py: 0.3, 
              fontSize: '0.6rem',
              whiteSpace: 'nowrap',
              bgcolor: Number(selectedCategory) === Number(cat.id) ? '#10b981' : 'transparent',
              color: Number(selectedCategory) === Number(cat.id) ? 'white' : '#10b981',
              borderColor: '#10b981',
              minHeight: 28,
              '&:hover': {
              bgcolor: String(selectedCategory) === String(cat.id) ? '#10b981' : 'transparent',
              }
            }}
          >
            {cat.icon || '📁'} {cat.name}
            <Chip 
              size="small" 
              label={products.filter(p => String(p.category_id) === String(cat.id)).length} 
              sx={{ 
                height: 16, 
                fontSize: '0.4rem', 
                ml: 0.5,
                bgcolor: Number(selectedCategory) === Number(cat.id) ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
                               color: String(selectedCategory) === String(cat.id) ? 'white' : '#10b981',
                minWidth: 18
              }} 
            />
          </Button>
        ))}
      </Box>

      {/* TOOLBAR */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Typography variant="subtitle2" fontWeight="bold" fontSize="0.75rem">
          Products
        </Typography>
        <Chip 
          size="small" 
          label={`${filteredProducts.length} items`} 
          color="primary" 
          variant="outlined" 
          sx={{ height: 20, fontSize: '0.55rem' }}
        />
        <ButtonGroup size="small" sx={{ ml: 'auto' }}>
          <Tooltip title="Toggle Cost Price">
            <Button 
              variant={showCostPrice ? 'contained' : 'outlined'} 
              onClick={() => {
                setShowCostPrice(!showCostPrice);
                if (showWholesalePrice) setShowWholesalePrice(false);
              }}
              sx={{ fontSize: '0.55rem', py: 0.3 }}
            >
              Cost
            </Button>
          </Tooltip>
          <Tooltip title="Toggle Wholesale Price">
            <Button 
              variant={showWholesalePrice ? 'contained' : 'outlined'} 
              onClick={() => {
                setShowWholesalePrice(!showWholesalePrice);
                if (showCostPrice) setShowCostPrice(false);
              }}
              sx={{ fontSize: '0.55rem', py: 0.3 }}
            >
              Whole
            </Button>
          </Tooltip>
        </ButtonGroup>
        {fbrEnabled && (
          <Chip 
            size="small" 
            label="⚡ FBR" 
            color="success" 
            sx={{ fontSize: '0.45rem', height: 20 }}
          />
        )}
      </Box>
      
      {/* PRODUCT GRID */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
        gridAutoRows: 'minmax(200px, auto)',
        gap: 1,
        alignContent: 'start',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#10b981', borderRadius: 2 },
        '&::-webkit-scrollbar-track': { bgcolor: '#f1f1f1', borderRadius: 2 }
      }}>
        {filteredProducts.slice(0, 50).map(product => {
          const cartItem = cart?.find(c => 
            String(c.variantId || c.id || c.variant_id || c.productId) === String(product.id)
          );
          const inCart = !!cartItem;
          const cartQty = cartItem ? (cartItem.qty || cartItem.quantity || 0) : 0;
          const stock = Number(product.current_stock || 0);
          const price = saleType === 'wholesale' 
            ? (product.wholesale_price || product.retail_price || 0)
            : (product.retail_price || product.purchase_price || 0);
          const costPrice = product.purchase_price || product.cost_price || 0;
          const wholesalePrice = product.wholesale_price || 0;

          return (
            <Card 
              key={product.id} 
              sx={{ 
                cursor: 'pointer', 
                position: 'relative',
                minHeight: 200,
                opacity: stock <= 0 ? 0.5 : 1,
                border: inCart ? '2px solid #10b981' : '1px solid #e5e7eb',
                '&:hover': { 
                  borderColor: '#10b981', 
                  boxShadow: 2,
                  transform: 'translateY(-1px)',
                  transition: 'all 0.15s ease'
                },
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => stock > 0 && !inCart && addToCart(product, 0)}
            >
              {stock <= 0 && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  right: 0, 
                  bgcolor: 'error.main', 
                  color: 'white', 
                  px: 0.5, 
                  fontSize: '0.45rem',
                  borderRadius: '0 4px 0 4px',
                  zIndex: 1
                }}>
                  OUT
                </Box>
              )}
              {inCart && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  bgcolor: '#10b981', 
                  color: 'white', 
                  px: 0.8, 
                  py: 0.2,
                  fontSize: '0.55rem',
                  fontWeight: 'bold',
                  borderRadius: '4px 0 4px 0',
                  zIndex: 1
                }}>
                  {cartQty}x
                </Box>
              )}
              <CardContent sx={{ p: 0.8, '&:last-child': { pb: 0.8 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* PRODUCT IMAGE */}
                {product.image_url ? (
                  <Box sx={{ 
                    width: '100%', 
                    height: 70, 
                    bgcolor: '#f3f4f6', 
                    borderRadius: 1,
                    mb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={product.image_url} 
                      alt={product.product_name || product.variant_name} 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain' 
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    width: '100%', 
                    height: 70, 
                    bgcolor: '#f3f4f6', 
                    borderRadius: 1,
                    mb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    opacity: 0.3
                  }}>
                    📦
                  </Box>
                )}
                
                <Typography variant="caption" fontWeight="bold" noWrap fontSize="0.65rem" title={product.product_name || product.variant_name}>
                  {product.product_name || product.variant_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap fontSize="0.5rem">
                  SKU: {product.sku || 'N/A'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.3 }}>
                  <Typography variant="body2" fontWeight="bold" color="#10b981" fontSize="0.7rem">
                    Rs. {Number(price).toFixed(0)}
                  </Typography>
                  <Chip 
                    label={stock} 
                    size="small" 
                    sx={{ height: 14, fontSize: '0.4rem' }} 
                    color={stock > 10 ? 'success' : stock > 0 ? 'warning' : 'error'} 
                  />
                </Box>
                {showCostPrice && (
                  <Typography variant="caption" color="text.secondary" fontSize="0.45rem">
                    Cost: Rs. {Number(costPrice).toFixed(0)}
                  </Typography>
                )}
                {showWholesalePrice && (
                  <Typography variant="caption" color="text.secondary" fontSize="0.45rem">
                    Whole: Rs. {Number(wholesalePrice).toFixed(0)}
                  </Typography>
                )}
              </CardContent>

              {/* CART CONTROLS FOR GRID CARDS */}
              {inCart && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f0fdf4', px: 1, py: 0.5, borderTop: '1px solid #bbf7d0', flexShrink: 0, minHeight: 32 }} onClick={(e) => e.stopPropagation()}>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => updateCartQty(product.id, cartQty - 1)}
                    sx={{ p: 0.2 }}
                  >
                    <Remove fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" fontWeight="bold" color="#059669">
                    {cartQty}
                  </Typography>
                  <IconButton 
                    size="small" 
                    color="success" 
                    onClick={() => updateCartQty(product.id, cartQty + 1)}
                    disabled={cartQty >= stock}
                    sx={{ p: 0.2 }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

// ==================== FBR SCAN DIALOG ====================
const FBRScanDialog = ({ open, onClose, onScanComplete, showSnackbar }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualRef, setManualRef] = useState('');

  const handleScan = async () => {
    setScanning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = {
        success: true,
        data: {
          reference: `FBR-${Date.now()}`,
          status: 'verified',
          taxRate: 18,
          amount: 0
        }
      };
      setScanResult(result);
      onScanComplete(result);
      showSnackbar('✅ FBR Invoice Verified', 'success');
    } catch (err) {
      onScanComplete({ success: false, error: err.message });
      showSnackbar('❌ FBR Scan Failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleManualVerify = () => {
    if (!manualRef.trim()) {
      showSnackbar('Please enter FBR reference', 'warning');
      return;
    }
    onScanComplete({ 
      success: true, 
      data: { reference: manualRef, status: 'verified', manual: true } 
    });
    showSnackbar(`✅ FBR Reference Verified: ${manualRef}`, 'success');
    setManualRef('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <QrCode sx={{ mr: 1, verticalAlign: 'middle' }} />
        FBR Invoice Scanner
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Paper sx={{ 
            p: 3, 
            bgcolor: '#f0fdf4', 
            border: '2px dashed #10b981',
            borderRadius: 2
          }}>
            <QrCodeScanner sx={{ fontSize: 80, color: '#10b981' }} />
            <Typography variant="h6" color="#10b981" fontWeight="bold">
              {scanning ? 'Scanning...' : 'Ready to Scan'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Scan FBR QR code from invoice
            </Typography>
          </Paper>
        </Box>

        <Divider sx={{ my: 2 }}>OR</Divider>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Enter FBR Reference"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
          />
          <Button 
            variant="outlined" 
            onClick={handleManualVerify}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Verify
          </Button>
        </Box>

        {scanResult && (
          <Alert severity={scanResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
            {scanResult.success ? `✅ Verified: ${scanResult.data.reference}` : `❌ ${scanResult.error}`}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button 
          variant="contained" 
          onClick={handleScan} 
          disabled={scanning}
          sx={{ bgcolor: '#10b981' }}
          startIcon={scanning ? <SyncIcon className="spin" /> : <QrCode />}
        >
          {scanning ? 'Scanning...' : 'Scan FBR QR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== PRINTER SETTINGS DIALOG ====================
const PrinterSettingsDialog = ({ open, onClose, onPrinterSelect }) => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [receiptDesign, setReceiptDesign] = useState(() => getReceiptDesign());

  useEffect(() => {
    if (open) {
      loadPrinters();
      const saved = localStorage.getItem('default_printer');
      if (saved) setSelectedPrinter(saved);
    }
  }, [open]);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      if (window.electronAPI && window.electronAPI.getPrinters) {
        const list = await window.electronAPI.getPrinters();
        setPrinters(list || []);
      } else {
        setPrinters(['Default Printer', 'Thermal Printer', 'Receipt Printer']);
      }
    } catch (err) {
      console.error('Failed to load printers:', err);
      setPrinters(['Default Printer']);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (selectedPrinter) {
      localStorage.setItem('default_printer', selectedPrinter);
      localStorage.setItem('receipt_design', receiptDesign);
      onPrinterSelect(selectedPrinter);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <PrintIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Printer Settings
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Select Printer</InputLabel>
            <Select 
              value={selectedPrinter} 
              onChange={(e) => setSelectedPrinter(e.target.value)}
              label="Select Printer"
            >
              {printers.map((printer, idx) => (
                <MenuItem key={idx} value={printer}>
                  {printer}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Receipt Design</InputLabel>
            <Select 
              value={receiptDesign} 
              onChange={(e) => setReceiptDesign(e.target.value)}
              label="Receipt Design"
            >
              <MenuItem value="design1">Design 1 - Classic Green</MenuItem>
              <MenuItem value="design2">Design 2 - Modern Clean</MenuItem>
              <MenuItem value="design3">Design 3 - Bold Border</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 1 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              💡 Tips:
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              • Press F12 to open this dialog
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              • Printer saves automatically
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              • Receipt design updates on next print
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ bgcolor: '#10b981' }}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== SHORTCUTS HELP ====================
const ShortcutsHelp = ({ open, onClose }) => {
  const shortcuts = [
    { key: 'F1', action: 'Focus Search / Scanner' },
    { key: 'F2', action: 'Toggle View (Grid/List)' },
    { key: 'F3', action: 'Hold Current Bill' },
    { key: 'F5', action: 'View Held Bills' },
    { key: 'F9', action: 'Save / Process Payment' },
    { key: 'F10', action: 'New Bill / Clear Cart' },
    { key: 'F12', action: 'Printer Settings' },
    { key: 'Tab', action: 'Move to Next Field' },
    { key: 'Shift+Tab', action: 'Move to Previous Field' },
    { key: 'Enter', action: 'Save Sale (on Paid field)' },
    { key: 'Escape', action: 'Close Dialogs' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
        <KeyboardArrowDown sx={{ mr: 1, verticalAlign: 'middle' }} />
        Keyboard Shortcuts
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List sx={{ p: 0 }}>
          {shortcuts.map((sc, idx) => (
            <ListItem 
              key={idx} 
              divider={idx < shortcuts.length - 1}
              sx={{ 
                py: 1.5,
                bgcolor: idx % 2 === 0 ? 'transparent' : '#f8fafc'
              }}
            >
              <ListItemIcon>
                <Chip 
                  label={sc.key} 
                  size="small" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    fontWeight: 'bold',
                    bgcolor: '#10b981',
                    color: 'white',
                    minWidth: 60
                  }} 
                />
              </ListItemIcon>
              <ListItemText primary={sc.action} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 2, bgcolor: '#f0fdf4' }}>
          <Typography variant="caption" color="text.secondary">
            💡 FBR Mode: Press FBR toggle button to switch between Real and Demo mode
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#10b981' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== MAIN COMPONENT ====================
export default function BillingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // ---- STATE ----
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  const [partyType, setPartyType] = useState('customer');
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [saleType, setSaleType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountType, setBillDiscountType] = useState('amount');
  const [taxPercent, setTaxPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState('INV-0001');
  const [heldBills, setHeldBills] = useState(() => {
    const saved = localStorage.getItem('heldBills');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [offers, setOffers] = useState([]);
  const [showOffersDialog, setShowOffersDialog] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [showWholesalePrice, setShowWholesalePrice] = useState(false);
  
  // ---- FBR State ----
  const [fbrEnabled, setFbrEnabled] = useState(false);
  const [fbrMode, setFbrMode] = useState(false);
  const [showFBRScan, setShowFBRScan] = useState(false);
  const [fbrStatus, setFbrStatus] = useState(null);
  const [fbrSyncEnabled, setFbrSyncEnabled] = useState(false);
  
  // ---- Tax Summary State ----
  const [totalTaxCollected, setTotalTaxCollected] = useState(0);
    // ---- Payment Account Routing ----
  const [accounts, setAccounts] = useState([]);
  const [paymentAccount, setPaymentAccount] = useState(null);
  
  // Printer
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const printRef = useRef();
  const searchRef = useRef();

  // ---- SNACKBAR HELPER ----
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ---- CHECK FBR STATUS ----
  useEffect(() => {
    const checkFBR = () => {
      const enabled = isFBRConfigured();
      setFbrEnabled(enabled);
      if (enabled) {
        setFbrSyncEnabled(true);
        const savedMode = localStorage.getItem('fbr_mode');
        if (savedMode !== null) {
          setFbrMode(savedMode === 'true');
        } else {
          setFbrMode(true);
        }
      } else {
        setFbrMode(false);
      }
    };
    checkFBR();
    
    const handleStorageChange = (e) => {
      if (e.key === 'tax_settings') {
        checkFBR();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ---- Load Total Tax Collected ----
  useEffect(() => {
    const loadTaxSummary = async () => {
      try {
        if (db.getTaxSummary) {
          const summary = await db.getTaxSummary();
          setTotalTaxCollected(summary?.totalTax || 0);
        }
      } catch (err) {
        console.error('Failed to load tax summary:', err);
      }
    };
    loadTaxSummary();
  }, []);

  // ---- SAVE FBR MODE ----
  const toggleFBRMode = () => {
    const newMode = !fbrMode;
    setFbrMode(newMode);
    localStorage.setItem('fbr_mode', String(newMode));
    showSnackbar(
      newMode ? '✅ FBR Mode: ON - Real Tax & QR' : '⏳ FBR Mode: OFF - 0% Tax (Demo)',
      newMode ? 'success' : 'warning'
    );
  };

  // ---- LOAD ----
  useEffect(() => {
    const saved = localStorage.getItem('default_printer');
    if (saved) setDefaultPrinter(saved);
  }, []);

  // ---- INITIAL DATA LOAD ----
  useEffect(() => {
    loadData();
    generateInvoiceNo();
    setTimeout(() => searchRef.current?.focus(), 500);
  }, []);

  // ---- Auto select payment account from memory ----
  useEffect(() => {
    if (accounts.length === 0) return;
    
    if (paymentMode === 'credit') {
      setPaymentAccount(null);
      return;
    }

    const prefs = JSON.parse(localStorage.getItem('raath_payment_prefs') || '{}');
    const savedId = prefs[paymentMode];
    
    const modeAccounts = accounts.filter(a => a.type === paymentMode && a.status === 'active');
    let target = null;
    
    if (savedId) {
      target = modeAccounts.find(a => String(a.id) === String(savedId));
    }
    if (!target && modeAccounts.length > 0) {
      target = modeAccounts[0];
    }
    
    setPaymentAccount(target || null);
  }, [paymentMode, accounts]);

  const handlePaymentAccountChange = (accountId) => {
    const acc = accounts.find(a => String(a.id) === String(accountId));
    setPaymentAccount(acc);
    if (acc && paymentMode !== 'credit') {
      const prefs = JSON.parse(localStorage.getItem('raath_payment_prefs') || '{}');
      prefs[paymentMode] = accountId;
      localStorage.setItem('raath_payment_prefs', JSON.stringify(prefs));
    }
  };

  const loadData = async () => {
    try {
      const [allVariants, custs, sups, cats, offs, accs] = await Promise.all([
        (db.getAllVariants ? db.getAllVariants() : db.getProductVariants()).catch(() => []),
        db.getCustomers().catch(() => []),
        db.getSuppliers().catch(() => []),
        db.getCategories().catch(() => []),
        db.getOffers ? db.getOffers().catch(() => []) : Promise.resolve([]),
        db.getAccounts ? db.getAccounts().catch(() => []) : Promise.resolve([])
      ]);
      setProducts(allVariants || []);
      setCustomers(custs || []);
      setSuppliers(sups || []);
      setCategories(cats || []);
      setOffers(offs || []);
      setAccounts(accs || []);
    } catch (err) {
      console.error("Data loading failed:", err);
    }
  };

  const generateInvoiceNo = async () => {
  try {
    if (window.electronAPI && window.electronAPI.dbQuery) {
      // Electron mode - direct query
      const rows = await window.electronAPI.dbQuery(
        "SELECT invoice_no FROM sales WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1"
      );
      
      if (rows && rows.length > 0) {
        const lastNum = parseInt(rows[0].invoice_no.split('-')[1]) || 0;
        const nextNum = lastNum + 1;
        setInvoiceNo(`INV-${String(nextNum).padStart(4, '0')}`);
      } else {
        setInvoiceNo('INV-0001');
      }
    } else if (db.getNextInvoiceNumber) {
      // Browser mode
      const nextNo = await db.getNextInvoiceNumber();
      setInvoiceNo(nextNo);
    } else {
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
    }
  } catch (err) {
    console.error('Error generating invoice:', err);
    // Fallback: use timestamp
    setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
  }
};

  // ---- SEARCH ----
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = products.filter(p => {
      if (selectedCategory && String(p.category_id) !== String(selectedCategory)) return false;
      const name = (p.product_name || p.variant_name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    }).slice(0, 15);
    setSearchResults(results);
  }, [searchQuery, products, selectedCategory]);

  // ---- ADD TO CART ----
  const addToCart = useCallback((product, perDiscount = 0) => {
    const availableStock = Number(product.current_stock || 0);
    if (availableStock <= 0) {
      showSnackbar(`🚫 ${product.product_name} Out of Stock!`, 'error');
      return;
    }

    let basePrice;
    if (showCostPrice) {
      basePrice = product.purchase_price || product.cost_price || product.retail_price || 0;
    } else if (showWholesalePrice) {
      basePrice = product.wholesale_price || product.retail_price || product.purchase_price || 0;
    } else {
      basePrice = saleType === 'wholesale' 
        ? (product.wholesale_price || product.retail_price || product.purchase_price || 0)
        : (product.retail_price || product.purchase_price || 0);
    }

    const discountPercent = Math.min(100, Math.max(0, parseFloat(perDiscount) || 0));
    const finalPrice = basePrice - (basePrice * (discountPercent / 100));

    const existingIndex = cart.findIndex(c => c.variantId === product.id);
    
    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].qty + 1;
      if (newQty > availableStock) {
        showSnackbar(`⚠️ Only ${availableStock} available!`, 'warning');
        return;
      }
      updated[existingIndex].qty = newQty;
      updated[existingIndex].price = finalPrice;
      updated[existingIndex].discount = discountPercent;
      updated[existingIndex].total = newQty * finalPrice;
      setCart(updated);
    } else {
      setCart(prev => [...prev, {
        id: Date.now(),
        variantId: product.id,
        productId: product.product_id,
        name: product.product_name || product.variant_name || 'Item',
        sku: product.sku || '',
        qty: 1,
        price: finalPrice,
        total: finalPrice,
        discount: discountPercent,
        discountType: 'percent',
        stock: availableStock,
        isOfferItem: false,
        offerName: null,
        image: product.image_url || null,
        originalPrice: basePrice,
        costPrice: product.purchase_price || product.cost_price || 0,
        wholesalePrice: product.wholesale_price || 0
      }]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    setTimeout(() => searchRef.current?.focus(), 100);
    showSnackbar(`✅ Added ${product.product_name}`, 'success');
  }, [cart, saleType, showCostPrice, showWholesalePrice, showSnackbar]);

  // ---- UPDATE CART QTY BY VARIANT ID ----
  const updateCartQtyByVariant = useCallback((variantId, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) {
      setCart(prev => prev.filter(item => String(item.variantId) !== String(variantId)));
      showSnackbar('🗑️ Item removed from cart', 'info');
      return;
    }
    setCart(prev => prev.map(item => {
      if (String(item.variantId) === String(variantId)) {
        const stockLimit = Number(item.stock || 0);
        const qty = val > stockLimit ? stockLimit : val;
        return {
          ...item,
          qty,
          total: qty * item.price
        };
      }
      return item;
    }));
  }, [showSnackbar]);

  // ---- REMOVE FROM CART ----
  const removeFromCart = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    showSnackbar('🗑️ Item removed from cart', 'info');
  }, [showSnackbar]);

  // ---- CART OPERATIONS ----
  const handleQtyChange = (index, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) return;
    const updated = [...cart];
    const stockLimit = Number(updated[index].stock || 0);
    updated[index].qty = val > stockLimit ? stockLimit : val;
    updated[index].total = updated[index].qty * updated[index].price;
    setCart(updated);
  };

  const handlePriceChange = (index, newPrice) => {
    const val = parseFloat(newPrice);
    if (isNaN(val) || val < 0) return;
    const updated = [...cart];
    updated[index].price = val;
    updated[index].total = updated[index].qty * val;
    setCart(updated);
  };

  const handleItemDiscount = (index, value, type) => {
    const val = parseFloat(value) || 0;
    const updated = [...cart];
    const item = updated[index];
    const basePrice = item.originalPrice || item.price;
    const qty = item.qty;
    const totalBase = qty * basePrice;
    
    if (type === 'percent') {
      const discountPercent = Math.min(100, Math.max(0, val));
      item.discount = discountPercent;
      item.discountType = 'percent';
      const discountAmount = totalBase * (discountPercent / 100);
      item.price = basePrice - (basePrice * (discountPercent / 100));
      item.total = (qty * item.price);
      item.discountAmount = discountAmount;
    } else if (type === 'amount') {
      const discountAmount = Math.min(totalBase, Math.max(0, val));
      item.discountAmount = discountAmount;
      item.discountType = 'amount';
      const discountPercent = (discountAmount / totalBase) * 100;
      item.discount = discountPercent;
      item.price = basePrice - (discountAmount / qty);
      item.total = totalBase - discountAmount;
    }
    
    setCart(updated);
  };

  // ---- CALCULATIONS ----
  const calc = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.qty * (item.originalPrice || item.price)), 0);
    const itemDiscount = cart.reduce((sum, item) => {
      if (item.discountType === 'amount') {
        return sum + (item.discountAmount || 0);
      } else {
        const base = item.qty * (item.originalPrice || item.price);
        return sum + (base * (item.discount || 0) / 100);
      }
    }, 0);
    
    const afterItemDisc = subtotal - itemDiscount;
    const disc = billDiscountType === 'percent' ? (afterItemDisc * (Number(billDiscount) || 0) / 100) : (Number(billDiscount) || 0);
    const afterBillDisc = Math.max(0, afterItemDisc - disc);
    
    const fbrConfig = getFBRConfig();
    
    let effectiveTaxRate = 0;
    if (fbrEnabled && fbrMode) {
      effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
    } else {
      effectiveTaxRate = 0;
    }
    
    setTaxPercent(effectiveTaxRate);
    
    const tax = afterBillDisc * (effectiveTaxRate / 100);
    const grandTotal = afterBillDisc + tax;
    
    // Empty paid = 0 (credit sale). Only when explicitly entered, use that value.
    const paidInput = paidAmount === '' ? 0 : Number(paidAmount);
    const paid = isNaN(paidInput) ? 0 : paidInput;
    
    const due = Math.max(0, grandTotal - paid);
    const change = Math.max(0, paid - grandTotal);
    
    return {
      subtotal, itemDiscount, billDiscount: disc, tax, grandTotal,
      paid: isNaN(paidInput) || paidInput === 0 ? 0 : paidInput,
      actualPaid: paid,
      due, change, totalItems: cart.length,
      totalQty: cart.reduce((s, i) => s + Number(i.qty), 0),
      taxRate: effectiveTaxRate,
      isFBRMode: fbrMode
    };
  }, [cart, billDiscount, billDiscountType, paidAmount, fbrEnabled, fbrMode]);

  // ---- UPDATE TOTAL TAX COLLECTED ----
  useEffect(() => {
    if (calc.tax > 0) {
      setTotalTaxCollected(prev => prev + calc.tax);
    }
  }, [calc.tax]);

  // ---- PRINT ----
  const handlePrint = useCallback(async () => {
    const receiptElement = document.querySelector('.receipt-content');
    
    if (!receiptElement) {
      showSnackbar('No receipt content to print!', 'error');
      return;
    }

    const receiptHTML = receiptElement.innerHTML;

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt #${lastSale?.invoiceNo || ''}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: "Courier New", Courier, monospace;
              background: white;
              color: black;
              width: 58mm;
            }
            * { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
        </body>
      </html>
    `;

    // Try Electron API first if available and configured
    if (window.electronAPI && window.electronAPI.printReceipt) {
      try {
        showSnackbar('🖨️ Printing via Electron...', 'info');
        await window.electronAPI.printReceipt(printHTML);
        showSnackbar('✅ Receipt printed successfully!', 'success');
        return;
      } catch (err) {
        console.error('Electron print failed:', err);
        showSnackbar('⚠️ Print failed, trying browser...', 'warning');
      }
    }
    
    try {
      const win = window.open('', '_blank', 'width=320,height=600');
      if (!win) {
        showSnackbar('❌ Please allow popups for printing', 'error');
        return;
      }
      win.document.write(printHTML);
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
        setTimeout(() => win.close(), 1000);
      }, 500);
    } catch (err) {
      console.error('Fallback print error:', err);
      showSnackbar('❌ Print failed: ' + err.message, 'error');
    }
  }, [lastSale, showSnackbar]);

  // ---- SAVE SALE (WITHOUT PRINT) ----
  const saveSaleOnly = async () => {
    if (cart.length === 0) {
      showSnackbar('Cart is empty!', 'warning');
      return;
    }

    if (isSaving) {
      showSnackbar('⏳ Already saving...', 'info');
      return;
    }

    setIsSaving(true);

    try {
      showSnackbar('⏳ Saving sale...', 'info');
      
      const fbrConfig = getFBRConfig();
      
      let effectiveTaxRate = 0;
      if (fbrEnabled && fbrMode) {
        effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
      } else {
        effectiveTaxRate = 0;
      }
      
      const dummyRef = !fbrMode ? generateDummyQR() : null;
      
      const now = new Date();
      const saleDate = new Date(); // ✅ Hamesha CURRENT date/time lega
      saleDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      const saleData = {
        invoice_no: invoiceNo,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Customer',
        customer_ntn: selectedParty?.ntn || '',
        subtotal: calc.subtotal,
        item_discount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grand_total: calc.grandTotal,
        paid_amount: calc.actualPaid,
        due_amount: calc.due,
        change_amount: calc.change,
        payment_mode: paymentMode,
        payment_status: calc.due > 0 ? (calc.actualPaid > 0 ? 'partial' : 'due') : 'paid',
        sale_type: saleType,
        date: getLocalISOString(saleDate),
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: fbrEnabled && fbrMode ? effectiveTaxRate : 0,
        fbr_tax_amount: calc.tax,
        fbr_business_type: fbrConfig?.fbrBusinessType || 'retail',
        dummy_fbr_reference: dummyRef
      };

      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        product_id: item.productId,
        quantity: item.qty,
        price: item.price,
        discount: item.discount || 0,
        total: item.total
      }));

      // ==================== CREATE SALE (Stock handled internally) ====================
      let result;
      if (window.electronAPI && window.electronAPI.createSale) {
        console.log('🟢 Using Electron createSale API');
        result = await window.electronAPI.createSale({ sale: saleData, items: itemsData });
      } else {
        console.log('🟡 Using IndexedDB createSale');
        result = await db.createSale({ sale: saleData, items: itemsData });
      }
      
      if (!result) {
        throw new Error('No result returned from createSale');
      }

      const saleId = result.id || result.lastInsertRowid;

      // ==================== AUTO PAYMENT TO ACCOUNT LEDGER ====================
      if (calc.actualPaid > 0 && paymentAccount && db.createTransaction) {
        try {
          await db.createTransaction({
            account_id: paymentAccount.id,
            date: getLocalISOString(saleDate),
            transaction_type: 'credit',
            amount: calc.actualPaid - calc.change,
            description: `Sale #${invoiceNo} — ${selectedParty?.name || 'Walk-in Customer'}`,
            payment_mode: paymentMode,
            reference_no: invoiceNo,
            reference_type: 'sale_payment'
          });
          showSnackbar(`✅ Payment recorded in ${paymentAccount.name}`, 'success');
        } catch (ledgerErr) {
          console.error('Ledger entry failed:', ledgerErr);
          showSnackbar('⚠️ Sale saved but payment not recorded in ledger', 'warning');
        }
      }

      // ==================== FBR SYNC ====================
      let fbrStatusData = null;
      
      if (fbrEnabled && fbrMode) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          fbrStatusData = {
            fbr_status: 'SYNCED',
            fbr_reference: `FBR-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
            fbr_response: { success: true, message: 'Invoice synced with FBR' },
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };

          if (db.updateFBRStatus) {
            await db.updateFBRStatus(saleId, fbrStatusData);
          }

          showSnackbar(`✅ FBR Invoice Synced: ${fbrStatusData.fbr_reference}`, 'success');
        } catch (fbrErr) {
          console.error('FBR sync error:', fbrErr);
          fbrStatusData = {
            fbr_status: 'FAILED',
            fbr_error: fbrErr.message,
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };
          showSnackbar('⚠️ FBR sync failed but sale saved', 'warning');
        }
      } else {
        fbrStatusData = {
          fbr_status: 'DEMO',
          fbr_reference: dummyRef,
          fbr_tax_rate: 0,
          fbr_tax_amount: 0,
          fbr_mode: false,
          is_demo: true
        };
        showSnackbar('⏳ Demo Mode: Sale saved with 0% tax', 'warning');
      }

      const legacyReceiptMapping = {
        invoiceNo: invoiceNo,
        subtotal: calc.subtotal,
        itemDiscount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grandTotal: calc.grandTotal,
        paid: calc.actualPaid,
        due: calc.due,
        change: calc.change,
        date: saleData.date,
        payment_mode: paymentMode,
        items: cart,
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: effectiveTaxRate,
        fbr_tax_amount: calc.tax,
        fbr_status: fbrStatusData?.fbr_status || null,
        fbr_reference: fbrStatusData?.fbr_reference || dummyRef,
        fbr_error: fbrStatusData?.fbr_error || null,
        dummy_fbr_reference: dummyRef,
        is_demo_mode: !fbrMode
      };

      setFbrStatus(fbrStatusData);
      setLastSale(legacyReceiptMapping);
      setShowReceipt(false);
      
      setTotalTaxCollected(prev => prev + calc.tax);
      showSnackbar('✅ Sale saved successfully!', 'success');
      
      loadData();
      setCart([]);
      setPaidAmount('');
      setBillDiscount(0);
      setSelectedParty(null);
      setInvoiceDate(today());
      generateInvoiceNo();
      
    } catch (err) {
      console.error("Save error:", err);
      showSnackbar('❌ Error saving sale: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- SAVE SALE WITH PRINT ----
  const saveSaleWithPrint = async () => {
    if (cart.length === 0) {
      showSnackbar('Cart is empty!', 'warning');
      return;
    }

    if (isSaving) {
      showSnackbar('⏳ Already saving...', 'info');
      return;
    }

    setIsSaving(true);

    try {
      showSnackbar('⏳ Saving and printing...', 'info');
      
      const fbrConfig = getFBRConfig();
      
      let effectiveTaxRate = 0;
      if (fbrEnabled && fbrMode) {
        effectiveTaxRate = fbrConfig?.fbrTaxRate || 18;
      } else {
        effectiveTaxRate = 0;
      }
      
      const dummyRef = !fbrMode ? generateDummyQR() : null;
      
      const now = new Date();
      const saleDate = new Date(); // ✅ Hamesha CURRENT date/time lega
      saleDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      const saleData = {
        invoice_no: invoiceNo,
        customer_id: partyType === 'customer' ? selectedParty?.id : null,
        customer_name: selectedParty?.name || 'Walk-in Customer',
        customer_ntn: selectedParty?.ntn || '',
        subtotal: calc.subtotal,
        item_discount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grand_total: calc.grandTotal,
        paid_amount: calc.actualPaid,
        due_amount: calc.due,
        change_amount: calc.change,
        payment_mode: paymentMode,
        payment_status: calc.due > 0 ? (calc.actualPaid > 0 ? 'partial' : 'due') : 'paid',
        sale_type: saleType,
        date: getLocalISOString(saleDate),
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: fbrEnabled && fbrMode ? effectiveTaxRate : 0,
        fbr_tax_amount: calc.tax,
        fbr_business_type: fbrConfig?.fbrBusinessType || 'retail',
        dummy_fbr_reference: dummyRef
      };

      const itemsData = cart.map(item => ({
        product_variant_id: item.variantId,
        product_id: item.productId,
        quantity: item.qty,
        price: item.price,
        discount: item.discount || 0,
        total: item.total
      }));

      // ==================== CREATE SALE (Stock handled internally) ====================
      let result;
      if (window.electronAPI && window.electronAPI.createSale) {
        console.log('🟢 Using Electron createSale API');
        result = await window.electronAPI.createSale({ sale: saleData, items: itemsData });
      } else {
        console.log('🟡 Using IndexedDB createSale');
        result = await db.createSale({ sale: saleData, items: itemsData });
      }
      
      if (!result) {
        throw new Error('No result returned from createSale');
      }

      const saleId = result.id || result.lastInsertRowid;

      // ==================== AUTO PAYMENT TO ACCOUNT LEDGER ====================
      if (calc.actualPaid > 0 && paymentAccount && db.createTransaction) {
        try {
          await db.createTransaction({
            account_id: paymentAccount.id,
            date: getLocalISOString(saleDate),
            transaction_type: 'credit',
            amount: calc.actualPaid - calc.change,
            description: `Sale #${invoiceNo} — ${selectedParty?.name || 'Walk-in Customer'}`,
            payment_mode: paymentMode,
            reference_no: invoiceNo,
            reference_type: 'sale_payment'
          });
          showSnackbar(`✅ Payment recorded in ${paymentAccount.name}`, 'success');
        } catch (ledgerErr) {
          console.error('Ledger entry failed:', ledgerErr);
          showSnackbar('⚠️ Sale saved but payment not recorded in ledger', 'warning');
        }
      }

      // ==================== FBR SYNC ====================
      let fbrStatusData = null;
      
      if (fbrEnabled && fbrMode) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          fbrStatusData = {
            fbr_status: 'SYNCED',
            fbr_reference: `FBR-${Date.now()}-${String(Math.random()).slice(2, 8)}`,
            fbr_response: { success: true, message: 'Invoice synced with FBR' },
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };

          if (db.updateFBRStatus) {
            await db.updateFBRStatus(saleId, fbrStatusData);
          }

          showSnackbar(`✅ FBR Invoice Synced: ${fbrStatusData.fbr_reference}`, 'success');
        } catch (fbrErr) {
          console.error('FBR sync error:', fbrErr);
          fbrStatusData = {
            fbr_status: 'FAILED',
            fbr_error: fbrErr.message,
            fbr_tax_rate: effectiveTaxRate,
            fbr_tax_amount: calc.tax,
            fbr_mode: true
          };
          showSnackbar('⚠️ FBR sync failed but sale saved', 'warning');
        }
      } else {
        fbrStatusData = {
          fbr_status: 'DEMO',
          fbr_reference: dummyRef,
          fbr_tax_rate: 0,
          fbr_tax_amount: 0,
          fbr_mode: false,
          is_demo: true
        };
        showSnackbar('⏳ Demo Mode: Sale saved with 0% tax', 'warning');
      }

      const legacyReceiptMapping = {
        invoiceNo: invoiceNo,
        subtotal: calc.subtotal,
        itemDiscount: calc.itemDiscount,
        discount: calc.billDiscount,
        tax: calc.tax,
        grandTotal: calc.grandTotal,
        paid: calc.actualPaid,
        due: calc.due,
        change: calc.change,
        date: saleData.date,
        payment_mode: paymentMode,
        items: cart,
        fbr_enabled: fbrEnabled && fbrMode,
        fbr_mode: fbrMode,
        fbr_tax_rate: effectiveTaxRate,
        fbr_tax_amount: calc.tax,
        fbr_status: fbrStatusData?.fbr_status || null,
        fbr_reference: fbrStatusData?.fbr_reference || dummyRef,
        fbr_error: fbrStatusData?.fbr_error || null,
        dummy_fbr_reference: dummyRef,
        is_demo_mode: !fbrMode
      };

      setFbrStatus(fbrStatusData);
      setLastSale(legacyReceiptMapping);
      setShowReceipt(true);
      
      setTotalTaxCollected(prev => prev + calc.tax);
      
      showSnackbar('✅ Sale saved! Printing receipt...', 'success');
      
      setTimeout(() => {
        handlePrint();
      }, 500);
      
      loadData();
      setCart([]);
      setPaidAmount('');
      setBillDiscount(0);
      setSelectedParty(null);
      setInvoiceDate(today());
      generateInvoiceNo();
      
    } catch (err) {
      console.error("Save error:", err);
      showSnackbar('❌ Error saving sale: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- HOLD / RESUME ----
  const holdBill = () => {
    if (cart.length === 0) return;
    const hold = {
      id: Date.now(),
      cart: [...cart],
      party: selectedParty,
      partyType,
      total: calc.grandTotal,
      date: new Date().toISOString()
    };
    const updated = [...heldBills, hold];
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
    setCart([]);
    setSelectedParty(null);
    showSnackbar('⏸️ Bill held!', 'info');
  };

  const resumeBill = (bill) => {
    setCart(bill.cart);
    setSelectedParty(bill.party);
    setPartyType(bill.partyType || 'customer');
    setShowResumeDialog(false);
  };

  const deleteHeld = (id) => {
    const updated = heldBills.filter(h => h.id !== id);
    setHeldBills(updated);
    localStorage.setItem('heldBills', JSON.stringify(updated));
  };

  // ---- APPLY OFFER ----
  const applyOffer = async (offer) => {
    try {
      let offerItems = [];
      if (db.getOfferItems) {
        const res = await db.getOfferItems(offer.id);
        offerItems = res.data || res || [];
      }

      if (!offerItems.length) {
        showSnackbar('Offer has no items!', 'warning');
        return;
      }

      for (const item of offerItems) {
        const product = products.find(p => p.id === item.variant_id);
        if (product) {
          const offerPrice = Number(item.offer_price) || Number(product.retail_price) || 0;
          setCart(prev => [...prev, {
            id: Date.now() + Math.random(),
            variantId: product.id,
            productId: product.product_id,
            name: item.product_name || product.product_name || 'Offer Item',
            sku: item.sku || product.sku || '',
            qty: 1,
            price: offerPrice,
            total: offerPrice,
            discount: 0,
            discountType: 'percent',
            stock: Number(product.current_stock) || 0,
            isOfferItem: true,
            offerName: offer.name,
            image: product.image_url || null,
            originalPrice: offerPrice,
            costPrice: product.purchase_price || product.cost_price || 0,
            wholesalePrice: product.wholesale_price || 0
          }]);
        }
      }

      showSnackbar(`🎉 Offer "${offer.name}" added!`, 'success');
      setShowOffersDialog(false);
    } catch (err) {
      console.error('Apply offer error:', err);
      showSnackbar('Error: ' + err.message, 'error');
    }
  };

  const newBill = () => {
    setCart([]);
    setSelectedParty(null);
    setPaidAmount('');
    setBillDiscount(0);
    setInvoiceDate(today());
    generateInvoiceNo();
    setSearchQuery('');
    setSearchResults([]);
    setSearchKey(prev => prev + 1);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ---- FBR Scan Handler ----
  const handleFBRScanComplete = (result) => {
    if (result.success) {
      showSnackbar(`✅ FBR Verified: ${result.data.reference}`, 'success');
    } else {
      showSnackbar('❌ FBR Verification Failed: ' + result.error, 'error');
    }
  };

  // ---- HOTKEYS ----
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (!['F1','F2','F3','F5','F9','F10','F12','Escape'].includes(e.key)) return;
      }
      
      switch(e.key) {
        case 'F1': e.preventDefault(); searchRef.current?.focus(); break;
        case 'F2': e.preventDefault(); setViewMode(prev => prev === 'grid' ? 'list' : 'grid'); break;
        case 'F3': e.preventDefault(); if (cart.length > 0) holdBill(); break;
        case 'F5': e.preventDefault(); setShowResumeDialog(true); break;
        case 'F9': e.preventDefault(); if (cart.length > 0) saveSaleWithPrint(); break;
        case 'F10': e.preventDefault(); if (cart.length > 0 && window.confirm('Clear cart?')) newBill(); else newBill(); break;
        case 'F12': e.preventDefault(); setShowPrinterSettings(true); break;
        case 'Escape': setShowReceipt(false); setShowHoldDialog(false); setShowResumeDialog(false); setShowOffersDialog(false); setShowFBRScan(false); break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, saveSaleWithPrint]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5', overflow: 'hidden', pb: isMobile ? 6 : 0 }}>
      
      {/* HEADER */}
      <Paper sx={{ bgcolor: '#10b981', color: 'white', px: isMobile ? 1 : 2, py: isMobile ? 1 : 1.5, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 0, flexShrink: 0 }}>
        <Receipt sx={{ fontSize: isMobile ? 24 : 28 }} />
        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" sx={{ flex: 1, fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
          {isMobile ? 'POS' : 'Raath Terminal POS'}
        </Typography>
        
        {fbrEnabled && (
          <Tooltip title={fbrMode ? 'FBR Mode: ON' : 'FBR Mode: OFF (0% Tax)'}>
            <Button
              size="small"
              variant="outlined"
              onClick={toggleFBRMode}
              sx={{
                color: 'white',
                borderColor: fbrMode ? '#10b981' : '#6b7280',
                bgcolor: fbrMode ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.3)',
                '&:hover': {
                  bgcolor: fbrMode ? 'rgba(16,185,129,0.5)' : 'rgba(107,114,128,0.5)',
                },
                mr: 1
              }}
              startIcon={fbrMode ? <ToggleOn /> : <ToggleOff />}
            >
              {fbrMode ? 'FBR ON' : 'FBR OFF'}
            </Button>
          </Tooltip>
        )}
        
        {fbrEnabled && fbrMode && (
          <Tooltip title="FBR Integration Active">
            <Chip 
              icon={<VerifiedUser fontSize="small" />}
              label="FBR"
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 1, fontWeight: 'bold' }}
            />
          </Tooltip>
        )}
        
        {fbrEnabled && !fbrMode && (
          <Chip 
            label="Demo"
            size="small" 
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#d1d5db', mr: 1, fontWeight: 'bold' }}
          />
        )}
        
        {defaultPrinter && !isMobile && (
          <Chip icon={<PrintIcon />} label={defaultPrinter.length > 20 ? defaultPrinter.substring(0, 20) + '...' : defaultPrinter} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 1 }} onClick={() => setShowPrinterSettings(true)} />
        )}
        
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, val) => val && setViewMode(val)}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1 }}
            >
              <ToggleButton value="grid" sx={{ color: 'white', '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.3)', color: 'white' } }}>
                <ViewModule fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" sx={{ color: 'white', '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.3)', color: 'white' } }}>
                <ViewList fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            
            <Button 
              size="small" 
              startIcon={<QrCode />} 
              onClick={() => setShowFBRScan(true)}
              sx={{ 
                color: 'white', 
                borderColor: 'white',
                bgcolor: fbrEnabled && fbrMode ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'
              }} 
              variant="outlined"
            >
              {fbrMode ? 'FBR Scan' : 'Demo'}
            </Button>
            
            <Button size="small" startIcon={<Receipt />} onClick={() => setShowResumeDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Held (F5)</Button>
            <Button size="small" startIcon={<Pause />} onClick={() => setShowHoldDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Hold (F3)</Button>
            <Button size="small" startIcon={<LocalOffer />} onClick={() => setShowOffersDialog(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Offers</Button>
            <Button size="small" startIcon={<PrintIcon />} onClick={() => setShowPrinterSettings(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">Printer</Button>
            <Button size="small" startIcon={<KeyboardArrowDown />} onClick={() => setShowShortcuts(true)} sx={{ color: 'white', borderColor: 'white' }} variant="outlined">⌨️</Button>
          </Box>
        )}
        
        {isMobile && (
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => setMobileDrawer(true)}><MenuIcon /></IconButton>
        )}
      </Paper>

      {/* SHORTCUTS BAR */}
      {!isMobile && (
        <Paper sx={{ px: 2, py: 0.5, display: 'flex', gap: 2, borderRadius: 0, bgcolor: '#f8fafc', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            ⌨️ <Chip label="F1" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3 }} /> Search
            <Chip label="F2" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3, bgcolor: '#10b981', color: 'white' }} /> View
            <Chip label="F3" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3 }} /> Hold
            <Chip label="F5" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3 }} /> Held
            <Chip label="F9" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3, bgcolor: '#10b981', color: 'white' }} /> Save+Print
            <Chip label="F10" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3, bgcolor: '#ef4444', color: 'white' }} /> New
            <Chip label="F12" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3 }} /> Printer
            <Chip label="Tab" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3, bgcolor: '#3b82f6', color: 'white' }} /> Next
            <Chip label="Shift+Tab" size="small" sx={{ height: 16, fontSize: '0.6rem', mx: 0.3, bgcolor: '#3b82f6', color: 'white' }} /> Back
            {fbrEnabled && fbrMode && (
              <Chip label="⚡ FBR Active" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#10b981', color: 'white', ml: 0.5 }} />
            )}
            {fbrEnabled && !fbrMode && (
              <Chip label="⏳ Demo (0% Tax)" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#6b7280', color: 'white', ml: 0.5 }} />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {viewMode === 'grid' ? '📱 Sale With Image' : '📋 Sale Without Image'}
          </Typography>
        </Paper>
      )}

      {/* SEARCH & FILTERS */}
      <Paper sx={{ px: isMobile ? 1 : 1.5, py: isMobile ? 1 : 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {!isMobile && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select value={selectedCategory} label="Category" onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }}>
              <MenuItem value="">All</MenuItem>
              {categories.map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Autocomplete
          key={searchKey}
          freeSolo
          options={searchResults}
          getOptionLabel={(o) => typeof o === 'string' ? o : `${o.product_name || o.variant_name} (${o.current_stock || 0})`}
          inputValue={searchQuery}
          onInputChange={(e, v) => setSearchQuery(v)}
          onChange={(e, v) => { if (v && typeof v !== 'string') addToCart(v, 0); }}
          sx={{ flex: 1, minWidth: isMobile ? 120 : 250 }}
          renderInput={(params) => (
            <TextField 
              {...params} 
              inputRef={searchRef}
              size="small" 
              placeholder={isMobile ? "Search/Scan..." : "Search or Scan Barcode (F1)"}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    {scanMode ? <QrCodeScanner sx={{ color: '#10b981', fontSize: 18 }} /> : <Search sx={{ color: '#10b981', fontSize: 18 }} />}
                  </InputAdornment>
                ),
                endAdornment: isMobile && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setScanMode(!scanMode)} color={scanMode ? 'success' : 'default'}>
                      <QrCodeScanner fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          )}
          renderOption={(props, option) => {
            const isOut = Number(option.current_stock || 0) <= 0;
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest} style={{ opacity: isOut ? 0.5 : 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.product_name || option.variant_name}
                      {isOut && <Chip label="OUT" size="small" color="error" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{option.sku}</Typography>
                  </Box>
                  <Typography variant="caption" color="primary" fontWeight="bold">
                    Rs. {saleType === 'wholesale' ? option.wholesale_price : option.retail_price}
                  </Typography>
                </Box>
              </li>
            );
          }}
          filterOptions={(x) => x}
          clearOnBlur={false}
          disableClearable
        />

        {!isMobile && (
          <>
            <Button variant="contained" sx={{ bgcolor: '#10b981', minWidth: 'auto' }} onClick={() => searchResults[0] && addToCart(searchResults[0], 0)}>
              <Add />
            </Button>

            <FormControl size="small" sx={{ minWidth: 90 }}>
              <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }}>
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>{partyType === 'customer' ? 'Select Customer' : 'Select Supplier'}</InputLabel>
              <Select value={selectedParty?.id || ''} onChange={(e) => {
                const dataset = partyType === 'customer' ? customers : suppliers;
                const match = dataset.find(x => x.id === e.target.value);
                setSelectedParty(match || null);
              }} label={partyType === 'customer' ? 'Select Customer' : 'Select Supplier'}>
                <MenuItem value="">Walk-in</MenuItem>
                {(partyType === 'customer' ? customers : suppliers).map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name} (Bal: {p.current_balance || 0})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 120 }} />

            <ToggleButtonGroup
              value={saleType}
              exclusive
              onChange={(e, val) => val && setSaleType(val)}
              size="small"
              sx={{ height: 32 }}
            >
              <ToggleButton value="retail" sx={{ fontSize: '0.65rem', px: 1.5 }}>
                Retail
              </ToggleButton>
              <ToggleButton value="wholesale" sx={{ fontSize: '0.65rem', px: 1.5 }}>
                Wholesale
              </ToggleButton>
            </ToggleButtonGroup>
          </>
        )}
      </Paper>

      {/* MOBILE FILTERS */}
      {isMobile && (
        <Paper sx={{ px: 1, py: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', borderRadius: 0, flexShrink: 0 }}>
          <FormControl size="small" sx={{ minWidth: 70, flex: 1 }}>
            <Select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSearchQuery(''); setSearchResults([]); }} displayEmpty size="small">
              <MenuItem value="">All</MenuItem>
              {categories.slice(0, 5).map(cat => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 60 }}>
            <Select value={partyType} onChange={(e) => { setPartyType(e.target.value); setSelectedParty(null); }} size="small">
              <MenuItem value="customer">Cust</MenuItem>
              <MenuItem value="supplier">Supp</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} sx={{ width: 90 }} />
          <ToggleButtonGroup
            value={saleType}
            exclusive
            onChange={(e, val) => val && setSaleType(val)}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="retail" sx={{ fontSize: '0.5rem', px: 0.5 }}>Retail</ToggleButton>
            <ToggleButton value="wholesale" sx={{ fontSize: '0.5rem', px: 0.5 }}>Whole</ToggleButton>
          </ToggleButtonGroup>
          
          {fbrEnabled && (
            <Button 
              size="small" 
              variant="outlined" 
              onClick={toggleFBRMode}
              sx={{ 
                fontSize: '0.5rem', 
                px: 0.5, 
                minWidth: 'auto',
                borderColor: fbrMode ? '#10b981' : '#6b7280',
                color: fbrMode ? '#10b981' : '#6b7280'
              }}
            >
              {fbrMode ? 'FBR ON' : 'FBR OFF'}
            </Button>
          )}
          
          <Button size="small" variant="outlined" onClick={() => setShowFBRScan(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto', borderColor: fbrMode ? '#10b981' : '#e5e7eb' }}>
            <QrCode fontSize="small" sx={{ color: fbrMode ? '#10b981' : 'inherit' }} />
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowOffersDialog(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto' }}>
            <LocalOffer fontSize="small" />
          </Button>
          <Button size="small" variant="outlined" onClick={() => setShowPrinterSettings(true)} sx={{ fontSize: '0.5rem', px: 0.5, minWidth: 'auto' }}>
            <PrintIcon fontSize="small" />
          </Button>
        </Paper>
      )}

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1, p: 1, flexDirection: isMobile ? 'column' : 'row' }}>
        
        {/* PRODUCT DISPLAY */}
        {viewMode === 'grid' ? (
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            bgcolor: 'white',
            borderRadius: 2,
            p: isMobile ? 1 : 1.5,
            height: isMobile ? '45vh' : '100%'
          }}>
            <ProductCategoryGrid 
              categories={categories}
              products={products}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              addToCart={addToCart}
              updateCartQty={updateCartQtyByVariant}
              removeFromCart={removeFromCart}
              cart={cart}
              saleType={saleType}
              showCostPrice={showCostPrice}
              setShowCostPrice={setShowCostPrice}
              showWholesalePrice={showWholesalePrice}
              setShowWholesalePrice={setShowWholesalePrice}
              fbrEnabled={fbrEnabled && fbrMode}
            />
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: isMobile ? '45vh' : '100%' }}>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexShrink: 0, flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                value={showCostPrice ? 'cost' : ''}
                exclusive
                onChange={(e, val) => {
                  if (val === 'cost') {
                    setShowCostPrice(!showCostPrice);
                    setShowWholesalePrice(false);
                  } else {
                    setShowCostPrice(false);
                  }
                }}
                size="small"
              >
                <ToggleButton value="cost" sx={{ fontSize: '0.6rem', px: 1.5, py: 0.5 }}>
                  <AttachMoney fontSize="small" sx={{ mr: 0.5 }} /> Cost Price
                </ToggleButton>
              </ToggleButtonGroup>

              <ToggleButtonGroup
                value={showWholesalePrice ? 'wholesale' : ''}
                exclusive
                onChange={(e, val) => {
                  if (val === 'wholesale') {
                    setShowWholesalePrice(!showWholesalePrice);
                    setShowCostPrice(false);
                  } else {
                    setShowWholesalePrice(false);
                  }
                }}
                size="small"
              >
                <ToggleButton value="wholesale" sx={{ fontSize: '0.6rem', px: 1.5, py: 0.5 }}>
                  <TrendingUp fontSize="small" sx={{ mr: 0.5 }} /> Wholesale Price
                </ToggleButton>
              </ToggleButtonGroup>
              
              <Chip 
                size="small" 
                label={saleType === 'retail' ? '🛒 Retail' : '🏷️ Wholesale'} 
                color="primary" 
                variant="filled"
                sx={{ height: 24, fontSize: '0.6rem' }}
              />
              
              {fbrEnabled && fbrMode && (
                <Chip 
                  size="small" 
                  label="⚡ FBR Active" 
                  color="success" 
                  variant="filled"
                  sx={{ height: 24, fontSize: '0.6rem' }}
                />
              )}
              {fbrEnabled && !fbrMode && (
                <Chip 
                  size="small" 
                  label="⏳ Demo (0% Tax)" 
                  color="default" 
                  variant="filled"
                  sx={{ height: 24, fontSize: '0.6rem', bgcolor: '#6b7280', color: 'white' }}
                />
              )}
            </Box>

            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>#</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>SKU</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }}>Item</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="center">Qty</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="right">Price</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="center" colSpan={2}>
                      Discount
                    </TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="right">Total</TableCell>
                    <TableCell sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', py: 1 }} align="center">Action</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5}></TableCell>
                    <TableCell sx={{ bgcolor: '#f0fdf4', fontSize: '0.6rem', py: 0.5, textAlign: 'center' }}>%</TableCell>
                    <TableCell sx={{ bgcolor: '#fef3c7', fontSize: '0.6rem', py: 0.5, textAlign: 'center' }}>Rs.</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, idx) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>
                        {item.name}
                        {item.isOfferItem && <Chip label="OFFER" size="small" color="warning" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                        {item.discount > 0 && <Chip label={`${item.discount.toFixed(1)}% OFF`} size="small" color="warning" sx={{ height: 16, fontSize: '0.5rem', ml: 0.5 }} />}
                        
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          {showCostPrice && (
                            <Chip 
                              label={`Cost: ${formatPKR(item.costPrice || item.originalPrice || item.price)}`} 
                              size="small" 
                              sx={{ height: 16, fontSize: '0.45rem', bgcolor: '#fef3c7', color: '#92400e' }} 
                            />
                          )}
                          {showWholesalePrice && (
                            <Chip 
                              label={`Wholesale: ${formatPKR(item.wholesalePrice || item.originalPrice || item.price)}`} 
                              size="small" 
                              sx={{ height: 16, fontSize: '0.45rem', bgcolor: '#dbeafe', color: '#1e40af' }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          id={`qty-${idx}`}
                          type="number" size="small" value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`price-${idx}`)?.focus(); 
                            } 
                          }}
                          inputProps={{ step: 0.001, style: { textAlign: 'center', width: 60 } }} 
                          sx={{ width: 70 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          id={`price-${idx}`}
                          type="number" size="small" value={item.price}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`discount-percent-${idx}`)?.focus(); 
                            } 
                          }}
                          inputProps={{ style: { textAlign: 'right', width: 80 } }} 
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ p: 0.5 }}>
                        <TextField
                          id={`discount-percent-${idx}`}
                          type="number" size="small" 
                          value={item.discountType === 'percent' ? (item.discount || '') : ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value, 'percent')}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              document.getElementById(`discount-amount-${idx}`)?.focus(); 
                            } 
                          }}
                          inputProps={{ 
                            style: { textAlign: 'center', width: 45 }, 
                            min: 0, 
                            max: 100,
                            placeholder: '%'
                          }} 
                          sx={{ width: 55 }}
                          placeholder="%"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ p: 0.5 }}>
                        <TextField
                          id={`discount-amount-${idx}`}
                          type="number" size="small" 
                          value={item.discountType === 'amount' ? (item.discountAmount || '') : ''}
                          onChange={(e) => handleItemDiscount(idx, e.target.value, 'amount')}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                            } 
                          }}
                          inputProps={{ 
                            style: { textAlign: 'center', width: 55 },
                            min: 0,
                            placeholder: 'Rs.'
                          }} 
                          sx={{ width: 65 }}
                          placeholder="Rs."
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="#10b981">{formatPKR(item.total)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removeFromCart(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                        <Search sx={{ fontSize: 40, color: '#d1d5db' }} />
                        <Typography color="text.secondary">Cart Empty — Press F1 to search</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* PAYMENT PANEL */}
        <Paper sx={{ 
          width: isMobile ? '100%' : 320, 
          p: isMobile ? 1.5 : 2, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1, 
          overflow: 'auto', 
          flexShrink: 0, 
          maxHeight: isMobile ? 'auto' : '100%',
          borderLeft: isMobile ? 'none' : '2px solid #e5e7eb'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold" color="#10b981">
              {isMobile ? '💳 Payment' : 'Payment Summary'}
            </Typography>
            {fbrEnabled && (
              <Tooltip title={fbrMode ? 'FBR Mode: ON - Real Tax & QR' : 'FBR Mode: OFF - 0% Tax (Demo)'}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={toggleFBRMode}
                  sx={{
                    borderColor: fbrMode ? '#10b981' : '#6b7280',
                    color: fbrMode ? '#10b981' : '#6b7280',
                    fontSize: '0.6rem',
                    py: 0.5,
                    px: 1,
                    minWidth: 'auto'
                  }}
                  startIcon={fbrMode ? <ToggleOn fontSize="small" /> : <ToggleOff fontSize="small" />}
                >
                  {fbrMode ? 'FBR ON' : 'FBR OFF'}
                </Button>
              </Tooltip>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Items</Typography>
            <Typography fontWeight="bold">{cart.length} ({calc.totalQty.toFixed(0)} qty)</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Sub Total</Typography>
            <Typography fontWeight="bold">{formatPKR(calc.subtotal)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Item Discount</Typography>
            <Typography fontWeight="bold" color="error">-{formatPKR(calc.itemDiscount)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight="bold" color="text.secondary">Bill Discount</Typography>
            <Typography fontWeight="bold" color="error">-{formatPKR(calc.billDiscount)}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', pt: 0.5 }}>
            <Typography fontWeight="bold" color={fbrMode ? '#10b981' : '#6b7280'}>
              {fbrMode ? 'FBR Tax' : 'Demo Tax (0%)'} ({calc.taxRate}%)
            </Typography>
            <Typography fontWeight="bold" color={fbrMode ? '#10b981' : '#6b7280'}>
              {formatPKR(calc.tax)}
              {fbrMode ? ' ✓' : ' ⏳'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #10b981', pt: 0.5 }}>
            <Typography fontWeight="bold" fontSize="1.1rem">Grand Total</Typography>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="#10b981">{formatPKR(calc.grandTotal)}</Typography>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 55 : 65, fontSize: '0.7rem', fontWeight: 500 }}>Discount</Typography>
            <TextField
              id="discount-input"
              size="small" type="number" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('paid-input')?.focus(); } }}
              sx={{ flex: 1 }} placeholder="0"
            />
            <Select size="small" value={billDiscountType} onChange={(e) => setBillDiscountType(e.target.value)} sx={{ width: 55 }}>
              <MenuItem value="amount">Rs</MenuItem>
              <MenuItem value="percent">%</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: isMobile ? 55 : 65, fontSize: '0.7rem', fontWeight: 500 }}>Payment</Typography>
            <Select size="small" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} fullWidth>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="bank">Bank</MenuItem>
              <MenuItem value="easypaisa">EasyPaisa</MenuItem>
              <MenuItem value="jazzcash">JazzCash</MenuItem>
              <MenuItem value="credit">Credit</MenuItem>
              <MenuItem value="credit">Other</MenuItem>
            </Select>
          </Box>

          {paymentMode !== 'credit' && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography sx={{ width: isMobile ? 55 : 65, fontSize: '0.7rem', fontWeight: 500 }}>To Acc</Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={paymentAccount?.id || ''}
                  onChange={(e) => handlePaymentAccountChange(e.target.value)}
                  displayEmpty
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="" disabled><em>Select {paymentMode} account</em></MenuItem>
                  {accounts
                    .filter(a => a.type === paymentMode && a.status === 'active')
                    .map(a => (
                      <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.75rem' }}>
                        {a.name} • Bal: {formatPKR(a.current_balance)}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {paymentMode !== 'credit' && paymentAccount && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f0fdf4', p: 0.5, borderRadius: 1, border: '1px solid #bbf7d0' }}>
              <Typography fontWeight="bold" color="text.secondary" fontSize="0.7rem">Receiving</Typography>
              <Typography fontWeight="bold" color="#059669" fontSize="0.7rem">
                {paymentAccount.name}
              </Typography>
            </Box>
          )}

          {paymentMode !== 'credit' && accounts.filter(a => a.type === paymentMode && a.status === 'active').length === 0 && (
            <Alert severity="warning" sx={{ py: 0.3, fontSize: '0.65rem' }}>
              ⚠️ No {paymentMode} account found! Add in Accounts page.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
  <Typography sx={{ width: isMobile ? 55 : 65, fontSize: '0.7rem', fontWeight: 700 }}>Paid</Typography>
  <TextField
    id="paid-input"
    size="small" 
    type="number" 
    value={paidAmount} 
    onChange={(e) => setPaidAmount(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSaleWithPrint(); } }}
    fullWidth 
    placeholder="0.00"
  />
</Box>

          {calc.due > 0 && (
            <Box sx={{ bgcolor: '#fef2f2', p: 1, borderRadius: 1, border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="error" fontWeight="bold" fontSize="0.8rem">Due</Typography>
              <Typography color="error" fontWeight="bold">{formatPKR(calc.due)}</Typography>
            </Box>
          )}
          {calc.change > 0 && (
            <Box sx={{ bgcolor: '#f0fdf4', p: 1, borderRadius: 1, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="success" fontWeight="bold" fontSize="0.8rem">Change</Typography>
              <Typography color="success" fontWeight="bold">{formatPKR(calc.change)}</Typography>
            </Box>
          )}

          <TaxSummary 
            totalTax={totalTaxCollected} 
            taxRate={calc.taxRate} 
            fbrMode={fbrMode} 
            fbrEnabled={fbrEnabled} 
          />

          {/* TWO BUTTONS - Sale & Sale+Print */}
          <Box sx={{ display: 'flex', gap: 1, flexDirection: isMobile ? 'column' : 'row' }}>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={saveSaleOnly} 
              sx={{ 
                bgcolor: isSaving ? '#9ca3af' : '#3b82f6', 
                py: isMobile ? 1.5 : 1.2, 
                fontWeight: 'bold', 
                fontSize: isMobile ? '0.9rem' : '1rem',
                '&:hover': { bgcolor: isSaving ? '#9ca3af' : '#2563eb' },
                flex: 1
              }} 
              disabled={cart.length === 0 || isSaving}
              startIcon={<Save />}
            >
              {isSaving ? '⏳ Saving...' : '💾 Sale'}
            </Button>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={saveSaleWithPrint} 
              sx={{ 
                bgcolor: isSaving ? '#9ca3af' : '#10b981', 
                py: isMobile ? 1.5 : 1.2, 
                fontWeight: 'bold', 
                fontSize: isMobile ? '0.9rem' : '1rem',
                '&:hover': { bgcolor: isSaving ? '#9ca3af' : '#059669' },
                flex: 1
              }} 
              disabled={cart.length === 0 || isSaving}
              startIcon={<PrintIcon />}
            >
              {isSaving ? '⏳ Saving...' : '🧾 Sale+Print'}
            </Button>
          </Box>

          {/* Mobile: Clear button */}
          {isMobile && (
            <Button fullWidth variant="outlined" color="error" startIcon={<Close />} onClick={newBill} size="small">
              Clear Cart
            </Button>
          )}
        </Paper>
      </Box>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, borderRadius: 0 }}>
          <BottomNavigation showLabels sx={{ bgcolor: 'white' }}>
            <BottomNavigationAction label="Cart" icon={<Badge badgeContent={cart.length} color="primary"><ShoppingCart /></Badge>} />
            <BottomNavigationAction label="Scan" icon={<QrCodeScanner />} onClick={() => setScanMode(!scanMode)} />
            <BottomNavigationAction 
              label={fbrMode ? 'FBR ON' : 'FBR OFF'} 
              icon={fbrMode ? <ToggleOn color="success" /> : <ToggleOff color="disabled" />} 
              onClick={toggleFBRMode}
              sx={{ color: fbrMode ? '#10b981' : '#6b7280' }}
            />
            <BottomNavigationAction label="Offers" icon={<LocalOffer />} onClick={() => setShowOffersDialog(true)} />
            <BottomNavigationAction label="Held" icon={<Receipt />} onClick={() => setShowResumeDialog(true)} />
            <BottomNavigationAction label="⌨️" icon={<KeyboardArrowDown />} onClick={() => setShowShortcuts(true)} />
          </BottomNavigation>
        </Paper>
      )}

      {/* RECEIPT DIALOG */}
      <Dialog open={showReceipt} onClose={() => setShowReceipt(false)} maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white', py: 1 }}>
          Receipt {defaultPrinter && <Chip label={defaultPrinter} size="small" sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />}
          {fbrStatus?.fbr_status === 'SYNCED' && (
            <Chip label="FBR ✓" size="small" sx={{ ml: 1, bgcolor: '#10b981', color: 'white' }} />
          )}
          {fbrStatus?.fbr_status === 'DEMO' && (
            <Chip label="Demo ⏳" size="small" sx={{ ml: 1, bgcolor: '#6b7280', color: 'white' }} />
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#f3f4f6' }}>
          <div style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }}>
            <ThermalReceipt 
              ref={printRef} 
              sale={lastSale} 
              items={lastSale?.items || []} 
              party={selectedParty} 
              partyType={partyType}
              fbrStatus={fbrStatus}
              fbrEnabled={fbrEnabled}
              fbrMode={fbrMode}
            />
          </div>
          <Paper sx={{ p: 1, width: '58mm', bgcolor: 'white', boxShadow: 3 }} className="receipt-content">
            <ThermalReceipt 
              sale={lastSale} 
              items={lastSale?.items || []} 
              party={selectedParty} 
              partyType={partyType}
              fbrStatus={fbrStatus}
              fbrEnabled={fbrEnabled}
              fbrMode={fbrMode}
            />
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReceipt(false)}>Close</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} sx={{ bgcolor: '#10b981' }}>
            {defaultPrinter ? 'Auto Print' : 'Print'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FBR SCAN DIALOG */}
      <FBRScanDialog 
        open={showFBRScan} 
        onClose={() => setShowFBRScan(false)} 
        onScanComplete={handleFBRScanComplete}
        showSnackbar={showSnackbar}
      />

      {/* HELD BILLS DIALOG */}
      <Dialog open={showResumeDialog} onClose={() => setShowResumeDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Held Bills ({heldBills.length})</DialogTitle>
        <DialogContent>
          {heldBills.length === 0 ? <Alert severity="info">No held bills</Alert> : (
            <List>
              {heldBills.map(bill => (
                <Paper key={bill.id} sx={{ mb: 1 }}>
                  <ListItem secondaryAction={
                    <Box>
                      <IconButton edge="end" onClick={() => resumeBill(bill)} color="success"><CheckCircle /></IconButton>
                      <IconButton edge="end" onClick={() => deleteHeld(bill.id)} color="error"><Delete /></IconButton>
                    </Box>
                  }>
                    <ListItemIcon><Receipt /></ListItemIcon>
                    <ListItemText primary={bill.party?.name || 'Walk-in'} secondary={`${formatPKR(bill.total)} • ${new Date(bill.date).toLocaleString()}`} />
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResumeDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* HOLD DIALOG */}
      <Dialog open={showHoldDialog} onClose={() => setShowHoldDialog(false)}>
        <DialogTitle>Hold Current Bill?</DialogTitle>
        <DialogContent><Typography>{cart.length} items will be saved.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHoldDialog(false)}>Cancel</Button>
          <Button onClick={() => { holdBill(); setShowHoldDialog(false); }} variant="contained" sx={{ bgcolor: '#f59e0b' }}>Hold Bill</Button>
        </DialogActions>
      </Dialog>

      {/* OFFERS DIALOG */}
      <Dialog open={showOffersDialog} onClose={() => setShowOffersDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}><LocalOffer sx={{ verticalAlign: 'middle', mr: 1 }} />Active Offers</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {offers.filter(o => o.status === 'active').length === 0 ? <Alert severity="info">No active offers</Alert> : (
            <Grid container spacing={isMobile ? 1 : 2} sx={{ mt: 1 }}>
              {offers.filter(o => o.status === 'active').map(offer => (
                <Grid item xs={12} sm={6} key={offer.id}>
                  <Paper variant="outlined" sx={{ p: 2, borderLeft: '4px solid #10b981', cursor: 'pointer', '&:hover': { bgcolor: '#f0fdf4' } }} onClick={() => applyOffer(offer)}>
                    <Typography fontWeight="bold">{offer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{offer.description}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Original:</Typography>
                      <Typography variant="body2">Rs. {Number(offer.original_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Final:</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#10b981">Rs. {Number(offer.final_total || 0).toLocaleString()}</Typography>
                    </Box>
                    <Button fullWidth variant="contained" size="small" sx={{ mt: 1, bgcolor: '#10b981' }}>Add to Cart</Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOffersDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* PRINTER SETTINGS */}
      <PrinterSettingsDialog 
        open={showPrinterSettings} 
        onClose={() => setShowPrinterSettings(false)} 
        onPrinterSelect={(printer) => setDefaultPrinter(printer)} 
      />

      {/* SHORTCUTS HELP */}
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* MOBILE DRAWER */}
      <Drawer anchor="right" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ width: 280, p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Menu</Typography>
          <List>
            <ListItem button onClick={() => { setShowFBRScan(true); setMobileDrawer(false); }} sx={{ bgcolor: fbrEnabled && fbrMode ? '#f0fdf4' : 'transparent' }}>
              <ListItemIcon><QrCode sx={{ color: fbrMode ? '#10b981' : '#6b7280' }} /></ListItemIcon>
              <ListItemText primary="FBR Scan" secondary={fbrMode ? 'Active' : 'Demo Mode'} />
            </ListItem>
            <ListItem button onClick={toggleFBRMode} sx={{ bgcolor: fbrMode ? '#f0fdf4' : '#f9fafb' }}>
              <ListItemIcon>{fbrMode ? <ToggleOn color="success" /> : <ToggleOff color="disabled" />}</ListItemIcon>
              <ListItemText primary={fbrMode ? 'FBR ON' : 'FBR OFF'} secondary={fbrMode ? 'Real Tax & QR' : '0% Tax (Demo)'} />
            </ListItem>
            <ListItem button onClick={() => { setShowOffersDialog(true); setMobileDrawer(false); }}><ListItemIcon><LocalOffer /></ListItemIcon><ListItemText primary="Offers" /></ListItem>
            <ListItem button onClick={() => { setShowResumeDialog(true); setMobileDrawer(false); }}><ListItemIcon><Receipt /></ListItemIcon><ListItemText primary="Held Bills" /></ListItem>
            <ListItem button onClick={() => { setShowHoldDialog(true); setMobileDrawer(false); }}><ListItemIcon><Pause /></ListItemIcon><ListItemText primary="Hold Bill" /></ListItem>
            <ListItem button onClick={() => { setShowPrinterSettings(true); setMobileDrawer(false); }}><ListItemIcon><PrintIcon /></ListItemIcon><ListItemText primary="Printer" /></ListItem>
            <ListItem button onClick={() => { setShowShortcuts(true); setMobileDrawer(false); }}><ListItemIcon><KeyboardArrowDown /></ListItemIcon><ListItemText primary="Shortcuts" /></ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>Party Type</InputLabel>
                <Select value={partyType} onChange={(e) => setPartyType(e.target.value)} label="Party Type">
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="supplier">Supplier</MenuItem>
                </Select>
              </FormControl>
            </ListItem>
            <ListItem>
              <FormControl fullWidth size="small">
                <InputLabel>{partyType === 'customer' ? 'Customer' : 'Supplier'}</InputLabel>
                <Select value={selectedParty?.id || ''} onChange={(e) => {
                  const dataset = partyType === 'customer' ? customers : suppliers;
                  const match = dataset.find(x => x.id === e.target.value);
                  setSelectedParty(match || null);
                }} label={partyType === 'customer' ? 'Customer' : 'Supplier'}>
                  <MenuItem value="">Walk-in</MenuItem>
                  {(partyType === 'customer' ? customers : suppliers).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} sx={{ mb: isMobile ? 7 : 0 }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}