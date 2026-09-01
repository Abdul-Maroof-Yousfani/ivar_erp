"use client";

import { useEffect } from "react";
import { ViewTransition } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { usePathname, useRouter } from "next/navigation";
import { getRoutePermissions } from "@/lib/route-permissions";
import { useAuth } from "@/components/providers/auth-provider";
import { LocationGuard } from "@/components/pos/location-guard";
import { ShiftGuard } from "@/components/pos/shift-guard";
import { PageTransition } from "@/components/layouts/page-transition";
import { TitleUpdater } from "@/components/common/title-updater";
import { toast } from "sonner";

export default function PosLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const requiredPermissions = getRoutePermissions(pathname);
    const { user, isAdmin, posNeedsUserAuth } = useAuth();

    const vt = (content: React.ReactNode) => (
        <PageTransition>
            {content}
        </PageTransition>
    );

    // Global keyboard shortcut: Ctrl + N → New Sale
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "n") {
                e.preventDefault();
                router.push("/pos/new-sale");
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [router]);

    // If POS needs user authentication, redirect to main login page
    useEffect(() => {
        if (posNeedsUserAuth) {
            window.location.href = `/auth/login?callbackUrl=${encodeURIComponent(pathname)}&subdomain=pos`;
        }
    }, [posNeedsUserAuth, pathname]);

    // If POS is a child terminal and trying to access parent-only routes, redirect
    useEffect(() => {
        const isChildTerminal = user?.terminal && !user.terminal.isParent;
        const restrictedRoutes = [
            "/pos/reports",
            "/pos/session",
            "/pos/shifts",
            "/pos/inventory/returns",
            "/pos/inventory/outbound",
            "/pos/inventory/inbound",
            "/pos/inventory/receiving"
        ];
        const isRestrictedRoute = restrictedRoutes.some(
            route => pathname === route || pathname.startsWith(route + "/")
        );

        if (isChildTerminal && isRestrictedRoute && !isAdmin()) {
            toast.error("Access Denied", {
                description: "This page is only accessible on the parent terminal.",
            });
            router.push("/pos/new-sale");
        }
    }, [user, pathname, isAdmin, router]);

    if (posNeedsUserAuth) {
        return null;
    }

    // Super admin bypasses all permission checks
    if (isAdmin()) {
        return (
            <DashboardLayout>
                <TitleUpdater section="POS" />
                <LocationGuard>
                    <ShiftGuard>
                        {vt(children)}
                    </ShiftGuard>
                </LocationGuard>
            </DashboardLayout>
        );
    }

    // If route requires permissions, wrap with PermissionGuard
    if (requiredPermissions.length > 0) {
        return (
            <DashboardLayout>
                <TitleUpdater section="POS" />
                <PermissionGuard permissions={requiredPermissions}>
                    <LocationGuard>
                        <ShiftGuard>
                            {vt(children)}
                        </ShiftGuard>
                    </LocationGuard>
                </PermissionGuard>
            </DashboardLayout>
        );
    }

    // Public routes (no permissions required)
    return (
        <DashboardLayout>
            <TitleUpdater section="POS" />
            <LocationGuard>
                <ShiftGuard>
                    {vt(children)}
                </ShiftGuard>
            </LocationGuard>
        </DashboardLayout>
    );
}
