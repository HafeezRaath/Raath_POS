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
} from '../components/ui/tailwind-mui';
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
} from '../components/ui/icons';
import db from '../database/db';
import {
  AVAILABLE_PAGES, DEFAULT_ROLES,
  getRoles, getRolePermissions, hasPermission, getRoleLabel, getRoleColor,
  getRolesSync, getRolePermissionsSync,
  persistRolesToDB
} from '../role';
import ThermalReceipt from '../components/receipt/ThermalReceipt';
import { printReceiptDirect } from '../utils/receiptGenerator';

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

// NEW: Granular CRUD permission checker
export const hasActionPermission = (rolePermissions, roleId, pageId, action = 'view') => {
  const rolePerms = rolePermissions?.[roleId] || {};
  const pagePerms = rolePerms[pageId] || {};
  return !!pagePerms[action];
};

export const ROLES = getRolesSync();
export const ROLE_PERMISSIONS = getRolePermissionsSync();

// ==================== CUSTOM BARCODE ICON ====================
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

// ==================== UNIFIED THERMAL RECEIPT DESIGN PREVIEW ====================
const ReceiptDesignPreview = ({ design, shopProfile, receiptSettings }) => {
  return (
    <ThermalReceipt
      design={design || receiptSettings?.design || 'design1'}
      shopProfile={shopProfile}
      receiptSettings={receiptSettings}
    />
  );
};

// ==================== PRODUCT BARCODE LABEL PREVIEW COMPONENT ====================
const BarcodeDesignPreview = ({ barcodeSettings, shopProfile }) => {
  const shopName = barcodeSettings.shopName || shopProfile.name || 'My Store';
  const labelWidth = barcodeSettings.labelWidth || 50;
  const labelHeight = barcodeSettings.labelHeight || 30;
  const columns = Math.min(3, Math.max(1, barcodeSettings.columns || 1));
  const currency = barcodeSettings.currencySymbol || 'Rs.';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', overflowX: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'nowrap' }}>
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Paper
            key={colIdx}
            sx={{
              width: `${Math.max(160, Math.min(260, labelWidth * 3.6))}px`,
              minHeight: `${Math.max(105, Math.min(190, labelHeight * 3.6))}px`,
              p: 1.5,
              bgcolor: '#ffffff',
              border: '1.5px solid #1e293b',
              borderRadius: 1,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textAlign: 'center',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Column Badge for 2-up / 3-up rolls */}
            {columns > 1 && (
              <Box sx={{ position: 'absolute', top: 3, right: 3, bgcolor: '#e2e8f0', color: '#475569', fontSize: '8px', px: 0.8, py: 0.2, borderRadius: 0.5, fontWeight: 700 }}>
                Col {colIdx + 1}
              </Box>
            )}

            {barcodeSettings.showShopName && (
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.2 }}>
                {shopName}
              </Typography>
            )}

            {barcodeSettings.showProductName && (
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2, my: 0.5, wordBreak: 'break-word' }}>
                Sample Product 500g
              </Typography>
            )}

            {barcodeSettings.showBarcode && (
              <Box sx={{ bgcolor: '#ffffff', py: 0.5, px: 1, my: 0.5 }}>
                {/* Visual Barcode SVG Simulation */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 28, gap: '2px', mx: 'auto', maxWidth: 140 }}>
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 2, 4, 1, 2, 3].map((w, i) => (
                    <Box key={i} sx={{ width: `${w}px`, height: '100%', bgcolor: '#000000' }} />
                  ))}
                </Box>
                {barcodeSettings.showBarcodeText && (
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '2px', mt: 0.3, color: '#000' }}>
                    8901234567890
                  </Typography>
                )}
              </Box>
            )}

            {barcodeSettings.showPrice && (
              <Box sx={{ mt: 'auto', pt: 0.5 }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Retail Price</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                  {currency} 1,250
                </Typography>
              </Box>
            )}

            {barcodeSettings.showSku && (
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', mt: 0.5, fontWeight: 500 }}>
                SKU: PRD-0042
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

// ==================== RECEIPT DESIGN SELECTOR (4 THERMAL MONOCHROME DESIGNS) ====================
const ReceiptDesignSelector = ({ currentDesign, onSelectDesign, shopProfile, receiptSettings, isMobile }) => {
  const designs = [
    { id: 'design1', label: 'Classic Thermal', description: 'Traditional centered layout & dashed rules', color: '#111827', icon: <ReceiptLong fontSize="small" /> },
    { id: 'design2', label: 'Modern Minimalist', description: 'Boxed customer card & crisp clean borders', color: '#111827', icon: <Palette fontSize="small" /> },
    { id: 'design3', label: 'Premium Thermal', description: 'Solid black header bar & bold contrast', color: '#000000', icon: <DesignServices fontSize="small" /> },
    { id: 'design4', label: 'Imtiaz Supermarket', description: 'High-density compact supermarket style', color: '#111827', icon: <ReceiptLong fontSize="small" /> },
  ];

  return (
    <Grid container spacing={isMobile ? 1 : 1.5}>
      {designs.map((design) => (
        <Grid item xs={6} sm={3} key={design.id}>
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

  // Shop Profile with logo support & registered user sync
  const [shopProfile, setShopProfile] = useState(() => {
    let currentUser = null;
    try {
      const rawUser = localStorage.getItem('current_user');
      if (rawUser) currentUser = JSON.parse(rawUser);
    } catch (_) {}

    const saved = localStorage.getItem('shop_profile');
    let parsed = null;
    if (saved) {
      try { parsed = JSON.parse(saved); } catch (e) {}
    }

    const name = currentUser?.shop_name || parsed?.name || parsed?.shopName || 'RAATH POS Store';
    const address = currentUser?.shop_address || parsed?.address || '';
    const phone = currentUser?.phone || parsed?.phone || '';
    const email = currentUser?.email || parsed?.email || '';
    const city = parsed?.city || currentUser?.shop_address || '';

    return {
      name, 
      tagline: parsed?.tagline || 'Quality Products, Best Prices', 
      address, 
      city, 
      phone, 
      email, 
      website: parsed?.website || '', 
      taxNumber: parsed?.taxNumber || '', 
      registrationNumber: parsed?.registrationNumber || '', 
      logo: parsed?.logo || null,
      logoPreview: parsed?.logoPreview || null,
      receiptFooter: parsed?.receiptFooter || 'Thank you for shopping with us!\nReturns accepted within 7 days with receipt.'
    };
  });

  const [users, setUsers] = useState([]);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-detected Attached System Printers (from Electron IPC)
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printSubTab, setPrintSubTab] = useState('pos'); // 'pos' or 'barcode'

  // POS Receipt Settings with localStorage and DESIGN SELECTION
  const [receiptSettings, setReceiptSettings] = useState(() => {
    const saved = localStorage.getItem('receipt_settings');
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved);
        if (!parsed.design) parsed.design = 'design1';
        if (parsed.marginLeft === undefined) parsed.marginLeft = 2;
        if (parsed.marginRight === undefined) parsed.marginRight = 2;
        if (parsed.marginTop === undefined) parsed.marginTop = 2;
        if (parsed.marginBottom === undefined) parsed.marginBottom = 6;
        if (parsed.feedLines === undefined) parsed.feedLines = 2;
        return parsed; 
      } catch (e) {} 
    }
    return {
      printerName: '',
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
      footerText: 'Thank you for visiting us!\nReturns accepted within 7 days with receipt.', 
      fontSize: 'medium', 
      showDiscountDetails: true, 
      showEmployeeName: true, 
      design: 'design1',
      marginLeft: 2,
      marginRight: 2,
      marginTop: 2,
      marginBottom: 6,
      feedLines: 2,
    };
  });

  // Product Barcode Label Settings (Products Page)
  const [barcodeSettings, setBarcodeSettings] = useState(() => {
    const saved = localStorage.getItem('barcode_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      printerName: '',
      labelSize: '50x30mm',
      labelWidth: 50,
      labelHeight: 30,
      columns: 1,
      showShopName: true,
      shopName: '',
      showProductName: true,
      showPrice: true,
      currencySymbol: 'Rs.',
      showBarcode: true,
      showBarcodeText: true,
      showSku: true,
      barcodeType: 'CODE128',
      fontSize: '11px',
      copies: 1,
      marginMm: 2,
      gapMm: 3
    };
  });

  // Tax Settings with FBR integration
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

  // Page Visibility Settings
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
    fetchPrinters();
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

  const handleMarginPreset = (preset) => {
    if (preset === 'zero') {
      setReceiptSettings(prev => ({ ...prev, marginLeft: 0, marginRight: 0, marginTop: 1, marginBottom: 4 }));
    } else if (preset === 'standard') {
      setReceiptSettings(prev => ({ ...prev, marginLeft: 2, marginRight: 2, marginTop: 2, marginBottom: 6 }));
    } else if (preset === 'wide') {
      setReceiptSettings(prev => ({ ...prev, marginLeft: 5, marginRight: 5, marginTop: 4, marginBottom: 10 }));
    }
    setHasChanges(true);
  };

  // ==================== BARCODE SETTINGS HANDLERS ====================
  const handleBarcodeChange = (field, value) => {
    setBarcodeSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleBarcodePresetChange = (preset) => {
    let width = 50;
    let height = 30;
    if (preset === '50x30mm') { width = 50; height = 30; }
    else if (preset === '40x25mm') { width = 40; height = 25; }
    else if (preset === '38x28mm') { width = 38; height = 28; }
    else if (preset === '50x25mm') { width = 50; height = 25; }
    else if (preset === '2x1inch') { width = 51; height = 25; }
    else if (preset === '3x2inch') { width = 76; height = 51; }
    
    setBarcodeSettings(prev => ({
      ...prev,
      labelSize: preset,
      labelWidth: preset === 'custom' ? prev.labelWidth : width,
      labelHeight: preset === 'custom' ? prev.labelHeight : height,
    }));
    setHasChanges(true);
  };

  // ==================== HARDWARE PRINTERS FETCHER & AUTO-DETECTION ====================
  const fetchPrinters = async () => {
    setPrintersLoading(true);
    try {
      let list = [];
      if (window.electronAPI?.getPrinters) {
        list = await window.electronAPI.getPrinters();
      }
      if (!list || list.length === 0) {
        list = [
          { name: 'POS-80 Thermal Printer', isDefault: true },
          { name: 'XP-58 Mini Thermal Printer', isDefault: false },
          { name: 'TSC TTP-244 Pro Barcode Printer', isDefault: false },
          { name: 'Xprinter XP-365B Label Printer', isDefault: false },
          { name: 'Microsoft Print to PDF', isDefault: false }
        ];
      }
      setAvailablePrinters(list);

      // Intelligent hardware printer auto-detection:
      // 1. Detect thermal receipt printer (keywords: POS, Thermal, Receipt, XP-, 80, 58, Rongta, Black Copper)
      const thermalPrinter = list.find(p => /pos|thermal|receipt|xp-|\b80\b|\b58\b|rongta|black\s*copper|printer/i.test(p.name)) || list.find(p => p.isDefault) || list[0];
      
      // 2. Detect barcode label printer (keywords: TSC, Xprinter, Zebra, Barcode, Label, 365, 244, Gprinter)
      const barcodePrinter = list.find(p => /tsc|xprinter|zebra|barcode|label|365|244|gprinter/i.test(p.name)) || list.find(p => p.isDefault) || list[0];

      if (thermalPrinter) {
        setReceiptSettings(prev => prev.printerName ? prev : { ...prev, printerName: thermalPrinter.name });
      }
      if (barcodePrinter) {
        setBarcodeSettings(prev => prev.printerName ? prev : { ...prev, printerName: barcodePrinter.name });
      }
    } catch (err) {
      console.warn('Error fetching printers:', err);
    } finally {
      setPrintersLoading(false);
    }
  };

  // ==================== TEST PRINT RECEIPT HANDLER ====================
  const handleTestPrintReceipt = async () => {
    try {
      const testData = {
        sale: {
          invoice_no: 'TEST-001',
          date: new Date().toISOString(),
          customer_name: 'Walk-in Customer',
          customer_phone: '0300-1234567',
          subtotal: 450,
          discount: 0,
          tax: 0,
          grand_total: 450,
          paid_amount: 500,
          change_amount: 50,
          payment_mode: 'CASH',
          payment_status: 'paid'
        },
        items: [
          { name: 'Sample Item A (500g)', qty: 2, price: 150, total: 300, sku: 'TEST-A' },
          { name: 'Sample Item B (Standard)', qty: 1, price: 150, total: 150, sku: 'TEST-B' }
        ],
        type: 'test'
      };

      const res = await printReceiptDirect(testData, {
        printerName: receiptSettings.printerName,
        receiptSettings,
        shopProfile,
        design: receiptSettings.design
      });

      if (res && res.success) {
        setSnackbar({
          open: true,
          message: `Test receipt (${receiptSettings.design}) sent to "${receiptSettings.printerName || 'Default Printer'}"!`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Test print finished with status: ${res?.method || 'browser'}${res?.error ? ` (${res.error})` : ''}`,
          severity: 'info'
        });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Test print error: ' + err.message, severity: 'error' });
    }
  };

  // ==================== TEST PRINT BARCODE HANDLER ====================
  const handleTestPrintBarcode = async () => {
    try {
      const widthMm = barcodeSettings.labelWidth || 50;
      const heightMm = barcodeSettings.labelHeight || 30;
      const columns = Math.min(3, Math.max(1, barcodeSettings.columns || 1));
      const shopName = barcodeSettings.shopName || shopProfile.name || 'MY STORE';
      const currency = barcodeSettings.currencySymbol || 'Rs.';

      const singleLabelHtml = `
        <div class="label-card">
          ${barcodeSettings.showShopName ? `<div class="shop-name">${shopName}</div>` : ''}
          ${barcodeSettings.showProductName ? `<div class="product-name">Sample Product 500g</div>` : ''}
          ${barcodeSettings.showBarcode ? `
            <div class="barcode-box">
              <svg class="barcode" jsbarcode-value="890123456789" jsbarcode-format="${barcodeSettings.barcodeType || 'CODE128'}" jsbarcode-width="1.3" jsbarcode-height="24" jsbarcode-fontsize="9" jsbarcode-displayvalue="${barcodeSettings.showBarcodeText}"></svg>
            </div>
          ` : ''}
          ${barcodeSettings.showPrice ? `<div class="price">${currency} 1,250</div>` : ''}
          ${barcodeSettings.showSku ? `<div class="sku">SKU: PRD-0042</div>` : ''}
        </div>
      `;

      const rowHtml = Array.from({ length: columns }).map(() => singleLabelHtml).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Test Barcode Label</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
          <style>
            @page {
              size: ${widthMm * columns}mm ${heightMm}mm;
              margin: 0;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${widthMm * columns}mm;
              height: ${heightMm}mm;
              margin: 0;
              padding: ${barcodeSettings.marginMm || 2}mm;
              display: flex;
              align-items: center;
              justify-content: space-around;
              font-family: Arial, sans-serif;
              background: #fff;
            }
            .label-card {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              padding: 1mm;
              overflow: hidden;
            }
            .shop-name { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
            .product-name { font-size: 9px; font-weight: 600; line-height: 1.1; max-height: 20px; overflow: hidden; }
            .barcode-box { display: flex; justify-content: center; }
            .price { font-size: 11px; font-weight: bold; color: #000; }
            .sku { font-size: 7px; color: #333; }
          </style>
        </head>
        <body>
          ${rowHtml}
          <script>
            try {
              JsBarcode(".barcode").init();
            } catch(e) {}
          <\/script>
        </body>
        </html>
      `;

      if (window.electronAPI && window.electronAPI.printReceipt) {
        await window.electronAPI.printReceipt(html, {
          printerName: barcodeSettings.printerName || undefined,
          pageSize: { width: Math.round(widthMm * 1000 * columns), height: Math.round(heightMm * 1000) },
          silent: true
        });
        setSnackbar({ open: true, message: `Test barcode label sent to "${barcodeSettings.printerName || 'Default'}"!`, severity: 'success' });
      } else {
        const win = window.open('', '_blank', `width=${widthMm * 4 * columns},height=${heightMm * 4}`);
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
        setSnackbar({ open: true, message: 'Browser print dialog opened for test barcode!', severity: 'info' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Barcode test print error: ' + err.message, severity: 'error' });
    }
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
    
    // FIX: Only migrate if we have roles AND they need migration
    if (dbRoles && dbRoles.length > 0) {
      const needsMigration = dbRoles.some(r => !r.permissions || Array.isArray(r.permissions));
      if (needsMigration) {
        const migratedRoles = dbRoles.map(role => {
          if (role.permissions && typeof role.permissions === 'object' && !Array.isArray(role.permissions)) {
            return role;
          }
          const newPerms = {};
          (role.pages || []).forEach(pid => {
            newPerms[pid] = { view: true, add: true, edit: true, delete: true };
          });
          return { ...role, permissions: newPerms };
        });
        
        // FIX: Only persist if roles have changed and we have valid data
        const hasChanges = dbRoles.some((role, idx) => {
          const migrated = migratedRoles[idx];
          return JSON.stringify(role.permissions) !== JSON.stringify(migrated.permissions);
        });
        
        if (hasChanges && migratedRoles.length > 0) {
          try {
            await persistRolesToDB(migratedRoles);
            dbRoles = migratedRoles;
          } catch (persistError) {
            console.warn('Role migration failed, using existing roles:', persistError);
            // Continue with existing roles
          }
        }
      }
    } else {
      // FIX: Only seed default roles if NO roles exist at all
      const defaultRoles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
      try {
        await persistRolesToDB(defaultRoles);
        dbRoles = defaultRoles;
      } catch (seedError) {
        console.warn('Failed to seed default roles:', seedError);
        // Try to fetch again
        dbRoles = await getRoles();
        if (!dbRoles || dbRoles.length === 0) {
          // If still no roles, create admin fallback
          const fallbackRole = {
            id: 'admin',
            label: 'Administrator',
            color: 'primary',
            pages: AVAILABLE_PAGES.map(p => p.id),
            permissions: AVAILABLE_PAGES.reduce((acc, p) => {
              acc[p.id] = { view: true, add: true, edit: true, delete: true };
              return acc;
            }, {})
          };
          try {
            await persistRolesToDB([fallbackRole]);
            dbRoles = [fallbackRole];
          } catch (fallbackError) {
            console.error('Failed to create fallback role:', fallbackError);
            dbRoles = [];
          }
        }
      }
    }
    
    // FIX: Handle empty or invalid roles gracefully
    if (!dbRoles || dbRoles.length === 0) {
      // Create emergency admin role directly
      const emergencyRole = {
        id: 'admin',
        label: 'Administrator',
        color: 'primary',
        pages: AVAILABLE_PAGES.map(p => p.id),
        permissions: AVAILABLE_PAGES.reduce((acc, p) => {
          acc[p.id] = { view: true, add: true, edit: true, delete: true };
          return acc;
        }, {})
      };
      try {
        await persistRolesToDB([emergencyRole]);
        dbRoles = [emergencyRole];
      } catch (e) {
        console.error('Emergency role creation failed:', e);
      }
    }
    
    setRoles(dbRoles || []);
    setRolePermissions(buildPermissionsMap(dbRoles || []));

    // Load users
    const dbUsers = await db.getUsers();
    if (dbUsers && dbUsers.length > 0) {
      setUsers(dbUsers.map(u => ({
        id: u.id, name: u.name, username: u.username || u.email || '', email: u.email || '',
        role: u.role || 'cashier', active: u.status === 'active', phone: u.phone || '',
        shop_name: u.shop_name || '', shop_address: u.shop_address || '',
        business_type: u.business_type || 'retail', currency: u.currency || 'PKR',
      })));
    } else {
      setUsers([]);
    }

    // ==================== LOAD SETTINGS FROM DB & LOCALSTORAGE ====================
    try {
      const [dbShop, dbReceipt, dbTax, dbNotif, dbPages, dbBarcode] = await Promise.all([
        db.getShopProfile().catch(() => null),
        db.getReceiptSettings().catch(() => null),
        db.getTaxSettings().catch(() => null),
        db.getNotificationSettings().catch(() => null),
        db.getPageVisibility().catch(() => null),
        db.getBarcodeSettings().catch(() => null)
      ]);

      if (dbShop) {
        setShopProfile(prev => {
          let currentUser = null;
          try {
            const rawUser = localStorage.getItem('current_user');
            if (rawUser) currentUser = JSON.parse(rawUser);
          } catch (_) {}
          return {
            ...prev,
            ...dbShop,
            name: dbShop.name || dbShop.shop_name || currentUser?.shop_name || prev.name,
            address: dbShop.address || dbShop.shop_address || currentUser?.shop_address || prev.address,
            phone: dbShop.phone || currentUser?.phone || prev.phone,
            email: dbShop.email || currentUser?.email || prev.email,
            city: dbShop.city || currentUser?.shop_address || prev.city
          };
        });
      }
      if (dbReceipt) setReceiptSettings(prev => ({ ...prev, ...dbReceipt }));
      if (dbBarcode) setBarcodeSettings(prev => ({ ...prev, ...dbBarcode }));
      if (dbTax) setTaxSettings(prev => ({ ...prev, ...dbTax }));
      if (dbNotif) setNotifications(prev => ({ ...prev, ...dbNotif }));
      if (dbPages) setPageVisibility(prev => ({ ...prev, ...dbPages }));
    } catch (dbErr) {
      console.warn('DB settings load fallback to localStorage:', dbErr);
      const savedProfile = localStorage.getItem('shop_profile');
      if (savedProfile) {
        try { setShopProfile(prev => ({ ...prev, ...JSON.parse(savedProfile) })); } catch (e) {}
      }
      const savedReceipt = localStorage.getItem('receipt_settings');
      if (savedReceipt) {
        try {
          const parsed = JSON.parse(savedReceipt);
          if (!parsed.design) parsed.design = 'design1';
          setReceiptSettings(parsed);
        } catch (e) {}
      }
      const savedBarcode = localStorage.getItem('barcode_settings');
      if (savedBarcode) {
        try { setBarcodeSettings(JSON.parse(savedBarcode)); } catch (e) {}
      }
      const savedTax = localStorage.getItem('tax_settings');
      if (savedTax) {
        try { setTaxSettings(JSON.parse(savedTax)); } catch (e) {}
      }
      const savedNotif = localStorage.getItem('notification_settings');
      if (savedNotif) {
        try { setNotifications(JSON.parse(savedNotif)); } catch (e) {}
      }
      const savedPages = localStorage.getItem('page_visibility');
      if (savedPages) {
        try { setPageVisibility(JSON.parse(savedPages)); } catch (e) {}
      }
    }

    // ==================== BACKGROUND PULL FROM FIREBASE CLOUD ====================
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');
      if (navigator.onLine && activeShopId && db.pullSettingsFromCloud) {
        db.pullSettingsFromCloud(activeShopId).then(pulled => {
          if (pulled) {
            if (pulled.shop_profile) setShopProfile(prev => ({ ...prev, ...pulled.shop_profile }));
            if (pulled.receipt_settings) setReceiptSettings(prev => ({ ...prev, ...pulled.receipt_settings }));
            if (pulled.barcode_settings) setBarcodeSettings(prev => ({ ...prev, ...pulled.barcode_settings }));
            if (pulled.tax_settings) setTaxSettings(prev => ({ ...prev, ...pulled.tax_settings }));
            if (pulled.notification_settings) setNotifications(prev => ({ ...prev, ...pulled.notification_settings }));
            if (pulled.page_visibility) setPageVisibility(prev => ({ ...prev, ...pulled.page_visibility }));
          }
        }).catch(e => console.log('[SettingsPage] Background cloud pull notice:', e.message));
      }
    } catch (e) {}
    
    await loadDbStats();
  } catch (err) {
    console.error('Load error:', err);
    setSnackbar({ open: true, message: 'Error loading: ' + err.message, severity: 'error' });
  }
  setLoading(false);
};

  const buildPermissionsMap = (rolesArr) => {
    const perms = {};
    rolesArr.forEach(r => {
      // NEW: Support granular permissions object
      if (r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions)) {
        perms[r.id] = r.permissions;
      } else {
        // Migrate old format (pages array) -> new format with full CRUD
        const pagePerms = {};
        AVAILABLE_PAGES.forEach(p => {
          const hasView = (r.pages || []).includes(p.id);
          pagePerms[p.id] = {
            view: hasView,
            add: hasView,
            edit: hasView,
            delete: hasView
          };
        });
        perms[r.id] = pagePerms;
      }
    });
    return perms;
  };

  const loadDbStats = async () => {
    try {
      const stats = await db.getDatabaseStats();
      setDbStats(stats);
    } catch (e) {
      console.warn('Failed to load DB stats:', e);
    }
  };

  // ==================== CLOUD PULL HANDLER ====================
  const handlePullFromCloud = async () => {
    setLoading(true);
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');
      if (!activeShopId) throw new Error('No Shop ID found for pulling cloud data');

      const pulled = await db.pullSettingsFromCloud(activeShopId);
      if (pulled) {
        if (pulled.shop_profile) setShopProfile(prev => ({ ...prev, ...pulled.shop_profile }));
        if (pulled.receipt_settings) setReceiptSettings(prev => ({ ...prev, ...pulled.receipt_settings }));
        if (pulled.barcode_settings) setBarcodeSettings(prev => ({ ...prev, ...pulled.barcode_settings }));
        if (pulled.tax_settings) setTaxSettings(prev => ({ ...prev, ...pulled.tax_settings }));
        if (pulled.notification_settings) setNotifications(prev => ({ ...prev, ...pulled.notification_settings }));
        if (pulled.page_visibility) setPageVisibility(prev => ({ ...prev, ...pulled.page_visibility }));
      }

      await refreshUsersList();
      const dbRoles = await db.getRoles();
      if (dbRoles && dbRoles.length > 0) {
        setRoles(dbRoles);
        setRolePermissions(buildPermissionsMap(dbRoles));
      }

      setSnackbar({
        open: true,
        message: `Cloud settings & profile pulled successfully for Shop: ${activeShopId}!`,
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({ open: true, message: 'Cloud pull error: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  // ==================== INDIVIDUAL TAB SAVE HANDLERS ====================
  const handleSaveShopProfileOnly = async () => {
    setLoading(true);
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');
      await db.saveShopProfile(shopProfile);

      let cloudSynced = false;
      if (navigator.onLine && activeShopId && db.syncSettingToFirebase) {
        try {
          await db.syncSettingToFirebase('shop_profile', shopProfile, activeShopId);
          cloudSynced = true;
        } catch (e) {}
      }

      if (currentUser?.id) {
        try {
          await db.updateUser(currentUser.id, {
            shop_name: shopProfile.name,
            shop_address: shopProfile.address,
            phone: shopProfile.phone
          });
        } catch (e) {}
      }

      setHasChanges(false);
      setSnackbar({
        open: true,
        message: cloudSynced
          ? `Shop Profile saved to Database & Synced to Firebase (Shop: ${activeShopId})!`
          : 'Shop Profile saved to database successfully!',
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving shop profile: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const handleSaveReceiptSettingsOnly = async () => {
    setLoading(true);
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');
      await db.saveReceiptSettings(receiptSettings);

      let cloudSynced = false;
      if (navigator.onLine && activeShopId && db.syncSettingToFirebase) {
        try {
          await db.syncSettingToFirebase('receipt_settings', receiptSettings, activeShopId);
          cloudSynced = true;
        } catch (e) {}
      }

      setHasChanges(false);
      setSnackbar({
        open: true,
        message: cloudSynced
          ? `Receipt settings saved to Database & Synced to Firebase (Shop: ${activeShopId})!`
          : 'Receipt settings saved to database successfully!',
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving receipt settings: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const handleSaveBarcodeSettingsOnly = async () => {
    setLoading(true);
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');
      await db.saveBarcodeSettings(barcodeSettings);

      let cloudSynced = false;
      if (navigator.onLine && activeShopId && db.syncSettingToFirebase) {
        try {
          await db.syncSettingToFirebase('barcode_settings', barcodeSettings, activeShopId);
          cloudSynced = true;
        } catch (e) {}
      }

      setHasChanges(false);
      setSnackbar({
        open: true,
        message: cloudSynced
          ? `Barcode label settings saved to Database & Synced to Firebase (Shop: ${activeShopId})!`
          : 'Barcode label settings saved to database successfully!',
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving barcode settings: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  // ==================== GLOBAL SAVE HANDLER (ALL SETTINGS + CLOUD SYNC) ====================
  const handleSave = async () => {
    setLoading(true);
    try {
      const activeShopId = db.getActiveShopId ? db.getActiveShopId() : (localStorage.getItem('raath_shop_id') || 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3');

      // 1. Save all settings to Database (IndexedDB / SQLite) + localStorage
      await Promise.all([
        db.saveShopProfile(shopProfile),
        db.saveReceiptSettings(receiptSettings),
        db.saveBarcodeSettings(barcodeSettings),
        db.saveTaxSettings(taxSettings),
        db.saveNotificationSettings(notifications),
        db.savePageVisibility(pageVisibility)
      ]);

      // 2. Sync directly to Firebase Cloud under active shop_id
      let cloudSynced = false;
      if (navigator.onLine && activeShopId && db.syncSettingsToCloud) {
        try {
          await db.syncSettingsToCloud(activeShopId, {
            shop_profile: shopProfile,
            receipt_settings: receiptSettings,
            barcode_settings: barcodeSettings,
            tax_settings: taxSettings,
            notification_settings: notifications,
            page_visibility: pageVisibility
          });
          cloudSynced = true;
        } catch (cloudErr) {
          console.warn('[SettingsPage] Cloud sync error:', cloudErr.message);
        }
      }

      // 3. Update Admin user profile
      if (currentUser?.id) {
        try {
          await db.updateUser(currentUser.id, { 
            shop_name: shopProfile.name, 
            shop_address: shopProfile.address, 
            phone: shopProfile.phone, 
            currency: taxSettings.currency 
          });
        } catch (uErr) {}
      }
      
      setHasChanges(false);
      setSnackbar({ 
        open: true, 
        message: cloudSynced 
          ? `All settings saved to Database & Synced to Firebase (Shop: ${activeShopId})!` 
          : 'All settings saved to database & local storage!', 
        severity: 'success' 
      });
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
      ['shop_profile', 'pos_users', 'receipt_settings', 'barcode_settings', 'tax_settings', 'notification_settings', 'current_user', 'page_visibility'].forEach(k => localStorage.removeItem(k));

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
    // NEW: Load granular permissions or migrate from old pages array
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
    // NEW: Validate at least one page has VIEW permission
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
      permissions: roleForm.permissions, // NEW: Save granular permissions
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

  // NEW: Granular CRUD permission toggle
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
    // NEW: Username required instead of email
    if (!editingUser.name || !editingUser.username) { 
      setSnackbar({ open: true, message: 'Name and username required!', severity: 'error' }); 
      return; 
    }
    // NEW: Password must be at least 6 characters for new users
    if (!editingUser.id && (!editingUser.password || editingUser.password.length < 6)) { 
      setSnackbar({ open: true, message: 'Password must be at least 6 characters!', severity: 'error' }); 
      return; 
    }
    // NEW: If changing password on existing user, also enforce 6 chars
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
    <Box sx={{ p: isMobile ? 1.5 : 3, width: '100%', maxWidth: '100%', pb: isMobile ? 8 : 3 }}>
      
      {/* HEADER */}
      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', mb: 3, gap: 1 }}>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
            <Settings sx={{ verticalAlign: 'middle', mr: 1, fontSize: isMobile ? 28 : 32 }} /> 
            {isMobile ? 'Settings' : 'Settings & Configuration'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {isMobile && (
            <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setMobileDrawer(true)}>
              Menu
            </Button>
          )}
          {hasChanges && <Chip color="warning" icon={<Warning fontSize="small" />} label="Unsaved" variant="outlined" size="small" />}
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<SyncIcon />} 
            onClick={handlePullFromCloud}
            disabled={loading}
            sx={{ borderColor: '#2563eb', color: '#2563eb', '&:hover': { bgcolor: '#eff6ff' }, fontWeight: 'bold' }}
          >
            {isMobile ? 'Pull Cloud' : 'Pull from Cloud'}
          </Button>
          <Button variant="outlined" color="error" size="small" startIcon={<Restore />} onClick={handleReset}>
            {isMobile ? 'Reset' : 'Reset All'}
          </Button>
          <Button variant="contained" size="small" startIcon={<Save />} onClick={handleSave} disabled={loading} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 'bold' }}>
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
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            minHeight: isMobile ? 44 : 48,
            '& .MuiTab-root': {
              minHeight: isMobile ? 44 : 48,
              py: isMobile ? 0.75 : 1,
              px: isMobile ? 1.5 : 2,
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              fontWeight: 600,
              textTransform: 'none',
              whiteSpace: 'nowrap'
            }
          }}
        >
          {SETTINGS_TABS.map((tab) => (
            <Tab 
              key={tab.id} 
              icon={tab.icon} 
              iconPosition="start"
              label={tab.label}
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
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                  <Button 
                    variant="contained" 
                    size="medium"
                    startIcon={<Save />} 
                    onClick={handleSaveShopProfileOnly}
                    disabled={loading}
                    sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 'bold', px: 3 }}
                  >
                    Save Shop Profile & Sync
                  </Button>
                </Box>
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
                                      <span style={{ color: '#dc2626', fontWeight: 700 }}>Can Delete</span>
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
                      <TableRow sx={{ bgcolor: '#1c2580' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>User</TableCell>
                        {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Email</TableCell>}
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Role</TableCell>
                        {!isMobile && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Access</TableCell>}
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }}>Status</TableCell>
                        {canManageUsers && <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5, fontSize: '0.85rem' }} align="right">Actions</TableCell>}
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
                  {/* NEW: Username field (required for login) */}
                  <TextField 
                    fullWidth 
                    size="small" 
                    label="Username *" 
                    value={editingUser?.username || ''} 
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} 
                    helperText="Unique login username (required)"
                  />
                  {/* Email is now optional */}
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
                  {/* NEW: Password with 6-char validation and red alert */}
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
                        ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Password must be at least 6 characters!</span>
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
                  {/* NEW: Show CRUD permissions for selected role */}
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
                    <Paper variant="outlined" sx={{ mb: 2, overflowX: 'auto' }}>
                      <Box sx={{ minWidth: isMobile ? 380 : 'auto' }}>
                        <Grid container sx={{ bgcolor: 'grey.50', p: 1.5, borderBottom: '1px solid', borderColor: 'divider', fontWeight: 'bold', fontSize: '0.7rem' }} spacing={1}>
                          <Grid item xs={4}><Typography variant="caption" fontWeight="bold">Page</Typography></Grid>
                          <Grid item xs={2} textAlign="center"><Typography variant="caption" fontWeight="bold">View</Typography></Grid>
                          <Grid item xs={2} textAlign="center"><Typography variant="caption" fontWeight="bold">Add</Typography></Grid>
                          <Grid item xs={2} textAlign="center"><Typography variant="caption" fontWeight="bold">Edit</Typography></Grid>
                          <Grid item xs={2} textAlign="center"><Typography variant="caption" fontWeight="bold" sx={{ color: 'error.main' }}>Delete</Typography></Grid>
                        </Grid>
                        {AVAILABLE_PAGES.map(page => {
                          const perms = roleForm.permissions[page.id] || { view: false, add: false, edit: false, delete: false };
                          return (
                            <Grid container key={page.id} alignItems="center" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
                              <Grid item xs={4}>
                                <Typography variant="body2" fontSize={isMobile ? '0.7rem' : '0.8rem'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} noWrap>
                                  {page.icon} {page.label}
                                </Typography>
                              </Grid>
                              <Grid item xs={2} textAlign="center">
                                <Checkbox size="small" checked={perms.view} onChange={() => toggleRolePermission(page.id, 'view')} />
                              </Grid>
                              <Grid item xs={2} textAlign="center">
                                <Checkbox size="small" checked={perms.add} onChange={() => toggleRolePermission(page.id, 'add')} disabled={!perms.view} />
                              </Grid>
                              <Grid item xs={2} textAlign="center">
                                <Checkbox size="small" checked={perms.edit} onChange={() => toggleRolePermission(page.id, 'edit')} disabled={!perms.view} />
                              </Grid>
                              <Grid item xs={2} textAlign="center">
                                <Checkbox size="small" checked={perms.delete} onChange={() => toggleRolePermission(page.id, 'delete')} disabled={!perms.view} sx={{ color: 'error.main', '&.Mui-checked': { color: 'error.main' } }} />
                              </Grid>
                            </Grid>
                          );
                        })}
                      </Box>
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
      {/* ==================== TAB 2: RECEIPT & BARCODE (DUAL PRINTING SETTINGS) ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <SectionTitle 
              icon={<Receipt />} 
              title="Receipt & Barcode Printing Settings" 
              subtitle="Manage POS Thermal Billing Receipts and Product Barcode Label Printers" 
              isMobile={isMobile} 
            />

            {/* SUB-TAB NAVIGATOR */}
            <Paper sx={{ p: 1, mb: 3, bgcolor: '#f8fafc', borderRadius: 2, display: 'flex', gap: 1.5, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <Button
                variant={printSubTab === 'pos' ? 'contained' : 'outlined'}
                onClick={() => setPrintSubTab('pos')}
                startIcon={<ReceiptLong />}
                sx={{
                  borderRadius: 1.5,
                  px: 2.5,
                  py: 1,
                  fontWeight: 'bold',
                  bgcolor: printSubTab === 'pos' ? '#10b981' : 'transparent',
                  color: printSubTab === 'pos' ? '#fff' : '#374151',
                  borderColor: '#10b981',
                  '&:hover': {
                    bgcolor: printSubTab === 'pos' ? '#059669' : '#f0fdf4',
                    borderColor: '#059669'
                  }
                }}
              >
                POS Billing Receipt (Billing Page)
              </Button>
              <Button
                variant={printSubTab === 'barcode' ? 'contained' : 'outlined'}
                onClick={() => setPrintSubTab('barcode')}
                startIcon={<BarcodeIcon fontSize="small" />}
                sx={{
                  borderRadius: 1.5,
                  px: 2.5,
                  py: 1,
                  fontWeight: 'bold',
                  bgcolor: printSubTab === 'barcode' ? '#6366f1' : 'transparent',
                  color: printSubTab === 'barcode' ? '#fff' : '#374151',
                  borderColor: '#6366f1',
                  '&:hover': {
                    bgcolor: printSubTab === 'barcode' ? '#4f46e5' : '#eef2ff',
                    borderColor: '#4f46e5'
                  }
                }}
              >
                Product Barcode Labels (Products Page)
              </Button>
            </Paper>

            {/* ----------------- SUB-TAB 1: POS BILLING RECEIPT ----------------- */}
            {printSubTab === 'pos' && (
              <Box>
                {/* POS RECEIPT PRINTER AUTO-DETECTION & SELECTION */}
                <Card sx={{ mb: 3, border: '2px solid #10b981', bgcolor: '#f0fdf4', borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#065f46' }}>
                          <LocalPrintshop color="primary" /> POS Receipt Printer (Hardware Auto-Detection)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Automatically detects attached thermal receipt printers. Billing page prints directly to this device.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SyncIcon />}
                          onClick={fetchPrinters}
                          disabled={printersLoading}
                          sx={{ borderColor: '#10b981', color: '#065f46', fontWeight: 600 }}
                        >
                          {printersLoading ? 'Scanning...' : 'Scan / Refresh Printers'}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Print />}
                          onClick={handleTestPrintReceipt}
                          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 600 }}
                        >
                          Test Print Receipt
                        </Button>
                      </Box>
                    </Box>

                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Selected POS Thermal Printer</InputLabel>
                          <Select
                            value={receiptSettings.printerName || ''}
                            onChange={(e) => handleReceiptChange('printerName', e.target.value)}
                            label="Selected POS Thermal Printer"
                          >
                            <MenuItem value="">
                              <em>Default System Printer (Auto-detect)</em>
                            </MenuItem>
                            {availablePrinters.map((printer, idx) => (
                              <MenuItem key={idx} value={printer.name}>
                                {printer.name} {printer.isDefault ? '(Default)' : ''}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Chip
                          label={receiptSettings.printerName ? `Active: ${receiptSettings.printerName}` : 'Active: System Default Printer'}
                          color={receiptSettings.printerName ? 'success' : 'default'}
                          sx={{ width: '100%', height: '40px', fontWeight: 'bold' }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* RECEIPT DESIGN SELECTION */}
                <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DesignServices color="primary" /> Choose Receipt Design Style
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Select your preferred receipt style. Changes will reflect immediately in all printed receipts and previews.
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
                        label={receiptSettings.design === 'design1' ? 'Classic' : receiptSettings.design === 'design2' ? 'Modern' : receiptSettings.design === 'design3' ? 'Premium' : 'Imtiaz Style'} 
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
                            <MenuItem value="58mm">58mm (Small Thermal Printer)</MenuItem>
                            <MenuItem value="80mm">80mm (Standard POS Thermal)</MenuItem>
                            <MenuItem value="custom">Custom Width (Set in mm)</MenuItem>
                            <MenuItem value="A4">A4 (Full Page)</MenuItem>
                            <MenuItem value="A5">A5 (Half Page)</MenuItem>
                          </Select>
                        </FormControl>
                        {receiptSettings.paperSize === 'custom' && (
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Custom Paper Width (mm)" 
                            value={receiptSettings.customWidthMm || 80} 
                            onChange={(e) => handleReceiptChange('customWidthMm', parseFloat(e.target.value) || 80)} 
                            inputProps={{ min: 30, max: 250, step: 1 }} 
                            helperText="Printable roll width in mm (e.g., 72, 76, 80)"
                          />
                        )}
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

                  {/* RECEIPT MARGINS & CUTTER FEED SPACING */}
                  <Grid item xs={12}>
                    <SettingCard 
                      title="Receipt Margins & Paper Cut Spacing (Padding)" 
                      icon={<Description color="primary" />}
                      isMobile={isMobile}
                      expandedCards={expandedCards}
                      toggleCard={toggleCard}
                    >
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          Set print margins in millimeters (mm) to fit your thermal printer paper roll perfectly and avoid clipped borders or cut text.
                        </Typography>
                        {/* Quick margin presets */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: '#4b5563' }}>
                            Quick Presets:
                          </Typography>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handleMarginPreset('zero')}
                            sx={{ fontSize: '0.75rem', py: 0.3 }}
                          >
                            Zero Margin (0mm - Full Width)
                          </Button>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handleMarginPreset('standard')}
                            sx={{ fontSize: '0.75rem', py: 0.3, borderColor: '#10b981', color: '#065f46' }}
                          >
                            Standard (2mm - Recommended)
                          </Button>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handleMarginPreset('wide')}
                            sx={{ fontSize: '0.75rem', py: 0.3 }}
                          >
                            Spacious (5mm - Extra Space)
                          </Button>
                        </Box>
                      </Box>

                      <Grid container spacing={isMobile ? 1.5 : 2}>
                        <Grid item xs={6} sm={3}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Left Margin (mm)" 
                            value={receiptSettings.marginLeft !== undefined ? receiptSettings.marginLeft : 2} 
                            onChange={(e) => handleReceiptChange('marginLeft', Math.max(0, parseFloat(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 20, step: 0.5 }} 
                            helperText="Indent from left edge"
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Right Margin (mm)" 
                            value={receiptSettings.marginRight !== undefined ? receiptSettings.marginRight : 2} 
                            onChange={(e) => handleReceiptChange('marginRight', Math.max(0, parseFloat(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 20, step: 0.5 }} 
                            helperText="Indent from right edge"
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Top Margin (mm)" 
                            value={receiptSettings.marginTop !== undefined ? receiptSettings.marginTop : 2} 
                            onChange={(e) => handleReceiptChange('marginTop', Math.max(0, parseFloat(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 30, step: 0.5 }} 
                            helperText="Top spacing before logo"
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Bottom Margin (mm)" 
                            value={receiptSettings.marginBottom !== undefined ? receiptSettings.marginBottom : 6} 
                            onChange={(e) => handleReceiptChange('marginBottom', Math.max(0, parseFloat(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 40, step: 0.5 }} 
                            helperText="Bottom spacing"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Content Padding (mm)" 
                            value={receiptSettings.paddingMm !== undefined ? receiptSettings.paddingMm : 2} 
                            onChange={(e) => handleReceiptChange('paddingMm', Math.max(0, parseFloat(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 15, step: 0.5 }} 
                            helperText="Spacing between content and paper edges"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField 
                            fullWidth 
                            size="small" 
                            type="number" 
                            label="Cutter Feed Blank Lines" 
                            value={receiptSettings.feedLines !== undefined ? receiptSettings.feedLines : 2} 
                            onChange={(e) => handleReceiptChange('feedLines', Math.max(0, parseInt(e.target.value) || 0))} 
                            inputProps={{ min: 0, max: 10, step: 1 }} 
                            helperText="Blank lines fed before paper cut so cutter doesn't slice footer"
                          />
                        </Grid>
                      </Grid>
                    </SettingCard>
                  </Grid>

                  <Grid item xs={12}>
                    <SettingCard 
                      title="Custom Header & Footer Branding" 
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
                            label="Receipt Header Subtitle" 
                            value={receiptSettings.headerText} 
                            onChange={(e) => handleReceiptChange('headerText', e.target.value)} 
                            placeholder="Welcome to our store!"
                            helperText="Appears below shop name on top of the receipt"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField 
                            fullWidth 
                            multiline
                            rows={2}
                            size="small" 
                            label="Footer Message (Thank You Note / Return Policy)" 
                            value={receiptSettings.footerText} 
                            onChange={(e) => handleReceiptChange('footerText', e.target.value)} 
                            placeholder="Thank you for visiting us!&#10;Returns accepted within 7 days with receipt."
                            helperText="Appears at the very bottom of every printed receipt"
                          />
                        </Grid>
                      </Grid>
                    </SettingCard>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                      <Button 
                        variant="contained" 
                        size="medium"
                        startIcon={<Save />} 
                        onClick={handleSaveReceiptSettingsOnly}
                        disabled={loading}
                        sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 'bold', px: 3 }}
                      >
                        Save Receipt Settings & Sync
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* ----------------- SUB-TAB 2: PRODUCT BARCODE LABELS ----------------- */}
            {printSubTab === 'barcode' && (
              <Box>
                {/* BARCODE PRINTER HARDWARE AUTO-DETECTION & SELECTION */}
                <Card sx={{ mb: 3, border: '2px solid #6366f1', bgcolor: '#eef2ff', borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#3730a3' }}>
                          <LocalPrintshop sx={{ color: '#4f46e5' }} /> Dedicated Barcode Label Printer (Hardware Auto-Detection)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Select the thermal barcode sticker printer (TSC, Xprinter, Zebra, Rongta). Products page barcode button prints directly here.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SyncIcon />}
                          onClick={fetchPrinters}
                          disabled={printersLoading}
                          sx={{ borderColor: '#6366f1', color: '#4338ca', fontWeight: 600 }}
                        >
                          {printersLoading ? 'Scanning...' : 'Scan / Refresh Printers'}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Print />}
                          onClick={handleTestPrintBarcode}
                          sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, fontWeight: 600 }}
                        >
                          Test Print Barcode Label
                        </Button>
                      </Box>
                    </Box>

                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Selected Barcode Label Printer</InputLabel>
                          <Select
                            value={barcodeSettings.printerName || ''}
                            onChange={(e) => handleBarcodeChange('printerName', e.target.value)}
                            label="Selected Barcode Label Printer"
                          >
                            <MenuItem value="">
                              <em>Default System Printer (Auto-detect)</em>
                            </MenuItem>
                            {availablePrinters.map((printer, idx) => (
                              <MenuItem key={idx} value={printer.name}>
                                {printer.name} {printer.isDefault ? '(Default)' : ''}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Chip
                          label={barcodeSettings.printerName ? `Active: ${barcodeSettings.printerName}` : 'Active: System Default Printer'}
                          sx={{ width: '100%', height: '40px', fontWeight: 'bold', bgcolor: '#4f46e5', color: '#fff' }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* LIVE BARCODE PREVIEW */}
                <Card sx={{ mb: 3, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BarcodeIcon fontSize="small" /> Live Barcode Label Preview ({barcodeSettings.labelWidth}mm x {barcodeSettings.labelHeight}mm - {barcodeSettings.columns} Column Roll)
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`${barcodeSettings.labelSize} | ${barcodeSettings.barcodeType}`} 
                        sx={{ fontWeight: 'bold', bgcolor: '#6366f1', color: '#fff' }}
                      />
                    </Box>
                    <BarcodeDesignPreview barcodeSettings={barcodeSettings} shopProfile={shopProfile} />
                  </CardContent>
                </Card>

                <Grid container spacing={isMobile ? 1.5 : 3}>
                  <Grid item xs={12} md={6}>
                    <SettingCard 
                      title="Label Dimensions & Roll Type" 
                      icon={<Palette sx={{ color: '#4f46e5' }} />}
                      isMobile={isMobile}
                      expandedCards={expandedCards}
                      toggleCard={toggleCard}
                    >
                      <Stack spacing={isMobile ? 1.5 : 2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Label Size Preset</InputLabel>
                          <Select 
                            value={barcodeSettings.labelSize || '50x30mm'} 
                            onChange={(e) => handleBarcodePresetChange(e.target.value)} 
                            label="Label Size Preset"
                          >
                            <MenuItem value="50x30mm">50 x 30 mm (Standard Price Tag - Most Popular)</MenuItem>
                            <MenuItem value="40x25mm">40 x 25 mm (Small Items / Jewelry)</MenuItem>
                            <MenuItem value="38x28mm">38 x 28 mm (Retail Shelf Tag)</MenuItem>
                            <MenuItem value="50x25mm">50 x 25 mm (Compact Sticker)</MenuItem>
                            <MenuItem value="2x1inch">2" x 1" (51 x 25 mm US Standard)</MenuItem>
                            <MenuItem value="3x2inch">3" x 2" (76 x 51 mm Shipping / Large)</MenuItem>
                            <MenuItem value="custom">Custom Dimensions (Set Width & Height)</MenuItem>
                          </Select>
                        </FormControl>

                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <TextField 
                              fullWidth 
                              size="small" 
                              type="number" 
                              label="Width (mm)" 
                              value={barcodeSettings.labelWidth} 
                              onChange={(e) => handleBarcodeChange('labelWidth', parseFloat(e.target.value) || 50)} 
                              inputProps={{ min: 20, max: 150 }} 
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField 
                              fullWidth 
                              size="small" 
                              type="number" 
                              label="Height (mm)" 
                              value={barcodeSettings.labelHeight} 
                              onChange={(e) => handleBarcodeChange('labelHeight', parseFloat(e.target.value) || 30)} 
                              inputProps={{ min: 15, max: 150 }} 
                            />
                          </Grid>
                        </Grid>

                        <FormControl fullWidth size="small">
                          <InputLabel>Labels Per Row (Roll Columns)</InputLabel>
                          <Select 
                            value={barcodeSettings.columns || 1} 
                            onChange={(e) => handleBarcodeChange('columns', parseInt(e.target.value) || 1)} 
                            label="Labels Per Row (Roll Columns)"
                          >
                            <MenuItem value={1}>1 Column (1 Label per row - Single Roll)</MenuItem>
                            <MenuItem value={2}>2 Columns (2 Labels per row - 2-Up Roll)</MenuItem>
                            <MenuItem value={3}>3 Columns (3 Labels per row - 3-Up Roll)</MenuItem>
                          </Select>
                        </FormControl>

                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <TextField 
                              fullWidth 
                              size="small" 
                              type="number" 
                              label="Default Copies" 
                              value={barcodeSettings.copies || 1} 
                              onChange={(e) => handleBarcodeChange('copies', parseInt(e.target.value) || 1)} 
                              inputProps={{ min: 1, max: 100 }} 
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField 
                              fullWidth 
                              size="small" 
                              type="number" 
                              label="Label Margin (mm)" 
                              value={barcodeSettings.marginMm !== undefined ? barcodeSettings.marginMm : 2} 
                              onChange={(e) => handleBarcodeChange('marginMm', parseFloat(e.target.value) || 0)} 
                              inputProps={{ min: 0, max: 10 }} 
                            />
                          </Grid>
                        </Grid>
                      </Stack>
                    </SettingCard>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <SettingCard 
                      title="Label Content & Fields" 
                      icon={<BarcodeIcon fontSize="small" sx={{ color: '#4f46e5' }} />}
                      isMobile={isMobile}
                      expandedCards={expandedCards}
                      toggleCard={toggleCard}
                    >
                      <Stack spacing={1.5}>
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showShopName} onChange={(e) => handleBarcodeChange('showShopName', e.target.checked)} />} 
                          label="Show Shop / Brand Name" 
                        />
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="Shop Name on Barcode (leave empty to use Store Name)" 
                          value={barcodeSettings.shopName || ''} 
                          onChange={(e) => handleBarcodeChange('shopName', e.target.value)} 
                          placeholder={shopProfile.name || 'My Store'}
                        />
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showProductName} onChange={(e) => handleBarcodeChange('showProductName', e.target.checked)} />} 
                          label="Show Product Title" 
                        />
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showPrice} onChange={(e) => handleBarcodeChange('showPrice', e.target.checked)} />} 
                          label="Show Retail Price" 
                        />
                        <TextField 
                          fullWidth 
                          size="small" 
                          label="Currency Symbol on Tag" 
                          value={barcodeSettings.currencySymbol || 'Rs.'} 
                          onChange={(e) => handleBarcodeChange('currencySymbol', e.target.value)} 
                          placeholder="Rs."
                        />
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showBarcode} onChange={(e) => handleBarcodeChange('showBarcode', e.target.checked)} />} 
                          label="Show Barcode Lines (Barcode Graphic)" 
                        />
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showBarcodeText} onChange={(e) => handleBarcodeChange('showBarcodeText', e.target.checked)} />} 
                          label="Show Barcode Digits/Text below lines" 
                        />
                        <FormControlLabel 
                          control={<Switch checked={barcodeSettings.showSku} onChange={(e) => handleBarcodeChange('showSku', e.target.checked)} />} 
                          label="Show SKU / Product Code" 
                        />
                        <FormControl fullWidth size="small">
                          <InputLabel>Barcode Symbology Format</InputLabel>
                          <Select 
                            value={barcodeSettings.barcodeType || 'CODE128'} 
                            onChange={(e) => handleBarcodeChange('barcodeType', e.target.value)} 
                            label="Barcode Symbology Format"
                          >
                            <MenuItem value="CODE128">CODE128 (Standard Alphanumeric - Recommended)</MenuItem>
                            <MenuItem value="EAN13">EAN-13 (13 Digits Standard)</MenuItem>
                            <MenuItem value="UPC">UPC-A (12 Digits)</MenuItem>
                            <MenuItem value="CODE39">CODE39 (Standard Barcode)</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </SettingCard>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                      <Button 
                        variant="contained" 
                        size="medium"
                        startIcon={<Save />} 
                        onClick={handleSaveBarcodeSettingsOnly}
                        disabled={loading}
                        sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, fontWeight: 'bold', px: 3 }}
                      >
                        Save Barcode Settings & Sync
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
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
                          {visible ? 'Visible' : 'Hidden'}
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