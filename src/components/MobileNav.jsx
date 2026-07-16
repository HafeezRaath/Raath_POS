import React, { useState, forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Dashboard, PointOfSale, Inventory, Payment, People,
  Add, ReceiptLong, AssignmentReturn, Category,
  LocalShipping, MoneyOff, AttachMoney, AccountBalance,
  Assessment, TrackChanges, CloudUpload, History,
  Settings, MoreHoriz, Close
} from '@mui/icons-material';
import {
  BottomNavigation, BottomNavigationAction, Paper,
  Box, Fab, Zoom, Badge, Drawer, List, ListItem,
  ListItemIcon, ListItemText, Typography, Divider,
  useTheme, alpha
} from '@mui/material';

// SafeLink - MUI props filter
const SafeLink = forwardRef((props, ref) => {
  const {
    showLabel, selected, label, icon, value,
    onChange, action, centerRipple, disableTouchRipple,
    focusRipple, TouchRippleProps, touchRippleRef,
    ...linkProps
  } = props;
  return <Link ref={ref} {...linkProps} />;
});

const moreItems = [
  { path: '/sales-history', icon: <ReceiptLong fontSize="small" />, label: 'Sales History' },
  { path: '/returns', icon: <AssignmentReturn fontSize="small" />, label: 'Returns' },
  { path: '/products', icon: <Category fontSize="small" />, label: 'Products' },
  { path: '/suppliers', icon: <LocalShipping fontSize="small" />, label: 'Suppliers' },
  { path: '/expenses', icon: <MoneyOff fontSize="small" />, label: 'Expenses' },
  { path: '/recovery', icon: <AttachMoney fontSize="small" />, label: 'Recovery' },
  { path: '/accounts', icon: <AccountBalance fontSize="small" />, label: 'Accounts' },
  { path: '/reports', icon: <Assessment fontSize="small" />, label: 'Reports' },
  { path: '/stock-tracking', icon: <TrackChanges fontSize="small" />, label: 'Stock Track' },
  { path: '/backup', icon: <CloudUpload fontSize="small" />, label: 'Backup' },
  { path: '/history', icon: <History fontSize="small" />, label: 'History' },
  { path: '/settings', icon: <Settings fontSize="small" />, label: 'Settings' },
];

const mainNavItems = [
  { path: '/', icon: <Dashboard />, label: 'Home' },
  { path: '/billing', icon: <PointOfSale />, label: 'Bill', badge: 0 },
  { path: '/inventory', icon: <Inventory />, label: 'Stock', badge: 3 },
  { path: '/emi', icon: <Payment />, label: 'EMI', badge: 0 },
  { path: '/customers', icon: <People />, label: 'Cust', badge: 0 },
];

export default function MobileNav() {
  const location = useLocation();
  const theme = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path) => location.pathname === path;
  if (location.pathname === '/billing') return null;

  return (
    <>
      <Zoom in={true} timeout={300}>
        <Fab component={Link} to="/billing" color="success" aria-label="new bill"
          sx={{ position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
            zIndex: (theme) => theme.zIndex.appBar + 2, width: 64, height: 64,
            boxShadow: '0 6px 20px rgba(0,200,83,0.4)',
            '&:active': { transform: 'translateX(-50%) scale(0.95)' },
            transition: 'transform 0.15s ease' }}>
          <Add sx={{ fontSize: 32 }} />
        </Fab>
      </Zoom>

      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: (theme) => theme.zIndex.appBar + 1,
          borderRadius: '16px 16px 0 0', overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          pb: 'env(safe-area-inset-bottom)' }} elevation={0}>
        <BottomNavigation value={location.pathname} showLabels
          sx={{ height: 70, bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto', padding: '8px 0 4px',
              color: alpha(theme.palette.text.secondary, 0.7),
              '&.Mui-selected': { color: theme.palette.primary.main,
                '& .MuiBottomNavigationAction-label': { fontWeight: 700, fontSize: '0.7rem' } },
              '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem', mt: 0.5 },
            } }}>
          {mainNavItems.slice(0, 2).map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} value={item.path}
              icon={item.badge ? <Badge badgeContent={item.badge} color="error" variant="dot">{item.icon}</Badge> : item.icon}
              component={SafeLink} to={item.path} />
          ))}
          <Box sx={{ width: 80, flexShrink: 0 }} />
          {mainNavItems.slice(2).map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} value={item.path}
              icon={item.badge ? <Badge badgeContent={item.badge} color="error" variant="dot">{item.icon}</Badge> : item.icon}
              component={SafeLink} to={item.path} />
          ))}
          <BottomNavigationAction label="More" value="more" icon={<MoreHoriz />}
            onClick={() => setMoreOpen(true)} sx={{ color: moreOpen ? 'primary.main' : undefined }} />
        </BottomNavigation>
      </Paper>

      <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', maxHeight: '70vh', pb: 'env(safe-area-inset-bottom)' } }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.5, mb: 1 }} />
        <Box sx={{ px: 2, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight="bold">All Menu</Typography>
          <Box onClick={() => setMoreOpen(false)} sx={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.text.primary, 0.05), cursor: 'pointer' }}>
            <Close fontSize="small" />
          </Box>
        </Box>
        <Divider />
        <List sx={{ px: 1, py: 1 }}>
          {moreItems.map((item) => (
            <ListItem button key={item.path} component={Link} to={item.path}
              onClick={() => setMoreOpen(false)} selected={isActive(item.path)}
              sx={{ borderRadius: 2, mb: 0.5, py: 1.2,
                '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', '& .MuiListItemIcon-root': { color: 'primary.main' } } }}>
              <ListItemIcon sx={{ minWidth: 40, color: isActive(item.path) ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: isActive(item.path) ? 600 : 400 }} />
              {isActive(item.path) && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}
            </ListItem>
          ))}
        </List>
      </Drawer>
    </>
  );
}