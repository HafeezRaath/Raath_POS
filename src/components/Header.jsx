import React, { useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Search,
  Notifications,
  AccountCircle,
  KeyboardArrowDown,
  PointOfSale,
  Dashboard,
  ReceiptLong,
  AssignmentReturn,
  Category,
  Inventory,
  LocalShipping,
  Payment,
  People,
  MoneyOff,
  AttachMoney,
  AccountBalance,
  Assessment,
  TrackChanges,
  CloudUpload,
  History,
  Settings,
  Logout,
  Person,
  Store,
  Circle,
  Close,
  Home,
  ShoppingCart,
  Receipt
} from '@mui/icons-material';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button,
  Menu,
  MenuItem,
  InputBase,
  Badge,
  Avatar,
  Tooltip,
  alpha,
  styled,
  useTheme,
  Divider,
  useMediaQuery,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Dialog,
  Slide
} from '@mui/material';

// ==================== OPTIMIZED STYLES ====================
const SearchBar = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 20,
  backgroundColor: alpha(theme.palette.common.white, 0.12),
  '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.2) },
  marginLeft: theme.spacing(2),
  width: '100%',
  maxWidth: 320,
  border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
  [theme.breakpoints.down('sm')]: { maxWidth: '100%', marginLeft: 0 }
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  color: alpha(theme.palette.common.white, 0.6),
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(0.8, 1, 0.8, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    fontSize: '0.85rem',
    [theme.breakpoints.down('sm')]: { fontSize: '0.8rem', padding: theme.spacing(0.6, 1, 0.6, 0) }
  },
}));

// ==================== MEMOIZED NAV DATA ====================
const NAV_ITEMS = [
  { path: '/', icon: <Dashboard />, label: 'Dashboard' },
  { path: '/billing', icon: <PointOfSale />, label: 'Bill', highlight: true },
  { path: '/sales-history', icon: <ReceiptLong />, label: 'Sales' },
  { path: '/returns', icon: <AssignmentReturn />, label: 'Returns' },
];

const MORE_NAV = [
  { label: 'INVENTORY', items: [
    { path: '/products', icon: <Category />, label: 'Products' },
    { path: '/inventory', icon: <Inventory />, label: 'Inventory' },
    { path: '/stock-tracking', icon: <TrackChanges />, label: 'Stock' },
  ]},
  { label: 'PEOPLE', items: [
    { path: '/customers', icon: <People />, label: 'Customers' },
    { path: '/suppliers', icon: <LocalShipping />, label: 'Suppliers' },
    { path: '/emi', icon: <Payment />, label: 'EMI' },
  ]},
  { label: 'FINANCE', items: [
    { path: '/expenses', icon: <MoneyOff />, label: 'Expenses' },
    { path: '/recovery', icon: <AttachMoney />, label: 'Recovery' },
    { path: '/accounts', icon: <AccountBalance />, label: 'Accounts' },
  ]},
  { label: 'SYSTEM', items: [
    { path: '/reports', icon: <Assessment />, label: 'Reports' },
    { path: '/backup', icon: <CloudUpload />, label: 'Backup' },
    { path: '/history', icon: <History />, label: 'History' },
    { path: '/settings', icon: <Settings />, label: 'Settings' },
  ]},
];

// ==================== MAIN COMPONENT ====================
export default function Header({ onMenuClick }) {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // State Management
  const [anchorEl, setAnchorEl] = useState({ more: null, profile: null, notif: null });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized active path check
  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  // Memoized current page
  const currentPage = useMemo(() => {
    const allPaths = [...NAV_ITEMS, ...MORE_NAV.flatMap(g => g.items)];
    return allPaths.find(p => isActive(p.path))?.label || 'Dashboard';
  }, [isActive]);

  // Handlers
  const handleMenuOpen = (menu) => (e) => setAnchorEl(prev => ({ ...prev, [menu]: e.currentTarget }));
  const handleMenuClose = (menu) => () => setAnchorEl(prev => ({ ...prev, [menu]: null }));
  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Memoized Nav Items
  const renderNavItems = useMemo(() => {
    if (isMobile || isTablet) return null;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.path}
            component={Link}
            to={item.path}
            startIcon={item.icon}
            size="small"
            sx={{
              color: isActive(item.path) ? '#fff' : alpha('#fff', 0.75),
              bgcolor: isActive(item.path) ? alpha('#fff', 0.12) : 'transparent',
              fontWeight: isActive(item.path) ? 600 : 400,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.8rem',
              border: item.highlight ? '1px solid #4caf50' : '1px solid transparent',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: alpha('#fff', 0.1) },
              transition: 'all 0.15s',
            }}
          >
            {item.label}
            {item.highlight && (
              <Box component="span" sx={{ ml: 0.8, width: 6, height: 6, borderRadius: '50%', bgcolor: '#69f0ae' }} />
            )}
          </Button>
        ))}
        <Button
          onClick={handleMenuOpen('more')}
          endIcon={<KeyboardArrowDown />}
          size="small"
          sx={{ color: alpha('#fff', 0.8), px: 1.5, textTransform: 'none', fontSize: '0.8rem' }}
        >
          More
        </Button>
      </Box>
    );
  }, [isMobile, isTablet, isActive]);

  return (
    <>
      {/* ==================== MAIN HEADER ==================== */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          bgcolor: '#1a237e',
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
          zIndex: 1200,
        }}
      >
        <Toolbar sx={{ 
          minHeight: { xs: 52, sm: 64 },
          px: { xs: 1, sm: 2 },
          gap: { xs: 0.5, sm: 1 }
        }}>
          
          {/* Menu Toggle */}
          <IconButton
            edge="start"
            color="inherit"
            onClick={onMenuClick}
            sx={{ '&:hover': { bgcolor: alpha('#fff', 0.1) } }}
          >
            <MenuIcon fontSize={isMobile ? 'small' : 'medium'} />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Store sx={{ fontSize: { xs: 22, sm: 28 }, mr: { xs: 0.5, sm: 1 }, color: '#82b1ff' }} />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '0.9rem', sm: '1.1rem' },
                letterSpacing: '0.3px',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              RAATH POS
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                fontSize: '0.9rem',
                display: { xs: 'block', sm: 'none' }
              }}
            >
              RAATH
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          {renderNavItems}

          {/* Search - Desktop */}
          {!isMobile && !isTablet && (
            <SearchBar>
              <SearchIconWrapper><Search fontSize="small" /></SearchIconWrapper>
              <StyledInputBase
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearch}
              />
            </SearchBar>
          )}

          {/* Right Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.3, sm: 0.5 }, ml: 'auto' }}>
            
            {/* Search - Mobile/Tablet */}
            {(isMobile || isTablet) && (
              <IconButton color="inherit" onClick={() => setSearchOpen(true)} size="small">
                <Search fontSize="small" />
              </IconButton>
            )}

            {/* Quick Bill - Tablet */}
            {isTablet && (
              <Button
                component={Link}
                to="/billing"
                variant="contained"
                size="small"
                sx={{
                  bgcolor: '#00c853',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  minWidth: 'auto',
                  fontSize: '0.75rem',
                  '&:hover': { bgcolor: '#00e676' }
                }}
              >
                Bill
              </Button>
            )}

            {/* Quick Bill - Desktop */}
            {!isMobile && !isTablet && (
              <Button
                component={Link}
                to="/billing"
                variant="contained"
                size="small"
                startIcon={<PointOfSale />}
                sx={{
                  mr: 1,
                  bgcolor: '#00c853',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  fontSize: '0.8rem',
                  '&:hover': { bgcolor: '#00e676' }
                }}
              >
                New Bill
              </Button>
            )}

            {/* Notifications */}
            <IconButton 
              color="inherit"
              onClick={handleMenuOpen('notif')}
              size="small"
            >
              <Badge badgeContent={3} color="error" variant="dot">
                <Notifications fontSize="small" />
              </Badge>
            </IconButton>

            {/* Profile */}
            <IconButton onClick={handleMenuOpen('profile')} size="small">
              <Avatar 
                sx={{ 
                  width: { xs: 28, sm: 32 }, 
                  height: { xs: 28, sm: 32 },
                  bgcolor: '#82b1ff',
                  color: '#1a237e',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              >
                A
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>

        {/* Status Bar - Desktop Only */}
        {!isMobile && !isTablet && (
          <Box sx={{ 
            px: 2, 
            py: 0.3, 
            bgcolor: alpha('#000', 0.15),
            borderTop: `1px solid ${alpha('#fff', 0.06)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: '0.7rem'
          }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>📍 {currentPage}</Typography>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.1), height: 12 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Circle sx={{ fontSize: 6, color: '#69f0ae' }} />
              <Typography variant="caption" sx={{ color: '#69f0ae', fontWeight: 500 }}>Open</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.1), height: 12 }} />
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Typography>
          </Box>
        )}
      </AppBar>

      {/* ==================== BOTTOM NAV (Mobile Only) ==================== */}
      {isMobile && (
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            zIndex: 1100,
            borderTop: '1px solid #eee'
          }}
        >
          <BottomNavigation
            value={NAV_ITEMS.findIndex(item => isActive(item.path))}
            onChange={(_, newValue) => {
              const item = NAV_ITEMS[newValue];
              if (item) window.location.href = item.path;
            }}
            showLabels
            sx={{ height: 56 }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.path}
                label={item.label}
                icon={item.icon}
                sx={{
                  color: isActive(item.path) ? '#1a237e' : 'text.secondary',
                  '&.Mui-selected': { color: '#1a237e' }
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* ==================== DROPDOWNS ==================== */}
      
      {/* More Menu */}
      <Menu
        anchorEl={anchorEl.more}
        open={Boolean(anchorEl.more)}
        onClose={handleMenuClose('more')}
        PaperProps={{ sx: { width: 240, borderRadius: 2, py: 1, maxHeight: '80vh' } }}
      >
        {MORE_NAV.map((group, idx) => (
          <Box key={group.label}>
            {idx > 0 && <Divider sx={{ my: 0.5 }} />}
            <Typography variant="caption" sx={{ px: 2, pt: 1, color: 'text.secondary', fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.5px' }}>
              {group.label}
            </Typography>
            {group.items.map((item) => (
              <MenuItem
                key={item.path}
                component={Link}
                to={item.path}
                onClick={handleMenuClose('more')}
                selected={isActive(item.path)}
                sx={{ py: 0.6, px: 2, borderRadius: 1, mx: 1 }}
              >
                <Box sx={{ color: isActive(item.path) ? 'primary.main' : 'text.secondary', mr: 1.5 }}>
                  {item.icon}
                </Box>
                <Typography variant="body2" fontWeight={isActive(item.path) ? 600 : 400}>
                  {item.label}
                </Typography>
              </MenuItem>
            ))}
          </Box>
        ))}
      </Menu>

      {/* Notification Menu */}
      <Menu
        anchorEl={anchorEl.notif}
        open={Boolean(anchorEl.notif)}
        onClose={handleMenuClose('notif')}
        PaperProps={{ sx: { width: { xs: '100%', sm: 300 }, borderRadius: { xs: 0, sm: 2 }, maxHeight: '80vh' } }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle2" fontWeight={600}>Notifications</Typography>
        </Box>
        {[
          { title: 'Low Stock Alert', desc: 'Samsung S24 - Only 2 left', color: '#e53935' },
          { title: 'Payment Due', desc: 'Ahmed Khan - PKR 45,000', color: '#fb8c00' },
          { title: 'New Sale', desc: 'Invoice #0042 - PKR 125,000', color: '#43a047' },
        ].map((notif, i) => (
          <MenuItem key={i} sx={{ py: 1, px: 2 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: notif.color, mt: 0.5, mr: 1.5 }} />
            <Box>
              <Typography variant="body2" fontWeight={500}>{notif.title}</Typography>
              <Typography variant="caption" color="text.secondary">{notif.desc}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl.profile}
        open={Boolean(anchorEl.profile)}
        onClose={handleMenuClose('profile')}
        PaperProps={{ sx: { width: { xs: '100%', sm: 200 }, borderRadius: { xs: 0, sm: 2 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" fontWeight={600}>Admin User</Typography>
          <Typography variant="caption" color="text.secondary">admin@pos.com</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleMenuClose('profile')}>
          <Person fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">Profile</Typography>
        </MenuItem>
        <MenuItem onClick={handleMenuClose('profile')}>
          <Settings fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">Settings</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose('profile')} sx={{ color: 'error.main' }}>
          <Logout fontSize="small" sx={{ mr: 1.5, color: 'inherit' }} />
          <Typography variant="body2">Logout</Typography>
        </MenuItem>
      </Menu>

      {/* ==================== MOBILE SEARCH DIALOG ==================== */}
      <Dialog
        fullScreen
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        TransitionComponent={Slide}
        PaperProps={{ sx: { bgcolor: '#1a237e' } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit" onClick={() => setSearchOpen(false)}>
            <Close />
          </IconButton>
          <SearchBar sx={{ flex: 1, maxWidth: '100%' }}>
            <SearchIconWrapper><Search /></SearchIconWrapper>
            <StyledInputBase
              placeholder="Search products, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearch}
              autoFocus
            />
          </SearchBar>
        </Box>
      </Dialog>
    </>
  );
}