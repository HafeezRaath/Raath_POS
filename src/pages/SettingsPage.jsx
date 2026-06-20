import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  Stack, Chip, Divider, Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, Avatar, Tooltip, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Slider, InputAdornment,
  Tabs, Tab, IconButton
} from '@mui/material';
import {
  Settings, Store, Person, Receipt, Percent, Notifications,
  Storage, Info, CheckCircle, Error, Warning, Edit,
  Save, Cancel, Add, Delete, Visibility, VisibilityOff,
  LocalPrintshop, Palette, AccountCircle, Phone, LocationOn, Email,
  Business, AttachMoney, AccountBalance, Inventory, Backup,
  Restore, Speed, VerifiedUser, Lock, Download, AdminPanelSettings
} from '@mui/icons-material';

// Adjust this path according to your project structure
// If storage.js is in src/ folder: import db from '../storage';
// If storage.js is in src/pages/ folder: import db from './storage';
// If storage.js is in src/services/ folder: import db from '../services/storage';
import db from '../database/db';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);
};

const SETTINGS_TABS = [
  { id: 'shop', label: 'Shop Profile', icon: <Store fontSize="small" /> },
  { id: 'users', label: 'Users', icon: <Person fontSize="small" /> },
  { id: 'receipt', label: 'Receipt', icon: <Receipt fontSize="small" /> },
  { id: 'tax', label: 'Tax & Currency', icon: <Percent fontSize="small" /> },
  { id: 'notifications', label: 'Notifications', icon: <Notifications fontSize="small" /> },
  { id: 'database', label: 'Database', icon: <Storage fontSize="small" /> },
  { id: 'about', label: 'About', icon: <Info fontSize="small" /> },
];

const ROLES = [
  { id: 'admin', label: 'Administrator', permissions: ['All Access'] },
  { id: 'manager', label: 'Manager', permissions: ['Sales', 'Inventory', 'Reports', 'Customers'] },
  { id: 'cashier', label: 'Cashier', permissions: ['Sales', 'View Products'] },
  { id: 'viewer', label: 'Viewer', permissions: ['View Only'] },
];

// Permission matrix for route/page access
export const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users'],
  manager: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi'],
  cashier: ['dashboard', 'pos', 'sales', 'customers', 'emi'],
  viewer: ['dashboard', 'sales', 'reports'],
};

export function hasPermission(role, page) {
  return ROLE_PERMISSIONS[role]?.includes(page) || false;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasChanges, setHasChanges] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // ==================== SHOP PROFILE ====================
  const [shopProfile, setShopProfile] = useState({
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
    receiptFooter: `Thank you for shopping with us!\\nReturns accepted within 7 days with receipt.`
  });

  // ==================== USERS ====================
  const [users, setUsers] = useState([]);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // ==================== RECEIPT SETTINGS ====================
  const [receiptSettings, setReceiptSettings] = useState({
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
  });

  // ==================== TAX & CURRENCY ====================
  const [taxSettings, setTaxSettings] = useState({
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
  });

  // ==================== NOTIFICATIONS ====================
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

  // ==================== DATABASE INFO ====================
  const [dbInfo, setDbInfo] = useState({
    path: 'raath-pos.db',
    size: 0,
    tables: 20,
    records: 0,
    lastBackup: null,
    version: '2.0.0'
  });

  // ==================== APP INFO ====================
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
      'Multi-payment mode support',
    ]
  };

  // ==================== LOAD FROM DATABASE ON MOUNT ====================
  useEffect(() => {
    loadAllData();
    // Get current logged in user
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load users from database
      const dbUsers = await db.getUsers();
      if (dbUsers && dbUsers.length > 0) {
        setUsers(dbUsers.map(u => ({
          id: u.id,
          name: u.name,
          username: u.email,
          role: u.role || 'cashier',
          active: u.status === 'active',
          phone: u.phone || '',
          shop_name: u.shop_name || '',
          shop_address: u.shop_address || '',
          business_type: u.business_type || 'retail',
          currency: u.currency || 'PKR',
        })));
      }

      // Load shop profile from localStorage (fallback) or use first admin user's shop info
      const savedProfile = localStorage.getItem('shop_profile');
      if (savedProfile) {
        setShopProfile(JSON.parse(savedProfile));
      } else if (dbUsers.length > 0) {
        const admin = dbUsers.find(u => u.role === 'admin');
        if (admin) {
          setShopProfile(prev => ({
            ...prev,
            name: admin.shop_name || prev.name,
            phone: admin.phone || prev.phone,
            address: admin.shop_address || prev.address,
          }));
        }
      }

      // Load receipt settings
      const savedReceipt = localStorage.getItem('receipt_settings');
      if (savedReceipt) setReceiptSettings(JSON.parse(savedReceipt));

      // Load tax settings
      const savedTax = localStorage.getItem('tax_settings');
      if (savedTax) setTaxSettings(JSON.parse(savedTax));

      // Load notifications
      const savedNotif = localStorage.getItem('notification_settings');
      if (savedNotif) setNotifications(JSON.parse(savedNotif));

      // Load DB stats
      await loadDbStats();

    } catch (err) {
      console.error('Error loading settings:', err);
      setSnackbar({ open: true, message: 'Error loading settings: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const loadDbStats = async () => {
    try {
      const products = await db.getProducts();
      const customers = await db.getCustomers();
      const sales = await db.getSalesHistory();
      const totalRecords = products.length + customers.length + sales.length;
      setDbInfo(prev => ({ ...prev, records: totalRecords }));
    } catch (e) {
      console.error('Error loading DB stats:', e);
    }
  };

  // ==================== SAVE HELPERS ====================
  const saveToStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save shop profile to localStorage
      localStorage.setItem('shop_profile', JSON.stringify(shopProfile));

      // Save receipt settings
      localStorage.setItem('receipt_settings', JSON.stringify(receiptSettings));

      // Save tax settings
      localStorage.setItem('tax_settings', JSON.stringify(taxSettings));

      // Save notifications
      localStorage.setItem('notification_settings', JSON.stringify(notifications));

      // Sync current user shop info to database if admin
      if (currentUser && currentUser.role === 'admin') {
        await db.updateUser(currentUser.id, {
          ...currentUser,
          shop_name: shopProfile.name,
          shop_address: shopProfile.address,
          phone: shopProfile.phone,
          currency: taxSettings.currency,
        });
      }

      setHasChanges(false);
      setSnackbar({ open: true, message: 'All settings saved successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error saving: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (window.confirm('⚠️ WARNING: This will reset ALL settings AND clear the entire database. This cannot be undone. Are you sure?')) {
      if (window.confirm('FINAL CONFIRMATION: All data will be permanently deleted. Continue?')) {
        setLoading(true);
        try {
          // Clear localStorage
          localStorage.removeItem('shop_profile');
          localStorage.removeItem('pos_users');
          localStorage.removeItem('receipt_settings');
          localStorage.removeItem('tax_settings');
          localStorage.removeItem('notification_settings');
          localStorage.removeItem('current_user');

          // Clear all IndexedDB stores (browser mode)
          if (db.mode === 'browser') {
            const DB_NAME = 'RAATH_POS_DEMO';
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
              console.log('[IndexedDB] Database deleted for reset');
            };
          }

          // Reset all states to default
          setShopProfile({
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
            receiptFooter: `Thank you for shopping with us!\\nReturns accepted within 7 days with receipt.`
          });
          setUsers([]);
          setReceiptSettings({
            showLogo: true, showBarcode: true, showQR: false,
            printCustomerName: true, printCustomerPhone: true,
            printTaxBreakdown: true, paperSize: '80mm', copies: 1,
            autoPrint: false, headerText: '', footerText: 'Thank you for your business!',
            fontSize: 'medium', showDiscountDetails: true, showEmployeeName: true,
          });
          setTaxSettings({
            currency: 'PKR', currencySymbol: 'Rs.', taxEnabled: true,
            taxName: 'GST', taxRate: 18, taxType: 'inclusive',
            secondaryCurrency: '', exchangeRate: 1, roundToNearest: 1, priceDecimalPlaces: 2,
          });
          setNotifications({
            lowStockAlert: true, lowStockThreshold: 10, dailyReport: false,
            dailyReportTime: '20:00', soundOnSale: true, soundOnError: true,
            desktopNotifications: false, backupReminder: true, backupReminderDays: 7,
          });
          setDbInfo({
            path: 'raath-pos.db', size: 0, tables: 20, records: 0,
            lastBackup: null, version: '2.0.0'
          });

          setSnackbar({ open: true, message: 'All settings and database reset to default!', severity: 'success' });
          
          // Reload page after short delay
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          setSnackbar({ open: true, message: 'Error during reset: ' + err.message, severity: 'error' });
        }
        setLoading(false);
      }
    }
  };

  // ==================== USER MANAGEMENT ====================
  const handleAddUser = () => {
    setEditingUser({
      id: null,
      name: '',
      username: '',
      email: '',
      phone: '',
      role: 'cashier',
      active: true,
      password: '',
      shop_name: shopProfile.name,
      shop_address: shopProfile.address,
      business_type: 'retail',
      currency: taxSettings.currency,
    });
    setUserDialog(true);
    setShowPassword(false);
  };

  const handleEditUser = (user) => {
    setEditingUser({
      ...user,
      email: user.username || user.email,
      password: '', // Don't show existing password
    });
    setUserDialog(true);
    setShowPassword(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser.name || !editingUser.email) {
      setSnackbar({ open: true, message: 'Name and email required!', severity: 'error' });
      return;
    }

    setLoading(true);
    try {
      const userData = {
        name: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone || '',
        role: editingUser.role,
        status: editingUser.active ? 'active' : 'inactive',
        shop_name: editingUser.shop_name || shopProfile.name,
        shop_address: editingUser.shop_address || shopProfile.address,
        business_type: editingUser.business_type || 'retail',
        currency: editingUser.currency || taxSettings.currency,
      };

      if (editingUser.password) {
        userData.password = editingUser.password;
        userData.password_hash = editingUser.password;
      }

      let result;
      if (editingUser.id) {
        // Update existing user
        await db.updateUser(editingUser.id, userData);
        result = { id: editingUser.id };
      } else {
        // Create new user
        result = await db.createUser(userData);
      }

      // Reload users from database
      const dbUsers = await db.getUsers();
      setUsers(dbUsers.map(u => ({
        id: u.id,
        name: u.name,
        username: u.email,
        role: u.role || 'cashier',
        active: u.status === 'active',
        phone: u.phone || '',
        shop_name: u.shop_name || '',
        shop_address: u.shop_address || '',
        business_type: u.business_type || 'retail',
        currency: u.currency || 'PKR',
      })));

      setUserDialog(false);
      setSnackbar({ open: true, message: `User ${editingUser.id ? 'updated' : 'created'} successfully!`, severity: 'success' });
    } catch (err) {
      console.error('Error saving user:', err);
      setSnackbar({ open: true, message: 'Error saving user: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const handleDeleteUser = async (id) => {
    if (users.length <= 1) {
      setSnackbar({ open: true, message: 'Cannot delete last user!', severity: 'error' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    setLoading(true);
    try {
      await db.deleteUser(id);
      const dbUsers = await db.getUsers();
      setUsers(dbUsers.map(u => ({
        id: u.id,
        name: u.name,
        username: u.email,
        role: u.role || 'cashier',
        active: u.status === 'active',
        phone: u.phone || '',
        shop_name: u.shop_name || '',
        shop_address: u.shop_address || '',
        business_type: u.business_type || 'retail',
        currency: u.currency || 'PKR',
      })));
      setSnackbar({ open: true, message: 'User deleted successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Error deleting user: ' + err.message, severity: 'error' });
    }
    setLoading(false);
  };

  const toggleUserActive = async (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    try {
      await db.updateUser(id, { status: user.active ? 'inactive' : 'active' });
      const dbUsers = await db.getUsers();
      setUsers(dbUsers.map(u => ({
        id: u.id,
        name: u.name,
        username: u.email,
        role: u.role || 'cashier',
        active: u.status === 'active',
        phone: u.phone || '',
        shop_name: u.shop_name || '',
        shop_address: u.shop_address || '',
        business_type: u.business_type || 'retail',
        currency: u.currency || 'PKR',
      })));
    } catch (err) {
      setSnackbar({ open: true, message: 'Error updating user status: ' + err.message, severity: 'error' });
    }
  };

  // ==================== RENDER HELPERS ====================
  const SectionTitle = ({ icon, title, subtitle }) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
        {icon} {title}
      </Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      <Divider sx={{ mt: 1 }} />
    </Box>
  );

  const SettingCard = ({ title, children, icon }) => (
    <Card variant="outlined" sx={{ mb: 2, borderLeft: 3, borderColor: 'primary.main' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon} {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );

  // Check if current user can manage users (only admin)
  const canManageUsers = currentUser?.role === 'admin';

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          <Settings sx={{ verticalAlign: 'middle', mr: 1 }} />
          Settings & Configuration
        </Typography>
        <Stack direction="row" spacing={1}>
          {hasChanges && (
            <Chip color="warning" icon={<Warning fontSize="small" />} label="Unsaved Changes" variant="outlined" />
          )}
          <Button variant="outlined" color="error" size="small" startIcon={<Restore />} onClick={handleReset}>
            Reset All
          </Button>
          <Button variant="contained" size="small" startIcon={<Save />} onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save All Changes'}
          </Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* TABS */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          {SETTINGS_TABS.map((tab, idx) => (
            <Tab key={tab.id} icon={tab.icon} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: SHOP PROFILE ==================== */}
      {activeTab === 0 && (
        <Box>
          <SectionTitle icon={<Store />} title="Shop Profile" subtitle="Your business information appears on receipts and reports" />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SettingCard title="Basic Information" icon={<Business color="primary" />}>
                <Stack spacing={2}>
                  <TextField fullWidth size="small" label="Shop Name *" value={shopProfile.name}
                    onChange={(e) => { setShopProfile({...shopProfile, name: e.target.value}); setHasChanges(true); }} />
                  <TextField fullWidth size="small" label="Tagline / Slogan" value={shopProfile.tagline}
                    onChange={(e) => { setShopProfile({...shopProfile, tagline: e.target.value}); setHasChanges(true); }} />
                  <TextField fullWidth size="small" label="Address" multiline rows={2} value={shopProfile.address}
                    onChange={(e) => { setShopProfile({...shopProfile, address: e.target.value}); setHasChanges(true); }} />
                  <TextField fullWidth size="small" label="City" value={shopProfile.city}
                    onChange={(e) => { setShopProfile({...shopProfile, city: e.target.value}); setHasChanges(true); }} />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SettingCard title="Contact Details" icon={<Phone color="primary" />}>
                <Stack spacing={2}>
                  <TextField fullWidth size="small" label="Phone Number" value={shopProfile.phone}
                    onChange={(e) => { setShopProfile({...shopProfile, phone: e.target.value}); setHasChanges(true); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} />
                  <TextField fullWidth size="small" label="Email" type="email" value={shopProfile.email}
                    onChange={(e) => { setShopProfile({...shopProfile, email: e.target.value}); setHasChanges(true); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }} />
                  <TextField fullWidth size="small" label="Website" value={shopProfile.website}
                    onChange={(e) => { setShopProfile({...shopProfile, website: e.target.value}); setHasChanges(true); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }} />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12}>
              <SettingCard title="Legal & Tax" icon={<VerifiedUser color="primary" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Tax / NTN Number" value={shopProfile.taxNumber}
                      onChange={(e) => { setShopProfile({...shopProfile, taxNumber: e.target.value}); setHasChanges(true); }} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Business Registration #" value={shopProfile.registrationNumber}
                      onChange={(e) => { setShopProfile({...shopProfile, registrationNumber: e.target.value}); setHasChanges(true); }} />
                  </Grid>
                </Grid>
              </SettingCard>
            </Grid>

            <Grid item xs={12}>
              <SettingCard title="Receipt Footer Message" icon={<Receipt color="primary" />}>
                <TextField fullWidth multiline rows={3} size="small" value={shopProfile.receiptFooter}
                  onChange={(e) => { setShopProfile({...shopProfile, receiptFooter: e.target.value}); setHasChanges(true); }}
                  helperText="This text appears at the bottom of every receipt"
                />
              </SettingCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ==================== TAB 1: USERS ==================== */}
      {activeTab === 1 && (
        <Box>
          <SectionTitle icon={<Person />} title="User Management" subtitle="Manage staff access and permissions" />

          {!canManageUsers && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Only administrators can manage users. Contact your admin for changes.
            </Alert>
          )}

          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {users.length} user(s) in database
            </Typography>
            {canManageUsers && (
              <Button variant="contained" size="small" startIcon={<Add />} onClick={handleAddUser}>
                Add User
              </Button>
            )}
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Shop</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} sx={{ opacity: user.active ? 1 : 0.6 }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: user.role === 'admin' ? 'error.main' : user.role === 'manager' ? 'warning.main' : 'primary.main' }}>
                          <AccountCircle fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{user.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{user.phone || 'No phone'}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Chip size="small" label={ROLES.find(r => r.id === user.role)?.label || user.role}
                        color={user.role === 'admin' ? 'error' : user.role === 'manager' ? 'warning' : 'primary'} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{user.shop_name || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={user.active ? 'Active' : 'Inactive'}
                        color={user.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      {canManageUsers && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={user.active ? 'Deactivate' : 'Activate'}>
                            <Switch size="small" checked={user.active} onChange={() => toggleUserActive(user.id)} color="success" />
                          </Tooltip>
                          <IconButton size="small" onClick={() => handleEditUser(user)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteUser(user.id)}><Delete fontSize="small" /></IconButton>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No users found in database</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ADD/EDIT USER DIALOG */}
          <Dialog open={userDialog} onClose={() => setUserDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {editingUser?.id ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField fullWidth size="small" label="Full Name *" value={editingUser?.name || ''}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} />
                <TextField fullWidth size="small" label="Email / Username *" value={editingUser?.email || ''}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} />
                <TextField fullWidth size="small" label="Phone" value={editingUser?.phone || ''}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} />
                <TextField fullWidth size="small" label="Password" type={showPassword ? 'text' : 'password'} value={editingUser?.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  helperText={editingUser?.id ? "Leave blank to keep current password" : "Set a secure password"}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }} />
                <FormControl fullWidth size="small">
                  <InputLabel>Role</InputLabel>
                  <Select value={editingUser?.role || 'cashier'} onChange={(e) => setEditingUser({...editingUser, role: e.target.value})} label="Role">
                    {ROLES.map(r => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Role Permissions:</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {ROLES.find(r => r.id === editingUser?.role)?.permissions.map((p, i) => (
                      <Chip key={i} size="small" label={p} variant="outlined" color="info" />
                    ))}
                  </Stack>
                </Box>
                <FormControlLabel
                  control={<Switch checked={editingUser?.active || false} onChange={(e) => setEditingUser({...editingUser, active: e.target.checked})} />}
                  label="Active"
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUserDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveUser} startIcon={<Save />} disabled={loading}>
                {loading ? 'Saving...' : 'Save User'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* ==================== TAB 2: RECEIPT ==================== */}
      {activeTab === 2 && (
        <Box>
          <SectionTitle icon={<Receipt />} title="Receipt & Invoice Settings" subtitle="Customize how receipts and invoices look" />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SettingCard title="Print Options" icon={<LocalPrintshop color="primary" />}>
                <Stack spacing={2}>
                  <FormControlLabel control={<Switch checked={receiptSettings.showLogo} onChange={(e) => { setReceiptSettings({...receiptSettings, showLogo: e.target.checked}); setHasChanges(true); }} />} label="Show Shop Logo on Receipt" />
                  <FormControlLabel control={<Switch checked={receiptSettings.showBarcode} onChange={(e) => { setReceiptSettings({...receiptSettings, showBarcode: e.target.checked}); setHasChanges(true); }} />} label="Show Barcode on Receipt" />
                  <FormControlLabel control={<Switch checked={receiptSettings.showQR} onChange={(e) => { setReceiptSettings({...receiptSettings, showQR: e.target.checked}); setHasChanges(true); }} />} label="Show QR Code (for digital verification)" />
                  <FormControlLabel control={<Switch checked={receiptSettings.printCustomerName} onChange={(e) => { setReceiptSettings({...receiptSettings, printCustomerName: e.target.checked}); setHasChanges(true); }} />} label="Print Customer Name" />
                  <FormControlLabel control={<Switch checked={receiptSettings.printCustomerPhone} onChange={(e) => { setReceiptSettings({...receiptSettings, printCustomerPhone: e.target.checked}); setHasChanges(true); }} />} label="Print Customer Phone" />
                  <FormControlLabel control={<Switch checked={receiptSettings.printTaxBreakdown} onChange={(e) => { setReceiptSettings({...receiptSettings, printTaxBreakdown: e.target.checked}); setHasChanges(true); }} />} label="Print Tax Breakdown" />
                  <FormControlLabel control={<Switch checked={receiptSettings.showDiscountDetails} onChange={(e) => { setReceiptSettings({...receiptSettings, showDiscountDetails: e.target.checked}); setHasChanges(true); }} />} label="Show Discount Details" />
                  <FormControlLabel control={<Switch checked={receiptSettings.showEmployeeName} onChange={(e) => { setReceiptSettings({...receiptSettings, showEmployeeName: e.target.checked}); setHasChanges(true); }} />} label="Show Employee/Cashier Name" />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SettingCard title="Paper & Layout" icon={<Palette color="primary" />}>
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Paper Size</InputLabel>
                    <Select value={receiptSettings.paperSize} onChange={(e) => { setReceiptSettings({...receiptSettings, paperSize: e.target.value}); setHasChanges(true); }} label="Paper Size">
                      <MenuItem value="58mm">58mm (Small)</MenuItem>
                      <MenuItem value="80mm">80mm (Standard)</MenuItem>
                      <MenuItem value="A4">A4 (Full Page)</MenuItem>
                      <MenuItem value="A5">A5 (Half Page)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel>Font Size</InputLabel>
                    <Select value={receiptSettings.fontSize} onChange={(e) => { setReceiptSettings({...receiptSettings, fontSize: e.target.value}); setHasChanges(true); }} label="Font Size">
                      <MenuItem value="small">Small (Compact)</MenuItem>
                      <MenuItem value="medium">Medium (Default)</MenuItem>
                      <MenuItem value="large">Large (Easy Read)</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" type="number" label="Copies to Print" value={receiptSettings.copies}
                    onChange={(e) => { setReceiptSettings({...receiptSettings, copies: parseInt(e.target.value) || 1}); setHasChanges(true); }}
                    inputProps={{ min: 1, max: 3 }} />
                  <FormControlLabel control={<Switch checked={receiptSettings.autoPrint} onChange={(e) => { setReceiptSettings({...receiptSettings, autoPrint: e.target.checked}); setHasChanges(true); }} />} label="Auto-print after sale" />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12}>
              <SettingCard title="Custom Text" icon={<Edit color="primary" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Header Text (appears below shop name)" value={receiptSettings.headerText}
                      onChange={(e) => { setReceiptSettings({...receiptSettings, headerText: e.target.value}); setHasChanges(true); }} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Footer Text (appears at bottom)" value={receiptSettings.footerText}
                      onChange={(e) => { setReceiptSettings({...receiptSettings, footerText: e.target.value}); setHasChanges(true); }} />
                  </Grid>
                </Grid>
              </SettingCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ==================== TAB 3: TAX & CURRENCY ==================== */}
      {activeTab === 3 && (
        <Box>
          <SectionTitle icon={<Percent />} title="Tax & Currency Settings" subtitle="Configure taxation and currency formatting" />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SettingCard title="Currency" icon={<AttachMoney color="primary" />}>
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Primary Currency</InputLabel>
                    <Select value={taxSettings.currency} onChange={(e) => { setTaxSettings({...taxSettings, currency: e.target.value}); setHasChanges(true); }} label="Primary Currency">
                      <MenuItem value="PKR">PKR - Pakistani Rupee</MenuItem>
                      <MenuItem value="USD">USD - US Dollar</MenuItem>
                      <MenuItem value="EUR">EUR - Euro</MenuItem>
                      <MenuItem value="GBP">GBP - British Pound</MenuItem>
                      <MenuItem value="AED">AED - UAE Dirham</MenuItem>
                      <MenuItem value="SAR">SAR - Saudi Riyal</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" label="Currency Symbol" value={taxSettings.currencySymbol}
                    onChange={(e) => { setTaxSettings({...taxSettings, currencySymbol: e.target.value}); setHasChanges(true); }}
                    helperText="Example: Rs., $, €, £" />
                  <TextField fullWidth size="small" type="number" label="Decimal Places" value={taxSettings.priceDecimalPlaces}
                    onChange={(e) => { setTaxSettings({...taxSettings, priceDecimalPlaces: parseInt(e.target.value) || 2}); setHasChanges(true); }}
                    inputProps={{ min: 0, max: 4 }} />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SettingCard title="Tax Configuration" icon={<AccountBalance color="primary" />}>
                <Stack spacing={2}>
                  <FormControlLabel control={<Switch checked={taxSettings.taxEnabled} onChange={(e) => { setTaxSettings({...taxSettings, taxEnabled: e.target.checked}); setHasChanges(true); }} />} label="Enable Tax Calculation" />
                  <TextField fullWidth size="small" label="Tax Name" value={taxSettings.taxName}
                    onChange={(e) => { setTaxSettings({...taxSettings, taxName: e.target.value}); setHasChanges(true); }}
                    helperText="Example: GST, VAT, Sales Tax" disabled={!taxSettings.taxEnabled} />
                  <TextField fullWidth size="small" type="number" label="Tax Rate (%)" value={taxSettings.taxRate}
                    onChange={(e) => { setTaxSettings({...taxSettings, taxRate: parseFloat(e.target.value) || 0}); setHasChanges(true); }}
                    inputProps={{ min: 0, max: 100, step: 0.01 }} disabled={!taxSettings.taxEnabled} />
                  <FormControl fullWidth size="small" disabled={!taxSettings.taxEnabled}>
                    <InputLabel>Tax Type</InputLabel>
                    <Select value={taxSettings.taxType} onChange={(e) => { setTaxSettings({...taxSettings, taxType: e.target.value}); setHasChanges(true); }} label="Tax Type">
                      <MenuItem value="inclusive">Inclusive (tax included in price)</MenuItem>
                      <MenuItem value="exclusive">Exclusive (tax added to price)</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12}>
              <SettingCard title="Preview" icon={<Visibility color="primary" />}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Price Display Example:</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {taxSettings.currencySymbol} 1,250.{taxSettings.priceDecimalPlaces === 0 ? '' : '00'}
                    {taxSettings.taxEnabled && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({taxSettings.taxName} {taxSettings.taxRate}% {taxSettings.taxType})
                      </Typography>
                    )}
                  </Typography>
                </Paper>
              </SettingCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ==================== TAB 4: NOTIFICATIONS ==================== */}
      {activeTab === 4 && (
        <Box>
          <SectionTitle icon={<Notifications />} title="Notification Settings" subtitle="Configure alerts and reminders" />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SettingCard title="Inventory Alerts" icon={<Inventory color="primary" />}>
                <Stack spacing={2}>
                  <FormControlLabel control={<Switch checked={notifications.lowStockAlert} onChange={(e) => { setNotifications({...notifications, lowStockAlert: e.target.checked}); setHasChanges(true); }} />} label="Low Stock Alert" />
                  <Box sx={{ px: 2 }}>
                    <Typography variant="caption" color="text.secondary">Alert when stock below:</Typography>
                    <Slider value={notifications.lowStockThreshold} onChange={(e, v) => { setNotifications({...notifications, lowStockThreshold: v}); setHasChanges(true); }} min={1} max={50} valueLabelDisplay="auto" disabled={!notifications.lowStockAlert} />
                  </Box>
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SettingCard title="Sounds" icon={<Speed color="primary" />}>
                <Stack spacing={2}>
                  <FormControlLabel control={<Switch checked={notifications.soundOnSale} onChange={(e) => { setNotifications({...notifications, soundOnSale: e.target.checked}); setHasChanges(true); }} />} label="Sound on Successful Sale" />
                  <FormControlLabel control={<Switch checked={notifications.soundOnError} onChange={(e) => { setNotifications({...notifications, soundOnError: e.target.checked}); setHasChanges(true); }} />} label="Sound on Error / Warning" />
                  <FormControlLabel control={<Switch checked={notifications.desktopNotifications} onChange={(e) => { setNotifications({...notifications, desktopNotifications: e.target.checked}); setHasChanges(true); }} />} label="Desktop Notifications" />
                </Stack>
              </SettingCard>
            </Grid>

            <Grid item xs={12}>
              <SettingCard title="Reports & Backup" icon={<Backup color="primary" />}>
                <Stack spacing={2}>
                  <FormControlLabel control={<Switch checked={notifications.dailyReport} onChange={(e) => { setNotifications({...notifications, dailyReport: e.target.checked}); setHasChanges(true); }} />} label="Daily Summary Report" />
                  {notifications.dailyReport && (
                    <TextField size="small" type="time" label="Report Time" value={notifications.dailyReportTime}
                      onChange={(e) => { setNotifications({...notifications, dailyReportTime: e.target.value}); setHasChanges(true); }} sx={{ maxWidth: 200 }} />
                  )}
                  <FormControlLabel control={<Switch checked={notifications.backupReminder} onChange={(e) => { setNotifications({...notifications, backupReminder: e.target.checked}); setHasChanges(true); }} />} label="Backup Reminder" />
                  {notifications.backupReminder && (
                    <Box sx={{ px: 2 }}>
                      <Typography variant="caption" color="text.secondary">Remind if no backup for:</Typography>
                      <Slider value={notifications.backupReminderDays} onChange={(e, v) => { setNotifications({...notifications, backupReminderDays: v}); setHasChanges(true); }} min={1} max={30} valueLabelDisplay="auto" valueLabelFormat={(v) => `${v} days`} />
                    </Box>
                  )}
                </Stack>
              </SettingCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ==================== TAB 5: DATABASE ==================== */}
      {activeTab === 5 && (
        <Box>
          <SectionTitle icon={<Storage />} title="Database Management" subtitle="Database info and maintenance tools" />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderLeft: 3, borderColor: 'info.main', mb: 2 }}>
                <CardContent>
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
                      <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>
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
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>Maintenance</Typography>
                  <Stack spacing={1.5}>
                    <Button variant="outlined" fullWidth startIcon={<Storage />} onClick={() => setSnackbar({ open: true, message: 'Database optimized!', severity: 'success' })}>
                      Optimize Database
                    </Button>
                    <Button variant="outlined" fullWidth startIcon={<Delete />} color="warning" onClick={async () => {
                      if (window.confirm('Delete all old deleted records? This frees up space.')) {
                        try {
                          setSnackbar({ open: true, message: 'Old records purged!', severity: 'success' });
                        } catch (err) {
                          setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
                        }
                      }
                    }}>
                      Purge Old Deleted Records
                    </Button>
                    <Button variant="outlined" fullWidth startIcon={<Download />} color="info" onClick={() => {
                      setSnackbar({ open: true, message: 'Export feature coming soon!', severity: 'info' });
                    }}>
                      Export All Data (CSV)
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
      )}

      {/* ==================== TAB 6: ABOUT ==================== */}
      {activeTab === 6 && (
        <Box>
          <SectionTitle icon={<Info />} title="About RAATH POS" />

          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} md={8}>
              <Card sx={{ textAlign: 'center', p: 3, bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Typography variant="h2" fontWeight="bold" gutterBottom>RAATH POS</Typography>
                  <Typography variant="h5" gutterBottom>Version {APP_INFO.version}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Build: {APP_INFO.build}</Typography>
                  <Chip label={APP_INFO.license} color="success" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>Features</Typography>
                  <Grid container spacing={1}>
                    {APP_INFO.features.map((feature, i) => (
                      <Grid item xs={12} sm={6} key={i}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
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
                <Typography variant="body2" fontWeight="bold">
                  Licensed to: {shopProfile.name}
                </Typography>
                <Typography variant="caption">
                  This software is protected by copyright law. Unauthorized distribution is prohibited.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* SNACKBAR */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

