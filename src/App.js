import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, Box, CssBaseline, Toolbar, CircularProgress } from '@mui/material';
import { useResponsive } from './hooks/useResponsive';
import { AuthProvider, useAuth } from './AuthContext';

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

// ==================== COMPONENTS ====================
import Navbar from './components/Sidebar';
import MobileNav from './components/MobileNav';

const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#00c853' },
    success: { main: '#10b981' },
    background: { default: '#f0f2f5' }
  }
});

// ==================== GUARDS ====================
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

// ==================== LAYOUT ====================
function MainLayout({ children }) {
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
}

// ==================== ROUTES ====================
function AppRoutes() {
  const { loading } = useAuth();

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      
      <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><MainLayout><Billing /></MainLayout></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><MainLayout><ProductsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><MainLayout><SuppliersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/emi" element={<ProtectedRoute><MainLayout><EMI /></MainLayout></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><MainLayout><Inventory /></MainLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><MainLayout><CustomerPage /></MainLayout></ProtectedRoute>} />
      <Route path="/recovery" element={<ProtectedRoute><MainLayout><RecoveryPage /></MainLayout></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><MainLayout><ExpensesPage /></MainLayout></ProtectedRoute>} />
      <Route path="/sales-history" element={<ProtectedRoute><MainLayout><SalesHistory /></MainLayout></ProtectedRoute>} />
      <Route path="/returns" element={<ProtectedRoute><MainLayout><ReturnsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/stock-tracking" element={<ProtectedRoute><MainLayout><StockTrackingPage /></MainLayout></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><MainLayout><ReportsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/backup" element={<ProtectedRoute><MainLayout><BackupPage /></MainLayout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><MainLayout><HistoryPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

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