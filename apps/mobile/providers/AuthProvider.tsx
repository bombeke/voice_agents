import NetInfo from "@react-native-community/netinfo";
import * as SplashScreen from "expo-splash-screen";
import { jwtDecode } from "jwt-decode";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { refreshSession } from "@/services/auth/AuthService";
import {
  clearAuth,
  getExpiry,
  getToken,
  saveExpiry,
  saveToken,
} from "@/services/auth/AuthStorage";

export interface IClaims {
  sub: string;
  roles?: string[];
  permissions?: string[];
  org?: string;
  exp: number;
}

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
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<
    string | undefined
  >(undefined);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const net = await NetInfo.fetch();
        const token = await getToken();
        const expiry = await getExpiry();

        if (!token || !expiry) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const expired = expiry < now;

        if (!expired) {
          if (!cancelled) {
            setIsAuthenticated(true);
            setLoading(false);
          }
          return;
        }

        // Offline & expired
        if (!net.isConnected) {
          if (!cancelled) {
            setOfflineMode(true);
            setIsAuthenticated(true);
            setLoading(false);
          }
          return;
        }

        // Online refresh
        const refreshed = await refreshSession();
        if (refreshed) {
          const newToken = await getToken();
          if (newToken && !cancelled) {
            setClaims(jwtDecode(newToken));
            setIsAuthenticated(true);
          }
        } else {
          await clearAuth();
          if (!cancelled) {
            setIsAuthenticated(false);
          }
        }

        if (!cancelled) {
          setLoading(false);
        }
      } finally {
        // 🔥 Release splash ONLY when auth is fully resolved
        if (!cancelled) {
          await SplashScreen.hideAsync();
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (token: string, expiresAt: number) => {
    const decoded = jwtDecode<IClaims>(token);

    await saveToken(token);
    await saveExpiry(expiresAt);
    //saveClaims(decoded);

    //setClaims(decoded);
    setIsAuthenticated(true);
    return;
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setClaims(null);
    setIsAuthenticated(false);
    setOfflineMode(false);
    setRedirectAfterLogin(undefined);
    return;
  }, []);

  const handleSetRedirectAfterLogin = useCallback((path?: string) => {
    setRedirectAfterLogin((prev) => {
      if (!path) return undefined;
      return prev ?? path;
    });
  }, []);

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
        setRedirectAfterLogin: handleSetRedirectAfterLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
