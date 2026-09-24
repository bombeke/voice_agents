import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { refreshSession } from "@/services/auth/AuthService";
import {
  clearSession,
  loadSession,
  saveSession,
} from "@/services/auth/AuthStorage";
import { isTokenExpired } from "@/services/auth/AuthUtils";
import { effectivePermissions } from "@/services/auth/Roles";
import { closeUserData, openUserData } from "@/services/storage/UserData";
import type { AuthMethod, Claims, Session } from "@/types/Auth";

export type { Claims };

export type AdminMode = "online" | "offline-readonly" | "disabled";

export type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  offlineMode: boolean;
  isAdmin: boolean;
  adminMode: AdminMode;
  claims?: Claims | null;
  /** How the current session signed in; undefined when signed out. */
  authMethod?: AuthMethod;
  permissions: string[];
  org?: string;

  redirectAfterLogin?: string;

  signIn: (session: Session) => Promise<void>;
  logout: () => Promise<void>;
  setRedirectAfterLogin: (path?: string) => void;
};

const AuthContext = createContext<AuthContextType>(null!);

/** The signed-in person as records name them. */
const userOf = (claims: Claims) => ({
  id: claims.sub,
  name: claims.name ?? claims.preferred_username ?? claims.sub,
});

type BootResult = {
  claims: Claims | null;
  method?: AuthMethod;
  offline: boolean;
};

/** Resolve the stored session at launch: valid, cached offline, refreshed, or none. */
async function restoreSession(): Promise<BootResult> {
  const session = await loadSession();
  if (!session) return { claims: null, offline: false };

  if (!isTokenExpired(session.expiresAt)) {
    return { claims: session.claims, method: session.method, offline: false };
  }

  // Expired but offline: keep working on the cached session so field capture
  // never blocks on connectivity. The API refreshes on the next 401.
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return { claims: session.claims, method: session.method, offline: true };
  }

  if (await refreshSession()) {
    const next = await loadSession();
    if (next)
      return { claims: next.claims, method: next.method, offline: false };
  }
  await clearSession();
  return { claims: null, offline: false };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>();
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string>();
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .catch((err) => {
        console.error("Failed to restore session:", err);
        return { claims: null, offline: false };
      })
      .then(async (boot: BootResult) => {
        // The user's own database loads before any screen can read it.
        if (boot.claims) await openUserData(userOf(boot.claims));
        return boot;
      })
      .catch((err) => {
        console.error("Failed to open the user's data:", err);
        return { claims: null, offline: false } as BootResult;
      })
      .then(({ claims, method, offline }: BootResult) => {
        if (cancelled) return;
        setClaims(claims);
        setAuthMethod(method);
        setOfflineMode(offline);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (session: Session) => {
    await openUserData(userOf(session.claims));
    await saveSession(session);
    setOfflineMode(false);
    setClaims(session.claims);
    setAuthMethod(session.method);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setClaims(null);
    setAuthMethod(undefined);
    setOfflineMode(false);
    setRedirectAfterLogin(undefined);
    // After the screens let go of the stores; unsent records stay saved.
    await closeUserData();
  }, []);

  const handleSetRedirectAfterLogin = useCallback((path?: string) => {
    setRedirectAfterLogin((prev) => (path ? (prev ?? path) : undefined));
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const isAuthenticated = claims !== null;
    const isAdmin = !!claims?.roles?.includes("admin");
    let adminMode: AdminMode = "disabled";
    if (isAdmin) adminMode = offlineMode ? "offline-readonly" : "online";

    return {
      isAuthenticated,
      loading,
      offlineMode,
      isAdmin,
      adminMode,
      claims,
      authMethod,
      permissions: effectivePermissions(claims),
      org: claims?.org,
      redirectAfterLogin,
      signIn,
      logout,
      setRedirectAfterLogin: handleSetRedirectAfterLogin,
    };
  }, [
    claims,
    authMethod,
    loading,
    offlineMode,
    redirectAfterLogin,
    signIn,
    logout,
    handleSetRedirectAfterLogin,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
