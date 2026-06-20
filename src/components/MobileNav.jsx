import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Dashboard,
  PointOfSale,
  Inventory,
  Payment,
  People,
  Add,
  ReceiptLong,
  AssignmentReturn,
  Category,
  LocalShipping,
  MoneyOff,
  AttachMoney,
  AccountBalance,
  Assessment,
  TrackChanges,
  CloudUpload,
  History,
  Settings,
  MoreHoriz,
  Close
} from '@mui/icons-material';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Box,
  Fab,
  Zoom,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  useTheme,
  alpha
} from '@mui/material';

// ==================== MORE MENU ITEMS ====================
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

// ==================== MAIN NAV ITEMS ====================
const mainNavItems = [
  { path: '/', icon: <Dashboard />, label: 'Home' },
  { path: '/billing', icon: <PointOfSale />, label: 'Bill', badge: 0, highlight: true },
  { path: '/inventory', icon: <Inventory />, label: 'Stock', badge: 3 }, // 3 low stock alerts
  { path: '/emi', icon: <Payment />, label: 'EMI', badge: 0 },
  { path: '/customers', icon: <People />, label: 'Cust', badge: 0 },
];

export default function MobileNav() {
  const location = useLocation();
  const theme = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Don't show on billing screen (full screen POS)
  if (location.pathname === '/billing') return null;

  return (
    <>
      {/* ==================== FLOATING CENTER BUTTON ==================== */}
      <Zoom in={true} timeout={300}>
        <Fab
          component={Link}
          to="/billing"
          color="success"
          aria-label="new bill"
          sx={{
            position: 'fixed',
            bottom: 36, // Sits above bottom nav
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: (theme) => theme.zIndex.appBar + 2,
            width: 64,
            height: 64,
            boxShadow: '0 6px 20px rgba(0,200,83,0.4)',
            '&:active': {
              transform: 'translateX(-50%) scale(0.95)',
            },
            transition: 'transform 0.15s ease',
          }}
        >
          <Add sx={{ fontSize: 32 }} />
        </Fab>
      </Zoom>

      {/* ==================== BOTTOM NAVIGATION ==================== */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar + 1,
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          pb: 'env(safe-area-inset-bottom)', // iPhone notch support
        }}
        elevation={0}
      >
        <BottomNavigation
          value={location.pathname}
          showLabels
          sx={{
            height: 70,
            bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '8px 0 4px',
              color: alpha(theme.palette.text.secondary, 0.7),
              '&.Mui-selected': {
                color: theme.palette.primary.main,
                '& .MuiBottomNavigationAction-label': {
                  fontWeight: 700,
                  fontSize: '0.7rem',
                },
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.65rem',
                mt: 0.5,
              },
            },
          }}
        >
          {/* Left side items */}
          {mainNavItems.slice(0, 2).map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={
                item.badge ? (
                  <Badge badgeContent={item.badge} color="error" variant="dot">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
              component={Link}
              to={item.path}
              sx={{
                '&.Mui-selected': {
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    bgcolor: 'primary.main',
                    borderRadius: '0 0 4px 4px',
                  },
                },
              }}
            />
          ))}

          {/* Spacer for center FAB */}
          <Box sx={{ width: 80, flexShrink: 0 }} />

          {/* Right side items */}
          {mainNavItems.slice(2).map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={
                item.badge ? (
                  <Badge badgeContent={item.badge} color="error" variant="dot">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
              component={Link}
              to={item.path}
              sx={{
                '&.Mui-selected': {
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    bgcolor: 'primary.main',
                    borderRadius: '0 0 4px 4px',
                  },
                },
              }}
            />
          ))}

          {/* More Button */}
          <BottomNavigationAction
            label="More"
            value="more"
            icon={<MoreHoriz />}
            onClick={() => setMoreOpen(true)}
            sx={{
              color: moreOpen ? 'primary.main' : undefined,
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* ==================== MORE DRAWER ==================== */}
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px 16px 0 0',
            maxHeight: '70vh',
            pb: 'env(safe-area-inset-bottom)',
          }
        }}
      >
        {/* Handle bar */}
        <Box
          sx={{
            width: 40,
            height: 4,
            bgcolor: 'divider',
            borderRadius: 2,
            mx: 'auto',
            mt: 1.5,
            mb: 1,
          }}
        />

        <Box sx={{ px: 2, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            All Menu
          </Typography>
          <Box
            onClick={() => setMoreOpen(false)}
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              cursor: 'pointer',
            }}
          >
            <Close fontSize="small" />
          </Box>
        </Box>

        <Divider />

        <List sx={{ px: 1, py: 1 }}>
          {moreItems.map((item) => (
            <ListItem
              button
              key={item.path}
              component={Link}
              to={item.path}
              onClick={() => setMoreOpen(false)}
              selected={isActive(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                py: 1.2,
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: isActive(item.path) ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: isActive(item.path) ? 600 : 400,
                }}
              />
              {isActive(item.path) && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                  }}
                />
              )}
            </ListItem>
          ))}
        </List>
      </Drawer>
    </>
  );
}