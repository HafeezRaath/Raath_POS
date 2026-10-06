import React, { useState, memo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Dashboard,
  PointOfSale,
  Inventory,
  Payment,
  People,
  Plus,
  Receipt,
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
  X,
} from './ui/icons';

const MORE_ITEMS = [
  { path: '/sales-history', icon: Receipt, label: 'Sales' },
  { path: '/returns', icon: AssignmentReturn, label: 'Returns' },
  { path: '/products', icon: Category, label: 'Products' },
  { path: '/suppliers', icon: LocalShipping, label: 'Suppliers' },
  { path: '/expenses', icon: MoneyOff, label: 'Expenses' },
  { path: '/recovery', icon: AttachMoney, label: 'Recovery' },
  { path: '/accounts', icon: AccountBalance, label: 'Accounts' },
  { path: '/reports', icon: Assessment, label: 'Reports' },
  { path: '/stock-tracking', icon: TrackChanges, label: 'Stock' },
  { path: '/backup', icon: CloudUpload, label: 'Backup' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const MAIN_NAV = [
  { path: '/', icon: Dashboard, label: 'Home' },
  { path: '/billing', icon: PointOfSale, label: 'Bill' },
  { path: '/inventory', icon: Inventory, label: 'Stock' },
  { path: '/emi', icon: Payment, label: 'EMI' },
  { path: '/customers', icon: People, label: 'Cust' },
];

const MobileNav = memo(() => {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = useCallback((p) => pathname === p, [pathname]);

  if (pathname === '/billing') return null;

  return (
    <div className="md:hidden mobile-nav-bar">
      {/* Floating Action Button for Quick Sale */}
      <Link
        to="/billing"
        className="fixed bottom-[68px] left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-[#00c853] hover:bg-[#00b046] text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 active:scale-95 transition-transform"
        aria-label="New Bill"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-between safe-area-pb">
        {MAIN_NAV.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                active ? 'text-[#1c2580] font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon size={20} />
              <span className="text-[11px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Gap for FAB */}
        <div className="w-14 flex-shrink-0" />

        {MAIN_NAV.slice(2).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                active ? 'text-[#1c2580] font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon size={20} />
              <span className="text-[11px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* More Options Button */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            moreOpen ? 'text-[#1c2580] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MoreHoriz size={20} />
          <span className="text-[11px] mt-0.5">More</span>
        </button>
      </div>

      {/* More Slide-up Bottom Drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 max-h-[80vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200">
            {/* Drawer Handle */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1" />

            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">All Navigation</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[60vh]">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      active
                        ? 'bg-blue-50 border-blue-200 text-[#1c2580] font-bold'
                        : 'bg-slate-50/60 border-slate-200/60 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        active ? 'bg-[#1c2580] text-white' : 'bg-white text-slate-600 shadow-xs'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="text-xs">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MobileNav;