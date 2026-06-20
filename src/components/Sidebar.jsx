import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Dashboard, PointOfSale, ReceiptLong, AssignmentReturn,
  Category, Inventory, LocalShipping, Payment, People,
  MoneyOff, AttachMoney, AccountBalance, Assessment,
  TrackChanges, CloudUpload, History, Settings,
  Search, Notifications, KeyboardArrowDown,
  Menu as MenuIcon, Store, Close, Logout, Person
} from '@mui/icons-material';
import {
  AppBar, Toolbar, Typography, Box, IconButton,
  Button, Menu, MenuItem, InputBase, Badge,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, alpha, styled, useTheme, useMediaQuery,
  Avatar, Tooltip
} from '@mui/material';
import { useAuth } from '../AuthContext';

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

// ==================== NAV DATA ====================
const invoicesNav = [
  { path: '/billing', icon: <PointOfSale fontSize="small" />, label: 'New Bill' },
  { path: '/sales-history', icon: <ReceiptLong fontSize="small" />, label: 'Sales History' },
  { path: '/returns', icon: <AssignmentReturn fontSize="small" />, label: 'Returns' },
];

const inventoryNav = [
  { path: '/products', icon: <Category fontSize="small" />, label: 'Products' },
  { path: '/inventory', icon: <Inventory fontSize="small" />, label: 'Inventory' },
  { path: '/stock-tracking', icon: <TrackChanges fontSize="small" />, label: 'Stock Tracking' },
];

const peopleNav = [
  { path: '/customers', icon: <People fontSize="small" />, label: 'Customers' },
  { path: '/suppliers', icon: <LocalShipping fontSize="small" />, label: 'Suppliers' },
  { path: '/emi', icon: <Payment fontSize="small" />, label: 'EMI System' },
];

const financeNav = [
  { path: '/expenses', icon: <MoneyOff fontSize="small" />, label: 'Expenses' },
  { path: '/recovery', icon: <AttachMoney fontSize="small" />, label: 'Recovery' },
  { path: '/accounts', icon: <AccountBalance fontSize="small" />, label: 'Accounts' },
];

const reportsNav = [
  { path: '/reports', icon: <Assessment fontSize="small" />, label: 'Reports' },
  { path: '/history', icon: <History fontSize="small" />, label: 'History' },
];

const systemNav = [
  { path: '/backup', icon: <CloudUpload fontSize="small" />, label: 'Backup' },
  { path: '/settings', icon: <Settings fontSize="small" />, label: 'Settings' },
];

const allPaths = [
  { path: '/', label: 'Dashboard' },
  ...invoicesNav, ...inventoryNav, ...peopleNav,
  ...financeNav, ...reportsNav, ...systemNav
];

// ==================== COMPONENT ====================
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchors, setAnchors] = useState({
    invoices: null,
    inventory: null,
    people: null,
    finance: null,
    reports: null,
    system: null,
    profile: null,
    notif: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => location.pathname === path;
  const currentPage = allPaths.find(p => isActive(p.path))?.label || 'Dashboard';
  const isGroupActive = (items) => items.some(item => isActive(item.path));

  const openMenu = (key, event) => setAnchors(prev => ({ ...prev, [key]: event.currentTarget }));
  const closeMenu = (key) => setAnchors(prev => ({ ...prev, [key]: null }));

  const handleLogout = () => {
    logout();
    closeMenu('profile');
    navigate('/login');
  };

  // Mobile drawer
  const mobileDrawerContent = (
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
      <Divider />
      <Box sx={{ p: 2, pb: 0 }}>
        <Button fullWidth variant="contained" color="success" component={Link} to="/billing" onClick={() => setMobileMenuOpen(false)} startIcon={<PointOfSale />} sx={{ mb: 1, py: 1.2, fontWeight: 'bold', borderRadius: 2 }}>
          New Bill
        </Button>
      </Box>
      <List dense sx={{ pt: 1 }}>
        {[{ title: 'DASHBOARD', items: [{ path: '/', icon: <Dashboard fontSize="small" />, label: 'Dashboard' }] },
          { title: 'INVOICES', items: invoicesNav },
          { title: 'INVENTORY', items: inventoryNav },
          { title: 'PEOPLE', items: peopleNav },
          { title: 'FINANCE', items: financeNav },
          { title: 'REPORTS', items: reportsNav },
          { title: 'SYSTEM', items: systemNav }].map((group, gIdx) => (
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
                  sx={{
                    borderRadius: 1,
                    mx: 1,
                    mb: 0.5,
                    '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' }
                  }}
                >
                  <ListItemIcon sx={{ color: isActive(item.path) ? 'inherit' : 'text.secondary', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: { sx: { fontSize: '14px' } }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );

  // Dropdown renderer
  const renderDropdown = (key, items, label, icon) => (
    <>
      <Button
        onClick={(e) => openMenu(key, e)}
        endIcon={<KeyboardArrowDown fontSize="small" />}
        startIcon={icon}
        size="small"
        sx={{
          color: isGroupActive(items) ? '#fff' : alpha('#fff', 0.8),
          bgcolor: isGroupActive(items) ? alpha('#fff', 0.15) : 'transparent',
          fontWeight: isGroupActive(items) ? 700 : 500,
          px: 1.5, py: 0.6, borderRadius: 2, textTransform: 'none', fontSize: '0.8rem',
          '&:hover': { bgcolor: isGroupActive(items) ? alpha('#fff', 0.2) : alpha('#fff', 0.1) },
          transition: 'all 0.2s',
        }}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchors[key]}
        open={Boolean(anchors[key])}
        onClose={() => closeMenu(key)}
        slotProps={{
          paper: { sx: { width: 220, mt: 1.5, borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', py: 1 } }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.path}
            component={Link}
            to={item.path}
            onClick={() => closeMenu(key)}
            selected={isActive(item.path)}
            sx={{
              py: 0.9, px: 2, borderRadius: 1, mx: 1, mb: 0.3,
              '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 600 }
            }}
          >
            <Box sx={{ color: isActive(item.path) ? 'primary.main' : 'text.secondary', mr: 1.5, display: 'flex' }}>
              {item.icon}
            </Box>
            <Typography variant="body2" fontWeight={isActive(item.path) ? 600 : 400}>{item.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );

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
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, justifyContent: 'center' }}>
              <Button component={Link} to="/" startIcon={<Dashboard fontSize="small" />} size="small" sx={{ color: isActive('/') ? '#fff' : alpha('#fff', 0.75), bgcolor: isActive('/') ? alpha('#fff', 0.15) : 'transparent', fontWeight: isActive('/') ? 700 : 500, px: 1.5, py: 0.6, borderRadius: 2, textTransform: 'none', fontSize: '0.8rem', '&:hover': { bgcolor: isActive('/') ? alpha('#fff', 0.2) : alpha('#fff', 0.1) }, transition: 'all 0.2s' }}>
                Dashboard
              </Button>
              {renderDropdown('invoices', invoicesNav, 'Invoices', <ReceiptLong fontSize="small" />)}
              {renderDropdown('inventory', inventoryNav, 'Inventory', <Inventory fontSize="small" />)}
              {renderDropdown('people', peopleNav, 'People', <People fontSize="small" />)}
              {renderDropdown('finance', financeNav, 'Finance', <AttachMoney fontSize="small" />)}
              {renderDropdown('reports', reportsNav, 'Reports', <Assessment fontSize="small" />)}
              {renderDropdown('system', systemNav, 'System', <Settings fontSize="small" />)}
            </Box>
          )}
          {!isMobile && (
            <SearchBar>
              <SearchIconWrapper><Search fontSize="small" /></SearchIconWrapper>
              <StyledInputBase placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </SearchBar>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            {!isMobile && (
              <Tooltip title="Quick New Bill">
                <Button variant="contained" size="small" component={Link} to="/billing" startIcon={<PointOfSale fontSize="small" />} sx={{ mr: 1.5, bgcolor: '#00c853', fontWeight: 'bold', textTransform: 'none', borderRadius: 2, px: 2, boxShadow: '0 4px 12px rgba(0,200,83,0.3)', '&:hover': { bgcolor: '#00e676', boxShadow: '0 6px 16px rgba(0,200,83,0.4)', transform: 'translateY(-1px)' }, transition: 'all 0.2s' }}>
                  Bill
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Notifications">
              <IconButton color="inherit" onClick={(e) => openMenu('notif', e)} sx={{ color: alpha('#fff', 0.8), '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.1) } }}>
                <Badge badgeContent={3} color="error" variant="dot"><Notifications fontSize="small" /></Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Account">
              <IconButton onClick={(e) => openMenu('profile', e)} size="small" sx={{ ml: 0.5 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#82b1ff', color: '#1a237e', fontSize: '0.9rem', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.3)' }}>A</Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
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
      <Menu anchorEl={anchors.profile} open={Boolean(anchors.profile)} onClose={() => closeMenu('profile')} slotProps={{ paper: { sx: { width: 220, mt: 1.5, borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' } } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" fontWeight="bold">Admin User</Typography>
          <Typography variant="caption" color="text.secondary">admin@raathpos.com</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => closeMenu('profile')} sx={{ py: 1 }}>
          <Person fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">My Profile</Typography>
        </MenuItem>
        <MenuItem component={Link} to="/settings" onClick={() => closeMenu('profile')} sx={{ py: 1 }}>
          <Settings fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">Settings</Typography>
        </MenuItem>
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