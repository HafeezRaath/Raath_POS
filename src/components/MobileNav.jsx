import React, { useState, memo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Dashboard, PointOfSale, Inventory, Payment, People, Add,
  ReceiptLong, AssignmentReturn, Category, LocalShipping, MoneyOff,
  AttachMoney, AccountBalance, Assessment, TrackChanges, CloudUpload,
  History, Settings, MoreHoriz, Close 
} from '@mui/icons-material';
import {
  BottomNavigation, BottomNavigationAction, Paper, Box, Fab, Zoom,
  Badge, Drawer, List, ListItem, ListItemIcon, ListItemText,
  Typography, Divider, useTheme, alpha, useMediaQuery
} from '@mui/material';

// Constants
const MORE_ITEMS = [
  { path: '/sales-history', icon: <ReceiptLong />, label: 'Sales' },
  { path: '/returns', icon: <AssignmentReturn />, label: 'Returns' },
  { path: '/products', icon: <Category />, label: 'Products' },
  { path: '/suppliers', icon: <LocalShipping />, label: 'Suppliers' },
  { path: '/expenses', icon: <MoneyOff />, label: 'Expenses' },
  { path: '/recovery', icon: <AttachMoney />, label: 'Recovery' },
  { path: '/accounts', icon: <AccountBalance />, label: 'Accounts' },
  { path: '/reports', icon: <Assessment />, label: 'Reports' },
  { path: '/stock-tracking', icon: <TrackChanges />, label: 'Stock' },
  { path: '/backup', icon: <CloudUpload />, label: 'Backup' },
  { path: '/history', icon: <History />, label: 'History' },
  { path: '/settings', icon: <Settings />, label: 'Settings' },
];

const MAIN_NAV = [
  { path: '/', icon: <Dashboard />, label: 'Home' },
  { path: '/billing', icon: <PointOfSale />, label: 'Bill' },
  { path: '/inventory', icon: <Inventory />, label: 'Stock', badge: 3 },
  { path: '/emi', icon: <Payment />, label: 'EMI' },
  { path: '/customers', icon: <People />, label: 'Cust' },
];

// Main Component
const MobileNav = memo(() => {
  const { pathname } = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [moreOpen, setMoreOpen] = useState(false);
  
  const isActive = useCallback(p => pathname === p, [pathname]);
  
  if (pathname === '/billing' || !isMobile) return null;

  return (
    <>
      {/* FAB Button */}
      <Zoom in timeout={200}>
        <Fab component={Link} to="/billing" color="success"
          sx={{
            position: 'fixed', bottom: 70, left: '50%',
            transform: 'translateX(-50%)', zIndex: 1100,
            width: 56, height: 56,
            boxShadow: '0 4px 20px rgba(0,200,83,0.35)',
            '&:active': { transform: 'translateX(-50%) scale(0.92)' },
          }}>
          <Add sx={{ fontSize: 28 }} />
        </Fab>
      </Zoom>

      {/* Bottom Navigation */}
      <Paper sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1100, borderRadius: '16px 16px 0 0',
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        pb: 'env(safe-area-inset-bottom)',
      }} elevation={0}>
        <BottomNavigation value={pathname} showLabels sx={{ height: 65, bgcolor: 'background.paper' }}>
          {MAIN_NAV.slice(0, 2).map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} value={item.path}
              icon={item.badge ? <Badge badgeContent={item.badge} color="error" variant="dot">{item.icon}</Badge> : item.icon}
              component={Link} to={item.path}
              sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: '0.6rem' } }} />
          ))}
          <Box sx={{ width: 56, flexShrink: 0 }} />
          {MAIN_NAV.slice(2).map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} value={item.path}
              icon={item.badge ? <Badge badgeContent={item.badge} color="error" variant="dot">{item.icon}</Badge> : item.icon}
              component={Link} to={item.path}
              sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: '0.6rem' } }} />
          ))}
          <BottomNavigationAction label="More" value="more" icon={<MoreHoriz />}
            onClick={() => setMoreOpen(true)}
            sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: '0.6rem' } }} />
        </BottomNavigation>
      </Paper>

      {/* More Drawer */}
      <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', maxHeight: '75vh', pb: 'env(safe-area-inset-bottom)' } }}>
        <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.5, mb: 1 }} />
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>All Menu</Typography>
          <Box onClick={() => setMoreOpen(false)} sx={{ p: 0.5, borderRadius: '50%', cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) } }}>
            <Close fontSize="small" />
          </Box>
        </Box>
        <Divider />
        <List sx={{ px: 1, py: 1 }}>
          {MORE_ITEMS.map((item) => (
            <ListItem button key={item.path} component={Link} to={item.path}
              onClick={() => setMoreOpen(false)} selected={isActive(item.path)}
              sx={{ borderRadius: 2, mb: 0.3, py: 1,
                '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main' } }}>
              <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isActive(item.path) ? 600 : 400 }} />
            </ListItem>
          ))}
        </List>
      </Drawer>
    </>
  );
});

export default MobileNav;