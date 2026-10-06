// ============================================================
//  frontend/src/AuthContext.jsx - Pure JWT Authentication Context
//  Zero Firebase Dependency - Connects directly to Backend API
//  Full Multi-Tenant Awareness
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api/apiClient';
import { getRoles, hasPermission } from './role';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('RAATH POS Store');

  // Load available roles
  const loadRoles = useCallback(async () => {
    try {
      const dbRoles = await getRoles();
      setRoles(dbRoles);
      const perms = {};
      dbRoles.forEach(r => { perms[r.id] = r.pages || []; });
      setRolePermissions(perms);
    } catch (e) {
      console.warn('[AuthContext] Roles load warning:', e.message);
    }
  }, []);

  // Restore authenticated session on mount
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        await loadRoles();
        const token = localStorage.getItem('raath_token');
        const savedUserStr = localStorage.getItem('current_user');

        if (token && savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr);
            const tenantId = savedUser.tenant_id || savedUser.shop_id || 'tenant_default';
            if (mounted) {
              setUser(savedUser);
              setIsAuthenticated(true);
              setShopId(tenantId);
              setShopName(savedUser.shop_name || 'RAATH POS Store');
              localStorage.setItem('raath_tenant_id', tenantId);
            }

            // Verify token with backend
            api.get('/auth/me').then(res => {
              if (res.success && (res.user || res.data) && mounted) {
                const refreshedUser = res.user || res.data;
                const freshTenantId = refreshedUser.tenant_id || refreshedUser.shop_id || tenantId;
                setUser(refreshedUser);
                setShopId(freshTenantId);
                setShopName(refreshedUser.shop_name || 'RAATH POS Store');
                localStorage.setItem('current_user', JSON.stringify(refreshedUser));
                localStorage.setItem('raath_tenant_id', freshTenantId);
              }
            }).catch(() => {
              // If backend is unreachable or token invalid, keep cached session if not expired
            });
          } catch (e) {
            localStorage.removeItem('current_user');
            localStorage.removeItem('raath_token');
            localStorage.removeItem('raath_tenant_id');
          }
        }
      } catch (err) {
        console.error('[AuthContext] Session restore error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();
    return () => { mounted = false; };
  }, [loadRoles]);

  // Login handler
  const login = async (identifier, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        username: identifier,
        email: identifier,
        password
      });

      if (!res.success || !res.token) {
        throw new Error(res.error || 'Login failed. Please check your credentials.');
      }

      const userData = res.user || res.data || {};
      const token = res.token;
      const tenantId = userData.tenant_id || userData.shop_id || 'tenant_default';
      const roleData = res.role || {
        id: userData.role || 'admin',
        pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup']
      };

      localStorage.setItem('raath_token', token);
      localStorage.setItem('current_user', JSON.stringify(userData));
      localStorage.setItem('raath_tenant_id', tenantId);
      localStorage.setItem('raath_shop_name', userData.shop_name || 'RAATH POS Store');

      setUser(userData);
      setIsAuthenticated(true);
      setShopId(tenantId);
      setShopName(userData.shop_name || 'RAATH POS Store');

      return { success: true, user: userData, role: roleData, token };
    } catch (error) {
      console.error('[AuthContext] Login error:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Register handler
  const register = async (emailOrData, password, shopData = {}) => {
    setLoading(true);
    try {
      let payload;
      if (typeof emailOrData === 'object' && emailOrData !== null) {
        payload = emailOrData;
      } else {
        payload = {
          email: emailOrData,
          password: password,
          name: shopData.name || (emailOrData ? emailOrData.split('@')[0] : 'User'),
          phone: shopData.phone || '',
          shop_name: shopData.shopName || shopData.shop_name || 'RAATH POS Store',
          shop_address: shopData.shopAddress || shopData.shop_address || '',
          business_type: shopData.businessType || shopData.business_type || 'retail',
          currency: shopData.currency || 'PKR',
          role: 'admin'
        };
      }

      const res = await api.post('/auth/register', payload);
      if (!res.success) {
        throw new Error(res.error || 'Registration failed');
      }

      const userData = res.user || {};
      const tenantId = userData.tenant_id || userData.shop_id || 'tenant_default';

      if (res.token && res.user) {
        localStorage.setItem('raath_token', res.token);
        localStorage.setItem('current_user', JSON.stringify(userData));
        localStorage.setItem('raath_tenant_id', tenantId);
        localStorage.setItem('raath_shop_name', userData.shop_name || 'RAATH POS Store');
        setUser(userData);
        setIsAuthenticated(true);
        setShopId(tenantId);
        setShopName(userData.shop_name || 'RAATH POS Store');
      }

      const roleData = res.role || {
        id: 'admin',
        pages: ['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup']
      };

      return { success: true, user: userData, role: roleData, token: res.token, message: 'Account registered successfully' };
    } catch (error) {
      console.error('[AuthContext] Register error:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post('/auth/logout').catch(() => {});
    } catch (_) {}
    localStorage.removeItem('raath_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('raath_tenant_id');
    localStorage.removeItem('raath_shop_name');
    setUser(null);
    setIsAuthenticated(false);
    setShopId(null);
  };

  // Permission checker
  const checkPermissionSync = useCallback((pageId) => {
    if (!user || !user.role) return false;
    if (user.role === 'admin') return true;
    return hasPermission(user.role, pageId);
  }, [user]);

  const value = {
    user,
    roles,
    rolePermissions,
    loading,
    isAuthenticated,
    shopId,
    shopName,
    login,
    register,
    logout,
    checkPermissionSync,
    hasPermission: checkPermissionSync
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;