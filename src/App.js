import React, { useMemo } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme, 
  Box, 
  CssBaseline, 
  Toolbar, 
  CircularProgress 
} from '@mui/material';
import { useResponsive } from './hooks/useResponsive';
import { AuthProvider, useAuth } from './AuthContext';

// Role imports
import { hasPermission } from './role';

// ==================== PAGES ====================
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/ProductsPage';
import Billing from './pages/Billing';
import SuppliersPage from './pages/SuppliersPage';
import Inventory from './pages/InventoryPage';
import EMI from './pages/EMI';
import CustomerPage from './pages/CustomerPage';
import RecoveryPage from './pages/RecoveryPage';
import ExpensesPage from './pages/ExpenseManagement';
import SalesHistory from './pages/SalesHistory';
import ReturnsPage from './pages/ReturnsPage';
import StockTrackingPage from './pages/StockTrackingPage';
import AccountsPage from './pages/AccountsPage';
import ReportsPage from './pages/ReportsPage';
import BackupPage from './pages/BackupPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ServicesPage from './pages/ServicesPage';

// ==================== COMPONENTS ====================
import Navbar from './components/Sidebar';
import MobileNav from './components/MobileNav';

// ==================== THEME ====================
const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#00c853' },
    success: { main: '#10b981' },
    background: { default: '#f0f2f5' }
  }
});

// ==================== GUARDS ====================

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedRoute({ children, pageId }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  const hasAccess = useMemo(() => {
    if (!user?.role || !pageId) return false;
    return hasPermission(user.role, pageId);
  }, [user?.role, pageId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (pageId && !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ==================== LAYOUT ====================
const MainLayout = React.memo(function MainLayout({ children }) {
  const { isMobile } = useResponsive();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Toolbar />
      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        {children}
      </Box>
      {isMobile && <MobileNav />}
    </Box>
  );
});

// ==================== ROUTES ====================
const AppRoutes = React.memo(function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* OLD URL REDIRECTS */}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/pos" element={<Navigate to="/billing" replace />} />

      {/* PROTECTED ROUTES */}
      <Route path="/" element={
        <ProtectedRoute pageId="dashboard">
          <MainLayout><Dashboard /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/billing" element={
        <ProtectedRoute pageId="pos">
          <MainLayout><Billing /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/sales-history" element={
        <ProtectedRoute pageId="sales">
          <MainLayout><SalesHistory /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/returns" element={
        <ProtectedRoute pageId="sales">
          <MainLayout><ReturnsPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/products" element={
        <ProtectedRoute pageId="products">
          <MainLayout><ProductsPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute pageId="inventory">
          <MainLayout><Inventory /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/stock-tracking" element={
        <ProtectedRoute pageId="inventory">
          <MainLayout><StockTrackingPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/customers" element={
        <ProtectedRoute pageId="customers">
          <MainLayout><CustomerPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute pageId="suppliers">
          <MainLayout><SuppliersPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/services" element={
        <ProtectedRoute pageId="services">
          <MainLayout><ServicesPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/emi" element={
        <ProtectedRoute pageId="emi">
          <MainLayout><EMI /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/expenses" element={
        <ProtectedRoute pageId="expenses">
          <MainLayout><ExpensesPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/recovery" element={
        <ProtectedRoute pageId="customers">
          <MainLayout><RecoveryPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/accounts" element={
        <ProtectedRoute pageId="reports">
          <MainLayout><AccountsPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute pageId="reports">
          <MainLayout><ReportsPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/history" element={
        <ProtectedRoute pageId="reports">
          <MainLayout><HistoryPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute pageId="settings">
          <MainLayout><SettingsPage /></MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/backup" element={
        <ProtectedRoute pageId="backup">
          <MainLayout><BackupPage /></MainLayout>
        </ProtectedRoute>
      } />

      {/* CATCH ALL */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}