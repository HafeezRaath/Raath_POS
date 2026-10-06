import React, { useMemo, lazy, Suspense } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
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

// ==================== LOADING FALLBACK ====================
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500 tracking-wide">Loading Raath POS...</span>
    </div>
  </div>
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
  const location = useLocation();
  const isPos = location.pathname === '/billing' || location.pathname === '/pos';

  if (isPos) {
    return (
      <div className="h-screen w-full overflow-hidden flex flex-col bg-[#f0f2f5]">
        <main className="flex-1 w-full h-full overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/75">
      <Navbar />
      <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6 max-w-[1600px] w-full mx-auto">
        {children}
      </main>
      {isMobile && <MobileNav />}
    </div>
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
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}