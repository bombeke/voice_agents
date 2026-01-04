import NetInfo from "@react-native-community/netinfo";
import { jwtDecode } from "jwt-decode";
import React, { createContext, useContext, useEffect, useState } from "react";

import { refreshSession } from "@/services/auth/AuthService";
import { clearAuth, getClaims, getExpiry, getToken, saveClaims, saveExpiry, saveToken } from "@/services/auth/AuthStorage";

export interface IClaims {
  sub: string;
  roles?: string[];
  permissions?: string[];
  org?: string;
  exp: number;
};

export type AdminMode = "online" | "offline-readonly" | "disabled";

export type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  offlineMode: boolean;
  isAdmin: boolean;
  adminMode: AdminMode;
  claims?: IClaims | null;
  permissions: string[];
  org?: string;

  redirectAfterLogin?: string;

  login: (token: string, expiresAt: number) => Promise<void>;
  logout: () => Promise<void>;
  setRedirectAfterLogin: (path?: string) => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [claims, setClaims] = useState<IClaims | null>(null);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | undefined>('/(tabs)');
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const net = await NetInfo.fetch();
      const token = await getToken();
      const expiry = await getExpiry();
      const cachedClaims = getClaims();

      if (!token || !expiry) {
        setLoading(false);
        return;
      }

      // token valid
      const now = Math.floor(Date.now() / 1000);
      const expired = expiry < now;

      if (!expired) {
        setClaims(cachedClaims ?? jwtDecode(token));
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // offline & expired → downgrade
      if (!net.isConnected) {
        setOfflineMode(true);
        setClaims(cachedClaims);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // online → refresh token
      const refreshed = await refreshSession();
      if (refreshed) {
        const newToken = await getToken();
        const decoded = jwtDecode<IClaims>(newToken!);
        setClaims(decoded);
        setIsAuthenticated(true);
      } 
      else {
        await clearAuth();
        setClaims(null);
        setIsAuthenticated(false);
      }

      setLoading(false);
    };

    bootstrap();
  }, []);

  const login = async (token: string, expiresAt: number) => {
    const decoded = jwtDecode<IClaims>(token);

    await saveToken(token);
    await saveExpiry(expiresAt);
    saveClaims(decoded);

    setClaims(decoded);
    setIsAuthenticated(true);
    return;
  };

  const logout = async () => {
    await clearAuth();
    setClaims(null);
    setIsAuthenticated(false);
    setOfflineMode(false);
    return;
  };

  const isAdmin = !!claims?.roles?.includes("admin");

  // Offline admin read-only mode
  let adminMode: AdminMode = "disabled";
  if (isAdmin && isAuthenticated) {
    adminMode = offlineMode ? "offline-readonly" : "online";
  }

  const permissions = claims?.permissions ?? [];
  const org = claims?.org;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        offlineMode,
        isAdmin,
        adminMode,
        claims,
        permissions,
        org,
        redirectAfterLogin,
        login,
        logout,
        setRedirectAfterLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
