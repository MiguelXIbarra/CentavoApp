import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [isLoading, setIsLoading] = useState(true);

  // Validación inicial de sesión centralizada
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const { valid, user: validatedUser } = await authService.validateSession();
        if (isMounted) {
          setIsAuthenticated(valid);
          setUser(valid ? validatedUser : null);
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const result = await authService.register(name, email, password);
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }, []);

  const loginDemo = useCallback(() => {
    const demoUser = authService.loginAsDemo();
    setUser(demoUser);
    setIsAuthenticated(true);
    return demoUser;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    loginDemo,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
