"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string | null;
  permissions: string[];
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userCookie = Cookies.get("user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const isAdmin = useCallback((): boolean => {
    // Check role name from nested object or string property
    const roleName = (user?.role as any)?.name || user?.role;

    if (typeof roleName === 'string') {
      const normalized = roleName.toLowerCase().trim();
      return normalized === "super_admin" || normalized === "admin" || normalized === "super admin";
    }

    return false;
  }, [user]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;
    return user.permissions.includes(permission);
  }, [user, isAdmin]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;
    return permissions.some((p) => user.permissions.includes(p));
  }, [user, isAdmin]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;
    return permissions.every((p) => user.permissions.includes(p));
  }, [user, isAdmin]);

  const logout = useCallback(async () => {
    // Call server action
    const { logout: serverLogout } = await import("@/lib/actions/auth");
    await serverLogout();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    logout,
  };
}

