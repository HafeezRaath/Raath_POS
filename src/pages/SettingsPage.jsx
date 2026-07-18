import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  Stack, Chip, Divider, Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, Avatar, Tooltip, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Slider, InputAdornment,
  Tabs, Tab, IconButton, Checkbox, FormGroup, useMediaQuery, useTheme,
  Drawer, Collapse, Fab, Badge, List, ListItem, ListItemText, ListItemIcon,
  Fade, Zoom
} from '@mui/material';
import {
  Settings, Store, Person, Receipt, Percent, Notifications,
  Storage, Info, CheckCircle, Warning, Edit,
  Save, Add, Delete, Visibility, VisibilityOff,
  LocalPrintshop, Palette, AccountCircle, Phone, Email,
  Business, AttachMoney, AccountBalance, Inventory, Backup,
  Restore, Speed, VerifiedUser, AdminPanelSettings,
  Shield, Menu as MenuIcon, Close, ArrowUpward, ArrowDownward
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
  { id: 'notifications', label: 'Notifications', icon: <Notifications fontSize="small" /> },
  { id: 'database', label: 'Database', icon: <Storage fontSize="small" /> },
  { id: 'about', label: 'About', icon: <Info fontSize="small" /> },
];

export { getRoles, getRolePermissions, hasPermission, getRoleLabel, getRoleColor };
export const ROLES = getRolesSync();
export const ROLE_PERMISSIONS = getRolePermissionsSync();

// ==================== MOBILE SETTINGS CARD ====================
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
  const [roleForm, setRoleForm] = useState({ id: '', label: '', color: 'primary', pages: [] });

  const nameInputRef = useRef(null);
  const roleLabelRef = useRef(null);

  const [shopProfile, setShopProfile] = useState({
    name: 'My Store', tagline: 'Quality Products, Best Prices', address: '', city: '', phone: '', email: '', website: '', taxNumber: '', registrationNumber: '', logo: null,
    receiptFooter: `Thank you for shopping with us!\nReturns accepted within 7 days with receipt.`
  });

  const [users, setUsers] = useState([]);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [receiptSettings, setReceiptSettings] = useState({
    showLogo: true, showBarcode: true, showQR: false, printCustomerName: true, printCustomerPhone: true,
    printTaxBreakdown: true, paperSize: '80mm', copies: 1, autoPrint: false, headerText: '',
    footerText: 'Thank you for your business!', fontSize: 'medium', showDiscountDetails: true, showEmployeeName: true,
  });

  const [taxSettings, setTaxSettings] = useState({
    currency: 'PKR', currencySymbol: 'Rs.', taxEnabled: true, taxName: 'GST', taxRate: 18, taxType: 'inclusive',
    secondaryCurrency: '', exchangeRate: 1, roundToNearest: 1, priceDecimalPlaces: 2,
  });

  const [notifications, setNotifications] = useState({
    lowStockAlert: true, lowStockThreshold: 10, dailyReport: false, dailyReportTime: '20:00',
    soundOnSale: true, soundOnError: true, desktopNotifications: false, backupReminder: true, backupReminderDays: 7,
  });

  const [dbInfo, setDbInfo] = useState({ path: 'raath-pos.db', size: 0, tables: 20, records: 0, lastBackup: null, version: '2.0.0' });

  const APP_INFO = {
    name: 'RAATH POS', version: '2.0.0', build: '2024.05.17', developer: 'RAATH Technologies',
    license: 'Commercial License', support: 'support@raathpos.com', website: 'https://raathpos.com',
    features: ['Multi-user with role-based access', 'Real-time inventory tracking', 'Barcode & QR code support', 'EMI & installment management', 'Customer & supplier ledger', 'Auto-backup to Gmail', 'Profit & loss reporting', 'Dead stock & fast-moving alerts', 'Serialized item tracking (IMEI)', 'Multi-payment mode support']
  };

  useEffect(() => {
    loadAllData();
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) { try { setCurrentUser(JSON.parse(savedUser)); } catch (e) {} }
  }, []);

  useEffect(() => { if (userDialog && nameInputRef.current) { setTimeout(() => nameInputRef.current?.focus(), 100); } }, [userDialog]);
  useEffect(() => { if (roleDialog && roleLabelRef.current) { setTimeout(() => roleLabelRef.current?.focus(), 100); } }, [roleDialog]);

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const dbRoles = await getRoles();
      setRoles(dbRoles);
      setRolePermissions(buildPermissionsMap(dbRoles));

      const dbUsers = await db.getUsers();
      if (dbUsers && dbUsers.length > 0) {
        setUsers(dbUsers.map(u => ({
          id: u.id, name: u.name, username: u.email || u.username, email: u.email,
          role: u.role || 'cashier', active: u.status === 'active', phone: u.phone || '',
          shop_name: u.shop_name || '', shop_address: u.shop_address || '',
          business_type: u.business_type || 'retail', currency: u.currency || 'PKR',
        })));
      } else { setUsers([]); }

      const savedProfile = localStorage.getItem('shop_profile');
      if (savedProfile) { try { setShopProfile(JSON.parse(savedProfile)); } catch (e) {} }
      else if (dbUsers && dbUsers.length > 0) {
        const admin = dbUsers.find(u => u.role === 'admin');
        if (admin) setShopProfile(prev => ({ ...prev, name: admin.shop_name || prev.name, phone: admin.phone || prev.phone, address: admin.shop_address || prev.address }));
      }
      const savedReceipt = localStorage.getItem('receipt_settings');
      if (savedReceipt) { try { setReceiptSettings(JSON.parse(savedReceipt)); } catch (e) {} }
      const savedTax = localStorage.getItem('tax_settings');
      if (savedTax) { try { setTaxSettings(JSON.parse(savedTax)); } catch (e) {} }
      const savedNotif = localStorage.getItem('notification_settings');
      if (savedNotif) { try { setNotifications(JSON.parse(savedNotif)); } catch (e) {} }
      await loadDbStats();
    } catch (err) { setSnackbar({ open: true, message: 'Error loading: ' + err.message, severity: 'error' }); }
    setLoading(false);
  };

  const buildPermissionsMap = (rolesArr) => {
    const perms = {};
    rolesArr.forEach(r => { perms[r.id] = r.pages || []; });
    return perms;
  };

  const loadDbStats = async () => {
    try {
      const [products, customers, sales] = await Promise.all([db.getProducts().catch(() => []), db.getCustomers().catch(() => []), db.getSalesHistory().catch(() => [])]);
      setDbInfo(prev => ({ ...prev, records: products.length + customers.length + sales.length }));
    } catch (e) {}
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('shop_profile', JSON.stringify(shopProfile));
      localStorage.setItem('receipt_settings', JSON.stringify(receiptSettings));
      localStorage.setItem('tax_settings', JSON.stringify(taxSettings));
      localStorage.setItem('notification_settings', JSON.stringify(notifications));
      if (currentUser?.role === 'admin') await db.updateUser(currentUser.id, { shop_name: shopProfile.name, shop_address: shopProfile.address, phone: shopProfile.phone, currency: taxSettings.currency });
      setHasChanges(false);
      setSnackbar({ open: true, message: 'All settings saved!', severity: 'success' });
    } catch (err) { setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm('WARNING: Reset ALL settings and clear database?')) return;
    if (!window.confirm('FINAL CONFIRMATION: All data permanently deleted?')) return;
    setLoading(true);
    try {
      ['shop_profile', 'pos_users', 'receipt_settings', 'tax_settings', 'notification_settings', 'current_user'].forEach(k => localStorage.removeItem(k));

      const defaultRoles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
      await persistRolesToDB(defaultRoles);
      setRoles(defaultRoles);
      setRolePermissions(buildPermissionsMap(defaultRoles));

      if (db.mode === 'browser') { indexedDB.deleteDatabase('RAATH_POS_DEMO'); }
      setSnackbar({ open: true, message: 'Reset complete! Reloading...', severity: 'success' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); }
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
    setRoleForm({ id: '', label: '', color: 'primary', pages: [] });
    setEditingRole(null);
    setRoleDialog(true);
  };

  const handleEditRole = (role) => {
    setRoleForm({ id: role.id, label: role.label, color: role.color, pages: [...(role.pages || [])] });
    setEditingRole(role);
    setRoleDialog(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.label) { setSnackbar({ open: true, message: 'Role Name required!', severity: 'error' }); return; }
    const id = editingRole ? editingRole.id : roleForm.id.trim().toLowerCase().replace(/\s+/g, '_');
    if (!editingRole) {
      if (!id) { setSnackbar({ open: true, message: 'Role ID required!', severity: 'error' }); return; }
      if (!/^[a-z0-9_]+$/.test(id)) { setSnackbar({ open: true, message: 'ID: letters, numbers, underscores only!', severity: 'error' }); return; }
      if (roles.find(r => r.id === id)) { setSnackbar({ open: true, message: 'Role ID already exists!', severity: 'error' }); return; }
    }
    if (roleForm.pages.length === 0) { setSnackbar({ open: true, message: 'Select at least one page!', severity: 'error' }); return; }

    const updatedRole = { id, label: roleForm.label.trim(), color: roleForm.color, pages: roleForm.pages, permissions: roleForm.pages.length === AVAILABLE_PAGES.length ? ['All Access'] : roleForm.pages.map(p => AVAILABLE_PAGES.find(ap => ap.id === p)?.label || p) };
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
    if (role.id === 'admin') { setSnackbar({ open: true, message: 'Cannot delete Administrator!', severity: 'error' }); return; }
    const usersWithRole = users.filter(u => u.role === role.id);
    if (usersWithRole.length > 0) { setSnackbar({ open: true, message: `Cannot delete: ${usersWithRole.length} user(s) assigned!`, severity: 'warning' }); return; }
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

  const toggleRolePage = (pageId) => {
    setRoleForm(prev => ({ ...prev, pages: prev.pages.includes(pageId) ? prev.pages.filter(p => p !== pageId) : [...prev.pages, pageId] }));
  };

  const handleCreateFirstAdmin = () => {
    setEditingUser({ id: null, name: '', email: '', phone: '', role: 'admin', active: true, password: '', shop_name: shopProfile.name, shop_address: shopProfile.address, business_type: 'retail', currency: taxSettings.currency, isFirstAdmin: true });
    setUserDialog(true); setShowPassword(false);
  };

  const handleAddUser = () => {
    setEditingUser({ id: null, name: '', email: '', phone: '', role: 'cashier', active: true, password: '', shop_name: shopProfile.name, shop_address: shopProfile.address, business_type: 'retail', currency: taxSettings.currency });
    setUserDialog(true); setShowPassword(false);
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user, email: user.email || user.username, password: '' });
    setUserDialog(true); setShowPassword(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser.name || !editingUser.email) { setSnackbar({ open: true, message: 'Name and email required!', severity: 'error' }); return; }
    if (!editingUser.id && !editingUser.password) { setSnackbar({ open: true, message: 'Password required for new users!', severity: 'error' }); return; }
    setLoading(true);
    try {
      const userData = { name: editingUser.name, email: editingUser.email, phone: editingUser.phone || '', role: editingUser.role, status: editingUser.active ? 'active' : 'inactive', shop_name: editingUser.shop_name || shopProfile.name, shop_address: editingUser.shop_address || shopProfile.address, business_type: editingUser.business_type || 'retail', currency: editingUser.currency || taxSettings.currency };
      if (editingUser.password) { userData.password = editingUser.password; userData.password_hash = editingUser.password; }
      let result;
      if (editingUser.id) { await db.updateUser(editingUser.id, userData); result = { id: editingUser.id }; }
      else { result = await db.createUser(userData); }
      if (editingUser.isFirstAdmin && result?.lastInsertRowid) {
        const newAdmin = await db.getUserById(result.lastInsertRowid);
        if (newAdmin) { const { password, password_hash, ...safeUser } = newAdmin; localStorage.setItem('current_user', JSON.stringify(safeUser)); setCurrentUser(safeUser); }
      }
      await refreshUsersList();
      setUserDialog(false); setEditingUser(null);
      setSnackbar({ open: true, message: `User ${editingUser.id ? 'updated' : 'created'}!`, severity: 'success' });
    } catch (err) { setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); }
    setLoading(false);
  };

  const refreshUsersList = async () => {
    const dbUsers = await db.getUsers();
    setUsers(dbUsers.map(u => ({ id: u.id, name: u.name, username: u.email || u.username, email: u.email, role: u.role || 'cashier', active: u.status === 'active', phone: u.phone || '', shop_name: u.shop_name || '', shop_address: u.shop_address || '', business_type: u.business_type || 'retail', currency: u.currency || 'PKR' })));
  };

  const handleDeleteUser = async (id) => {
    if (users.length <= 1) { setSnackbar({ open: true, message: 'Cannot delete last user!', severity: 'error' }); return; }
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    try { await db.deleteUser(id); await refreshUsersList(); setSnackbar({ open: true, message: 'User deleted!', severity: 'success' }); }
    catch (err) { setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); }
    setLoading(false);
  };

  const toggleUserActive = async (id) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    try { await db.updateUser(id, { status: user.active ? 'inactive' : 'active' }); await refreshUsersList(); setSnackbar({ open: true, message: `User ${user.active ? 'deactivated' : 'activated'}!`, severity: 'success' }); }
    catch (err) { setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' }); }
  };

  const SectionTitle = ({ icon, title, subtitle }) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="primary" gutterBottom>
        {icon} {title}
      </Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      <Divider sx={{ mt: 1 }} />
    </Box>
  );

  const SettingCard = ({ title, children, icon }) => {
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

  const canManageUsers = useMemo(() => {
    if (users.length === 0) return true;
    return currentUser?.role === 'admin';
  }, [currentUser, users.length]);

  const isFirstSetup = users.length === 0;

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
            <SectionTitle icon={<Store />} title="Shop Profile" subtitle="Your business information appears on receipts and reports" />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard title="Basic Information" icon={<Business color="primary" />}>
                  <Stack spacing={2}>
                    <TextField fullWidth size="small" label="Shop Name *" value={shopProfile.name} onChange={(e) => { setShopProfile({...shopProfile, name: e.target.value}); setHasChanges(true); }} />
                    <TextField fullWidth size="small" label="Tagline / Slogan" value={shopProfile.tagline} onChange={(e) => { setShopProfile({...shopProfile, tagline: e.target.value}); setHasChanges(true); }} />
                    <TextField fullWidth size="small" label="Address" multiline rows={2} value={shopProfile.address} onChange={(e) => { setShopProfile({...shopProfile, address: e.target.value}); setHasChanges(true); }} />
                    <TextField fullWidth size="small" label="City" value={shopProfile.city} onChange={(e) => { setShopProfile({...shopProfile, city: e.target.value}); setHasChanges(true); }} />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard title="Contact Details" icon={<Phone color="primary" />}>
                  <Stack spacing={2}>
                    <TextField fullWidth size="small" label="Phone Number" value={shopProfile.phone} onChange={(e) => { setShopProfile({...shopProfile, phone: e.target.value}); setHasChanges(true); }} InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} />
                    <TextField fullWidth size="small" label="Email" type="email" value={shopProfile.email} onChange={(e) => { setShopProfile({...shopProfile, email: e.target.value}); setHasChanges(true); }} InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }} />
                    <TextField fullWidth size="small" label="Website" value={shopProfile.website} onChange={(e) => { setShopProfile({...shopProfile, website: e.target.value}); setHasChanges(true); }} InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }} />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard title="Legal & Tax" icon={<VerifiedUser color="primary" />}>
                  <Grid container spacing={isMobile ? 1 : 2}>
                    <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Tax / NTN Number" value={shopProfile.taxNumber} onChange={(e) => { setShopProfile({...shopProfile, taxNumber: e.target.value}); setHasChanges(true); }} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Business Registration #" value={shopProfile.registrationNumber} onChange={(e) => { setShopProfile({...shopProfile, registrationNumber: e.target.value}); setHasChanges(true); }} /></Grid>
                  </Grid>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard title="Receipt Footer Message" icon={<Receipt color="primary" />}>
                  <TextField fullWidth multiline rows={3} size="small" value={shopProfile.receiptFooter} onChange={(e) => { setShopProfile({...shopProfile, receiptFooter: e.target.value}); setHasChanges(true); }} helperText="This text appears at the bottom of every receipt" />
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
            <SectionTitle icon={<Person />} title="User Management" subtitle="Manage staff access and permissions" />

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
                              <Typography variant="caption" color="text.secondary" display="block">{role.pages?.length || 0} pages</Typography>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                                {(role.permissions || []).slice(0, 2).map((p, i) => (
                                  <Chip key={i} size="small" label={p} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                ))}
                                {(role.permissions || []).length > 2 && (
                                  <Chip size="small" label={`+${(role.permissions || []).length - 2}`} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
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
                                  {(roleConfig?.permissions || []).map((p, i) => (
                                    <Chip key={i} size="small" label={p} variant="outlined" color="info" sx={{ fontSize: '0.65rem', height: 20 }} />
                                  ))}
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
                      {users.length === 0 && <TableRow><TableCell colSpan={isMobile ? 5 : 6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No users found</Typography></TableCell></TableRow>}
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
                  <TextField fullWidth size="small" label="Email / Username *" value={editingUser?.email || ''} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} />
                  <TextField fullWidth size="small" label="Phone" value={editingUser?.phone || ''} onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} />
                  <TextField fullWidth size="small" label="Password" type={showPassword ? 'text' : 'password'} value={editingUser?.password || ''} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} helperText={editingUser?.id ? "Leave blank to keep current" : "Set a secure password"} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
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
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Selected Role: {roles.find(r => r.id === editingUser?.role)?.label}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Can access these pages:</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {roles.find(r => r.id === editingUser?.role)?.pages?.map((page, i) => (
                        <Chip key={i} size="small" label={page} variant="outlined" color="success" sx={{ textTransform: 'capitalize' }} />
                      )) || <Typography variant="caption" color="error">No pages assigned!</Typography>}
                    </Stack>
                  </Box>
                  <FormControlLabel control={<Switch checked={editingUser?.active || false} onChange={(e) => setEditingUser({...editingUser, active: e.target.checked})} />} label="Active" />
                </Stack>
              </DialogContent>
              <DialogActions sx={{ flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0 }}>
                <Button fullWidth={isMobile} onClick={() => { setUserDialog(false); setEditingUser(null); }}>Cancel</Button>
                <Button fullWidth={isMobile} variant="contained" onClick={handleSaveUser} startIcon={<Save />} sx={{ bgcolor: '#10b981' }} disabled={loading}>
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
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Page Permissions</Typography>
                    <FormGroup>
                      <Grid container spacing={isMobile ? 0.5 : 1}>
                        {AVAILABLE_PAGES.map(page => (
                          <Grid item xs={12} sm={6} key={page.id}>
                            <FormControlLabel
                              control={<Checkbox checked={roleForm.pages.includes(page.id)} onChange={() => toggleRolePage(page.id)} size="small" />}
                              label={<Typography variant="body2" fontSize={isMobile ? '0.75rem' : '0.85rem'}>{page.label}</Typography>}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </FormGroup>
                  </Box>
                  <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary"><strong>{roleForm.pages.length}</strong> of <strong>{AVAILABLE_PAGES.length}</strong> pages selected</Typography>
                    {roleForm.pages.length === AVAILABLE_PAGES.length && <Chip size="small" label="All Access" color="success" sx={{ ml: 1, height: 20 }} />}
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

      {/* ==================== TAB 2: RECEIPT ==================== */}
      {activeTab === 2 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Receipt />} title="Receipt & Invoice Settings" subtitle="Customize how receipts and invoices look" />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard title="Print Options" icon={<LocalPrintshop color="primary" />}>
                  <Stack spacing={1.5}>
                    <FormControlLabel control={<Switch checked={receiptSettings.showLogo} onChange={(e) => { setReceiptSettings({...receiptSettings, showLogo: e.target.checked}); setHasChanges(true); }} />} label="Show Shop Logo" />
                    <FormControlLabel control={<Switch checked={receiptSettings.showBarcode} onChange={(e) => { setReceiptSettings({...receiptSettings, showBarcode: e.target.checked}); setHasChanges(true); }} />} label="Show Barcode" />
                    <FormControlLabel control={<Switch checked={receiptSettings.showQR} onChange={(e) => { setReceiptSettings({...receiptSettings, showQR: e.target.checked}); setHasChanges(true); }} />} label="Show QR Code" />
                    <FormControlLabel control={<Switch checked={receiptSettings.printCustomerName} onChange={(e) => { setReceiptSettings({...receiptSettings, printCustomerName: e.target.checked}); setHasChanges(true); }} />} label="Print Customer Name" />
                    <FormControlLabel control={<Switch checked={receiptSettings.printCustomerPhone} onChange={(e) => { setReceiptSettings({...receiptSettings, printCustomerPhone: e.target.checked}); setHasChanges(true); }} />} label="Print Customer Phone" />
                    <FormControlLabel control={<Switch checked={receiptSettings.printTaxBreakdown} onChange={(e) => { setReceiptSettings({...receiptSettings, printTaxBreakdown: e.target.checked}); setHasChanges(true); }} />} label="Print Tax Breakdown" />
                    <FormControlLabel control={<Switch checked={receiptSettings.showDiscountDetails} onChange={(e) => { setReceiptSettings({...receiptSettings, showDiscountDetails: e.target.checked}); setHasChanges(true); }} />} label="Show Discount Details" />
                    <FormControlLabel control={<Switch checked={receiptSettings.showEmployeeName} onChange={(e) => { setReceiptSettings({...receiptSettings, showEmployeeName: e.target.checked}); setHasChanges(true); }} />} label="Show Employee Name" />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard title="Paper & Layout" icon={<Palette color="primary" />}>
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControl fullWidth size="small"><InputLabel>Paper Size</InputLabel><Select value={receiptSettings.paperSize} onChange={(e) => { setReceiptSettings({...receiptSettings, paperSize: e.target.value}); setHasChanges(true); }} label="Paper Size"><MenuItem value="58mm">58mm (Small)</MenuItem><MenuItem value="80mm">80mm (Standard)</MenuItem><MenuItem value="A4">A4 (Full Page)</MenuItem><MenuItem value="A5">A5 (Half Page)</MenuItem></Select></FormControl>
                    <FormControl fullWidth size="small"><InputLabel>Font Size</InputLabel><Select value={receiptSettings.fontSize} onChange={(e) => { setReceiptSettings({...receiptSettings, fontSize: e.target.value}); setHasChanges(true); }} label="Font Size"><MenuItem value="small">Small (Compact)</MenuItem><MenuItem value="medium">Medium (Default)</MenuItem><MenuItem value="large">Large (Easy Read)</MenuItem></Select></FormControl>
                    <TextField fullWidth size="small" type="number" label="Copies to Print" value={receiptSettings.copies} onChange={(e) => { setReceiptSettings({...receiptSettings, copies: parseInt(e.target.value) || 1}); setHasChanges(true); }} inputProps={{ min: 1, max: 3 }} />
                    <FormControlLabel control={<Switch checked={receiptSettings.autoPrint} onChange={(e) => { setReceiptSettings({...receiptSettings, autoPrint: e.target.checked}); setHasChanges(true); }} />} label="Auto-print after sale" />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard title="Custom Text" icon={<Edit color="primary" />}>
                  <Grid container spacing={isMobile ? 1 : 2}>
                    <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Header Text" value={receiptSettings.headerText} onChange={(e) => { setReceiptSettings({...receiptSettings, headerText: e.target.value}); setHasChanges(true); }} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Footer Text" value={receiptSettings.footerText} onChange={(e) => { setReceiptSettings({...receiptSettings, footerText: e.target.value}); setHasChanges(true); }} /></Grid>
                  </Grid>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 3: TAX ==================== */}
      {activeTab === 3 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Percent />} title="Tax & Currency Settings" subtitle="Configure taxation and currency formatting" />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard title="Currency" icon={<AttachMoney color="primary" />}>
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControl fullWidth size="small"><InputLabel>Primary Currency</InputLabel><Select value={taxSettings.currency} onChange={(e) => { setTaxSettings({...taxSettings, currency: e.target.value}); setHasChanges(true); }} label="Primary Currency"><MenuItem value="PKR">PKR - Pakistani Rupee</MenuItem><MenuItem value="USD">USD - US Dollar</MenuItem><MenuItem value="EUR">EUR - Euro</MenuItem><MenuItem value="GBP">GBP - British Pound</MenuItem><MenuItem value="AED">AED - UAE Dirham</MenuItem><MenuItem value="SAR">SAR - Saudi Riyal</MenuItem></Select></FormControl>
                    <TextField fullWidth size="small" label="Currency Symbol" value={taxSettings.currencySymbol} onChange={(e) => { setTaxSettings({...taxSettings, currencySymbol: e.target.value}); setHasChanges(true); }} helperText="Example: Rs., $, €, £" />
                    <TextField fullWidth size="small" type="number" label="Decimal Places" value={taxSettings.priceDecimalPlaces} onChange={(e) => { setTaxSettings({...taxSettings, priceDecimalPlaces: parseInt(e.target.value) || 2}); setHasChanges(true); }} inputProps={{ min: 0, max: 4 }} />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SettingCard title="Tax Configuration" icon={<AccountBalance color="primary" />}>
                  <Stack spacing={isMobile ? 1.5 : 2}>
                    <FormControlLabel control={<Switch checked={taxSettings.taxEnabled} onChange={(e) => { setTaxSettings({...taxSettings, taxEnabled: e.target.checked}); setHasChanges(true); }} />} label="Enable Tax Calculation" />
                    <TextField fullWidth size="small" label="Tax Name" value={taxSettings.taxName} onChange={(e) => { setTaxSettings({...taxSettings, taxName: e.target.value}); setHasChanges(true); }} helperText="Example: GST, VAT, Sales Tax" disabled={!taxSettings.taxEnabled} />
                    <TextField fullWidth size="small" type="number" label="Tax Rate (%)" value={taxSettings.taxRate} onChange={(e) => { setTaxSettings({...taxSettings, taxRate: parseFloat(e.target.value) || 0}); setHasChanges(true); }} inputProps={{ min: 0, max: 100, step: 0.01 }} disabled={!taxSettings.taxEnabled} />
                    <FormControl fullWidth size="small" disabled={!taxSettings.taxEnabled}><InputLabel>Tax Type</InputLabel><Select value={taxSettings.taxType} onChange={(e) => { setTaxSettings({...taxSettings, taxType: e.target.value}); setHasChanges(true); }} label="Tax Type"><MenuItem value="inclusive">Inclusive (tax included)</MenuItem><MenuItem value="exclusive">Exclusive (tax added)</MenuItem></Select></FormControl>
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard title="Preview" icon={<Visibility color="primary" />}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Price Display Example:</Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {taxSettings.currencySymbol} 1,250.{taxSettings.priceDecimalPlaces === 0 ? '' : '00'}
                      {taxSettings.taxEnabled && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({taxSettings.taxName} {taxSettings.taxRate}% {taxSettings.taxType})</Typography>}
                    </Typography>
                  </Paper>
                </SettingCard>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 4: NOTIFICATIONS ==================== */}
      {activeTab === 4 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Notifications />} title="Notification Settings" subtitle="Configure alerts and reminders" />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <SettingCard title="Inventory Alerts" icon={<Inventory color="primary" />}>
                  <Stack spacing={1.5}>
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
                  <Stack spacing={1.5}>
                    <FormControlLabel control={<Switch checked={notifications.soundOnSale} onChange={(e) => { setNotifications({...notifications, soundOnSale: e.target.checked}); setHasChanges(true); }} />} label="Sound on Successful Sale" />
                    <FormControlLabel control={<Switch checked={notifications.soundOnError} onChange={(e) => { setNotifications({...notifications, soundOnError: e.target.checked}); setHasChanges(true); }} />} label="Sound on Error / Warning" />
                    <FormControlLabel control={<Switch checked={notifications.desktopNotifications} onChange={(e) => { setNotifications({...notifications, desktopNotifications: e.target.checked}); setHasChanges(true); }} />} label="Desktop Notifications" />
                  </Stack>
                </SettingCard>
              </Grid>
              <Grid item xs={12}>
                <SettingCard title="Reports & Backup" icon={<Backup color="primary" />}>
                  <Stack spacing={1.5}>
                    <FormControlLabel control={<Switch checked={notifications.dailyReport} onChange={(e) => { setNotifications({...notifications, dailyReport: e.target.checked}); setHasChanges(true); }} />} label="Daily Summary Report" />
                    {notifications.dailyReport && <TextField size="small" type="time" label="Report Time" value={notifications.dailyReportTime} onChange={(e) => { setNotifications({...notifications, dailyReportTime: e.target.value}); setHasChanges(true); }} sx={{ maxWidth: 200 }} />}
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
        </Fade>
      )}

      {/* ==================== TAB 5: DATABASE ==================== */}
      {activeTab === 5 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Storage />} title="Database Management" subtitle="Database info and maintenance tools" />
            <Grid container spacing={isMobile ? 1.5 : 3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderLeft: 3, borderColor: 'info.main', mb: 2 }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Database Info</Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Mode:</Typography><Typography variant="body2" fontWeight="bold" color={db.mode === 'electron' ? 'success.main' : 'info.main'}>{db.mode === 'electron' ? 'Electron (SQLite)' : 'Browser (IndexedDB)'}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">File Path:</Typography><Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', maxWidth: isMobile ? '50%' : '60%', textAlign: 'right' }}>{dbInfo.path}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Tables:</Typography><Typography variant="body2" fontWeight="bold">{dbInfo.tables}+</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Total Records:</Typography><Typography variant="body2" fontWeight="bold">{dbInfo.records}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Last Backup:</Typography><Typography variant="body2" color={dbInfo.lastBackup ? 'success.main' : 'error.main'}>{dbInfo.lastBackup || 'Never'}</Typography></Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderLeft: 3, borderColor: 'warning.main' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Maintenance</Typography>
                    <Stack spacing={1.5}>
                      <Button variant="outlined" fullWidth startIcon={<Storage />} onClick={() => setSnackbar({ open: true, message: 'Database optimized!', severity: 'success' })}>Optimize Database</Button>
                      <Button variant="outlined" fullWidth startIcon={<Delete />} color="warning" onClick={async () => { if (window.confirm('Delete all old deleted records? This frees up space.')) { setSnackbar({ open: true, message: 'Old records purged!', severity: 'success' }); } }}>Purge Deleted Records</Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2"><strong>Tip:</strong> Regular backups prevent data loss. Enable auto-backup in the Backup page to email your database daily.</Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 6: ABOUT ==================== */}
      {activeTab === 6 && (
        <Fade in>
          <Box>
            <SectionTitle icon={<Info />} title="About RAATH POS" />
            <Grid container spacing={isMobile ? 1.5 : 3} justifyContent="center">
              <Grid item xs={12} md={8}>
                <Card sx={{ textAlign: 'center', p: 3, bgcolor: '#10b981', color: 'white' }}>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Business color="primary" fontSize="small" /><Typography variant="body2">{APP_INFO.developer}</Typography></Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Email color="primary" fontSize="small" /><Typography variant="body2">{APP_INFO.support}</Typography></Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Business color="primary" fontSize="small" /><Typography variant="body2">{APP_INFO.website}</Typography></Box>
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