"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { getApiBaseUrl } from "@/lib/utils";
import { navigateToPath } from "@/lib/navigation";

// Get base domain from host
function getBaseDomain(host: string): string {
  const hostWithoutPort = host.split(":")[0];
  if (hostWithoutPort.includes("localhost") || hostWithoutPort.includes("127.0.0.1")) return "localhost";
  if (hostWithoutPort.includes("localtest.me")) return "localtest.me";
  const parts = hostWithoutPort.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostWithoutPort;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  status?: string;
  roleId?: string | null;
  isFirstPassword?: boolean;
  employee?: {
    id: string;
    employeeId: string;
    designation: { name: string };
    department: { name: string };
  } | null;
  role?: {
    id: string;
    name: string;
    permissions?: Array<{
      permission: {
        name: string;
      };
    }>;
  } | null;
  preferences?: Array<{
    id: string;
    key: string;
    value: string;
    createdAt: string;
    updatedAt: string;
  }>;
  // Impersonation context (present when admin is viewing as another user)
  isImpersonating?: boolean;
  impersonatorId?: string;

  // POS fields
  isPosUser?: boolean;
  terminalId?: string;
  locationId?: string;
  posSessionId?: string;
  terminal?: {
    id: string;
    code: string;
    name: string;
    location?: {
      id: string;
      code: string;
      name: string;
    } | null;
  };
}

interface AuthContextType {
  user: User | null;
  preferences: Record<string, any>;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  updatePreference: (key: string, value: any) => Promise<void>;
  getPreference: (key: string) => any;
  logout: () => Promise<void>;
  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isAdmin: () => boolean;
  // Token management
  refreshToken: () => Promise<boolean>;
  checkAndRefreshSession: () => Promise<boolean>;

  sessionExpired: boolean;
  setSessionExpired: (value: boolean) => void;
  handleSessionExpiry: () => Promise<void>;
  // App initialization controls
  setLoadingProgress: (progress: number) => void;
  setLoadingMessage: (message: string) => void;
  completeAuthStep: () => void;
  completeAppWait: (key: string) => void;
  registerAppWait: (key: string) => void;
  // POS switch-user
  posNeedsUserAuth: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [posNeedsUserAuth, setPosNeedsUserAuth] = useState(false);

  // Track multiple initialization steps
  const [pendingSteps, setPendingSteps] = useState<Set<string>>(new Set(["auth"]));
  const [isInitializing, setIsInitializing] = useState(true);

  const registerAppWait = useCallback((key: string) => {
    setPendingSteps(prev => new Set(prev).add(key));
    setIsInitializing(true);
  }, []);

  const completeAppWait = useCallback((key: string) => {
    setPendingSteps(prev => {
      const next = new Set(prev);
      next.delete(key);
      if (next.size === 0) {
        setIsInitializing(false);
      }
      return next;
    });
  }, []);

  const completeAuthStep = useCallback(() => {
    completeAppWait("auth");
  }, [completeAppWait]);

  // Convert preferences array to object for easier access
  const preferencesToObject = useCallback((prefs: Array<{ key: string; value: string }> | undefined) => {
    if (!prefs) return {};
    const obj: Record<string, any> = {};
    for (const pref of prefs) {
      try {
        obj[pref.key] = JSON.parse(pref.value);
      } catch {
        obj[pref.key] = pref.value;
      }
    }
    return obj;
  }, []);

  // Token refresh promise ref to handle race conditions
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  // Handle session expiry (clear cookies/state, show dialog, NO redirect)
  const handleSessionExpiry = useCallback(async () => {
    try {
      const { logoutClient } = await import("@/lib/client-auth");
      await logoutClient();
    } catch (e) {
      console.error("Error clearing cookies:", e);
    }
    setUser(null);
    setPreferences({});
    setSessionExpired(true);
  }, []);

  // Token refresh function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    // If a refresh is already in progress, return the existing promise
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const { refreshTokenClient } = await import("@/lib/client-auth");
        const result = await refreshTokenClient();

        // Handle both older boolean return type (if cached somehow) and new object return type
        const success = typeof result === 'boolean' ? result : result.success;
        const isNetworkError = typeof result === 'boolean' ? false : result.isNetworkError;

        if (!success && !isNetworkError) {
          // Refresh failed due to 401 or invalid token, trigger session expiry UI
          await handleSessionExpiry();
          return false;
        }

        if (isNetworkError) {
          // It's a network glitch, don't clear the user's session
          return false;
        }

        return true;
      } catch (error) {
        console.error("Token refresh error:", error);
        // Don't auto-logout on unexpected execution errors during refresh
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [handleSessionExpiry]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Ensure URL is absolute; if relative, prepend BASE URL from ENV
      const finalUrl = url.startsWith("http") ? url : `${getApiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AuthProvider authFetch] ${options.method || 'GET'} ${finalUrl}`);
      }
      let response = await fetch(finalUrl, {
        ...options,
        credentials: "include", // ✅ sends ALL cookies automatically
        cache: "no-store",
      });

      // If unauthorized, try refresh once
      if (response.status === 401) {
        const refreshSuccess = await refreshToken();

        if (refreshSuccess) {
          response = await fetch(finalUrl, {
            ...options,
            credentials: "include",
            cache: "no-store",
          });
        }
      }

      return response;
    },
    [refreshToken]
  );


  // Fetch user data including preferences from backend /api/auth/me
  const fetchUser = useCallback(async () => {
    try {
      setLoadingMessage("Connecting to server...");
      setLoadingProgress(10);

      // Try to get user from cookie first for immediate UI update
      try {
        const userCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user='));

        if (userCookie) {
          const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
          // Transform simple permission array from cookie to the structure expected by User interface if needed
          // The cookie usually has { ...user, permissions: string[] }
          // But our User interface expects role.permissions to be populated for helper methods

          if (userData && userData.permissions && Array.isArray(userData.permissions)) {
            // Ensure role structure exists
            if (!userData.role) userData.role = { name: "", permissions: [] };
            else if (typeof userData.role === 'string') userData.role = { name: userData.role, permissions: [] };

            // Map flat permissions to object structure if not already done
            if (!userData.role.permissions || userData.role.permissions.length === 0) {
              userData.role.permissions = userData.permissions.map((p: string) => ({
                permission: { name: p }
              }));
            }
          }

          setUser(userData);
          // NOTE: We intentionally do NOT call setLoading(false) here.
          // Loading stays true until /auth/me completes with real data.
          // Calling it early caused PermissionGuard to render with a stale
          // cookie user that might have incomplete permission structures.
        }
      } catch (e) {
        console.warn("Failed to parse user cookie", e);
      }

      const res = await authFetch(`${getApiBaseUrl()}/auth/me`);

      setLoadingProgress(50);

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          setPreferences({});
          setLoadingProgress(100);
          return;
        }
        // Do not throw here if it's a non-401 error. 
        // We already have user from the cookie, so we can gracefully allow the user to proceed.
        // We just log it and stop further loading.
        console.warn(`Non-401 error fetching user: ${res.status}`);
        setLoadingProgress(100);
        return;
      }

      setLoadingMessage("Loading user data...");
      setLoadingProgress(70);

      const data = await res.json();

      setLoadingProgress(85);

      if (data.status && data.data) {
        const userData = data.data;

        // Ensure permissions are accessible in both formats for compatibility
        // The API returns role.permissions as objects, but we also need flat array for fallback
        if (userData.role?.permissions && Array.isArray(userData.role.permissions) && userData.role.permissions.length > 0) {
          // Extract flat permissions array if not already present
          if (!userData.permissions || !Array.isArray(userData.permissions)) {
            userData.permissions = userData.role.permissions.map((p: any) =>
              p.permission?.name || p.name || p
            ).filter(Boolean);
          }
        }

        if (process.env.NODE_ENV === 'development') {
          const permissionNames = userData.role?.permissions?.map((p: any) => p.permission?.name || p.name || p).filter(Boolean) || [];
          console.log('RBAC - User data from /auth/me:', {
            role: userData.role,
            roleName: userData.role?.name,
            permissionsFromRole: userData.role?.permissions,
            flatPermissions: userData.permissions,
            permissionsCount: userData.permissions?.length || 0,
            actualPermissionNames: permissionNames
          });
        }

        setUser(userData);
        setPreferences(preferencesToObject(userData.preferences));
      }

      setLoadingMessage("Almost done...");
      setLoadingProgress(100);

      // Small delay to show 100% before hiding
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Error fetching user:", error);
      // If we already have a user from the cookie, KEEP it instead of nullifying.
      // This prevents "AccessDenied" flashes on temporary network drops/500 errors.
      setLoadingProgress(100);
    } finally {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthProvider] fetchUser complete');
      }
      setLoading(false);
      completeAuthStep();
    }
  }, [preferencesToObject, authFetch, completeAuthStep]);

  // Set mounted flag to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initial load - only fetch after component is mounted (client-side)
  useEffect(() => {
    if (mounted) {
      fetchUser();
    }
  }, [mounted, fetchUser]);

  // Set up automatic token refresh interval
  useEffect(() => {
    if (!user) return;

    // Refresh token every 6 hours (access token lasts 7 days)
    // This ensures tokens stay fresh without being overly aggressive
    const refreshInterval = setInterval(() => {
      refreshToken();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Also refresh on window focus (user returns to tab)
    const handleFocus = () => {
      refreshToken();
    };

    // Add event listeners
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshToken]);

  const pathname = usePathname();

  // Check for first password status or impersonation
  useEffect(() => {
    if (user?.isFirstPassword || user?.isImpersonating) {
      document.documentElement.style.setProperty("--banner-height", "2.5rem");

      if (user?.isFirstPassword && !user?.isImpersonating) {
        // You can implement forced redirect here if needed
        // if (pathname !== '/hr/settings/password') router.push('/hr/settings/password');

        // For now, let's show a toast
        const { toast } = require("sonner");
        toast.warning("Please change your password", {
          description: "You are using a temporary password. Please update it immediately.",
          duration: Infinity,
          action: {
            label: "Change Now",
            onClick: () => router.push("/hr/settings/password"),
          },
        });
      }
    } else {
      document.documentElement.style.setProperty("--banner-height", "0px");
    }
  }, [user, router]);

  // POS Route Protection — Two-Layer Auth
  // Layer 1: Terminal setup (manager enters PIN via /pos-login)
  // Layer 2: User logs in via standard auth, route guard auto-links to terminal
  const posLinkAttemptedRef = useRef(false);

  useEffect(() => {
    if (!mounted || loading) return;

    const host = typeof window !== "undefined" ? window.location.host : "";
    const isPosSubdomain = host.startsWith("pos.");
    const isPosPath = pathname === "/pos" || pathname?.startsWith("/pos/");
    const isPosLoginPage = pathname === "/pos-login" || pathname === "/auth/pos-login";

    if (!(isPosSubdomain || isPosPath) || isPosLoginPage) return;

    // No user at all — show switch-user form
    if (!user) {
      setPosNeedsUserAuth(true);
      return;
    }

    // All users on POS route must have a terminal assigned
    if (!user.terminalId) {
      navigateToPath("/pos-login");
      return;
    }

    // Since they have a terminalId, allow access immediately
    setPosNeedsUserAuth(false);
  }, [user, pathname, mounted, loading, fetchUser]);

  // Proactive session check - refresh token if needed
  const checkAndRefreshSession = useCallback(async () => {
    if (!user) return false;

    try {
      // Proactive check: if token is already expired or near expiry, refresh first
      // But for simplicity, we let the backend return 401 and handle it there.
      const res = await fetch(`${getApiBaseUrl()}/auth/check-session`, {
        credentials: "include",
      });

      if (res.status === 401) {
        return await refreshToken();
      }

      if (!res.ok) return false;
      const data = await res.json();
      return data.status && data.valid;
    } catch (error) {
      console.error("Session check failed:", error);
      return false;
    }
  }, [user, refreshToken]);

  // Update preference - only update local state since preferences are handled by /api/auth/me
  const updatePreference = useCallback(async (key: string, value: any) => {
    // Update local state immediately for instant UI feedback
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Get preference by key
  const getPreference = useCallback((key: string) => {
    return preferences[key] ?? null;
  }, [preferences]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    await fetchUser();
  }, [fetchUser]);

  // Logout
  const logout = useCallback(async () => {
    const { logoutClient } = await import("@/lib/client-auth");
    await logoutClient();
    setUser(null);
    setPreferences({});
    router.push("/auth/choose-account");
  }, [router]);

  const isAdmin = useCallback((): boolean => {
    // Check role name from nested object or string property
    const roleName = user?.role?.name || (user as any)?.role;

    // Return true for both super_admin and admin roles
    // This allows admins to see and access everything
    if (typeof roleName === 'string') {
      const normalized = roleName.toLowerCase().trim();
      return (
        normalized === "super_admin" ||
        normalized === "admin" ||
        normalized === "super admin" ||
        normalized === "super-admin"
      );
    }

    return false;
  }, [user]);

  // Permission helpers
  const hasPermission = useCallback((permission: string): boolean => {
    if (isAdmin()) return true;
    // Check in role.permissions object structure (from API /me)
    if (user?.role?.permissions && Array.isArray(user.role.permissions) && user.role.permissions.length > 0) {
      // Check if permissions are in object format { permission: { name: "..." } }
      if (user.role.permissions[0].permission) {
        return user.role.permissions.some(p => p.permission?.name === permission);
      }
      // Handle case where permissions might be strings in role.permissions
      if (typeof user.role.permissions[0] === 'string') {
        return (user.role.permissions as any as string[]).includes(permission);
      }
    }

    // Fallback: Check flat permissions array (from cookie or simplified user object)
    // The user interface defines permissions?: string[] on the root object in some contexts (like lib/auth.ts)
    // casting to any to bypass strict type checking for this fallback
    const flatPermissions = (user as any)?.permissions;
    if (flatPermissions && Array.isArray(flatPermissions)) {
      return flatPermissions.includes(permission);
    }

    return false;
  }, [user, isAdmin]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (isAdmin()) return true;
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('RBAC hasAnyPermission: No user', { required: permissions });
      }
      return false;
    }

    // Check in role.permissions object structure (from API /me)
    if (user?.role?.permissions && Array.isArray(user.role.permissions) && user.role.permissions.length > 0) {
      // Check if permissions are in object format { permission: { name: "..." } }
      if (user.role.permissions[0].permission) {
        const userPermissionNames = user.role.permissions.map((p: any) => p.permission?.name).filter(Boolean);
        const hasPermission = permissions.some(permission => userPermissionNames.includes(permission));
        if (process.env.NODE_ENV === 'development') {
          console.log('RBAC hasAnyPermission result (object format):', hasPermission, {
            required: permissions,
            userPermissions: userPermissionNames,
            match: permissions.filter(p => userPermissionNames.includes(p))
          });
        }
        return hasPermission;
      }
      // Handle case where permissions might be strings in role.permissions
      if (typeof user.role.permissions[0] === 'string') {
        const hasPermission = permissions.some(permission =>
          (user.role?.permissions as any as string[]).includes(permission)
        );
        if (process.env.NODE_ENV === 'development') {
          console.log('RBAC hasAnyPermission result (string format):', hasPermission, {
            required: permissions,
            userPermissions: user.role.permissions
          });
        }
        return hasPermission;
      }
    }

    // Fallback: Check flat permissions array (from cookie)
    const flatPermissions = (user as any)?.permissions;
    if (flatPermissions && Array.isArray(flatPermissions)) {
      const hasPermission = permissions.some(p => flatPermissions.includes(p));
      if (process.env.NODE_ENV === 'development') {
        console.log('RBAC hasAnyPermission result (flat array):', hasPermission, {
          userPermissions: flatPermissions,
          required: permissions
        });
      }
      return hasPermission;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('RBAC hasAnyPermission: No permissions found, returning false');
    }
    return false;
  }, [user, isAdmin]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (isAdmin()) return true;
    // Check in role.permissions object structure
    if (user?.role?.permissions && Array.isArray(user.role.permissions) && user.role.permissions.length > 0) {
      if (user.role.permissions[0].permission) {
        return permissions.every(permission =>
          user.role?.permissions?.some(p => p.permission?.name === permission)
        );
      }
      // Handle case where permissions might be strings in role.permissions
      if (typeof user.role.permissions[0] === 'string') {
        return permissions.every(permission =>
          (user.role?.permissions as any as string[]).includes(permission)
        );
      }
    }

    // Fallback: Check flat permissions array
    const flatPermissions = (user as any)?.permissions;
    if (flatPermissions && Array.isArray(flatPermissions)) {
      return permissions.every(p => flatPermissions.includes(p));
    }

    return false;
  }, [user, isAdmin]);

  const contextValue = useMemo(() => ({
    user,
    preferences,
    loading,
    isAuthenticated: !!user,
    refreshUser,
    updatePreference,
    getPreference,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    refreshToken,
    checkAndRefreshSession,

    sessionExpired,
    setSessionExpired,
    handleSessionExpiry,
    setLoadingProgress,
    setLoadingMessage,
    completeAuthStep,
    completeAppWait,
    registerAppWait,
    posNeedsUserAuth,
  }), [
    user,
    preferences,
    loading,
    refreshUser,
    updatePreference,
    getPreference,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    refreshToken,
    checkAndRefreshSession,

    sessionExpired,
    setSessionExpired,
    handleSessionExpiry,
    setLoadingProgress,
    setLoadingMessage,
    completeAuthStep,
    completeAppWait,
    registerAppWait,
    posNeedsUserAuth,
  ]);

  // Don't render children until mounted and initial load is complete
  // This prevents hydration mismatch between server and client
  if (!mounted || loading) {
    return (
      <AuthContext.Provider
        value={{
          user,
          preferences,
          loading: true,
          isAuthenticated: false,
          refreshUser,
          updatePreference,
          getPreference,
          logout,
          hasPermission: () => false,
          hasAnyPermission: () => false,
          hasAllPermissions: () => false,
          isAdmin: () => false,
          refreshToken: async () => false,
          checkAndRefreshSession: async () => false,

          sessionExpired: false,
          setSessionExpired: () => { },
          handleSessionExpiry: async () => { },
          setLoadingProgress,
          setLoadingMessage,
          completeAuthStep,
          completeAppWait,
          registerAppWait,
          posNeedsUserAuth,
        }}
      >
        <LoadingScreen progress={loadingProgress} message={loadingMessage} />
      </AuthContext.Provider>
    );
  }

  if (loading && !mounted) {
    return (
      <AuthContext.Provider value={contextValue}>
        <LoadingScreen progress={loadingProgress} message={loadingMessage} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {mounted && children}
      {(!mounted || isInitializing) && (
        <LoadingScreen progress={loadingProgress} message={loadingMessage} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

