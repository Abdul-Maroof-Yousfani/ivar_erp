"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { ReactNode } from "react";

import { AccessDenied } from "./access-denied";

interface PermissionGuardProps {
    children: ReactNode;
    permissions: string | string[];
    requireAll?: boolean;
    fallback?: ReactNode;
}

export function PermissionGuard({
    children,
    permissions,
    requireAll = false,
    fallback,
}: PermissionGuardProps) {
    const { hasPermission, hasAllPermissions, hasAnyPermission, loading, isAdmin } = useAuth();

    // If fallback is not provided, default to AccessDenied
    const fallbackUI = fallback !== undefined ? fallback : <AccessDenied />;

    if (loading) {
        return null; // Or a loading spinner if preferred
    }

    if (isAdmin()) {
        return <>{children}</>;
    }

    const perms = Array.isArray(permissions) ? permissions : [permissions];

    if (perms.length === 0) {
        return <>{children}</>;
    }

    const isAuthorized = requireAll
        ? hasAllPermissions(perms)
        : hasAnyPermission(perms);

    if (!isAuthorized) {
        return <>{fallbackUI}</>;
    }

    return <>{children}</>;
}
