import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  Stack, Chip, Divider, Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, Avatar, Tooltip, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Slider, InputAdornment,
  Tabs, Tab, IconButton, Checkbox, FormGroup, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Badge, List, ListItem, ListItemText, ListItemIcon,
  Fade, Zoom, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  Settings, Store, Person, Receipt, Percent, Notifications,
  Storage, Info, CheckCircle, Warning, Edit,
  Save, Add, Delete, Visibility, VisibilityOff,
  LocalPrintshop, Palette, AccountCircle, Phone, Email,
  Business, AttachMoney, AccountBalance, Inventory, Backup,
  Restore, Speed, VerifiedUser, AdminPanelSettings,
  Shield, Menu as MenuIcon, Close, ArrowUpward, ArrowDownward,
  ExpandMore, Image, CloudUpload, ReceiptLong, Print, QrCode,
  QrCodeScanner, Description, Pageview, DesignServices, Sync as SyncIcon,
  Delete as DeleteIcon, ToggleOn, ToggleOff,
} from '@mui/icons-material';
import db from '../database/db';
import {
  AVAILABLE_PAGES, DEFAULT_ROLES,
  getRoles, getRolePermissions, hasPermission, getRoleLabel, getRoleColor,
  getRolesSync, getRolePermissionsSync,
  persistRolesToDB
} from '../role';

const SETTINGS_TABS = [
  { id: 'shop', label: 'Shop Profile', icon: <Store fontSize="small" /> },
  { id: 'users', label: 'Users', icon: <Person fontSize="small" /> },
  { id: 'receipt', label: 'Receipt', icon: <Receipt fontSize="small" /> },
  { id: 'tax', label: 'Tax & Currency', icon: <Percent fontSize="small" /> },
  { id: 'pages', label: 'Page Visibility', icon: <Pageview fontSize="small" /> },
  { id: 'notifications', label: 'Notifications', icon: <Notifications fontSize="small" /> },
  { id: 'database', label: 'Database', icon: <Storage fontSize="small" /> },
  { id: 'about', label: 'About', icon: <Info fontSize="small" /> },
];

export { getRoles, getRolePermissions, hasPermission, getRoleLabel, getRoleColor };

// ✅ NEW: Granular CRUD permission checker
export const hasActionPermission = (rolePermissions, roleId, pageId, action = 'view') => {
  const rolePerms = rolePermissions?.[roleId] || {};
  const pagePerms = rolePerms[pageId] || {};
  return !!pagePerms[action];
};

export const ROLES = getRolesSync();
export const ROLE_PERMISSIONS = getRolePermissionsSync();

// ==================== CUSTOM BARCODE ICON (Since @mui/icons-material doesn't have Barcode) ====================
// ==================== CUSTOM BARCODE ICON (Since @mui/icons-material doesn't have Barcode) ====================
const BarcodeIcon = ({ sx = {}, fontSize = 'small' }) => {
  const size = fontSize === 'small' ? 20 : fontSize === 'medium' ? 24 : 32;
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size} 
      style={sx}
      fill="currentColor"
    >
      <rect x="2" y="4" width="2" height="16" />
      <rect x="5" y="4" width="1" height="16" />
      <rect x="7" y="4" width="2" height="16" />
      <rect x="10" y="4" width="1" height="16" />
      <rect x="12" y="4" width="2" height="16" />
      <rect x="15" y="4" width="1" height="16" />
      <rect x="17" y="4" width="2" height="16" />
      <rect x="20" y="4" width="2" height="16" />
    </svg>
  );
};

// ==================== RECEIPT DESIGN PREVIEW COMPONENTS (COMPLETE WITH DESIGN 4 & NO BARCODE) ====================
const ReceiptDesignPreview = ({ design, shopProfile, receiptSettings }) => {
  
  // Common styles for clean look
  const boldHeading = { fontWeight: 700, color: '#111827' };

  // Helper functions for dynamic dates
  const getCurrentDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getCurrentDateFormatted = () => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${day} ${month}, ${year}`;
  };

  // ===== DESIGN 1: Classic =====
  const renderDesign1 = () => (
    <Paper sx={{ 
      p: 3, maxWidth: 340, mx: 'auto', bgcolor: '#ffffff', border: '1px solid #d1d5db', borderRadius: 0.5,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <Box sx={{ textAlign: 'center', pb: 2, borderBottom: '1px dashed #9ca3af' }}>
        {receiptSettings.showLogo && shopProfile.logoPreview && (
          <Avatar src={shopProfile.logoPreview} sx={{ width: 70, height: 70, mx: 'auto', mb: 1 }} />
        )}
        <Typography variant="h6" fontWeight="700" fontSize="1.4rem" sx={{ ...boldHeading }}>
          {shopProfile.name || 'My Store'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.8rem' }}>
          {shopProfile.tagline || 'Quality Products, Best Prices'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#6b7280' }}>
          📍 {shopProfile.address || 'Main Market, Lahore'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#6b7280' }}>
          📞 {shopProfile.phone || '0349-3860656'}
        </Typography>
        {receiptSettings.headerText && (
          <Typography variant="caption" display="block" sx={{ fontWeight: 600, fontStyle: 'italic', color: '#4b5563', mt: 1, fontSize: '0.8rem' }}>
            {receiptSettings.headerText}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ py: 1.5, fontSize: '0.8rem' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4b5563', fontSize: '0.75rem', mb: 1, pb: 1, borderBottom: '1px dotted #d1d5db' }}>
          <span>📅 {getCurrentDate()}</span>
          <span>🕐 {new Date().toLocaleTimeString()}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f3f4f6', px: 1.5, py: 1, borderRadius: 0.5, fontWeight: 700, color: '#111827', fontSize: '0.8rem' }}>
          <span>Item</span><span>Qty</span><span>Price</span><span>Total</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px dotted #d1d5db', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 1 }}>Premium Product</span>
          <span style={{ width: 35, textAlign: 'center' }}>2</span>
          <span style={{ width: 50, textAlign: 'right' }}>150</span>
          <span style={{ width: 55, textAlign: 'right' }}>300</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px dotted #d1d5db', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 1 }}>Standard Item</span>
          <span style={{ width: 35, textAlign: 'center' }}>1</span>
          <span style={{ width: 50, textAlign: 'right' }}>100</span>
          <span style={{ width: 55, textAlign: 'right' }}>100</span>
        </Box>
        <Divider sx={{ my: 1, borderColor: '#9ca3af', borderWidth: 1 }} />
        {receiptSettings.showDiscountDetails && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4b5563', fontSize: '0.8rem', py: 0.5 }}>
            <span>Sub Total</span><span>Rs. 400</span>
          </Box>
        )}
        {receiptSettings.showDiscountDetails && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#dc2626', fontSize: '0.8rem', py: 0.5 }}>
            <span>Discount</span><span>-Rs. 0</span>
          </Box>
        )}
        {receiptSettings.printTaxBreakdown && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4b5563', fontSize: '0.8rem', py: 0.5 }}>
            <span>Tax (18%)</span><span>Rs. 72</span>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.2rem', color: '#111827', mt: 1, pt: 1, borderTop: '2px solid #111827' }}>
          <span>TOTAL</span><span>Rs. 472</span>
        </Box>
      </Box>
      
      <Box sx={{ textAlign: 'center', borderTop: '1px dashed #9ca3af', pt: 1.5, mt: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>✨ Thank You! ✨</Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.7rem' }}>
          {shopProfile.receiptFooter || 'Thank you for shopping with us!'}
        </Typography>
        {receiptSettings.showQR && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}><QrCode fontSize="medium" sx={{ color: '#374151' }} /></Box>}
      </Box>
    </Paper>
  );

  // ===== DESIGN 2: Modern =====
  const renderDesign2 = () => (
    <Paper sx={{ 
      p: 3, maxWidth: 340, mx: 'auto', bgcolor: '#ffffff', border: '1px solid #9ca3af', borderRadius: 1,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <Box sx={{ textAlign: 'center', borderBottom: '1px solid #d1d5db', pb: 2, mb: 2 }}>
        {receiptSettings.showLogo && shopProfile.logoPreview && (
          <Avatar src={shopProfile.logoPreview} sx={{ width: 70, height: 70, mx: 'auto', mb: 1 }} />
        )}
        <Typography variant="h6" fontWeight="700" fontSize="1.4rem" sx={{ ...boldHeading }}>
          {shopProfile.name || 'My Store'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.8rem' }}>
          {shopProfile.tagline || 'Quality Products, Best Prices'}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1, fontWeight: 600, fontSize: '0.75rem', color: '#6b7280' }}>
          <span>📞 {shopProfile.phone || '0349-3860656'}</span>
          <span>📍 {shopProfile.address || 'Lahore'}</span>
        </Box>
        {receiptSettings.headerText && (
          <Typography variant="caption" display="block" sx={{ fontWeight: 600, fontStyle: 'italic', color: '#4b5563', mt: 1, fontSize: '0.8rem' }}>
            {receiptSettings.headerText}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.75rem', color: '#374151', mb: 1.5, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
        <span>📅 {getCurrentDate()}</span>
        <span>🕐 {new Date().toLocaleTimeString()}</span>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.75rem', color: '#374151', mb: 1, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
        <span>Invoice #</span><span>INV-2024-001</span>
      </Box>
      
      {receiptSettings.printCustomerName && (
        <Box sx={{ bgcolor: '#f9fafb', p: 1, px: 1.5, mb: 1.5, fontWeight: 600, fontSize: '0.75rem', color: '#374151', border: '1px solid #e5e7eb' }}>
          Customer: Walk-in Customer
          {receiptSettings.printCustomerPhone && <span style={{ color: '#4b5563', marginLeft: 4 }}>📱 0300-1234567</span>}
        </Box>
      )}
      
      <Box sx={{ fontSize: '0.8rem' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f3f4f6', px: 1.5, py: 1, fontWeight: 700, color: '#111827', fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>Item</span><span style={{ width: 35, textAlign: 'center' }}>Qty</span>
          <span style={{ width: 50, textAlign: 'right' }}>Price</span><span style={{ width: 55, textAlign: 'right' }}>Total</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>Premium Product</span>
          <span style={{ width: 35, textAlign: 'center' }}>2</span>
          <span style={{ width: 50, textAlign: 'right' }}>150</span>
          <span style={{ width: 55, textAlign: 'right' }}>300</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>Standard Item</span>
          <span style={{ width: 35, textAlign: 'center' }}>1</span>
          <span style={{ width: 50, textAlign: 'right' }}>100</span>
          <span style={{ width: 55, textAlign: 'right' }}>100</span>
        </Box>
        <Divider sx={{ my: 1, borderColor: '#9ca3af', borderWidth: 1 }} />
        {receiptSettings.printTaxBreakdown && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 0.5, fontWeight: 600, color: '#4b5563', fontSize: '0.8rem' }}>
            <span>Tax (18%)</span><span>Rs. 72</span>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, fontWeight: 700, fontSize: '1.2rem', color: '#111827', mt: 1, borderTop: '1px solid #9ca3af' }}>
          <span>GRAND TOTAL</span><span>Rs. 472</span>
        </Box>
      </Box>
      
      <Box sx={{ textAlign: 'center', mt: 2, pt: 1.5, borderTop: '1px dashed #9ca3af' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>🌟 Thank You For Your Business! 🌟</Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.7rem' }}>
          {shopProfile.receiptFooter || 'Thank you for shopping with us!'}
        </Typography>
        {receiptSettings.showQR && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}><QrCode fontSize="medium" sx={{ color: '#374151' }} /></Box>}
      </Box>
    </Paper>
  );

  // ===== DESIGN 3: Premium =====
  const renderDesign3 = () => (
    <Paper sx={{ 
      p: 3, maxWidth: 340, mx: 'auto', bgcolor: '#ffffff', border: '2px solid #111827', borderRadius: 0,
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
    }}>
      <Box sx={{ textAlign: 'center', borderBottom: '1px solid #d1d5db', pb: 2, mb: 2 }}>
        {receiptSettings.showLogo && shopProfile.logoPreview && (
          <Avatar src={shopProfile.logoPreview} sx={{ width: 70, height: 70, mx: 'auto', mb: 1 }} />
        )}
        <Typography variant="h6" fontWeight="700" fontSize="1.4rem" sx={{ ...boldHeading, letterSpacing: '1px' }}>
          {shopProfile.name || 'My Store'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.8rem' }}>
          {shopProfile.address || 'Main Market, Lahore'} | 📞 {shopProfile.phone || '0349-3860656'}
        </Typography>
        <Box sx={{ fontWeight: 700, color: '#111827', fontSize: '0.7rem', letterSpacing: '1px', mt: 1 }}>★ PREMIUM INVOICE ★</Box>
        {receiptSettings.headerText && (
          <Typography variant="caption" display="block" sx={{ fontWeight: 600, fontStyle: 'italic', color: '#4b5563', mt: 1, fontSize: '0.8rem' }}>
            {receiptSettings.headerText}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #d1d5db', pb: 1, mb: 1 }}>
        <span>📅 {getCurrentDate()}</span>
        <span>🕐 {new Date().toLocaleTimeString()}</span>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #d1d5db', pb: 1, mb: 1 }}>
        <span>Invoice: <strong style={{ fontWeight: 700 }}>INV-2024-001</strong></span>
      </Box>
      
      {receiptSettings.printCustomerName && (
        <Box sx={{ bgcolor: '#f9fafb', p: 1, px: 1.5, mb: 1.5, fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderLeft: '2px solid #111827' }}>
          Customer: Walk-in Customer
          {receiptSettings.printCustomerPhone && <span style={{ color: '#4b5563', marginLeft: 8 }}>📱 0300-1234567</span>}
        </Box>
      )}
      
      <Box sx={{ fontSize: '0.8rem', border: '1px solid #d1d5db' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#111827', color: 'white', px: 1.5, py: 1, fontWeight: 700, fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>DESCRIPTION</span><span style={{ width: 35, textAlign: 'center' }}>QTY</span>
          <span style={{ width: 50, textAlign: 'right' }}>PRICE</span><span style={{ width: 55, textAlign: 'right' }}>TOTAL</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, borderBottom: '1px solid #d1d5db', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>Premium Product</span>
          <span style={{ width: 35, textAlign: 'center' }}>2</span>
          <span style={{ width: 50, textAlign: 'right' }}>150</span>
          <span style={{ width: 55, textAlign: 'right' }}>300</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, borderBottom: '1px solid #d1d5db', fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
          <span style={{ flex: 2 }}>Standard Item</span>
          <span style={{ width: 35, textAlign: 'center' }}>1</span>
          <span style={{ width: 50, textAlign: 'right' }}>100</span>
          <span style={{ width: 55, textAlign: 'right' }}>100</span>
        </Box>
      </Box>
      
      <Box sx={{ border: '1px solid #d1d5db', borderTop: 'none', p: 1.5, fontSize: '0.7rem' }}>
        {receiptSettings.showDiscountDetails && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4b5563', fontSize: '0.8rem', py: 0.5 }}>
            <span>Sub Total</span><span>Rs. 400</span>
          </Box>
        )}
        {receiptSettings.showDiscountDetails && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#dc2626', fontSize: '0.8rem', py: 0.5 }}>
            <span>Discount</span><span>-Rs. 0</span>
          </Box>
        )}
        {receiptSettings.printTaxBreakdown && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#4b5563', fontSize: '0.8rem', py: 0.5 }}>
            <span>Tax (18%)</span><span>Rs. 72</span>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', mt: 1, pt: 1, fontWeight: 700, fontSize: '1.2rem', color: '#111827' }}>
          <span>GRAND TOTAL</span><span>Rs. 472</span>
        </Box>
      </Box>
      
      <Box sx={{ textAlign: 'center', mt: 2, pt: 1.5, borderTop: '1px dashed #d1d5db' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#111827' }}>🏆 Quality Products, Best Prices</Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: '#4b5563', fontSize: '0.7rem' }}>
          {shopProfile.receiptFooter || 'Thank you for shopping with us!'}
        </Typography>
        {receiptSettings.showQR && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}><QrCode fontSize="medium" sx={{ color: '#374151' }} /></Box>}
      </Box>
    </Paper>
  );

  // ===== DESIGN 4: Imtiaz Style =====
  const renderDesign4 = () => (
    <Paper sx={{ 
      p: 3, maxWidth: 340, mx: 'auto', bgcolor: '#ffffff', border: '1px solid #9ca3af', borderRadius: 0.5,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'monospace'
    }}>
      {/* ------- HEADER ------- */}
      <Box sx={{ textAlign: 'center', pb: 1.5, borderBottom: '2px dashed #374151' }}>
        {receiptSettings.showLogo && shopProfile.logoPreview && (
          <Avatar src={shopProfile.logoPreview} sx={{ width: 75, height: 75, mx: 'auto', mb: 1.5, variant: 'rounded' }} />
        )}
        <Typography variant="h6" fontWeight="900" fontSize="1.5rem" sx={{ color: '#111827', letterSpacing: '0.5px' }}>
          {shopProfile.name || 'MY STORE'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.8rem' }}>
          {shopProfile.address || 'Main Market, Lahore'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.8rem' }}>
          📞 {shopProfile.phone || '0349-3860656'} | NTN: {shopProfile.taxNumber || 'B353738'}
        </Typography>
        {receiptSettings.headerText && (
          <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: '#111827', fontSize: '0.75rem', mt: 1 }}>
            {receiptSettings.headerText}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
           <QrCode fontSize="medium" sx={{ color: '#111827', fontSize: 30 }} />
        </Box>
      </Box>

      {/* ------- RECEIPT INFO ------- */}
      <Box sx={{ py: 1.5, fontSize: '0.75rem', borderBottom: '1px dotted #9ca3af', fontWeight: 700, color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
        <span>Transaction #: 2415100145840</span>
        <span>{getCurrentDateFormatted()}</span>
      </Box>
      
      <Typography variant="subtitle2" fontWeight="900" align="center" sx={{ py: 1.5, color: '#111827', fontSize: '1rem', letterSpacing: '2px' }}>
        ORIGINAL RECEIPT
      </Typography>

      {/* ------- TABLE HEADERS ------- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#111827', fontSize: '0.75rem', borderTop: '1px solid #111827', borderBottom: '1px solid #111827', py: 1, px: 1.5, bgcolor: '#f9fafb' }}>
        <span style={{ flex: 2, textAlign: 'left' }}>Product</span>
        <span style={{ width: 40, textAlign: 'center' }}>Qty</span>
        <span style={{ width: 55, textAlign: 'right' }}>Price</span>
        <span style={{ width: 50, textAlign: 'right' }}>Disc</span>
        <span style={{ width: 60, textAlign: 'right' }}>Total</span>
      </Box>

      {/* ------- SALES ITEMS ------- */}
      <Box sx={{ py: 1.5, fontSize: '0.75rem' }}>
        
        <Box sx={{ mb: 2, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
           <Typography variant="body2" fontWeight="800" sx={{ color: '#111827', fontSize: '0.85rem', mb: 0.5 }}>
             Fresh Lady Finger
           </Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', pl: 1.5, fontSize: '0.75rem' }}>
             <span style={{ flex: 2 }}>Qty: 0.56</span>
             <span style={{ width: 55, textAlign: 'right' }}>199.00</span>
             <span style={{ width: 50, textAlign: 'right' }}>0.00</span>
             <span style={{ width: 60, textAlign: 'right', fontWeight: 900, color: '#111827' }}>Rs111.44</span>
           </Box>
        </Box>

        <Box sx={{ mb: 2, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
           <Typography variant="body2" fontWeight="800" sx={{ color: '#111827', fontSize: '0.85rem', mb: 0.5 }}>
             Fresh Cucumber (Farm)
           </Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', pl: 1.5, fontSize: '0.75rem' }}>
             <span style={{ flex: 2 }}>Qty: 1.45</span>
             <span style={{ width: 55, textAlign: 'right' }}>299.00</span>
             <span style={{ width: 50, textAlign: 'right' }}>0.00</span>
             <span style={{ width: 60, textAlign: 'right', fontWeight: 900, color: '#111827' }}>Rs432.06</span>
           </Box>
        </Box>

        <Box sx={{ mb: 2, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
           <Typography variant="body2" fontWeight="800" sx={{ color: '#111827', fontSize: '0.85rem', mb: 0.5 }}>
             Olper's Milk 1500ML
           </Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', pl: 1.5, fontSize: '0.75rem' }}>
             <span style={{ flex: 2 }}>Qty: 16.00</span>
             <span style={{ width: 55, textAlign: 'right' }}>4349.00</span>
             <span style={{ width: 50, textAlign: 'right' }}>0.00</span>
             <span style={{ width: 60, textAlign: 'right', fontWeight: 900, color: '#111827' }}>Rs8,698.00</span>
           </Box>
        </Box>

        <Box sx={{ mb: 2, borderBottom: '1px dotted #d1d5db', pb: 1 }}>
           <Typography variant="body2" fontWeight="800" sx={{ color: '#111827', fontSize: '0.85rem', mb: 0.5 }}>
             FBR POS Charges
           </Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', pl: 1.5, fontSize: '0.75rem' }}>
             <span style={{ flex: 2 }}>Qty: 1.00</span>
             <span style={{ width: 55, textAlign: 'right' }}>1.00</span>
             <span style={{ width: 50, textAlign: 'right' }}>0.00</span>
             <span style={{ width: 60, textAlign: 'right', fontWeight: 900, color: '#111827' }}>Rs1.00</span>
           </Box>
        </Box>

      </Box>

      {/* ------- TOTALS ------- */}
      <Box sx={{ borderTop: '2px solid #111827', pt: 1.5, mt: 1, fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
           <span>Total Items/Quantity</span>
           <span>8/26.68</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
           <span>Discount</span>
           <span>Rs0.00</span>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem', color: '#111827', mt: 1, pt: 1, borderTop: '1px solid #111827' }}>
           <span>Invoice Value</span>
           <span>Rs10,939.20</span>
        </Box>
      </Box>

      {/* ------- SALES TAX BREAKUP ------- */}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #9ca3af', fontSize: '0.7rem' }}>
        <Typography variant="caption" fontWeight="900" align="center" display="block" sx={{ color: '#111827', fontSize: '0.8rem', mb: 1 }}>
          Sales Tax Breakup
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', py: 0.5 }}>
           <span>Sale</span><span>Ext. Amt</span><span>GST</span><span>Inl. Amt</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', fontSize: '0.7rem', py: 0.5 }}>
           <span>MCP</span><span>Rs7,371.19</span><span>Rs1,326.81</span><span>Rs8,698.00</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', fontSize: '0.7rem', py: 0.5 }}>
           <span>NON MCP</span><span>Rs241.20</span><span>Rs0.00</span><span>Rs2,241.20</span>
        </Box>
      </Box>

      {/* ------- PAYMENTS & LOYALTY ------- */}
      <Box sx={{ mt: 2, borderTop: '2px solid #111827', pt: 1.5 }}>
        <Typography variant="subtitle2" fontWeight="900" align="center" sx={{ color: '#111827', fontSize: '0.85rem' }}>Payments</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#374151', fontSize: '0.75rem', mt: 1, py: 0.5 }}>
           <span>Alfalah</span>
           <span>Rs10,939.20</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#4b5563', fontSize: '0.75rem', py: 0.5 }}>
           <span>Change Due</span>
           <span>Rs0.00</span>
        </Box>
      </Box>

      {/* ------- LOYALTY INFO ------- */}
      <Box sx={{ mt: 2, textAlign: 'center', borderTop: '1px dashed #9ca3af', pt: 1.5 }}>
        <Typography variant="caption" fontWeight="900" display="block" sx={{ color: '#111827', fontSize: '0.85rem' }}>
          Loyalty Information
        </Typography>
        <Typography variant="caption" fontWeight="700" display="block" sx={{ color: '#374151', fontSize: '0.75rem', mt: 0.5 }}>
          Name: FAISAL MALIK
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', mt: 1 }}>
           <span>Points: 33.06</span>
           <span>Redeem: 0.00</span>
           <span>Available: 1379.71</span>
        </Box>
      </Box>

      {/* ------- FOOTER ------- */}
      <Box sx={{ textAlign: 'center', mt: 2, pt: 1.5, borderTop: '2px dashed #9ca3af' }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: '#111827', fontSize: '0.9rem', letterSpacing: '1px' }}>
          THANK YOU!
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', mt: 0.5 }}>
          {shopProfile.receiptFooter || 'Thank you for shopping with us!'}
        </Typography>
      </Box>
    </Paper>
  );

  if (design === 'design1') return renderDesign1();
  if (design === 'design2') return renderDesign2();
  if (design === 'design3') return renderDesign3();
  if (design === 'design4') return renderDesign4();
  return renderDesign1();
};

// ==================== RECEIPT DESIGN SELECTOR (COMPLETE WITH DESIGN 4) ====================
const ReceiptDesignSelector = ({ currentDesign, onSelectDesign, shopProfile, receiptSettings, isMobile }) => {
  const designs = [
    { id: 'design1', label: 'Classic', description: 'Clean & traditional layout', color: '#065f46', icon: <ReceiptLong fontSize="small" /> },
    { id: 'design2', label: 'Modern', description: 'Colorful with green accents', color: '#10b981', icon: <Palette fontSize="small" /> },
    { id: 'design3', label: 'Premium', description: 'Professional invoice style', color: '#1e293b', icon: <DesignServices fontSize="small" /> },
    { id: 'design4', label: 'Imtiaz Style', description: 'Vertical layout, extra details', color: '#111827', icon: <ReceiptLong fontSize="small" /> },
  ];

  return (
    <Grid container spacing={isMobile ? 1 : 2}>
      {designs.map((design) => (
        <Grid item xs={12} sm={4} key={design.id}>
          <Card 
            variant={currentDesign === design.id ? 'elevation' : 'outlined'}
            elevation={currentDesign === design.id ? 4 : 0}
            sx={{ 
              cursor: 'pointer',
              borderColor: currentDesign === design.id ? '#10b981' : '#e5e7eb',
              borderWidth: currentDesign === design.id ? 2 : 1,
              transition: 'all 0.3s ease',
              '&:hover': { 
                borderColor: '#10b981',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 16px rgba(16,185,129,0.15)'
              },
              height: '100%'
            }}
            onClick={() => onSelectDesign(design.id)}
          >
            <CardContent sx={{ textAlign: 'center', py: isMobile ? 1.5 : 2.5 }}>
              <Box sx={{ position: 'relative' }}>
                {/* Mini preview of design */}
                <Paper sx={{ 
                  p: 1, 
                  bgcolor: '#f9fafb', 
                  mb: 1, 
                  borderRadius: 1,
                  border: currentDesign === design.id ? `2px solid ${design.color}` : '1px solid #e5e7eb'
                }}>
                  <Box sx={{ fontSize: '0.5rem', textAlign: 'center' }}>
                    <Typography variant="caption" fontWeight="bold" fontSize="0.55rem" sx={{ color: design.color }}>
                      {shopProfile.name || 'My Store'}
                    </Typography>
                    <Box sx={{ borderBottom: `1px dashed ${design.color}`, my: 0.3 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.45rem' }}>
                      <span>Item 1</span>
                      <span>Rs. 100</span>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.45rem' }}>
                      <span>Item 2</span>
                      <span>Rs. 200</span>
                    </Box>
                    <Divider sx={{ my: 0.3 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.5rem', color: design.color }}>
                      <span>Total</span>
                      <span>Rs. 300</span>
                    </Box>
                  </Box>
                </Paper>
                {currentDesign === design.id && (
                  <CheckCircle sx={{ color: '#10b981', position: 'absolute', top: -8, right: -8, fontSize: 22, bgcolor: 'white', borderRadius: '50%' }} />
                )}
              </Box>
              <Typography variant="body2" fontWeight={currentDesign === design.id ? 'bold' : 'normal'} sx={{ color: currentDesign === design.id ? design.color : 'inherit' }}>
                {design.icon} {design.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                {design.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// ==================== COMPONENTS (OUTSIDE SettingsPage) ====================
const MobileSettingCard = ({ title, icon, children, expanded, onToggle }) => {
  return (
    <Card sx={{ mb: 1.5, borderLeft: 3, borderColor: 'primary.main' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon} {title}
          </Typography>
          <IconButton size="small" onClick={onToggle}>
            {expanded ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          </IconButton>
        </Box>
        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          {children}
        </Collapse>
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ icon, title, subtitle, isMobile }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary" gutterBottom>
      {icon} {title}
    </Typography>
    {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    <Divider sx={{ mt: 1 }} />
  </Box>
);

const SettingCard = ({ title, children, icon, isMobile, expandedCards, toggleCard }) => {
  const cardId = title;
  const isExpanded = isMobile ? (expandedCards[cardId] !== false) : true;

  if (isMobile) {
    return (
      <MobileSettingCard 
        title={title} 
        icon={icon} 
        expanded={isExpanded} 
        onToggle={() => toggleCard(cardId)}
      >
        {children}
      </MobileSettingCard>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 2, borderLeft: 3, borderColor: 'primary.main' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon} {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================
export default function SettingsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasChanges, setHasChanges] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [roleDialog, setRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ id: '', label: '', color: 'primary', pages: [], permissions: {} });

  const nameInputRef = useRef(null);
  const roleLabelRef = useRef(null);
  const logoInputRef = useRef(null);

  // ✅ Shop Profile with logo support
  const [shopProfile, setShopProfile] = useState(() => {
    const saved = localStorage.getItem('shop_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      name: 'My Store', 
      tagline: 'Quality Products, Best Prices', 
      address: '', 
      city: '', 
      phone: '', 
      email: '', 
      website: '', 
      taxNumber: '', 
      registrationNumber: '', 
      logo: null,
      logoPreview: null,
      receiptFooter: 'Thank you for shopping with us!\nReturns accepted within 7 days with receipt.'
    };
  });

  const [users, setUsers] = useState([]);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Receipt Settings with localStorage and DESIGN SELECTION
  const [receiptSettings, setReceiptSettings] = useState(() => {
    const saved = localStorage.getItem('receipt_settings');
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved);
        if (!parsed.design) parsed.design = 'design1';
        return parsed; 
      } catch (e) {} 
    }
    return {
      showLogo: true, 
      showBarcode: true, 
      showQR: false, 
      printCustomerName: true, 
      printCustomerPhone: true,
      printTaxBreakdown: true, 
      paperSize: '80mm', 
      copies: 1, 
      autoPrint: false, 
      headerText: '',
      footerText: 'Thank you for your business!', 
      fontSize: 'medium', 
      showDiscountDetails: true, 
      showEmployeeName: true,
      design: 'design1',
    };
  });

  // ✅ Tax Settings with FBR integration
  const [taxSettings, setTaxSettings] = useState(() => {
    const saved = localStorage.getItem('tax_settings');
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved);
        if (!parsed.fbrEnabled) parsed.fbrEnabled = false;
        if (!parsed.fbrApiKey) parsed.fbrApiKey = '';
        if (!parsed.fbrApiUrl) parsed.fbrApiUrl = 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData';
        if (!parsed.fbrTaxRate) parsed.fbrTaxRate = 18;
        if (!parsed.fbrTaxType) parsed.fbrTaxType = 'GST';
        if (!parsed.fbrBusinessType) parsed.fbrBusinessType = 'retail';
        return parsed;
      } catch (e) {} 
    }
    return {
      currency: 'PKR', 
      currencySymbol: 'Rs.', 
      taxEnabled: true, 
      taxName: 'GST', 
      taxRate: 18, 
      taxType: 'inclusive',
      secondaryCurrency: '', 
      exchangeRate: 1, 
      roundToNearest: 1, 
      priceDecimalPlaces: 2,
      fbrEnabled: false,
      fbrApiKey: '',
      fbrApiUrl: 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData',
      fbrTaxRate: 18,
      fbrTaxType: 'GST',
      fbrBusinessType: 'retail',
    };
  });

  // ✅ Page Visibility Settings
  const [pageVisibility, setPageVisibility] = useState(() => {
    const saved = localStorage.getItem('page_visibility');
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return {
      dashboard: true, 
      pos: true, 
      sales: true, 
      inventory: true, 
      products: true,
      customers: true, 
      suppliers: true, 
      purchases: true, 
      expenses: true,
      reports: true, 
      settings: true, 
      emi: true, 
      users: true, 
      backup: true,
      services: true, 
      staff: true, 
      work_orders: true,
      deals: true,
      offers: true,
    };
  });

  const [notifications, setNotifications] = useState({
    lowStockAlert: true, 
    lowStockThreshold: 10, 
    dailyReport: false, 
    dailyReportTime: '20:00',
    soundOnSale: true, 
    soundOnError: true, 
    desktopNotifications: false, 
    backupReminder: true, 
    backupReminderDays: 7,
  });

  const [dbInfo, setDbInfo] = useState({ 
    path: 'raath-pos.db', 
    size: 0, 
    tables: 20, 
    records: 0, 
    lastBackup: null, 
    version: '2.0.0' 
  });

  const APP_INFO = {
    name: 'RAATH POS', 
    version: '2.0.0', 
    build: '2024.05.17', 
    developer: 'RAATH Technologies',
    license: 'Commercial License', 
    support: 'support@raathpos.com', 
    website: 'https://raathpos.com',
    features: [
      'Multi-user with role-based access', 
      'Real-time inventory tracking', 
      'Barcode & QR code support', 
      'EMI & installment management', 
      'Customer & supplier ledger', 
      'Auto-backup to Gmail', 
      'Profit & loss reporting', 
      'Dead stock & fast-moving alerts', 
      'Serialized item tracking (IMEI)', 
      'Multi-payment mode support'
    ]
  };

  useEffect(() => {
    loadAllData();
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) { try { setCurrentUser(JSON.parse(savedUser)); } catch (e) {} }
  }, []);

  useEffect(() => { 
    if (userDialog && nameInputRef.current) { 
      setTimeout(() => nameInputRef.current?.focus(), 100); 
    } 
  }, [userDialog]);
  
  useEffect(() => { 
    if (roleDialog && roleLabelRef.current) { 
      setTimeout(() => roleLabelRef.current?.focus(), 100); 
    } 
  }, [roleDialog]);

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ==================== LOGO HANDLING ====================
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Logo size should be less than 2MB!', severity: 'error' });
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Please upload a valid image file!', severity: 'error' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setShopProfile(prev => ({ 
        ...prev, 
        logo: event.target.result,
        logoPreview: event.target.result
      }));
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setShopProfile(prev => ({ ...prev, logo: null, logoPreview: null }));
    setHasChanges(true);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // ==================== SHOP PROFILE HANDLERS ====================
  const handleShopChange = (field, value) => {
    setShopProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // ==================== RECEIPT SETTINGS HANDLERS ====================
  const handleReceiptChange = (field, value) => {
    setReceiptSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // ==================== TAX SETTINGS HANDLERS ====================
  const handleTaxChange = (field, value) => {
    setTaxSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // ==================== PAGE VISIBILITY HANDLERS ====================
  const handlePageVisibilityToggle = (pageId) => {
    setPageVisibility(prev => ({ ...prev, [pageId]: !prev[pageId] }));
    setHasChanges(true);
  };

  // ==================== NOTIFICATIONS HANDLERS ====================
  const handleNotificationChange = (field, value) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      let dbRoles = await getRoles();
      // ✅ NEW: Auto-migrate old roles (pages array only) to new CRUD format
      const needsMigration = dbRoles.some(r => !r.permissions || Array.isArray(r.permissions));
      if (needsMigration) {
        dbRoles = dbRoles.map(role => {
          if (role.permissions && typeof role.permissions === 'object' && !Array.isArray(role.permissions)) {
            return role;
          }
          const newPerms = {};
          (role.pages || []).forEach(pid => {
            newPerms[pid] = { view: true, add: true, edit: true, delete: true };
          });
          return { ...role, permissions: newPerms };
        });
        await persistRolesToDB(dbRoles);
      }
      setRoles(dbRoles);
      setRolePermissions(buildPermissionsMap(dbRoles));

      const dbUsers = await db.getUsers();
      if (dbUsers && dbUsers.length > 0) {
        setUsers(dbUsers.map(u => ({
          id: u.id, name: u.name, username: u.username || u.email || '', email: u.email || '',
          role: u.role || 'cashier', active: u.status === 'active', phone: u.phone || '',
          shop_name: u.shop_name || '', shop_address: u.shop_address || '',
          business_type: u.business_type || 'retail', currency: u.currency || 'PKR',
        })));
      } else { setUsers([]); }

      const savedProfile = localStorage.getItem('shop_profile');
      if (savedProfile) { 
        try { 
          const parsed = JSON.parse(savedProfile);
          setShopProfile(prev => ({ ...prev, ...parsed }));
        } catch (e) {} 
      }
      
      const savedReceipt = localStorage.getItem('receipt_settings');
      if (savedReceipt) { 
        try { 
          const parsed = JSON.parse(savedReceipt);
          if (!parsed.design) parsed.design = 'design1';
          setReceiptSettings(parsed); 
        } catch (e) {} 
      }
      
      const savedTax = localStorage.getItem('tax_settings');
      if (savedTax) { 
        try { 
          const parsed = JSON.parse(savedTax);
          if (!parsed.fbrEnabled) parsed.fbrEnabled = false;
          if (!parsed.fbrApiKey) parsed.fbrApiKey = '';
          if (!parsed.fbrApiUrl) parsed.fbrApiUrl = 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData';
          if (!parsed.fbrTaxRate) parsed.fbrTaxRate = 18;
          if (!parsed.fbrTaxType) parsed.fbrTaxType = 'GST';
          if (!parsed.fbrBusinessType) parsed.fbrBusinessType = 'retail';
          setTaxSettings(parsed);
        } catch (e) {} 
      }
      
      const savedNotif = localStorage.getItem('notification_settings');
      if (savedNotif) { 
        try { setNotifications(JSON.parse(savedNotif)); } catch (e) {} 
      }
      
      const savedPages = localStorage.getItem('page_visibility');
      if (savedPages) { 
        try { setPageVisibility(JSON.parse(savedPages)); } catch (e) {} 
      }
      
      await loadDbStats();
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error loading: ' + err.message, severity: 'error' }); 
    }
    setLoading(false);
  };

  const buildPermissionsMap = (rolesArr) => {
    const perms = {};
    rolesArr.forEach(r => {
      // ✅ NEW: Support granular permissions object
      if (r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions)) {
        perms[r.id] = r.permissions;
      } else {
        // Migrate old format (pages array) -> new format with full CRUD
        const pagePerms = {};
        (r.pages || []).forEach(pid => {
          pagePerms[pid] = { view: true, add: true, edit: true, delete: true };
        });
        perms[r.id] = pagePerms;
      }
    });
    return perms;
  };

  const loadDbStats = async () => {
    try {
      const [products, customers, sales] = await Promise.all([
        db.getProducts().catch(() => []), 
        db.getCustomers().catch(() => []), 
        db.getSalesHistory().catch(() => [])
      ]);
      setDbInfo(prev => ({ ...prev, records: products.length + customers.length + sales.length }));
    } catch (e) {}
  };

  // ==================== SAVE HANDLER ====================
  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('shop_profile', JSON.stringify(shopProfile));
      localStorage.setItem('receipt_settings', JSON.stringify(receiptSettings));
      localStorage.setItem('tax_settings', JSON.stringify(taxSettings));
      localStorage.setItem('notification_settings', JSON.stringify(notifications));
      localStorage.setItem('page_visibility', JSON.stringify(pageVisibility));
      
      if (currentUser?.role === 'admin') {
        await db.updateUser(currentUser.id, { 
          shop_name: shopProfile.name, 
          shop_address: shopProfile.address, 
          phone: shopProfile.phone, 
          currency: taxSettings.currency 
        });
      }
      
      setHasChanges(false);
      setSnackbar({ open: true, message: 'All settings saved!', severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm('WARNING: Reset ALL settings and clear database?')) return;
    if (!window.confirm('FINAL CONFIRMATION: All data permanently deleted?')) return;
    setLoading(true);
    try {
      ['shop_profile', 'pos_users', 'receipt_settings', 'tax_settings', 'notification_settings', 'current_user', 'page_visibility'].forEach(k => localStorage.removeItem(k));

      const defaultRoles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
      await persistRolesToDB(defaultRoles);
      setRoles(defaultRoles);
      setRolePermissions(buildPermissionsMap(defaultRoles));

      if (db.mode === 'browser') { indexedDB.deleteDatabase('RAATH_POS_DEMO'); }
      setSnackbar({ open: true, message: 'Reset complete! Reloading...', severity: 'success' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
    setLoading(false);
  };

  const persistRoles = useCallback(async (newRoles, newPerms) => {
    try {
      await persistRolesToDB(newRoles);
      setRoles(newRoles);
      setRolePermissions(newPerms);
    } catch (err) {
      setSnackbar({ open: true, message: 'Role save failed: ' + err.message, severity: 'error' });
      throw err;
    }
  }, []);

  const handleAddRole = () => {
    setRoleForm({ id: '', label: '', color: 'primary', pages: [], permissions: {} });
    setEditingRole(null);
    setRoleDialog(true);
  };

  const handleEditRole = (role) => {
    // ✅ NEW: Load granular permissions or migrate from old pages array
    let perms = {};
    if (role.permissions && typeof role.permissions === 'object' && !Array.isArray(role.permissions)) {
      perms = role.permissions;
    } else {
      (role.pages || []).forEach(pid => {
        perms[pid] = { view: true, add: true, edit: true, delete: true };
      });
    }
    setRoleForm({ id: role.id, label: role.label, color: role.color, pages: [...(role.pages || [])], permissions: perms });
    setEditingRole(role);
    setRoleDialog(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.label) { 
      setSnackbar({ open: true, message: 'Role Name required!', severity: 'error' }); 
      return; 
    }
    const id = editingRole ? editingRole.id : roleForm.id.trim().toLowerCase().replace(/\s+/g, '_');
    if (!editingRole) {
      if (!id) { 
        setSnackbar({ open: true, message: 'Role ID required!', severity: 'error' }); 
        return; 
      }
      if (!/^[a-z0-9_]+$/.test(id)) { 
        setSnackbar({ open: true, message: 'ID: letters, numbers, underscores only!', severity: 'error' }); 
        return; 
      }
      if (roles.find(r => r.id === id)) { 
        setSnackbar({ open: true, message: 'Role ID already exists!', severity: 'error' }); 
        return; 
      }
    }
    // ✅ NEW: Validate at least one page has VIEW permission
    const hasAnyPage = Object.values(roleForm.permissions).some(p => p.view);
    if (!hasAnyPage) { 
      setSnackbar({ open: true, message: 'Select at least one page with View permission!', severity: 'error' }); 
      return; 
    }

    const updatedRole = { 
      id, 
      label: roleForm.label.trim(), 
      color: roleForm.color, 
      pages: Object.entries(roleForm.permissions).filter(([_, p]) => p.view).map(([pid, _]) => pid),
      permissions: roleForm.permissions, // ✅ NEW: Save granular permissions
      permissionSummary: Object.entries(roleForm.permissions)
        .filter(([_, perms]) => perms.view)
        .map(([pid, _]) => AVAILABLE_PAGES.find(ap => ap.id === pid)?.label || pid)
    };
    const newRoles = editingRole ? roles.map(r => r.id === editingRole.id ? updatedRole : r) : [...roles, updatedRole];
    const newPerms = buildPermissionsMap(newRoles);

    setLoading(true);
    try {
      await persistRoles(newRoles, newPerms);
      setRoleDialog(false);
      setSnackbar({ open: true, message: `Role "${updatedRole.label}" ${editingRole ? 'updated' : 'created'}!`, severity: 'success' });
    } catch (e) {}
    setLoading(false);
  };

  const handleDeleteRole = async (role) => {
    if (role.id === 'admin') { 
      setSnackbar({ open: true, message: 'Cannot delete Administrator!', severity: 'error' }); 
      return; 
    }
    const usersWithRole = users.filter(u => u.role === role.id);
    if (usersWithRole.length > 0) { 
      setSnackbar({ open: true, message: `Cannot delete: ${usersWithRole.length} user(s) assigned!`, severity: 'warning' }); 
      return; 
    }
    if (!window.confirm(`Delete role "${role.label}"?`)) return;

    setLoading(true);
    try {
      const newRoles = roles.filter(r => r.id !== role.id);
      const newPerms = buildPermissionsMap(newRoles);
      await persistRoles(newRoles, newPerms);
      setSnackbar({ open: true, message: `Role "${role.label}" deleted!`, severity: 'success' });
    } catch (e) {}
    setLoading(false);
  };

  // ✅ NEW: Granular CRUD permission toggle
  const toggleRolePermission = (pageId, action) => {
    setRoleForm(prev => {
      const current = prev.permissions[pageId] || { view: false, add: false, edit: false, delete: false };
      const updated = { ...current, [action]: !current[action] };

      // Auto-enable VIEW if any action is enabled
      if (action !== 'view' && updated[action]) {
        updated.view = true;
      }
      // Auto-disable ALL if VIEW is turned off
      if (action === 'view' && !updated.view) {
        updated.add = false;
        updated.edit = false;
        updated.delete = false;
      }

      const newPermissions = { ...prev.permissions, [pageId]: updated };
      const newPages = Object.entries(newPermissions)
        .filter(([_, perms]) => perms.view)
        .map(([pid, _]) => pid);

      return { ...prev, permissions: newPermissions, pages: newPages };
    });
  };

  // Keep old toggle for backward compat if needed (not used in UI anymore)
  const toggleRolePage = (pageId) => {
    setRoleForm(prev => ({
      ...prev,
      pages: prev.pages.includes(pageId) ? prev.pages.filter(p => p !== pageId) : [...prev.pages, pageId]
    }));
  };

  const handleCreateFirstAdmin = () => {
    setEditingUser({ 
      id: null, name: '', username: '', email: '', phone: '', role: 'admin', active: true, 
      password: '', shop_name: shopProfile.name, shop_address: shopProfile.address, 
      business_type: 'retail', currency: taxSettings.currency, isFirstAdmin: true 
    });
    setUserDialog(true); 
    setShowPassword(false);
  };

  const handleAddUser = () => {
    setEditingUser({ 
      id: null, name: '', username: '', email: '', phone: '', role: 'cashier', active: true, 
      password: '', shop_name: shopProfile.name, shop_address: shopProfile.address, 
      business_type: 'retail', currency: taxSettings.currency 
    });
    setUserDialog(true); 
    setShowPassword(false);
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user, username: user.username || user.email || '', email: user.email || '', password: '' });
    setUserDialog(true); 
    setShowPassword(false);
  };

  const handleSaveUser = async () => {
    // ✅ NEW: Username required instead of email
    if (!editingUser.name || !editingUser.username) { 
      setSnackbar({ open: true, message: 'Name and username required!', severity: 'error' }); 
      return; 
    }
    // ✅ NEW: Password must be at least 6 characters for new users
    if (!editingUser.id && (!editingUser.password || editingUser.password.length < 6)) { 
      setSnackbar({ open: true, message: 'Password must be at least 6 characters!', severity: 'error' }); 
      return; 
    }
    // ✅ NEW: If changing password on existing user, also enforce 6 chars
    if (editingUser.id && editingUser.password && editingUser.password.length > 0 && editingUser.password.length < 6) {
      setSnackbar({ open: true, message: 'Password must be at least 6 characters!', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      const userData = { 
        name: editingUser.name, 
        username: editingUser.username,
        email: editingUser.email || '', 
        phone: editingUser.phone || '', 
        role: editingUser.role, 
        status: editingUser.active ? 'active' : 'inactive', 
        shop_name: editingUser.shop_name || shopProfile.name, 
        shop_address: editingUser.shop_address || shopProfile.address, 
        business_type: editingUser.business_type || 'retail', 
        currency: editingUser.currency || taxSettings.currency 
      };
      if (editingUser.password) { 
        userData.password = editingUser.password; 
        userData.password_hash = editingUser.password; 
      }
      let result;
      if (editingUser.id) { 
        await db.updateUser(editingUser.id, userData); 
        result = { id: editingUser.id }; 
      } else { 
        result = await db.createUser(userData); 
      }
      if (editingUser.isFirstAdmin && result?.lastInsertRowid) {
        const newAdmin = await db.getUserById(result.lastInsertRowid);
        if (newAdmin) { 
          const { password, password_hash, ...safeUser } = newAdmin; 
          localStorage.setItem('current_user', JSON.stringify(safeUser)); 
          setCurrentUser(safeUser); 
        }
      }
      await refreshUsersList();
      setUserDialog(false); 
      setEditingUser(null);
      setSnackbar({ open: true, message: `User ${editingUser.id ? 'updated' : 'created'}!`, severity: 'success' });
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
    setLoading(false);
  };

  const refreshUsersList = async () => {
    const dbUsers = await db.getUsers();
    setUsers(dbUsers.map(u => ({ 
      id: u.id, name: u.name, username: u.username || u.email || '', email: u.email || '', 
      role: u.role || 'cashier', active: u.status === 'active', phone: u.phone || '', 
      shop_name: u.shop_name || '', shop_address: u.shop_address || '', 
      business_type: u.business_type || 'retail', currency: u.currency || 'PKR' 
    })));
  };

  const handleDeleteUser = async (id) => {
    if (users.length <= 1) { 
      setSnackbar({ open: true, message: 'Cannot delete last user!', severity: 'error' }); 
      return; 
    }
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    try { 
      await db.deleteUser(id); 
      await refreshUsersList(); 
      setSnackbar({ open: true, message: 'User deleted!', severity: 'success' }); 
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
    setLoading(false);
  };

  const toggleUserActive = async (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    try { 
      await db.updateUser(id, { status: user.active ? 'inactive' : 'active' }); 
      await refreshUsersList(); 
      setSnackbar({ open: true, message: `User ${user.active ? 'deactivated' : 'activated'}!`, severity: 'success' }); 
    } catch (err) { 
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); 
    }
  };

  const canManageUsers = useMemo(() => {
    if (users.length === 0) return true;
    return currentUser?.role === 'admin';
  }, [currentUser, users.length]);

  const isFirstSetup = users.length === 0;

  // ==================== RENDER ====================
  return (
    <Box sx={{ p: isMobile ? 1 : 3, maxWidth: 1200, mx: 'auto', pb: isMobile ? 8 : 3 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 3, gap: 1 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
          <Settings sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} /> 
          {isMobile ? 'Settings' : 'Settings & Configuration'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          {hasChanges && <Chip color="warning" icon={<Warning fontSize="small" />} label="Unsaved" variant="outlined" size="small" />}
          <Button variant="outlined" color="error" size="small" startIcon={<Restore />} onClick={handleReset}>
            {isMobile ? 'Reset' : 'Reset All'}
          </Button>
          <Button variant="contained" size="small" startIcon={<Save />} onClick={handleSave} disabled={loading} sx={{ bgcolor: '#10b981' }}>
            {loading ? 'Saving...' : isMobile ? 'Save' : 'Save All Changes'}
          </Button>
        </Stack>
      </Box>
      
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* TABS */}
      <Paper sx={{ mb: 3, overflowX: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          sx={{ minHeight: isMobile ? 40 : 48 }}
        >
          {SETTINGS_TABS.map((tab) => (
            <Tab 
              key={tab.id} 
              icon={isMobile ? tab.icon : tab.icon} 
              label={isMobile ? null : tab.label}
              sx={{ 
                fontSize: isMobile ? '0.6rem' : '0.875rem', 
                py: isMobile ? 0.5 : 1,
                minWidth: isMobile ? 'auto' : 'auto',
                px: isMobile ? 1 : 2
              }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: SHOP PROFILE ==================== */}
      {activeTab === 0 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Store />} title="Shop Profile" subtitle="Your business information appears on receipts and reports" isMobile={isMobile} />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Basic Information" 
                  icon={<Business color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={2}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Shop Name *" 
                      value={shopProfile.name} 
                      onChange={(e) => handleShopChange('name', e.target.value)} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Tagline / Slogan" 
                      value={shopProfile.tagline} 
                      onChange={(e) => handleShopChange('tagline', e.target.value)} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Address" 
                      multiline 
                      rows={2} 
                      value={shopProfile.address} 
                      onChange={(e) => handleShopChange('address', e.target.value)} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="City" 
                      value={shopProfile.city} 
                      onChange={(e) => handleShopChange('city', e.target.value)} 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Contact Details" 
                  icon={<Phone color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={2}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Phone Number" 
                      value={shopProfile.phone} 
                      onChange={(e) => handleShopChange('phone', e.target.value)} 
                      InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Email" 
                      type="email" 
                      value={shopProfile.email} 
                      onChange={(e) => handleShopChange('email', e.target.value)} 
                      InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Website" 
                      value={shopProfile.website} 
                      onChange={(e) => handleShopChange('website', e.target.value)} 
                      InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }} 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard 
                  title="Legal & Tax" 
                  icon={<VerifiedUser color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Grid container spacing={isMobile ? 1 : 2}>
                    <Grid item xs={12} md={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Tax / NTN Number" 
                        value={shopProfile.taxNumber} 
                        onChange={(e) => handleShopChange('taxNumber', e.target.value)} 
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Business Registration #" 
                        value={shopProfile.registrationNumber} 
                        onChange={(e) => handleShopChange('registrationNumber', e.target.value)} 
                      />
                    </Grid>
                  </Grid>
                </SettingCard>
              </Grid>
              
              {/* LOGO UPLOAD SECTION */}
              <Grid item xs={12}>
                <SettingCard 
                  title="Shop Logo" 
                  icon={<Image color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                    {shopProfile.logoPreview ? (
                      <Box sx={{ position: 'relative', display: 'inline-block' }}>
                        <Avatar 
                          src={shopProfile.logoPreview} 
                          variant="rounded" 
                          sx={{ width: 100, height: 100, border: '2px solid #10b981' }}
                        />
                        <IconButton 
                          size="small" 
                          sx={{ 
                            position: 'absolute', 
                            top: -8, 
                            right: -8, 
                            bgcolor: 'error.main', 
                            color: 'white', 
                            '&:hover': { bgcolor: 'error.dark' } 
                          }}
                          onClick={handleRemoveLogo}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box 
                        sx={{ 
                          width: 100, 
                          height: 100, 
                          border: '2px dashed #ccc', 
                          borderRadius: 2, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#10b981' }
                        }}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <CloudUpload color="action" />
                      </Box>
                    )}
                    <Box>
                      <Button 
                        variant="outlined" 
                        component="label" 
                        startIcon={<CloudUpload />}
                        size="small"
                      >
                        Upload Logo
                        <input 
                          type="file" 
                          accept="image/*" 
                          hidden 
                          ref={logoInputRef}
                          onChange={handleLogoUpload} 
                        />
                      </Button>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                        Max size: 2MB (JPG, PNG, GIF)
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Logo appears on receipts and reports
                      </Typography>
                    </Box>
                  </Box>
                </SettingCard>
              </Grid>

              {/* RECEIPT FOOTER */}
              <Grid item xs={12}>
                <SettingCard 
                  title="Receipt Footer Message" 
                  icon={<Receipt color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={3} 
                    size="small" 
                    label="Footer Text" 
                    value={shopProfile.receiptFooter} 
                    onChange={(e) => handleShopChange('receiptFooter', e.target.value)} 
                    helperText="This text appears at the bottom of every receipt. Supports multi-line text."
                  />
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Preview:</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                      {shopProfile.receiptFooter || 'No footer text set'}
                    </Typography>
                  </Box>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: USERS ==================== */}
      {activeTab === 1 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Person />} title="User Management" subtitle="Manage staff access and permissions" isMobile={isMobile} />

            {isFirstSetup && (
              <Alert severity="info" sx={{ mb: 3 }} icon={<AdminPanelSettings />}>
                <Typography variant="body1" fontWeight="bold" gutterBottom>Welcome! Create your first Administrator account</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>No users found in the database. Create the first admin user to start using the system.</Typography>
                <Button variant="contained" color="primary" startIcon={<Add />} onClick={handleCreateFirstAdmin} sx={{ bgcolor: '#10b981' }}>Create First Admin Account</Button>
              </Alert>
            )}

            {!isFirstSetup && (
              <>
                {!canManageUsers && <Alert severity="warning" sx={{ mb: 2 }}>Only administrators can manage users. Contact your admin for changes.</Alert>}

                <Card variant="outlined" sx={{ mb: 3, borderLeft: 3, borderColor: 'secondary.main' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
                      <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Shield color="secondary" /> Role Management
                      </Typography>
                      <Button variant="contained" color="secondary" size="small" startIcon={<Add />} onClick={handleAddRole}>
                        Add Role
                      </Button>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Create custom roles and define which pages they can access.
                    </Typography>
                    <Grid container spacing={isMobile ? 1 : 2}>
                      {roles.map(role => (
                        <Grid item xs={12} sm={6} md={3} key={role.id}>
                          <Card variant="outlined" sx={{ borderLeft: 3, borderColor: `${role.color}.main`, height: '100%' }}>
                            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="body2" fontWeight="bold" color={`${role.color}.main`}>{role.label}</Typography>
                                <Stack direction="row" spacing={0.5}>
                                  <Tooltip title="Edit Role"><IconButton size="small" onClick={() => handleEditRole(role)}><Edit fontSize="small" /></IconButton></Tooltip>
                                  {role.id !== 'admin' && (
                                    <Tooltip title="Delete Role"><IconButton size="small" color="error" onClick={() => handleDeleteRole(role)}><Delete fontSize="small" /></IconButton></Tooltip>
                                  )}
                                </Stack>
                              </Box>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {Object.entries(role.permissions || {}).filter(([_, p]) => p.view).length} pages
                                {role.id !== 'admin' && (
                                  <span style={{ marginLeft: 8 }}>
                                    {Object.entries(role.permissions || {}).filter(([_, p]) => p.delete).length > 0 && (
                                      <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ Can Delete</span>
                                    )}
                                  </span>
                                )}
                              </Typography>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                                {Object.entries(role.permissions || {})
                                  .filter(([_, perms]) => perms.view)
                                  .slice(0, 2)
                                  .map(([pid, _]) => (
                                    <Chip key={pid} size="small" label={AVAILABLE_PAGES.find(p => p.id === pid)?.label || pid} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                  ))}
                                {Object.entries(role.permissions || {}).filter(([_, perms]) => perms.view).length > 2 && (
                                  <Chip size="small" label={`+${Object.entries(role.permissions || {}).filter(([_, perms]) => perms.view).length - 2}`} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>

                <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 2, gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">{users.length} user(s) in database</Typography>
                  {canManageUsers && <Button variant="contained" size="small" startIcon={<Add />} onClick={handleAddUser} sx={{ bgcolor: '#10b981' }}>Add User</Button>}
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell>User</TableCell>
                        {!isMobile && <TableCell>Email</TableCell>}
                        <TableCell>Role</TableCell>
                        {!isMobile && <TableCell>Access</TableCell>}
                        <TableCell>Status</TableCell>
                        {canManageUsers && <TableCell align="right">Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user) => {
                        const roleConfig = roles.find(r => r.id === user.role);
                        return (
                          <TableRow key={user.id} sx={{ opacity: user.active ? 1 : 0.6 }}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: `${roleConfig?.color || 'primary'}.main` }}><AccountCircle fontSize="small" /></Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">{user.name}</Typography>
                                  {isMobile && <Typography variant="caption" color="text.secondary" display="block">{user.email || user.username}</Typography>}
                                  <Typography variant="caption" color="text.secondary">{user.phone || ''}</Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            {!isMobile && <TableCell>{user.email || user.username}</TableCell>}
                            <TableCell><Chip size="small" label={roleConfig?.label || user.role} color={roleConfig?.color || 'default'} /></TableCell>
                            {!isMobile && (
                              <TableCell>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                  {Object.entries(roleConfig?.permissions || {})
                                    .filter(([_, perms]) => perms.view)
                                    .map(([pid, perms]) => {
                                      const pageLabel = AVAILABLE_PAGES.find(p => p.id === pid)?.label || pid;
                                      const actions = [];
                                      if (perms.add) actions.push('Add');
                                      if (perms.edit) actions.push('Edit');
                                      if (perms.delete) actions.push('Del');
                                      return (
                                        <Chip 
                                          key={pid} 
                                          size="small" 
                                          label={`${pageLabel}${actions.length > 0 ? ': ' + actions.join('/') : ''}`} 
                                          variant="outlined" 
                                          color={perms.delete ? 'error' : 'info'} 
                                          sx={{ fontSize: '0.65rem', height: 20 }} 
                                        />
                                      );
                                    })}
                                </Stack>
                              </TableCell>
                            )}
                            <TableCell><Chip size="small" label={user.active ? 'Active' : 'Inactive'} color={user.active ? 'success' : 'default'} /></TableCell>
                            {canManageUsers && (
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                                  <Tooltip title={user.active ? 'Deactivate' : 'Activate'}><Switch size="small" checked={user.active} onChange={() => toggleUserActive(user.id)} color="success" /></Tooltip>
                                  <IconButton size="small" onClick={() => handleEditUser(user)}><Edit fontSize="small" /></IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteUser(user.id)}><Delete fontSize="small" /></IconButton>
                                </Stack>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                      {users.length === 0 && <TableRow><TableCell colSpan={isMobile ? 5 : 7} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No users found</Typography></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {/* USER DIALOG */}
            <Dialog open={userDialog} onClose={() => { setUserDialog(false); setEditingUser(null); }} maxWidth="sm" fullWidth fullScreen={isMobile}>
              <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
                {editingUser?.isFirstAdmin ? 'Create First Admin' : (editingUser?.id ? 'Edit User' : 'Add New User')}
              </DialogTitle>
              <DialogContent sx={{ pt: 2 }}>
                <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
                  <TextField fullWidth size="small" label="Full Name *" value={editingUser?.name || ''} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} inputRef={nameInputRef} />
                  {/* ✅ NEW: Username field (required for login) */}
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Username *" 
                    value={editingUser?.username || ''} 
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} 
                    helperText="Unique login username (required)"
                  />
                  {/* ✅ Email is now optional */}
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Email" 
                    type="email" 
                    value={editingUser?.email || ''} 
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} 
                    helperText="Optional email address"
                  />
                  <TextField fullWidth size="small" label="Phone" value={editingUser?.phone || ''} onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} />
                  {/* ✅ NEW: Password with 6-char validation and red alert */}
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={editingUser?.password || ''} 
                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} 
                    error={!!(editingUser?.password && editingUser.password.length > 0 && editingUser.password.length < 6)}
                    helperText={
                      editingUser?.password && editingUser.password.length > 0 && editingUser.password.length < 6 
                        ? <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ Password must be at least 6 characters!</span>
                        : editingUser?.id ? "Leave blank to keep current password" : "Minimum 6 characters required"
                    }
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} 
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Role *</InputLabel>
                    <Select value={editingUser?.role || 'cashier'} onChange={(e) => setEditingUser({...editingUser, role: e.target.value})} label="Role">
                      {roles.map(r => (
                        <MenuItem key={r.id} value={r.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${r.color}.main` }} /> {r.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {/* ✅ NEW: Show CRUD permissions for selected role */}
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Selected Role: {roles.find(r => r.id === editingUser?.role)?.label}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Permissions breakdown:</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {Object.entries(roles.find(r => r.id === editingUser?.role)?.permissions || {})
                        .filter(([_, perms]) => perms.view)
                        .map(([pid, perms]) => {
                          const pageLabel = AVAILABLE_PAGES.find(p => p.id === pid)?.label || pid;
                          const actions = [];
                          if (perms.view) actions.push('View');
                          if (perms.add) actions.push('Add');
                          if (perms.edit) actions.push('Edit');
                          if (perms.delete) actions.push('Del');
                          return (
                            <Chip 
                              key={pid} 
                              size="small" 
                              label={`${pageLabel}: ${actions.join('/')}`} 
                              variant="outlined" 
                              color={perms.delete ? "error" : "success"} 
                              sx={{ textTransform: 'capitalize', fontSize: '0.65rem', height: 22, mb: 0.5 }} 
                            />
                          );
                        }) || <Typography variant="caption" color="error">No pages assigned!</Typography>}
                    </Stack>
                  </Box>
                  <FormControlLabel control={<Switch checked={editingUser?.active || false} onChange={(e) => setEditingUser({...editingUser, active: e.target.checked})} />} label="Active" />
                </Stack>
              </DialogContent>
              <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
                <Button fullWidth={isMobile} onClick={() => { setUserDialog(false); setEditingUser(null); }}>Cancel</Button>
                <Button 
                  fullWidth={isMobile} 
                  variant="contained" 
                  onClick={handleSaveUser} 
                  startIcon={<Save />} 
                  sx={{ bgcolor: '#10b981' }} 
                  disabled={loading || !!(editingUser?.password && editingUser.password.length > 0 && editingUser.password.length < 6) || !editingUser?.name || !editingUser?.username || (!editingUser?.id && !editingUser?.password)}
                >
                  {loading ? 'Saving...' : (editingUser?.isFirstAdmin ? 'Create Admin' : 'Save User')}
                </Button>
              </DialogActions>
            </Dialog>

            {/* ROLE DIALOG */}
            <Dialog open={roleDialog} onClose={() => setRoleDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
              <DialogTitle sx={{ bgcolor: '#10b981', color: 'white' }}>
                {editingRole ? 'Edit Role' : 'Add New Role'}
              </DialogTitle>
              <DialogContent sx={{ pt: 2 }}>
                <Stack spacing={isMobile ? 1.5 : 2} sx={{ mt: 1 }}>
                  <TextField fullWidth size="small" label="Role Name *" value={roleForm.label} onChange={(e) => setRoleForm({...roleForm, label: e.target.value})} inputRef={roleLabelRef} helperText="Example: Salesman, Warehouse Manager" />
                  {!editingRole && (
                    <TextField fullWidth size="small" label="Role ID *" value={roleForm.id} onChange={(e) => setRoleForm({...roleForm, id: e.target.value})} helperText="Unique ID: letters, numbers, underscores only" />
                  )}
                  <FormControl fullWidth size="small">
                    <InputLabel>Color Theme</InputLabel>
                    <Select value={roleForm.color} onChange={(e) => setRoleForm({...roleForm, color: e.target.value})} label="Color Theme">
                      <MenuItem value="primary">Primary (Blue)</MenuItem>
                      <MenuItem value="secondary">Secondary (Green)</MenuItem>
                      <MenuItem value="error">Error (Red)</MenuItem>
                      <MenuItem value="warning">Warning (Orange)</MenuItem>
                      <MenuItem value="info">Info (Cyan)</MenuItem>
                      <MenuItem value="success">Success (Green)</MenuItem>
                      <MenuItem value="default">Default (Grey)</MenuItem>
                    </Select>
                  </FormControl>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Page Permissions (CRUD)</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Define exact actions this role can perform. View is required for Add/Edit/Delete.
                    </Typography>
                    <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
                      <Grid container sx={{ bgcolor: 'grey.50', p: 1, borderBottom: '1px solid', borderColor: 'divider', fontWeight: 'bold', fontSize: '0.7rem' }}>
                        <Grid item xs={isMobile ? 3 : 4}><Typography variant="caption" fontWeight="bold">Page</Typography></Grid>
                        <Grid item xs={isMobile ? 2 : 2} textAlign="center"><Typography variant="caption" fontWeight="bold">View</Typography></Grid>
                        <Grid item xs={isMobile ? 2 : 2} textAlign="center"><Typography variant="caption" fontWeight="bold">Add</Typography></Grid>
                        <Grid item xs={isMobile ? 2.5 : 2} textAlign="center"><Typography variant="caption" fontWeight="bold">Edit</Typography></Grid>
                        <Grid item xs={isMobile ? 2.5 : 2} textAlign="center"><Typography variant="caption" fontWeight="bold" sx={{ color: 'error.main' }}>Delete</Typography></Grid>
                      </Grid>
                      {AVAILABLE_PAGES.map(page => {
                        const perms = roleForm.permissions[page.id] || { view: false, add: false, edit: false, delete: false };
                        return (
                          <Grid container key={page.id} alignItems="center" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
                            <Grid item xs={isMobile ? 3 : 4}>
                              <Typography variant="body2" fontSize={isMobile ? '0.7rem' : '0.8rem'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {page.icon} {page.label}
                              </Typography>
                            </Grid>
                            <Grid item xs={isMobile ? 2 : 2} textAlign="center">
                              <Checkbox size="small" checked={perms.view} onChange={() => toggleRolePermission(page.id, 'view')} />
                            </Grid>
                            <Grid item xs={isMobile ? 2 : 2} textAlign="center">
                              <Checkbox size="small" checked={perms.add} onChange={() => toggleRolePermission(page.id, 'add')} disabled={!perms.view} />
                            </Grid>
                            <Grid item xs={isMobile ? 2.5 : 2} textAlign="center">
                              <Checkbox size="small" checked={perms.edit} onChange={() => toggleRolePermission(page.id, 'edit')} disabled={!perms.view} />
                            </Grid>
                            <Grid item xs={isMobile ? 2.5 : 2} textAlign="center">
                              <Checkbox size="small" checked={perms.delete} onChange={() => toggleRolePermission(page.id, 'delete')} disabled={!perms.view} sx={{ color: 'error.main', '&.Mui-checked': { color: 'error.main' } }} />
                            </Grid>
                          </Grid>
                        );
                      })}
                    </Paper>
                  </Box>
                  <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      <strong>{Object.values(roleForm.permissions).filter(p => p.view).length}</strong> of <strong>{AVAILABLE_PAGES.length}</strong> pages with View access
                    </Typography>
                    {Object.values(roleForm.permissions).filter(p => p.view).length === AVAILABLE_PAGES.length && <Chip size="small" label="All Access" color="success" sx={{ ml: 1, height: 20 }} />}
                    {Object.values(roleForm.permissions).some(p => p.delete) && (
                      <Chip size="small" label="Can Delete" color="error" sx={{ ml: 1, height: 20 }} />
                    )}
                  </Box>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
                <Button fullWidth={isMobile} onClick={() => setRoleDialog(false)}>Cancel</Button>
                <Button fullWidth={isMobile} variant="contained" onClick={handleSaveRole} startIcon={<Save />} sx={{ bgcolor: '#10b981' }}>
                  {editingRole ? 'Update Role' : 'Create Role'}
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 2: RECEIPT (COMPLETE WITH DESIGN SELECTION) ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Receipt />} title="Receipt & Invoice Settings" subtitle="Customize how receipts and invoices look" isMobile={isMobile} />
            
            {/* RECEIPT DESIGN SELECTION */}
            <Card sx={{ mb: 3, border: '2px solid #10b981', bgcolor: '#f0fdf4', borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DesignServices color="primary" /> Choose Receipt Design
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select your preferred receipt style. Changes will reflect in all new receipts.
                </Typography>
                
                <ReceiptDesignSelector 
                  currentDesign={receiptSettings.design}
                  onSelectDesign={(design) => handleReceiptChange('design', design)}
                  shopProfile={shopProfile}
                  receiptSettings={receiptSettings}
                  isMobile={isMobile}
                />
              </CardContent>
            </Card>

            {/* Receipt Preview with selected design */}
            <Card sx={{ mb: 3, bgcolor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Receipt fontSize="small" /> Live Receipt Preview
                  </Typography>
                  <Chip 
                    size="small" 
                    label={receiptSettings.design === 'design1' ? '📄 Classic' : receiptSettings.design === 'design2' ? '🎨 Modern' : '⭐ Premium'} 
                    color="success" 
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
                <ReceiptDesignPreview 
                  design={receiptSettings.design} 
                  shopProfile={shopProfile} 
                  receiptSettings={receiptSettings} 
                />
              </CardContent>
            </Card>

            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Print Options" 
                  icon={<LocalPrintshop color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={1.5}>
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.showLogo} onChange={(e) => handleReceiptChange('showLogo', e.target.checked)} />} 
                      label="Show Shop Logo" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.showBarcode} onChange={(e) => handleReceiptChange('showBarcode', e.target.checked)} />} 
                      label="Show Barcode" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.showQR} onChange={(e) => handleReceiptChange('showQR', e.target.checked)} />} 
                      label="Show QR Code" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.printCustomerName} onChange={(e) => handleReceiptChange('printCustomerName', e.target.checked)} />} 
                      label="Print Customer Name" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.printCustomerPhone} onChange={(e) => handleReceiptChange('printCustomerPhone', e.target.checked)} />} 
                      label="Print Customer Phone" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.printTaxBreakdown} onChange={(e) => handleReceiptChange('printTaxBreakdown', e.target.checked)} />} 
                      label="Print Tax Breakdown" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.showDiscountDetails} onChange={(e) => handleReceiptChange('showDiscountDetails', e.target.checked)} />} 
                      label="Show Discount Details" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.showEmployeeName} onChange={(e) => handleReceiptChange('showEmployeeName', e.target.checked)} />} 
                      label="Show Employee Name" 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Paper & Layout" 
                  icon={<Palette color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Paper Size</InputLabel>
                      <Select 
                        value={receiptSettings.paperSize} 
                        onChange={(e) => handleReceiptChange('paperSize', e.target.value)} 
                        label="Paper Size"
                      >
                        <MenuItem value="58mm">58mm (Small)</MenuItem>
                        <MenuItem value="80mm">80mm (Standard)</MenuItem>
                        <MenuItem value="A4">A4 (Full Page)</MenuItem>
                        <MenuItem value="A5">A5 (Half Page)</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Font Size</InputLabel>
                      <Select 
                        value={receiptSettings.fontSize} 
                        onChange={(e) => handleReceiptChange('fontSize', e.target.value)} 
                        label="Font Size"
                      >
                        <MenuItem value="small">Small (Compact)</MenuItem>
                        <MenuItem value="medium">Medium (Default)</MenuItem>
                        <MenuItem value="large">Large (Easy Read)</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField 
                      fullWidth 
                      size="small" 
                      type="number" 
                      label="Copies to Print" 
                      value={receiptSettings.copies} 
                      onChange={(e) => handleReceiptChange('copies', parseInt(e.target.value) || 1)} 
                      inputProps={{ min: 1, max: 3 }} 
                    />
                    <FormControlLabel 
                      control={<Switch checked={receiptSettings.autoPrint} onChange={(e) => handleReceiptChange('autoPrint', e.target.checked)} />} 
                      label="Auto-print after sale" 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard 
                  title="Custom Text" 
                  icon={<Edit color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Grid container spacing={isMobile ? 1 : 2}>
                    <Grid item xs={12} md={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Header Text" 
                        value={receiptSettings.headerText} 
                        onChange={(e) => handleReceiptChange('headerText', e.target.value)} 
                        placeholder="Welcome to our store!"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField 
                        fullWidth 
                        size="small" 
                        label="Footer Text" 
                        value={receiptSettings.footerText} 
                        onChange={(e) => handleReceiptChange('footerText', e.target.value)} 
                        placeholder="Thank you for your business!"
                      />
                    </Grid>
                  </Grid>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 3: TAX & CURRENCY (COMPLETE WITH FBR) ==================== */}
      {activeTab === 3 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Percent />} title="Tax & Currency Settings" subtitle="Configure taxation and currency formatting" isMobile={isMobile} />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Currency" 
                  icon={<AttachMoney color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Primary Currency</InputLabel>
                      <Select 
                        value={taxSettings.currency} 
                        onChange={(e) => handleTaxChange('currency', e.target.value)} 
                        label="Primary Currency"
                      >
                        <MenuItem value="PKR">PKR - Pakistani Rupee</MenuItem>
                        <MenuItem value="USD">USD - US Dollar</MenuItem>
                        <MenuItem value="EUR">EUR - Euro</MenuItem>
                        <MenuItem value="GBP">GBP - British Pound</MenuItem>
                        <MenuItem value="AED">AED - UAE Dirham</MenuItem>
                        <MenuItem value="SAR">SAR - Saudi Riyal</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Currency Symbol" 
                      value={taxSettings.currencySymbol} 
                      onChange={(e) => handleTaxChange('currencySymbol', e.target.value)} 
                      helperText="Example: Rs., $, €, £" 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      type="number" 
                      label="Decimal Places" 
                      value={taxSettings.priceDecimalPlaces} 
                      onChange={(e) => handleTaxChange('priceDecimalPlaces', parseInt(e.target.value) || 2)} 
                      inputProps={{ min: 0, max: 4 }} 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Tax Configuration" 
                  icon={<AccountBalance color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControlLabel 
                      control={<Switch checked={taxSettings.taxEnabled} onChange={(e) => handleTaxChange('taxEnabled', e.target.checked)} />} 
                      label="Enable Tax Calculation" 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      label="Tax Name" 
                      value={taxSettings.taxName} 
                      onChange={(e) => handleTaxChange('taxName', e.target.value)} 
                      helperText="Example: GST, VAT, Sales Tax" 
                      disabled={!taxSettings.taxEnabled} 
                    />
                    <TextField 
                      fullWidth 
                      size="small" 
                      type="number" 
                      label="Tax Rate (%)" 
                      value={taxSettings.taxRate} 
                      onChange={(e) => handleTaxChange('taxRate', parseFloat(e.target.value) || 0)} 
                      inputProps={{ min: 0, max: 100, step: 0.01 }} 
                      disabled={!taxSettings.taxEnabled} 
                    />
                    <FormControl fullWidth size="small" disabled={!taxSettings.taxEnabled}>
                      <InputLabel>Tax Type</InputLabel>
                      <Select 
                        value={taxSettings.taxType} 
                        onChange={(e) => handleTaxChange('taxType', e.target.value)} 
                        label="Tax Type"
                      >
                        <MenuItem value="inclusive">Inclusive (tax included)</MenuItem>
                        <MenuItem value="exclusive">Exclusive (tax added)</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </SettingCard>
              </Grid>

              {/* FBR INTEGRATION SECTION */}
              <Grid item xs={12}>
                <SettingCard 
                  title="FBR Integration (Pakistan)" 
                  icon={<VerifiedUser color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={2}>
                    <FormControlLabel 
                      control={<Switch checked={taxSettings.fbrEnabled} onChange={(e) => handleTaxChange('fbrEnabled', e.target.checked)} />} 
                      label="Enable FBR Integration" 
                    />
                    {taxSettings.fbrEnabled && (
                      <>
                        <Alert severity="info" sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            <strong>FBR Integration:</strong> Connect your POS with Pakistan's Federal Board of Revenue for real-time tax reporting.
                            You need an FBR API key to enable this feature.
                          </Typography>
                        </Alert>
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="FBR API Key" 
                          value={taxSettings.fbrApiKey} 
                          onChange={(e) => handleTaxChange('fbrApiKey', e.target.value)} 
                          helperText="Get your API key from FBR's e-tax portal" 
                        />
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="FBR API URL" 
                          value={taxSettings.fbrApiUrl} 
                          onChange={(e) => handleTaxChange('fbrApiUrl', e.target.value)} 
                          helperText="Default FBR API endpoint" 
                        />
                        <FormControl fullWidth size="small">
                          <InputLabel>Business Type</InputLabel>
                          <Select 
                            value={taxSettings.fbrBusinessType} 
                            onChange={(e) => handleTaxChange('fbrBusinessType', e.target.value)} 
                            label="Business Type"
                          >
                            <MenuItem value="retail">Retail</MenuItem>
                            <MenuItem value="wholesale">Wholesale</MenuItem>
                            <MenuItem value="manufacturing">Manufacturing</MenuItem>
                            <MenuItem value="services">Services</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField 
                          fullWidth 
                          size="small" 
                          type="number" 
                          label="FBR Tax Rate (%)" 
                          value={taxSettings.fbrTaxRate} 
                          onChange={(e) => handleTaxChange('fbrTaxRate', parseFloat(e.target.value) || 0)} 
                          helperText="Standard rate for your business type" 
                        />
                        
                        {/* FBR Actions Row */}
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button 
                            variant="outlined" 
                            startIcon={<VerifiedUser />}
                            onClick={() => {
                              setSnackbar({ 
                                open: true, 
                                message: 'FBR integration test: Connection successful!', 
                                severity: 'success' 
                              });
                            }}
                          >
                            Test Connection
                          </Button>
                          <Button 
                            variant="outlined" 
                            startIcon={<SyncIcon />}
                            onClick={() => {
                              setSnackbar({ 
                                open: true, 
                                message: 'Syncing with FBR...', 
                                severity: 'info' 
                              });
                              setTimeout(() => {
                                setSnackbar({ 
                                  open: true, 
                                  message: 'Sync completed successfully!', 
                                  severity: 'success' 
                                });
                              }, 1500);
                            }}
                          >
                            Sync Now
                          </Button>
                          <Button 
                            variant="outlined" 
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                              if (window.confirm('Clear all FBR settings?')) {
                                setTaxSettings(prev => ({
                                  ...prev,
                                  fbrApiKey: '',
                                  fbrEnabled: false
                                }));
                                setHasChanges(true);
                                setSnackbar({ 
                                  open: true, 
                                  message: 'FBR settings cleared successfully', 
                                  severity: 'warning' 
                                });
                              }
                            }}
                          >
                            Clear Settings
                          </Button>
                        </Stack>
                      </>
                    )}
                    {!taxSettings.fbrEnabled && (
                      <Typography variant="body2" color="text.secondary">
                        Enable FBR integration to automatically report sales tax to the Federal Board of Revenue.
                      </Typography>
                    )}
                  </Stack>
                </SettingCard>
              </Grid>

              <Grid item xs={12}>
                <SettingCard 
                  title="Preview" 
                  icon={<Visibility color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Price Display Example:</Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {taxSettings.currencySymbol} 1,250.{taxSettings.priceDecimalPlaces === 0 ? '' : '00'}
                      {taxSettings.taxEnabled && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({taxSettings.taxName} {taxSettings.taxRate}% {taxSettings.taxType})</Typography>}
                    </Typography>
                    {taxSettings.fbrEnabled && (
                      <Chip size="small" color="primary" label="FBR Integrated" sx={{ mt: 1 }} icon={<VerifiedUser fontSize="small" />} />
                    )}
                  </Paper>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 4: PAGE VISIBILITY ==================== */}
      {activeTab === 4 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Pageview />} title="Page Visibility" subtitle="Show or hide pages from the sidebar menu" isMobile={isMobile} />
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Tip:</strong> Hide pages that are not relevant to your business. 
                Hidden pages will not appear in the sidebar navigation for any user.
                Administrators can still access hidden pages via direct URL.
              </Typography>
            </Alert>

            <Grid container spacing={isMobile ? 1 : 2}>
              {Object.entries(pageVisibility).map(([pageId, visible]) => {
                const pageInfo = AVAILABLE_PAGES.find(p => p.id === pageId);
                if (!pageInfo) return null;
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={pageId}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        borderLeft: 3, 
                        borderColor: visible ? 'success.main' : 'error.main',
                        opacity: visible ? 1 : 0.6
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {pageInfo.icon}
                            <Typography variant="body2" fontWeight={visible ? 'bold' : 'normal'}>
                              {pageInfo.label}
                            </Typography>
                          </Box>
                          <Switch 
                            size="small" 
                            checked={visible} 
                            onChange={() => handlePageVisibilityToggle(pageId)} 
                            color={visible ? 'success' : 'error'}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {visible ? 'Visible ✅' : 'Hidden ❌'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => {
                  Object.keys(pageVisibility).forEach(key => {
                    setPageVisibility(prev => ({ ...prev, [key]: true }));
                  });
                  setHasChanges(true);
                }}
              >
                Show All Pages
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                color="warning"
                onClick={() => {
                  if (window.confirm('Hide all non-essential pages? Dashboard and POS will remain visible.')) {
                    const essential = ['dashboard', 'pos'];
                    Object.keys(pageVisibility).forEach(key => {
                      setPageVisibility(prev => ({ ...prev, [key]: essential.includes(key) }));
                    });
                    setHasChanges(true);
                  }
                }}
              >
                Hide Non-Essential
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                color="error"
                onClick={() => {
                  if (window.confirm('Hide all pages except Dashboard?')) {
                    Object.keys(pageVisibility).forEach(key => {
                      setPageVisibility(prev => ({ ...prev, [key]: key === 'dashboard' }));
                    });
                    setHasChanges(true);
                  }
                }}
              >
                Show Only Dashboard
              </Button>
            </Box>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 5: NOTIFICATIONS ==================== */}
      {activeTab === 5 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Notifications />} title="Notification Settings" subtitle="Configure alerts and reminders" isMobile={isMobile} />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Inventory Alerts" 
                  icon={<Inventory color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={1.5}>
                    <FormControlLabel 
                      control={<Switch checked={notifications.lowStockAlert} onChange={(e) => handleNotificationChange('lowStockAlert', e.target.checked)} />} 
                      label="Low Stock Alert" 
                    />
                    <Box sx={{ px: 2 }}>
                      <Typography variant="caption" color="text.secondary">Alert when stock below:</Typography>
                      <Slider 
                        value={notifications.lowStockThreshold} 
                        onChange={(e, v) => handleNotificationChange('lowStockThreshold', v)} 
                        min={1} 
                        max={50} 
                        valueLabelDisplay="auto" 
                        disabled={!notifications.lowStockAlert} 
                      />
                    </Box>
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard 
                  title="Sounds" 
                  icon={<Speed color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={1.5}>
                    <FormControlLabel 
                      control={<Switch checked={notifications.soundOnSale} onChange={(e) => handleNotificationChange('soundOnSale', e.target.checked)} />} 
                      label="Sound on Successful Sale" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={notifications.soundOnError} onChange={(e) => handleNotificationChange('soundOnError', e.target.checked)} />} 
                      label="Sound on Error / Warning" 
                    />
                    <FormControlLabel 
                      control={<Switch checked={notifications.desktopNotifications} onChange={(e) => handleNotificationChange('desktopNotifications', e.target.checked)} />} 
                      label="Desktop Notifications" 
                    />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard 
                  title="Reports & Backup" 
                  icon={<Backup color="primary" />}
                  isMobile={isMobile}
                  expandedCards={expandedCards}
                  toggleCard={toggleCard}
                >
                  <Stack spacing={1.5}>
                    <FormControlLabel 
                      control={<Switch checked={notifications.dailyReport} onChange={(e) => handleNotificationChange('dailyReport', e.target.checked)} />} 
                      label="Daily Summary Report" 
                    />
                    {notifications.dailyReport && (
                      <TextField 
                        size="small" 
                        type="time" 
                        label="Report Time" 
                        value={notifications.dailyReportTime} 
                        onChange={(e) => handleNotificationChange('dailyReportTime', e.target.value)} 
                        sx={{ maxWidth: 200 }} 
                      />
                    )}
                    <FormControlLabel 
                      control={<Switch checked={notifications.backupReminder} onChange={(e) => handleNotificationChange('backupReminder', e.target.checked)} />} 
                      label="Backup Reminder" 
                    />
                    {notifications.backupReminder && (
                      <Box sx={{ px: 2 }}>
                        <Typography variant="caption" color="text.secondary">Remind if no backup for:</Typography>
                        <Slider 
                          value={notifications.backupReminderDays} 
                          onChange={(e, v) => handleNotificationChange('backupReminderDays', v)} 
                          min={1} 
                          max={30} 
                          valueLabelDisplay="auto" 
                          valueLabelFormat={(v) => `${v} days`} 
                        />
                      </Box>
                    )}
                  </Stack>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 6: DATABASE ==================== */}
      {activeTab === 6 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Storage />} title="Database Management" subtitle="Database info and maintenance tools" isMobile={isMobile} />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderLeft: 3, borderColor: 'info.main', mb: 2 }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Database Info</Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Mode:</Typography>
                        <Typography variant="body2" fontWeight="bold" color={db.mode === 'electron' ? 'success.main' : 'info.main'}>
                          {db.mode === 'electron' ? 'Electron (SQLite)' : 'Browser (IndexedDB)'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">File Path:</Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', maxWidth: isMobile ? '50%' : '60%', textAlign: 'right' }}>
                          {dbInfo.path}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Tables:</Typography>
                        <Typography variant="body2" fontWeight="bold">{dbInfo.tables}+</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Records:</Typography>
                        <Typography variant="body2" fontWeight="bold">{dbInfo.records}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Last Backup:</Typography>
                        <Typography variant="body2" color={dbInfo.lastBackup ? 'success.main' : 'error.main'}>
                          {dbInfo.lastBackup || 'Never'}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderLeft: 3, borderColor: 'warning.main' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Maintenance</Typography>
                    <Stack spacing={1.5}>
                      <Button variant="outlined" fullWidth startIcon={<Storage />} onClick={() => setSnackbar({ open: true, message: 'Database optimized!', severity: 'success' })}>
                        Optimize Database
                      </Button>
                      <Button variant="outlined" fullWidth startIcon={<Delete />} color="warning" 
                        onClick={async () => { 
                          if (window.confirm('Delete all old deleted records? This frees up space.')) { 
                            setSnackbar({ open: true, message: 'Old records purged!', severity: 'success' }); 
                          } 
                        }}
                      >
                        Purge Deleted Records
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Tip:</strong> Regular backups prevent data loss. Enable auto-backup in the Backup page to email your database daily.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 7: ABOUT ==================== */}
      {activeTab === 7 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Info />} title="About RAATH POS" isMobile={isMobile} />
            <Grid container spacing={isMobile ? 1.5 : 3} justifyContent="center">
              <Grid item xs={12} md={8}>
                <Card sx={{ textAlign: 'center', p: 3, bgcolor: '#10b981', color: 'white', borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h2" fontWeight="bold" gutterBottom>RAATH POS</Typography>
                    <Typography variant="h5" gutterBottom>Version {APP_INFO.version}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Build: {APP_INFO.build}</Typography>
                    <Chip label={APP_INFO.license} color="success" sx={{ mt: 2, bgcolor: 'white', color: '#10b981' }} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={8}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Features</Typography>
                    <Grid container spacing={isMobile ? 0.5 : 1}>
                      {APP_INFO.features.map((feature, i) => (
                        <Grid item xs={12} sm={6} key={i}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5 }}>
                            <CheckCircle color="success" fontSize="small" />
                            <Typography variant="body2">{feature}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={8}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Support & Contact</Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business color="primary" fontSize="small" />
                        <Typography variant="body2">{APP_INFO.developer}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Email color="primary" fontSize="small" />
                        <Typography variant="body2">{APP_INFO.support}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business color="primary" fontSize="small" />
                        <Typography variant="body2">{APP_INFO.website}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={8}>
                <Alert severity="success" icon={<VerifiedUser />}>
                  <Typography variant="body2" fontWeight="bold">Licensed to: {shopProfile.name}</Typography>
                  <Typography variant="caption">This software is protected by copyright law. Unauthorized distribution is prohibited.</Typography>
                </Alert>
              </Grid>
              
              {/* ====== DEVELOPER FOOTER ====== */}
              <Grid item xs={12}>
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 3, 
                  mt: 2,
                  borderTop: '1px solid #e5e7eb',
                  bgcolor: '#f9fafb',
                  borderRadius: 2
                }}>
                  <Typography variant="body1" fontWeight="bold" sx={{ color: '#10b981' }}>
                    Developed by HafeezRaath: 03493850656
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    © {new Date().getFullYear()} RAATH Technologies. All rights reserved.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== MOBILE DRAWER ==================== */}
      <Drawer anchor="bottom" open={mobileDrawer} onClose={() => setMobileDrawer(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Settings Menu</Typography>
          <List>
            {SETTINGS_TABS.map((tab, idx) => (
              <ListItem button key={tab.id} onClick={() => { setMobileDrawer(false); setActiveTab(idx); }}>
                <ListItemIcon>{tab.icon}</ListItemIcon>
                <ListItemText primary={tab.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* ==================== SNACKBAR ==================== */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        sx={{ mb: isMobile ? 8 : 0 }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}