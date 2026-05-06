"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Ticket, Handshake, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGuard } from "@/components/auth/permission-guard";

const TABS = [
    { href: "/master/pos-config/promos", label: "Promos", icon: Megaphone, permission: "master.promo.read" },
    { href: "/master/pos-config/coupons", label: "Coupons", icon: Ticket, permission: "master.coupon.read" },
    { href: "/master/pos-config/alliances", label: "Alliances", icon: Handshake, permission: "master.alliance.read" },
    { href: "/master/pos-config/vouchers", label: "Vouchers", icon: Gift, permission: "pos.voucher.view" },
];

// Routes that are "detail/form" pages — hide the tab bar on these
const FORM_PATHS = [
    "/master/pos-config/promos/new",
    "/master/pos-config/coupons/new",
    "/master/pos-config/alliances/new",
    "/master/pos-config/vouchers/new",
];

export function PosConfigShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isFormPage = FORM_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    return (
        <div className="space-y-4">
            {!isFormPage && (
                <>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">POS Configuration</h2>
                        <p className="text-muted-foreground">Manage promo campaigns, coupon codes, alliance discounts, and vouchers</p>
                    </div>

                    {/* Tab navigation */}
                    <div className="border-b">
                        <nav className="flex gap-1 -mb-px">
                            {TABS.map(({ href, label, icon: Icon, permission }) => {
                                const isActive = pathname === href || pathname.startsWith(href + "/");
                                return (
                                    <PermissionGuard key={href} permissions={permission} fallback={null}>
                                        <Link
                                            href={href}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                                                isActive
                                                    ? "border-primary text-primary"
                                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {label}
                                        </Link>
                                    </PermissionGuard>
                                );
                            })}
                        </nav>
                    </div>
                </>
            )}

            <div>{children}</div>
        </div>
    );
}
