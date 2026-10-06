import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Dashboard,
  PointOfSale,
  Receipt,
  AssignmentReturn,
  Category,
  Package,
  TrackChanges,
  Users,
  LocalShipping,
  CreditCard,
  Build,
  HomeRepairService,
  AttachMoney,
  MoneyOff,
  Landmark,
  Assessment,
  History,
  Settings,
  Group,
  CloudUpload,
  Search,
  RefreshCw,
  Bell,
  Menu as MenuIcon,
  X,
  ChevronDown,
  Store,
  Shield,
  LogOut,
  User,
  Warning,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from './ui/icons';
import { useAuth } from '../AuthContext';
import { getRoleColorSync, getRoleLabelSync } from '../role';
import db from '../database/db';

// ==================== PATH PERMISSION MAP ====================
const PATH_PERMISSION_MAP = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/billing': 'pos',
  '/pos': 'pos',
  '/sales-history': 'sales',
  '/sales': 'sales',
  '/returns': 'sales',
  '/products': 'products',
  '/inventory': 'inventory',
  '/stock-tracking': 'inventory',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/services': 'services',
  '/distribution': 'services',
  '/emi': 'emi',
  '/expenses': 'expenses',
  '/recovery': 'customers',
  '/accounts': 'reports',
  '/reports': 'reports',
  '/history': 'reports',
  '/purchases': 'purchases',
  '/users': 'users',
  '/backup': 'backup',
  '/settings': 'settings',
};

// ==================== UNIFIED NAV STRUCTURE ====================
const NAV_GROUPS = [
  {
    key: 'invoices',
    label: 'Invoices',
    icon: Receipt,
    items: [
      { id: 'pos', label: 'New Bill', icon: PointOfSale, path: '/billing' },
      { id: 'sales', label: 'Sales History', icon: Receipt, path: '/sales-history' },
      { id: 'sales', label: 'Returns', icon: AssignmentReturn, path: '/returns' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: Package,
    items: [
      { id: 'products', label: 'Products', icon: Category, path: '/products' },
      { id: 'inventory', label: 'Purchase', icon: Package, path: '/inventory' },
      { id: 'inventory', label: 'Stock Tracking', icon: TrackChanges, path: '/stock-tracking' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: Users,
    items: [
      { id: 'customers', label: 'Customers', icon: Users, path: '/customers' },
      { id: 'suppliers', label: 'Suppliers', icon: LocalShipping, path: '/suppliers' },
      { id: 'emi', label: 'EMI System', icon: CreditCard, path: '/emi' },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    icon: Build,
    items: [
      { id: 'services', label: 'Work Orders', icon: HomeRepairService, path: '/services' },
      { id: 'services', label: 'Distribution', icon: LocalShipping, path: '/distribution' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: AttachMoney,
    items: [
      { id: 'expenses', label: 'Expenses', icon: MoneyOff, path: '/expenses' },
      { id: 'customers', label: 'Recovery', icon: AttachMoney, path: '/recovery' },
      { id: 'reports', label: 'Accounts', icon: Landmark, path: '/accounts' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: Assessment,
    items: [
      { id: 'reports', label: 'Reports', icon: Assessment, path: '/reports' },
      { id: 'reports', label: 'History', icon: History, path: '/history' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { id: 'users', label: 'User Management', icon: Group, path: '/users' },
      { id: 'backup', label: 'Backup', icon: CloudUpload, path: '/backup' },
      { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

const allPaths = [
  { path: '/', label: 'Dashboard' },
  { path: '/dashboard', label: 'Dashboard' },
  ...NAV_GROUPS.flatMap((g) => g.items),
];

const NOTIF_CONFIG = {
  low_stock: { color: 'bg-rose-500', label: 'Low Stock' },
  emi_due: { color: 'bg-amber-500', label: 'EMI Due' },
  payment_due: { color: 'bg-amber-500', label: 'Payment Due' },
  new_sale: { color: 'bg-emerald-500', label: 'New Sale' },
  out_of_stock: { color: 'bg-rose-600', label: 'Out of Stock' },
};

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user: authUser, checkPermissionSync } = useAuth();

  const [localUser, setLocalUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navRef = useRef(null);
  const searchInputRef = useRef(null);

  // Global Keyboard shortcuts (F1: New Bill, F2: Products, Ctrl+K: Search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F1') {
        e.preventDefault();
        navigate('/billing');
      } else if (e.key === 'F2') {
        e.preventDefault();
        navigate('/products');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null);
        setNotifOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setOpenDropdown(null);
    setNotifOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Page visibility state
  const [pageVisibility, setPageVisibility] = useState(() => {
    const saved = localStorage.getItem('page_visibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing page_visibility:', e);
      }
    }
    return {
      dashboard: true,
      pos: true,
      sales: true,
      inventory: true,
      products: true,
      customers: true,
      suppliers: true,
      purchases: true,
      expenses: true,
      reports: true,
      settings: true,
      emi: true,
      users: true,
      backup: true,
      services: true,
    };
  });

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'page_visibility') {
        try {
          setPageVisibility(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem('current_user');
        setLocalUser(saved ? JSON.parse(saved) : null);
      } catch (e) {
        console.error(e);
      }
    };
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const currentUser = authUser || localUser;
  const userRole = currentUser?.role || '';
  const userName = currentUser?.name || 'Guest';
  const userEmail = currentUser?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = getRoleLabelSync(userRole);

  const canAccess = useCallback(
    (permId) => {
      const authResult = checkPermissionSync(permId);
      if (authResult) return true;
      if (!currentUser?.role) return false;
      if (currentUser.role === 'admin') return true;
      try {
        const storedPerms = localStorage.getItem('pos_permissions');
        if (storedPerms) {
          const perms = JSON.parse(storedPerms);
          return perms[currentUser.role]?.includes(permId) || false;
        }
      } catch (e) {}
      return false;
    },
    [checkPermissionSync, currentUser]
  );

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);
  const isGroupActive = useCallback(
    (items) => items.some((item) => isActive(item.path)),
    [isActive]
  );

  // Load real notifications
  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const notifs = [];
      const today = new Date();

      try {
        const variants = await db.getAllVariants();
        const lowStock = variants.filter(
          (v) => !v.is_deleted && Number(v.current_stock) <= Number(v.stock_alert_quantity)
        );
        const outOfStock = lowStock.filter((v) => Number(v.current_stock) === 0);
        const nearLow = lowStock.filter((v) => Number(v.current_stock) > 0);

        outOfStock.slice(0, 3).forEach((item) => {
          notifs.push({
            id: `stock-out-${item.id}`,
            type: 'out_of_stock',
            title: 'Out of Stock',
            desc: `${item.product_name || 'Product'} (SKU: ${item.sku || 'N/A'}) - 0 units left`,
            time: 'Now',
            path: '/stock-tracking',
          });
        });

        nearLow.slice(0, 3).forEach((item) => {
          notifs.push({
            id: `stock-low-${item.id}`,
            type: 'low_stock',
            title: 'Low Stock Alert',
            desc: `${item.product_name || 'Product'} - Only ${item.current_stock} units left`,
            time: 'Now',
            path: '/stock-tracking',
          });
        });
      } catch (e) {
        console.error(e);
      }

      try {
        const emis = await db.getEMIs();
        const dueSoon = emis.filter((e) => {
          if (e.status !== 'active' || !e.next_due_date) return false;
          const due = new Date(e.next_due_date);
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7 && diffDays >= 0;
        });

        dueSoon.slice(0, 3).forEach((emi) => {
          const due = new Date(emi.next_due_date);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          notifs.push({
            id: `emi-${emi.id}`,
            type: 'emi_due',
            title: 'EMI Payment Due',
            desc: `${emi.customer_name || 'Customer'} - Rs. ${Number(emi.installment_amount || 0).toLocaleString()} due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
            time: diffDays === 0 ? 'Today' : `${diffDays}d left`,
            path: '/emi',
          });
        });
      } catch (e) {
        console.error(e);
      }

      setNotifications(notifs);
    } catch (e) {
      console.error(e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canAccess(item.id)) return false;
        if (pageVisibility[item.id] === false) return false;
        return true;
      }),
    })).filter((group) => group.items.length > 0);
  }, [canAccess, pageVisibility]);

  const currentPage = useMemo(
    () => allPaths.find((p) => isActive(p.path))?.label || 'Dashboard',
    [isActive]
  );

  const currentGroup = useMemo(() => {
    return NAV_GROUPS.find((group) => group.items.some((item) => isActive(item.path)));
  }, [isActive]);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allPaths.filter(
      (p) => p.label.toLowerCase().includes(q) && canAccess(PATH_PERMISSION_MAP[p.path] || '')
    );
  }, [searchQuery, canAccess]);

  return (
    <header ref={navRef} className="sticky top-0 z-40 w-full select-none shadow-xl no-print">
      {/* Main Top Navbar */}
      <div 
        className="text-white border-b"
        style={{ 
          background: 'linear-gradient(135deg, #1c2580 0%, #151b60 100%)', 
          borderColor: '#283593',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="w-full px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Mobile Toggle & Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden p-2 rounded-lg text-indigo-100 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Toggle menu"
            >
              <MenuIcon size={22} />
            </button>

            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 border border-indigo-400/30 flex items-center justify-center text-white shadow-lg shadow-indigo-950/60 group-hover:scale-105 group-hover:shadow-indigo-500/50 transition-all">
                <Store size={21} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-wide text-white leading-tight font-sans">
                  RAATH
                </span>
                <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase leading-none">
                  POS SYSTEM
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-0.5 2xl:gap-1 flex-shrink-0">
            {pageVisibility.dashboard !== false && canAccess('dashboard') && (
              <Link
                to="/"
                className={`flex items-center gap-1 px-2 py-1.5 2xl:px-2.5 2xl:py-2 rounded-lg text-xs 2xl:text-[13px] font-semibold transition-all whitespace-nowrap ${
                  isActive('/')
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Dashboard size={15} />
                <span>Dashboard</span>
              </Link>
            )}

            {filteredGroups.map((group) => {
              const Icon = group.icon;
              const groupActive = isGroupActive(group.items);
              const isOpen = openDropdown === group.key;

              return (
                <div key={group.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(isOpen ? null : group.key)}
                    className={`flex items-center gap-1 px-2 py-1.5 2xl:px-2.5 2xl:py-2 rounded-lg text-xs 2xl:text-[13px] font-semibold transition-all whitespace-nowrap ${
                      groupActive
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{group.label}</span>
                    <ChevronDown
                      size={11}
                      className={`transition-transform duration-200 opacity-80 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute left-0 mt-2 w-56 bg-[#141a5c] text-white rounded-xl shadow-2xl border border-indigo-500/30 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 backdrop-blur-md">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpenDropdown(null)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                              itemActive
                                ? 'bg-blue-600/30 text-blue-300 font-bold border-l-2 border-blue-400'
                                : 'text-slate-200 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span
                              className={itemActive ? 'text-blue-400' : 'text-slate-400'}
                            >
                              <ItemIcon size={16} />
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Center Search Bar: Scaled proportionally with zero overflow */}
          <div className="relative hidden lg:flex items-center flex-shrink max-w-[170px] xl:max-w-[210px] 2xl:max-w-xs mx-1.5 2xl:mx-3">
            <div className="relative w-full flex items-center">
              <span className="absolute left-2.5 text-indigo-200 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111752]/85 hover:bg-[#111752] focus:bg-[#0d1242] text-white placeholder:text-indigo-200/70 text-xs rounded-xl pl-8 pr-14 py-1.5 border border-indigo-400/35 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/25 transition-all shadow-inner backdrop-blur-sm"
              />
              <span className="absolute right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/10 text-indigo-100 border border-indigo-300/30 pointer-events-none">
                Ctrl+K
              </span>
            </div>

            {/* Quick search popup results */}
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#141a5c] text-white rounded-xl shadow-2xl border border-indigo-500/30 py-1.5 z-50 min-w-[220px] backdrop-blur-md">
                {searchResults.slice(0, 6).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSearchQuery('')}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-indigo-100 hover:bg-white/10 font-medium transition-colors"
                  >
                    <span className="text-blue-400 font-bold">●</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] text-indigo-300 ml-auto font-mono">{item.path}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Actions: Quick Bill, Refresh, Notifications, Profile */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Quick Bill Button */}
            {pageVisibility.pos !== false && canAccess('pos') && (
              <Link
                to="/billing"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs 2xl:text-sm font-bold shadow-md shadow-emerald-950/40 hover:shadow-emerald-600/30 transition-all flex-shrink-0"
              >
                <PointOfSale size={15} />
                <span>New Bill</span>
              </Link>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Refresh alerts"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* Notifications Menu */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                className="relative p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {notifications.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse border border-slate-900">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Notifications & Alerts</h4>
                      <p className="text-[11px] text-slate-500">
                        {notifications.length > 0
                          ? `${notifications.length} unread alerts`
                          : 'All caught up!'}
                      </p>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifLoading ? (
                      <div className="p-6 text-center text-xs text-slate-400">Loading alerts...</div>
                    ) : notifications.length > 0 ? (
                      notifications.map((notif) => {
                        const dotColor = NOTIF_CONFIG[notif.type]?.color || 'bg-indigo-500';
                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setNotifOpen(false);
                              if (notif.path) navigate(notif.path);
                            }}
                            className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-start gap-3 transition-colors"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-900">
                                  {notif.title}
                                </span>
                                <span className="text-[10px] text-slate-400">{notif.time}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                {notif.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 px-4 text-center">
                        <CheckCircle size={32} className="mx-auto text-emerald-500/40 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No active alerts</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Inventory and payments are in good standing
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center p-0.5 rounded-xl hover:opacity-95 transition-all focus:outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm flex items-center justify-center ring-2 ring-amber-300/70 hover:ring-amber-300 shadow-md shadow-black/40 transition-all">
                  {userInitial}
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-base flex items-center justify-center border-2 border-white shadow-xs">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-500 truncate">{userEmail || 'User'}</p>
                        <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-[#1c2580]">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5">
                    {pageVisibility.settings !== false && canAccess('settings') && (
                      <Link
                        to="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Settings size={16} className="text-slate-400" />
                        <span>Settings</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Slide-out Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div 
              style={{ background: 'linear-gradient(90deg, #161c5c 0%, #1a237e 100%)' }} 
              className="p-4 text-white flex items-center justify-between border-b border-indigo-950"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">RAATH POS</h3>
                  <p className="text-[10px] text-blue-200">POINT OF SALE</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* User Details */}
            {currentUser && (
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#64b5f6] text-slate-900 font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs">
                  {userInitial}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{userName}</p>
                  <span className="text-[10px] font-semibold text-[#1c2580] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {roleLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {pageVisibility.dashboard !== false && canAccess('dashboard') && (
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/')
                      ? 'bg-[#1c2580] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Dashboard size={18} />
                  <span>Dashboard</span>
                </Link>
              )}

              {filteredGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key} className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <Icon size={14} />
                      <span>{group.label}</span>
                    </div>
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            active
                              ? 'bg-blue-50 text-[#1c2580] font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className={active ? 'text-[#1c2580]' : 'text-slate-400'}>
                            <ItemIcon size={16} />
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Drawer Logout Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}