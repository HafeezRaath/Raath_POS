import React, { useState } from 'react';
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
  Circle
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
  Fade,
  alpha,
  styled,
  useTheme,
  Divider
} from '@mui/material';

// ==================== STYLED COMPONENTS ====================
const SearchBar = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius * 3,
  backgroundColor: alpha(theme.palette.common.white, 0.12),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.2),
  },
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
    '&::placeholder': {
      color: alpha(theme.palette.common.white, 0.5),
      opacity: 1,
    },
  },
}));

// ==================== NAV DATA ====================
const mainNav = [
  { path: '/', icon: <Dashboard fontSize="small" />, label: 'Dashboard' },
  { path: '/billing', icon: <PointOfSale fontSize="small" />, label: 'New Bill', highlight: true },
  { path: '/sales-history', icon: <ReceiptLong fontSize="small" />, label: 'Sales' },
  { path: '/returns', icon: <AssignmentReturn fontSize="small" />, label: 'Returns' },
];

const moreNav = [
  { label: 'INVENTORY', items: [
    { path: '/products', icon: <Category fontSize="small" />, label: 'Products' },
    { path: '/inventory', icon: <Inventory fontSize="small" />, label: 'Inventory' },
    { path: '/stock-tracking', icon: <TrackChanges fontSize="small" />, label: 'Stock' },
  ]},
  { label: 'PEOPLE', items: [
    { path: '/customers', icon: <People fontSize="small" />, label: 'Customers' },
    { path: '/suppliers', icon: <LocalShipping fontSize="small" />, label: 'Suppliers' },
    { path: '/emi', icon: <Payment fontSize="small" />, label: 'EMI' },
  ]},
  { label: 'FINANCE', items: [
    { path: '/expenses', icon: <MoneyOff fontSize="small" />, label: 'Expenses' },
    { path: '/recovery', icon: <AttachMoney fontSize="small" />, label: 'Recovery' },
    { path: '/accounts', icon: <AccountBalance fontSize="small" />, label: 'Accounts' },
  ]},
  { label: 'SYSTEM', items: [
    { path: '/reports', icon: <Assessment fontSize="small" />, label: 'Reports' },
    { path: '/backup', icon: <CloudUpload fontSize="small" />, label: 'Backup' },
    { path: '/history', icon: <History fontSize="small" />, label: 'History' },
    { path: '/settings', icon: <Settings fontSize="small" />, label: 'Settings' },
  ]},
];

const allPaths = [...mainNav, ...moreNav.flatMap(g => g.items)];

// ==================== COMPONENT ====================
export default function Header({ onMenuClick, isMobile }) {
  const location = useLocation();
  const theme = useTheme();
  
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => location.pathname === path;
  const currentPage = allPaths.find(p => isActive(p.path))?.label || 'Dashboard';

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      {/* ==================== PRIMARY APP BAR ==================== */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          bgcolor: '#1a237e', // Deep professional blue
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)',
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: 64, px: { xs: 1, sm: 2 } }}>
          
          {/* Hamburger (Mobile / Sidebar Toggle) */}
          <IconButton
            edge="start"
            color="inherit"
            onClick={onMenuClick}
            sx={{ 
              mr: 1.5,
              '&:hover': { bgcolor: alpha('#fff', 0.1) }
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <Store sx={{ fontSize: 30, mr: 1, color: '#82b1ff' }} />
            <Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 800, 
                  lineHeight: 1.1,
                  letterSpacing: '0.5px',
                  fontSize: '1.25rem'
                }}
              >
                RAATH
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  opacity: 0.8, 
                  display: 'block', 
                  lineHeight: 1,
                  fontSize: '0.65rem',
                  letterSpacing: '1.5px'
                }}
              >
                POS SYSTEM
              </Typography>
            </Box>
          </Box>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
              {mainNav.map((item) => (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  startIcon={item.icon}
                  size="small"
                  sx={{
                    color: isActive(item.path) ? '#fff' : alpha('#fff', 0.75),
                    bgcolor: isActive(item.path) ? alpha('#fff', 0.15) : 'transparent',
                    fontWeight: isActive(item.path) ? 700 : 500,
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    border: item.highlight ? `1px solid #4caf50` : '1px solid transparent',
                    '&:hover': {
                      bgcolor: isActive(item.path) ? alpha('#fff', 0.2) : alpha('#fff', 0.1),
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  {item.label}
                  {item.highlight && (
                    <Box
                      component="span"
                      sx={{
                        ml: 0.8,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: '#69f0ae',
                        display: 'inline-block',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                          '50%': { opacity: 0.4, transform: 'scale(1.3)' },
                        },
                      }}
                    />
                  )}
                </Button>
              ))}

              {/* More Dropdown */}
              <Button
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                endIcon={<KeyboardArrowDown fontSize="small" />}
                size="small"
                sx={{
                  color: alpha('#fff', 0.8),
                  fontWeight: 500,
                  px: 1.5,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  '&:hover': { bgcolor: alpha('#fff', 0.1) },
                }}
              >
                More
              </Button>
            </Box>
          )}

          {/* Search Bar */}
          {!isMobile && (
            <SearchBar>
              <SearchIconWrapper>
                <Search fontSize="small" />
              </SearchIconWrapper>
              <StyledInputBase
                placeholder="Search products, customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearch}
              />
            </SearchBar>
          )}

          {/* Right Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            
            {/* Quick Bill Button */}
            {!isMobile && (
              <Tooltip title="Quick New Bill" TransitionComponent={Fade}>
                <Button
                  variant="contained"
                  size="small"
                  component={Link}
                  to="/billing"
                  startIcon={<PointOfSale fontSize="small" />}
                  sx={{
                    mr: 1.5,
                    bgcolor: '#00c853',
                    fontWeight: 'bold',
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2,
                    boxShadow: '0 4px 12px rgba(0,200,83,0.3)',
                    '&:hover': {
                      bgcolor: '#00e676',
                      boxShadow: '0 6px 16px rgba(0,200,83,0.4)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  Bill
                </Button>
              </Tooltip>
            )}

            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton 
                color="inherit"
                onClick={(e) => setNotifAnchor(e.currentTarget)}
                sx={{ 
                  color: alpha('#fff', 0.8),
                  '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.1) }
                }}
              >
                <Badge badgeContent={3} color="error" variant="dot">
                  <Notifications fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Profile */}
            <Tooltip title="Account">
              <IconButton
                onClick={(e) => setProfileAnchor(e.currentTarget)}
                size="small"
                sx={{ ml: 0.5 }}
              >
                <Avatar 
                  sx={{ 
                    width: 34, 
                    height: 34, 
                    bgcolor: '#82b1ff',
                    color: '#1a237e',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    border: '2px solid rgba(255,255,255,0.3)'
                  }}
                >
                  A
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>

        {/* ==================== SECONDARY STATUS BAR ==================== */}
        {!isMobile && (
          <Box
            sx={{
              px: 2,
              py: 0.4,
              bgcolor: alpha('#000', 0.15),
              borderTop: `1px solid ${alpha('#fff', 0.08)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                📍
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.3px' }}>
                {currentPage}
              </Typography>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.15), height: 14 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Circle sx={{ fontSize: 8, color: '#69f0ae' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#69f0ae' }}>
                Store Open
              </Typography>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: alpha('#fff', 0.15), height: 14 }} />
            
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {new Date().toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </Typography>
            
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem' }}>
                Shift: Morning
              </Typography>
            </Box>
          </Box>
        )}
      </AppBar>

      {/* ==================== MORE DROPDOWN MENU ==================== */}
      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={() => setMoreAnchor(null)}
        PaperProps={{
          sx: {
            width: 260,
            mt: 1.5,
            borderRadius: 2,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            py: 1,
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {moreNav.map((group, idx) => (
          <Box key={group.label}>
            {idx > 0 && <Divider sx={{ my: 1, mx: 1.5 }} />}
            <Typography 
              variant="caption" 
              sx={{ 
                px: 2, 
                pt: 1, 
                pb: 0.5, 
                display: 'block', 
                color: 'text.secondary', 
                fontWeight: 700, 
                fontSize: '0.65rem',
                letterSpacing: '1px'
              }}
            >
              {group.label}
            </Typography>
            {group.items.map((item) => (
              <MenuItem
                key={item.path}
                component={Link}
                to={item.path}
                onClick={() => setMoreAnchor(null)}
                selected={isActive(item.path)}
                sx={{
                  py: 0.8,
                  px: 2,
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.3,
                  '&.Mui-selected': { 
                    bgcolor: alpha(theme.palette.primary.main, 0.1), 
                    color: 'primary.main',
                    fontWeight: 600
                  }
                }}
              >
                <Box sx={{ color: isActive(item.path) ? 'primary.main' : 'text.secondary', mr: 1.5, display: 'flex' }}>
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

      {/* ==================== NOTIFICATIONS DROPDOWN ==================== */}
      <Menu
        anchorEl={notifAnchor}
        open={Boolean(notifAnchor)}
        onClose={() => setNotifAnchor(null)}
        PaperProps={{
          sx: {
            width: 320,
            mt: 1.5,
            borderRadius: 2,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
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
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: notif.color, 
                mt: 0.8, 
                mr: 1.5,
                flexShrink: 0
              }} 
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.3 }}>
                {notif.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {notif.desc}
              </Typography>
              <Typography variant="caption" color="primary" sx={{ fontSize: '0.7rem' }}>
                {notif.time}
              </Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem sx={{ justifyContent: 'center', py: 1 }}>
          <Typography variant="caption" color="primary" fontWeight={600}>
            View All Notifications
          </Typography>
        </MenuItem>
      </Menu>

      {/* ==================== PROFILE DROPDOWN ==================== */}
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        PaperProps={{
          sx: {
            width: 220,
            mt: 1.5,
            borderRadius: 2,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" fontWeight="bold">Admin User</Typography>
          <Typography variant="caption" color="text.secondary">admin@raathpos.com</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => setProfileAnchor(null)} sx={{ py: 1 }}>
          <Person fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">My Profile</Typography>
        </MenuItem>
        <MenuItem onClick={() => setProfileAnchor(null)} sx={{ py: 1 }}>
          <Settings fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          <Typography variant="body2">Settings</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setProfileAnchor(null)} sx={{ py: 1, color: 'error.main' }}>
          <Logout fontSize="small" sx={{ mr: 1.5, color: 'inherit' }} />
          <Typography variant="body2">Logout</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}