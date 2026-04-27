"use client";

import { useEffect } from "react";
import { ViewTransition } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { usePathname, useRouter } from "next/navigation";
import { getRoutePermissions } from "@/lib/route-permissions";
import { useAuth } from "@/components/providers/auth-provider";
import { PosSwitchUser } from "@/components/pos/pos-switch-user";
import { LocationGuard } from "@/components/pos/location-guard";
import { PageTransition } from "@/components/layouts/page-transition";

export default function PosLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const requiredPermissions = getRoutePermissions(pathname);
    const { isAdmin, posNeedsUserAuth } = useAuth();

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

    // If POS needs user authentication, show the switch-user overlay
    if (posNeedsUserAuth) {
        return <PosSwitchUser />;
    }

    // Super admin bypasses all permission checks
    if (isAdmin()) {
        return (
            <DashboardLayout>
                <LocationGuard>
                    {vt(children)}
                </LocationGuard>
            </DashboardLayout>
        );
    }

    // If route requires permissions, wrap with PermissionGuard
    if (requiredPermissions.length > 0) {
        return (
            <DashboardLayout>
                <PermissionGuard permissions={requiredPermissions}>
                    <LocationGuard>
                        {vt(children)}
                    </LocationGuard>
                </PermissionGuard>
            </DashboardLayout>
        );
    }

    // Public routes (no permissions required)
    return (
        <DashboardLayout>
            <LocationGuard>
                {vt(children)}
            </LocationGuard>
        </DashboardLayout>
    );
}
