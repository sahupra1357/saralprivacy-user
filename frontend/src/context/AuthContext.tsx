import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthContextType, User } from '../types/auth';
import { logout as apiLogout, refreshToken } from '../api/auth';
import { setAccessToken, setLogoutHandler } from '../api/axiosInstance';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((token: string, u: User) => {
    setToken(token);
    setAccessToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore errors on logout
    }
    setToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    refreshToken()
      .then((data) => {
        if (!cancelled) {
          setToken(data.access_token);
          setAccessToken(data.access_token);
        }
      })
      .catch(() => {
        // no valid refresh cookie — user not logged in
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
