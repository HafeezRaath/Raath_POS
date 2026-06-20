import React, { createContext, useContext, useState, useEffect } from 'react';

// ==================== AUTH CONTEXT ====================
const AuthContext = createContext(null);

// Custom hook for easy access
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check localStorage on app load
  useEffect(() => {
    const checkAuth = () => {
      try {
        const stored = localStorage.getItem('pos_user');
        if (stored) {
          const parsedUser = JSON.parse(stored);
          // Validate parsed data has required fields
          if (parsedUser && parsedUser.id && parsedUser.email) {
            setUser(parsedUser);
          } else {
            localStorage.removeItem('pos_user');
            setUser(null);
          }
        }
      } catch (e) {
        console.error('Failed to parse user data:', e);
        localStorage.removeItem('pos_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login: update state + localStorage
  const login = (userData) => {
    if (!userData || !userData.id || !userData.email) {
      console.error('Invalid user data provided to login');
      return;
    }
    localStorage.setItem('pos_user', JSON.stringify(userData));
    setUser(userData);
  };

  // Logout: clear state + localStorage
  const logout = () => {
    localStorage.removeItem('pos_user');
    setUser(null);
  };

  // Update user data without full re-login
  const updateUser = (updates) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('pos_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}