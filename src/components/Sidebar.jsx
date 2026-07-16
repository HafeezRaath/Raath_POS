import {
  AccountBalance, Assessment,
  AssignmentReturn,
  AttachMoney,
  Build,  // <-- NAYA: Services icon
  Category,
  Close,
  CloudUpload,
  Dashboard,
  Group,
  History,
  HomeRepairService,  // <-- NAYA: Alternative services icon
  Inventory,
  KeyboardArrowDown,
  LocalShipping,
  Logout,
  Menu as MenuIcon,
  MoneyOff,
  Notifications,
  Payment, People,
  Person,
  PointOfSale, ReceiptLong,
  Refresh,
  Search,
  Security,
  Settings,
  ShoppingCart,
  Store,
  TrackChanges
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  alpha, styled,
  useMediaQuery,
  useTheme
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// ==================== FIX #1: Sync versions import karo ====================
import { getRoleColorSync, getRoleLabelSync } from '../role';

// ==================== PATH PERMISSION MAP ====================
const PATH_PERMISSION_MAP = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/billing': 'pos',
  '/pos': 'pos',
  '/sales-history': 'sales',
  '/sales': 'sales',
  '/returns': 'sales',
  '/products': 'products',
  '/inventory': 'inventory',
  '/stock-tracking': 'inventory',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/services': 'services',        // <-- NAYA
  '/emi': 'emi',
  '/expenses': 'expenses',
  '/recovery': 'customers',
  '/accounts': 'reports',
  '/reports': 'reports',
  '/history': 'reports',
  '/purchases': 'purchases',
  '/users': 'users',
  '/backup': 'backup',
  '/settings': 'settings',
};

// ==================== UNIFIED NAV STRUCTURE ====================
const NAV_GROUPS = [
  {
    key: 'invoices',
    label: 'Invoices',
    icon: <ReceiptLong fontSize="small" />,
    items: [
      { id: 'pos', label: 'New Bill', icon: <PointOfSale fontSize="small" />, path: '/billing' },
      { id: 'sales', label: 'Sales History', icon: <ReceiptLong fontSize="small" />, path: '/sales-history' },
      { id: 'sales', label: 'Returns', icon: <AssignmentReturn fontSize="small" />, path: '/returns' },
    ]
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: <Inventory fontSize="small" />,
    items: [
      { id: 'products', label: 'Products', icon: <Category fontSize="small" />, path: '/products' },
      { id: 'inventory', label: 'Inventory', icon: <Inventory fontSize="small" />, path: '/inventory' },
      { id: 'inventory', label: 'Stock Tracking', icon: <TrackChanges fontSize="small" />, path: '/stock-tracking' },
    ]
  },
  {
    key: 'people',
    label: 'People',
    icon: <People fontSize="small" />,
    items: [
      { id: 'customers', label: 'Customers', icon: <People fontSize="small" />, path: '/customers' },
      { id: 'suppliers', label: 'Suppliers', icon: <LocalShipping fontSize="small" />, path: '/suppliers' },
      { id: 'emi', label: 'EMI System', icon: <Payment fontSize="small" />, path: '/emi' },
    ]
  },
  {
    key: 'services',  // <-- NAYA: Services Group
    label: 'Services',
    icon: <Build fontSize="small" />,
    items: [
      { id: 'services', label: 'Work Orders', icon: <HomeRepairService fontSize="small" />, path: '/services' },
    ]
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: <AttachMoney fontSize="small" />,
    items: [
      { id: 'expenses', label: 'Expenses', icon: <MoneyOff fontSize="small" />, path: '/expenses' },
      { id: 'customers', label: 'Recovery', icon: <AttachMoney fontSize="small" />, path: '/recovery' },
      { id: 'reports', label: 'Accounts', icon: <AccountBalance fontSize="small" />, path: '/accounts' },
    ]
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: <Assessment fontSize="small" />,
    items: [
      { id: 'reports', label: 'Reports', icon: <Assessment fontSize="small" />, path: '/reports' },
      { id: 'reports', label: 'History', icon: <History fontSize="small" />, path: '/history' },
    ]
  },
  {
    key: 'system',
    label: 'System',
    icon: <Settings fontSize="small" />,
    items: [
      { id: 'users', label: 'User Management', icon: <Group fontSize="small" />, path: '/users' },
      { id: 'backup', label: 'Backup', icon: <CloudUpload fontSize="small" />, path: '/backup' },
      { id: 'settings', label: 'Settings', icon: <Settings fontSize="small" />, path: '/settings' },
    ]
  },
];

const allPaths = [
  { path: '/', label: 'Dashboard' },
  { path: '/dashboard', label: 'Dashboard' },
  ...NAV_GROUPS.flatMap(g => g.items),
];

// ==================== STYLED COMPONENTS ====================
const SearchBar = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 20,
  backgroundColor: alpha(theme.palette.common.white, 0.12),
  '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.2) },
  marginLeft: theme.spacing(2),
  marginRight: theme.spacing(2),
  width: '100%',
  maxWidth: 360,
  border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
  transition: 'all 0.3s ease',
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: alpha(theme.palette.common.white, 0.6),
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    width: '100%',
    fontSize: '0.9rem',
    '&::placeholder': { color: alpha(theme.palette.common.white, 0.5), opacity: 1 },
  },
}));

// ==================== COMPONENT ====================
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user: authUser, checkPermissionSync, rolePermissions } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [localUser, setLocalUser] = useState(null);

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem('current_user');
        setLocalUser(saved ? JSON.parse(saved) : null);
      } catch (e) { console.error('Error loading from storage:', e); }
    };
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const currentUser = authUser || localUser;
  const userRole = currentUser?.role || '';
  const userName = currentUser?.name || 'Guest';
  const userEmail = currentUser?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  // ==================== FIX #2: canAccess mein currentUser fallback add karo ====================
  const canAccess = useCallback((permId) => {
    const authResult = checkPermissionSync(permId);
    if (authResult) return true;

    if (!currentUser?.role) return false;
    if (currentUser.role === 'admin') return true;

    try {
      const storedPerms = localStorage.getItem('pos_permissions');
      if (storedPerms) {
        const perms = JSON.parse(storedPerms);
        return perms[currentUser.role]?.includes(permId) || false;
      }
    } catch (e) {}

    return false;
  }, [checkPermissionSync, currentUser]);

  const canAccessPath = useCallback((path) => canAccess(PATH_PERMISSION_MAP[path] || ''), [canAccess]);

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);
  const isGroupActive = useCallback((items) => items.some(item => isActive(item.path)), [isActive]);

  const [anchors, setAnchors] = useState({
    invoices: null, inventory: null, people: null, services: null,  // <-- NAYA: services anchor
    finance: null, reports: null, system: null,
    profile: null, notif: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const openMenu = useCallback((key, event) => {
    setAnchors(prev => ({ ...prev, [key]: event.currentTarget }));
  }, []);

  const closeMenu = useCallback((key) => {
    setAnchors(prev => ({ ...prev, [key]: null }));
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    closeMenu('profile');
    localStorage.removeItem('current_user');
    localStorage.removeItem('pos_user');
    setLocalUser(null);
    navigate('/login');
  }, [logout, closeMenu, navigate]);

  // ==================== REFRESH FUNCTION ====================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      window.location.reload();
    } catch (e) {
      console.error('Refresh error:', e);
      setRefreshing(false);
    }
  }, []);

  // ==================== FIX #3: Sync versions use karo (showLabel error fix) ====================
  const roleColor = useMemo(() => getRoleColorSync(userRole), [userRole]);
  const roleLabel = useMemo(() => getRoleLabelSync(userRole), [userRole]);

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => canAccess(item.id))
    })).filter(group => group.items.length > 0);
  }, [canAccess]);

  const currentPage = useMemo(() => 
    allPaths.find(p => isActive(p.path))?.label || 'Dashboard',
  [isActive]);

  const mobileGroups = useMemo(() => {
    const dashboardGroup = {
      title: 'DASHBOARD',
      items: [{ id: 'dashboard', icon: <Dashboard fontSize="small" />, label: 'Dashboard', path: '/' }]
    };
    return [
      dashboardGroup,
      ...filteredGroups.map(g => ({
        title: g.label.toUpperCase(),
        items: g.items
      }))
    ].filter(g => g.items.length > 0);
  }, [filteredGroups]);

  const mobileDrawerContent = useMemo(() => (
    <Box sx={{ width: 300, bgcolor: 'background.paper', height: '100%' }}>
      <Box sx={{ p: 2.5, bgcolor: '#1a237e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Store fontSize="large" />
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>RAATH</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>POS SYSTEM</Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: 'inherit' }}><Close /></IconButton>
      </Box>

      {currentUser && (
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.main, fontSize: '1rem' }}>
              {userInitial}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight="bold">{userName}</Typography>
              <Chip size="small" label={roleLabel} color={roleColor} sx={{ height: 20, fontSize: '0.65rem' }} />
            </Box>
          </Box>
        </Box>
      )}

      <Divider />
      <Box sx={{ p: 2, pb: 0 }}>
        {canAccess('pos') && (
          <Button fullWidth variant="contained" color="success" component={Link} to="/billing" onClick={() => setMobileMenuOpen(false)} startIcon={<PointOfSale />} sx={{ mb: 1, py: 1.2, fontWeight: 'bold', borderRadius: 2 }}>
            New Bill
          </Button>
        )}
      </Box>
      <List dense sx={{ pt: 1 }}>
        {mobileGroups.map((group, gIdx) => (
          <React.Fragment key={group.title}>
            {gIdx > 0 && <Divider sx={{ my: 1 }} />}
            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.5px' }}>
              {group.title}
            </Typography>
            {group.items.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  selected={isActive(item.path)}
                  sx={{ borderRadius: 1, mx: 1, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' } }}
                >
                  <ListItemIcon sx={{ color: isActive(item.path) ? 'inherit' : 'text.secondary', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '14px' } } }} />
                </ListItemButton>
              </ListItem>
            ))}
          </React.Fragment>
        ))}
      </List>
    </Box>
  ), [currentUser, userRole, userName, userInitial, theme, canAccess, isActive, mobileGroups, roleColor, roleLabel]);

  const renderDropdown = useCallback((group) => {
    if (group.items.length === 0) return null;
    const key = group.key;
    return (
      <React.Fragment key={key}>
        <Button
          onClick={(e) => openMenu(key, e)}
          endIcon={<KeyboardArrowDown fontSize="small" />}
          startIcon={group.icon}
          size="small"
          sx={{
            color: isGroupActive(group.items) ? '#fff' : alpha('#fff', 0.8),
            bgcolor: isGroupActive(group.items) ? alpha('#fff', 0.15) : 'transparent',
            fontWeight: isGroupActive(group.items) ? 700 : 500,
            px: 1.5, py: 0.6, borderRadius: 2, textTransform: 'none', fontSize: '0.8rem',
            '&:hover': { bgcolor: isGroupActive(group.items) ? alpha('#fff', 0.2) : alpha('#fff', 0.1) },
            transition: 'all 0.2s',
          }}
        >
          {group.label}
        </Button>
        <Menu
          anchorEl={anchors[key]}
          open={Boolean(anchors[key])}
          onClose={() => closeMenu(key)}
          slotProps={{ paper: { sx: { width: 220, mt: 1.5, borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', py: 1 } } }}
          transformOrigin={{ horizontal: 'left', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        >
          {group.items.map((item) => (
            <MenuItem
              key={item.path}
              component={Link}
              to={item.path}
              onClick={() => closeMenu(key)}
              selected={isActive(item.path)}
              sx={{ py: 0.9, px: 2, borderRadius: 1, mx: 1, mb: 0.3, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 600 } }}
            >
              <Box sx={{ color: isActive(item.path) ? 'primary.main' : 'text.secondary', mr: 1.5, display: 'flex' }}>
                {item.icon}
              </Box>
              <Typography variant="body2" fontWeight={isActive(item.path) ? 600 : 400}>{item.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </React.Fragment>
    );
  }, [anchors, openMenu, closeMenu, isActive, isGroupActive, theme]);

  return (
    <>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: '#1a237e', background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: 64, px: { xs: 1, sm: 2 } }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileMenuOpen(true)} sx={{ mr: 1.5, '&:hover': { bgcolor: alpha('#fff', 0.1) } }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: { xs: 1, md: 3 } }}>
            <Store sx={{ fontSize: 30, mr: 1, color: '#82b1ff' }} />
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '0.5px', fontSize: '1.25rem' }}>RAATH</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', lineHeight: 1, fontSize: '0.65rem', letterSpacing: '1.5px' }}>POS SYSTEM</Typography>
            </Box>
          </Box>

          {/* DESKTOP NAV */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, justifyContent: 'center' }}>
              {canAccess('dashboard') && (
                <Button component={Link} to="/" startIcon={<Dashboard fontSize="small" />} size="small" sx={{ color: isActive('/') ? '#fff' : alpha('#fff', 0.75), bgcolor: isActive('/') ? alpha('#fff', 0.15) : 'transparent', fontWeight: isActive('/') ? 700 : 500, px: 1.5, py: 0.6, borderRadius: 2, textTransform: 'none', fontSize: '0.8rem', '&:hover': { bgcolor: isActive('/') ? alpha('#fff', 0.2) : alpha('#fff', 0.1) }, transition: 'all 0.2s' }}>
                  Dashboard
                </Button>
              )}
              {filteredGroups.map(group => renderDropdown(group))}
            </Box>
          )}

          {!isMobile && (
            <SearchBar>
              <SearchIconWrapper><Search fontSize="small" /></SearchIconWrapper>
              <StyledInputBase placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </SearchBar>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            {!isMobile && canAccess('pos') && (
              <Tooltip title="Quick New Bill">
                <Button variant="contained" size="small" component={Link} to="/billing" startIcon={<PointOfSale fontSize="small" />} sx={{ mr: 1.5, bgcolor: '#00c853', fontWeight: 'bold', textTransform: 'none', borderRadius: 2, px: 2, boxShadow: '0 4px 12px rgba(0,200,83,0.3)', '&:hover': { bgcolor: '#00e676', boxShadow: '0 6px 16px rgba(0,200,83,0.4)', transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>
                  Bill
                </Button>
              </Tooltip>
            )}
            <Tooltip title={refreshing ? "Refreshing..." : "Refresh App"}>
              <IconButton 
                color="inherit" 
                onClick={handleRefresh} 
                disabled={refreshing}
                sx={{ 
                  color: refreshing ? alpha('#fff', 0.4) : alpha('#fff', 0.8), 
                  '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.1) },
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  }
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton color="inherit" onClick={(e) => openMenu('notif', e)} sx={{ color: alpha('#fff', 0.8), '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.1) } }}>
                <Badge badgeContent={3} color="error" variant="dot"><Notifications fontSize="small" /></Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Account">
              <IconButton onClick={(e) => openMenu('profile', e)} size="small" sx={{ ml: 0.5 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#82b1ff', color: '#1a237e', fontSize: '0.9rem', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.3)' }}>
                  {userInitial}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>

        {/* BOTTOM STATUS BAR */}
        {!isMobile && (
          <Box sx={{ px: 2, py: 0.4, bgcolor: alpha('#000', 0.15), borderTop: `1px solid ${alpha('#fff', 0.08)}`, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>📍</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.3px' }}>{currentPage}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.15), height: 14 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#69f0ae' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#69f0ae' }}>Store Open</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.15), height: 14 }} />
            <Typography variant="caption" sx={{ opacity: 0.7 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Typography>
            {currentUser && (
              <>
                <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.15), height: 14 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Security fontSize="small" sx={{ fontSize: '0.8rem', color: '#69f0ae' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#69f0ae' }}>
                    {roleLabel}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </AppBar>

      {/* Notifications Menu */}
      <Menu anchorEl={anchors.notif} open={Boolean(anchors.notif)} onClose={() => closeMenu('notif')} slotProps={{ paper: { sx: { width: 320, mt: 1.5, borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' } } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle2" fontWeight="bold">Notifications</Typography>
          <Typography variant="caption" color="text.secondary">3 new alerts</Typography>
        </Box>
        {[
          { title: 'Low Stock Alert', desc: 'Samsung S24 Ultra - Only 2 left', time: '2 min ago', color: '#e53935' },
          { title: 'Payment Due', desc: 'Ahmed Khan - PKR 45,000 overdue', time: '1 hour ago', color: '#fb8c00' },
          { title: 'New Sale', desc: 'Invoice #INV-0042 - PKR 125,000', time: '3 hours ago', color: '#43a047' },
        ].map((notif, i) => (
          <MenuItem key={i} sx={{ py: 1.5, px: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: notif.color, mt: 0.8, mr: 1.5, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.3 }}>{notif.title}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{notif.desc}</Typography>
              <Typography variant="caption" color="primary" sx={{ fontSize: '0.7rem' }}>{notif.time}</Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem sx={{ justifyContent: 'center', py: 1 }}>
          <Typography variant="caption" color="primary" fontWeight={600}>View All Notifications</Typography>
        </MenuItem>
      </Menu>

      {/* Profile Menu */}
      <Menu anchorEl={anchors.profile} open={Boolean(anchors.profile)} onClose={() => closeMenu('profile')} slotProps={{ paper: { sx: { width: 240, mt: 1.5, borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' } } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.primary.main, fontSize: '0.9rem' }}>
              {userInitial}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ lineHeight: 1.2 }}>{userName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{userEmail}</Typography>
            </Box>
          </Box>
          <Chip 
            size="small" 
            label={roleLabel} 
            color={roleColor}
            sx={{ height: 20, fontSize: '0.65rem', mt: 0.5 }} 
          />
        </Box>
        <Divider />
        <MenuItem onClick={() => closeMenu('profile')} sx={{ py: 1 }}>
          <Person fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">My Profile</Typography>
        </MenuItem>
        {canAccess('settings') && (
          <MenuItem component={Link} to="/settings" onClick={() => closeMenu('profile')} sx={{ py: 1 }}>
            <Settings fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
            <Typography variant="body2">Settings</Typography>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ py: 1, color: 'error.main' }}>
          <Logout fontSize="small" sx={{ mr: 1.5, color: 'inherit' }} />
          <Typography variant="body2">Logout</Typography>
        </MenuItem>
      </Menu>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} slotProps={{ root: { keepMounted: true } }}>
        {mobileDrawerContent}
      </Drawer>
    </>
  );
}