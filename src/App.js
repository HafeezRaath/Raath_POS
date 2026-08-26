import React, { useMemo, lazy, Suspense } from 'react';
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
import { hasPermission } from './role';

// ==================== LAZY LOADED PAGES ====================
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const Billing = lazy(() => import('./pages/Billing'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const Inventory = lazy(() => import('./pages/Purchase'));
const EMI = lazy(() => import('./pages/EMI'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'));
const ExpensesPage = lazy(() => import('./pages/ExpenseManagement'));
const SalesHistory = lazy(() => import('./pages/SalesHistory'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const StockTrackingPage = lazy(() => import('./pages/StockTrackingPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const BackupPage = lazy(() => import('./pages/BackupPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));

// ===== SERVICES & DISTRIBUTION SECTION =====
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const Distribution = lazy(() => import('./pages/Distribution'));

// ==================== COMPONENTS ====================
const Navbar = lazy(() => import('./components/Sidebar'));
const MobileNav = lazy(() => import('./components/MobileNav'));

// ==================== THEME ====================
const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#00c853' },
    success: { main: '#10b981' },
    background: { default: '#f0f2f5' }
  }
});

// ==================== LOADING FALLBACK ====================
const PageLoader = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

// ==================== GUARDS ====================

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function ProtectedRoute({ children, pageId }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  const hasAccess = useMemo(() => {
    if (!user?.role || !pageId) return false;
    return hasPermission(user.role, pageId);
  }, [user?.role, pageId]);

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (pageId && !hasAccess) return <Navigate to="/" replace />;

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

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

        {/* OLD URL REDIRECTS */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/pos" element={<Navigate to="/billing" replace />} />

        {/* PROTECTED ROUTES */}
        <Route path="/" element={<ProtectedRoute pageId="dashboard"><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute pageId="pos"><MainLayout><Billing /></MainLayout></ProtectedRoute>} />
        <Route path="/sales-history" element={<ProtectedRoute pageId="sales"><MainLayout><SalesHistory /></MainLayout></ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute pageId="sales"><MainLayout><ReturnsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute pageId="products"><MainLayout><ProductsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute pageId="inventory"><MainLayout><Inventory /></MainLayout></ProtectedRoute>} />
        <Route path="/stock-tracking" element={<ProtectedRoute pageId="inventory"><MainLayout><StockTrackingPage /></MainLayout></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute pageId="customers"><MainLayout><CustomerPage /></MainLayout></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute pageId="suppliers"><MainLayout><SuppliersPage /></MainLayout></ProtectedRoute>} />
        
        {/* ===== SERVICES & DISTRIBUTION ROUTES ===== */}
        <Route path="/services" element={<ProtectedRoute pageId="services"><MainLayout><ServicesPage /></MainLayout></ProtectedRoute>} />
        <Route path="/distribution" element={<ProtectedRoute pageId="services"><MainLayout><Distribution /></MainLayout></ProtectedRoute>} />

        <Route path="/emi" element={<ProtectedRoute pageId="emi"><MainLayout><EMI /></MainLayout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute pageId="expenses"><MainLayout><ExpensesPage /></MainLayout></ProtectedRoute>} />
        <Route path="/recovery" element={<ProtectedRoute pageId="customers"><MainLayout><RecoveryPage /></MainLayout></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute pageId="reports"><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute pageId="reports"><MainLayout><ReportsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute pageId="reports"><MainLayout><HistoryPage /></MainLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute pageId="settings"><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/backup" element={<ProtectedRoute pageId="backup"><MainLayout><BackupPage /></MainLayout></ProtectedRoute>} />

        {/* CATCH ALL */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
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