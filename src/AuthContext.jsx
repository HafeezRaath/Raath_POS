import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import db from './database/db';
import { getRoles, hasPermission, clearRoleCache } from './role';
import { verifyPassword } from './database/core/utils';

// Firebase imports
import { auth as firebaseAuth } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getFirestore,
  collection, 
  query, 
  where, 
  limit, 
  getDocs
} from 'firebase/firestore';
import { cloudSync } from './cloudSync';

const firestoreDb = getFirestore();
const AuthContext = createContext(null);

// Demo user for Hostinger / web mode (no database)
const DEMO_USER = {
  id: 'demo-admin',
  name: 'Admin User',
  username: 'admin',
  email: 'admin@posit.com',
  role: 'admin',
  shop_name: 'POSIT Store',
  shop_address: '',
  business_type: 'retail',
  currency: 'PKR',
  status: 'active',
  created_at: new Date().toISOString(),
  shop_id: 'shop_demo',
};

const DEMO_ROLE = {
  id: 'admin',
  label: 'Administrator',
  color: 'error',
  permissions: ['All Access'],
  pages: ['dashboard','pos','sales','inventory','products','customers','suppliers','purchases','expenses','reports','settings','emi','users','backup'],
  is_default: 1
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Load roles on mount
  useEffect(() => {
    let mounted = true;
    const initRoles = async () => {
      try {
        const dbRoles = await getRoles();
        if (mounted) {
          setRoles(dbRoles);
          const perms = {};
          dbRoles.forEach(r => { perms[r.id] = r.pages || []; });
          setRolePermissions(perms);
        }
      } catch (e) {
        console.error('[AuthContext] Role load error:', e);
      }
    };
    initRoles();
    return () => { mounted = false; };
  }, []);

  // Firebase Auth state listener
  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const userDoc = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const sid = data.shop_id || `shop_${fbUser.uid}`;
            const sName = data.shop_name || 'My Shop';

            setShopId(sid);
            setShopName(sName);
            localStorage.setItem('raath_shop_id', sid);
            localStorage.setItem('raath_shop_name', sName);
            cloudSync.setShopId(sid);

             const mergedUser = {
              id: fbUser.uid,
              name: data.owner_name || fbUser.displayName || fbUser.email,
              username: data.username || data.name || '',
              email: fbUser.email,
              role: data.role || 'admin',
              shop_name: sName,
              shop_address: data.shop_address || '',
              business_type: data.business_type || 'retail',
              currency: data.currency || 'PKR',
              status: 'active',
              created_at: data.created_at || new Date().toISOString(),
              shop_id: sid,
            };

            setUser(mergedUser);
            setIsAuthenticated(true);
            localStorage.setItem('current_user', JSON.stringify(mergedUser));

            // Pull cloud data to local
            setSyncing(true);
            try {
              await db.syncFromCloud();
            } catch (e) {
              console.warn('[AuthContext] Cloud sync failed:', e);
            }
            setSyncing(false);
          }
        } catch (e) {
          console.error('[AuthContext] Firebase user load error:', e);
        }
      } else {
        setFirebaseUser(null);
        // Don't clear user here — let restoreSession handle localStorage fallback
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Restore session from localStorage (fallback for demo / offline)
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem('current_user');
        if (saved) {
          const parsed = JSON.parse(saved);

          // DEMO: agar demo user hai to directly restore karo
          if (parsed.email === 'admin@posit.com') {
            if (mounted) {
              setUser(parsed);
              setShopId(parsed.shop_id || 'shop_demo');
              setShopName(parsed.shop_name || 'POSIT Store');
              setIsAuthenticated(true);
              cloudSync.setShopId(parsed.shop_id || 'shop_demo');
            }
            if (mounted) setLoading(false);
            return;
          }

          // REAL USER: DB mein verify karo (Electron mode)
          try {
            const dbUser = await db.getUserById(parsed.id);
            if (mounted && dbUser && dbUser.status === 'active') {
              setUser(dbUser);
              setIsAuthenticated(true);
              const sid = dbUser.shop_id || `shop_${dbUser.id}`;
              setShopId(sid);
              setShopName(dbUser.shop_name || 'My Shop');
              cloudSync.setShopId(sid);
            } else if (mounted) {
              localStorage.removeItem('current_user');
            }
          } catch (dbErr) {
            // Agar DB nahi mila (web mode), to localStorage se hi restore kar do
            if (mounted) {
              setUser(parsed);
              setIsAuthenticated(true);
              setShopId(parsed.shop_id || 'shop_default');
              setShopName(parsed.shop_name || 'My Shop');
              cloudSync.setShopId(parsed.shop_id || 'shop_default');
            }
          }
        }
      } catch (e) {
        console.error('[AuthContext] Session restore error:', e);
        localStorage.removeItem('current_user');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    restoreSession();
    return () => { mounted = false; };
  }, []);

  // ==================== LOGIN ====================
const login = useCallback(async (email, password) => {
    try {
      // ===== DEMO LOGIN (Hostinger / Web / No DB) =====
      if (email.toLowerCase() === 'admin@posit.com' && password === 'admin123') {
        setUser(DEMO_USER);
        setIsAuthenticated(true);
        setShopId(DEMO_USER.shop_id);
        setShopName(DEMO_USER.shop_name);
        cloudSync.setShopId(DEMO_USER.shop_id);
        localStorage.setItem('current_user', JSON.stringify(DEMO_USER));
        return { success: true, user: DEMO_USER, role: DEMO_ROLE };
      }

      let foundUser = null;
      let foundShopId = null;

      // ===== STEP 1: Try Firebase Auth First (For Admin / Main Owners) =====
      try {
        const fbResult = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const fbUser = fbResult.user;

        // Check root-level users doc
        let userDoc = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
        let data = userDoc.exists() ? userDoc.data() : null;
        let sid = data?.shop_id || `shop_${fbUser.uid}`;

        // If not in root, check inside shops/{shopId}/users/{uid}
        if (!data) {
          const shopsSnap = await getDocs(collection(firestoreDb, 'shops'));
          for (const shopDoc of shopsSnap.docs) {
            const shopUsersRef = doc(firestoreDb, 'shops', shopDoc.id, 'users', fbUser.uid);
            const shopUserSnap = await getDoc(shopUsersRef);
            if (shopUserSnap.exists()) {
              data = shopUserSnap.data();
              sid = shopDoc.id;
              break;
            }
          }
        }

        if (data) {
          foundUser = {
            id: fbUser.uid,
            name: data.owner_name || data.name || fbUser.displayName || fbUser.email,
            email: fbUser.email,
            role: data.role || 'admin',
            shop_name: data.shop_name || 'My Shop',
            shop_address: data.shop_address || '',
            business_type: data.business_type || 'retail',
            currency: data.currency || 'PKR',
            status: data.status || 'active',
            created_at: data.created_at || new Date().toISOString(),
            shop_id: sid,
          };
          foundShopId = sid;
        }
      } catch (fbErr) {
        console.log('[AuthContext] Firebase Auth login skipped/failed, checking database query:', fbErr.message);
      }

           // ===== STEP 2: Fallback to Firestore Database Search (For Staff & Created Users) =====
      if (!foundUser) {
        const shopsSnap = await getDocs(collection(firestoreDb, 'shops'));
        for (const shopDoc of shopsSnap.docs) {
          const usersRef = collection(firestoreDb, 'shops', shopDoc.id, 'users');
          
          // ✅ Try email first
          let q = query(usersRef, 
            where('email', '==', email.toLowerCase().trim()),
            limit(1)
          );
          let userSnap = await getDocs(q);
          
          // ✅ Fallback: try username if email not found
          if (userSnap.empty) {
            q = query(usersRef,
              where('username', '==', email.toLowerCase().trim()),
              limit(1)
            );
            userSnap = await getDocs(q);
          }
          
          // ✅ Fallback: try name field (legacy support)
          if (userSnap.empty) {
            q = query(usersRef,
              where('name', '==', email.toLowerCase().trim()),
              limit(1)
            );
            userSnap = await getDocs(q);
          }

          if (!userSnap.empty) {
            const userData = userSnap.docs[0].data();
            if (userData.is_deleted === 1) {
              throw new Error('This account has been deactivated.');
            }
            
            // Verify password match
            const storedPassword = userData.password || userData.password_hash;
            if (storedPassword && storedPassword === password) {
              foundUser = { id: userSnap.docs[0].id, ...userData };
              foundShopId = shopDoc.id;
              break;
            }
          }
        }
      }

     if (!foundUser) {
        throw new Error('Invalid username/email or password');
      }

      // ===== STEP 3: Setup Session & Context =====
      const sName = foundUser.shop_name || 'My Shop';
      setShopId(foundShopId);
      setShopName(sName);
      localStorage.setItem('raath_shop_id', foundShopId);
      localStorage.setItem('raath_shop_name', sName);
      cloudSync.setShopId(foundShopId);

           const safeUser = {
        id: foundUser.id,
        name: foundUser.name || foundUser.email,
        username: foundUser.username || foundUser.name || '',
        email: foundUser.email,
        phone: foundUser.phone || '',
        role: foundUser.role || 'cashier',
        shop_name: sName,
        shop_address: foundUser.shop_address || '',
        business_type: foundUser.business_type || 'retail',
        currency: foundUser.currency || 'PKR',
        status: foundUser.status || 'active',
        created_at: foundUser.created_at || new Date().toISOString(),
        shop_id: foundShopId,
      };

      setUser(safeUser);
      setIsAuthenticated(true);
      localStorage.setItem('current_user', JSON.stringify(safeUser));

      // Sync cloud data locally in background
      try {
        await db.syncFromCloud();
      } catch (e) {
        console.warn('[AuthContext] Cloud sync failed:', e);
      }

      const dbRoles = await getRoles();
      const userRole = dbRoles.find(r => r.id === safeUser.role);

      return { success: true, user: safeUser, role: userRole || DEMO_ROLE };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // ==================== REGISTER ====================
  const register = useCallback(async (email, password, shopData) => {
    try {
      // Create Firebase Auth user
      const fbResult = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const fbUser = fbResult.user;

      if (shopData.name) {
        await updateProfile(fbUser, { displayName: shopData.name });
      }

      const sid = `shop_${fbUser.uid}`;
      const sName = shopData.shopName || 'My Shop';

      // Save user doc
      await setDoc(doc(firestoreDb, 'users', fbUser.uid), {
        email: fbUser.email,
        shop_id: sid,
        shop_name: sName,
        owner_name: shopData.name || '',
        phone: shopData.phone || '',
        business_type: shopData.businessType || 'retail',
        role: 'admin',
        created_at: new Date().toISOString(),
      });

      // Save shop doc
      await setDoc(doc(firestoreDb, 'shops', sid), {
        shop_id: sid,
        shop_name: sName,
        owner_uid: fbUser.uid,
        owner_email: fbUser.email,
        created_at: new Date().toISOString(),
      });

      // Set locally
      localStorage.setItem('raath_shop_id', sid);
      localStorage.setItem('raath_shop_name', sName);
      cloudSync.setShopId(sid);

     const mergedUser = {
        id: fbUser.uid,
        name: shopData.name || fbUser.email,
        username: shopData.username || shopData.name || '',
        email: fbUser.email,
        role: 'admin',
        shop_name: sName,
        shop_address: '',
        business_type: shopData.businessType || 'retail',
        currency: 'PKR',
        status: 'active',
        created_at: new Date().toISOString(),
        shop_id: sid,
      };

      setUser(mergedUser);
      setIsAuthenticated(true);
      setShopId(sid);
      setShopName(sName);
      setFirebaseUser(fbUser);
      localStorage.setItem('current_user', JSON.stringify(mergedUser));

      return { success: true, user: mergedUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // ==================== LOGOUT ====================
  const logout = useCallback(async () => {
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      // ignore if not signed in with Firebase
    }
    // Clear local DB data for privacy
    try {
      await db.clearAllData();
    } catch (e) {
      console.warn('[AuthContext] clearAllData error:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
    setFirebaseUser(null);
    setShopId(null);
    setShopName('');
    localStorage.removeItem('current_user');
    localStorage.removeItem('raath_shop_id');
    localStorage.removeItem('raath_shop_name');
  }, []);

  // ==================== PERMISSION CHECKS ====================
  const checkPermission = useCallback(async (pageId) => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, pageId);
  }, [user]);

  const checkPermissionSync = useCallback((pageId) => {
    if (!user || !user.role) return false;
    if (user.role === 'admin') return true;
    return rolePermissions[user.role]?.includes(pageId) || false;
  }, [user, rolePermissions]);

  // ==================== REFRESH USER ====================
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    if (user.email === 'admin@posit.com') return;

    // If Firebase user exists, refresh from Firestore
    if (firebaseUser) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const fresh = {
            id: firebaseUser.uid,
            name: data.owner_name || firebaseUser.displayName || firebaseUser.email,
            email: firebaseUser.email,
            role: data.role || 'admin',
            shop_name: data.shop_name || 'My Shop',
            shop_address: data.shop_address || '',
            business_type: data.business_type || 'retail',
            currency: data.currency || 'PKR',
            status: 'active',
            created_at: data.created_at || new Date().toISOString(),
            shop_id: data.shop_id || `shop_${firebaseUser.uid}`,
          };
          setUser(fresh);
          localStorage.setItem('current_user', JSON.stringify(fresh));
        }
      } catch (e) {
        console.error('[AuthContext] Firebase refresh error:', e);
      }
      return;
    }

    // Fallback to DB refresh
    try {
      const fresh = await db.getUserById(user.id);
      if (fresh) {
       const safeUser = {
          id: fresh.id,
          name: fresh.name,
          username: fresh.username || fresh.name || '',
          email: fresh.email,
          phone: fresh.phone,
          role: fresh.role,
          shop_name: fresh.shop_name,
          shop_address: fresh.shop_address,
          business_type: fresh.business_type,
          currency: fresh.currency,
          status: fresh.status,
          created_at: fresh.created_at,
          shop_id: fresh.shop_id || `shop_${fresh.id}`,
        };
        setUser(safeUser);
        localStorage.setItem('current_user', JSON.stringify(safeUser));
      }
    } catch (e) {
      console.error('[AuthContext] Refresh error:', e);
    }
  }, [user?.id, user?.email, firebaseUser]);

  // ==================== REFRESH ROLES ====================
  const refreshRoles = useCallback(async () => {
    try {
      clearRoleCache();
      const dbRoles = await getRoles();
      setRoles(dbRoles);
      const perms = {};
      dbRoles.forEach(r => { perms[r.id] = r.pages || []; });
      setRolePermissions(perms);
    } catch (e) {
      console.error('[AuthContext] Role refresh error:', e);
    }
  }, []);

  const value = {
    user,
    isAuthenticated,
    loading,
    syncing,
    roles,
    rolePermissions,
    shopId,
    shopName,
    login,
    logout,
    register,
    checkPermission,
    checkPermissionSync,
    refreshUser,
    refreshRoles,
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

// Component wrapper - renders children only if user has permission
export function PermissionGuard({ pageId, children, fallback }) {
  const { checkPermissionSync, user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const doCheck = async () => {
      const syncResult = checkPermissionSync(pageId);
      if (syncResult) {
        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }
      const result = await hasPermission(user?.role, pageId);
      if (mounted) {
        setAllowed(result);
        setChecking(false);
      }
    };
    doCheck();
    return () => { mounted = false; };
  }, [pageId, checkPermissionSync, user?.role]);

  if (checking) return null;
  if (!allowed) return fallback || null;
  return children;
}