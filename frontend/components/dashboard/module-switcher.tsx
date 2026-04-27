"use client";

import { useEnvironment, EnvironmentType } from "@/components/providers/environment-provider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Users, Package, ShoppingCart, ShieldCheck, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { menuData, MenuItem } from "@/components/dashboard/sidebar-menu-data";

/**
 * Walk menuData depth-first and return the first href whose permissions
 * the user satisfies for the given environment.
 * Falls back to the env root path if nothing matches.
 */
function findFirstAccessibleRoute(
    env: EnvironmentType,
    hasAnyPermission: (perms: string[]) => boolean,
    fallback: string,
): string {
    function walk(items: MenuItem[]): string | null {
        for (const item of items) {
            // Skip items that belong to a different environment
            if (item.environment && item.environment !== env) continue;

            if (item.href) {
                // No permissions required, or user has at least one
                if (!item.permissions?.length || hasAnyPermission(item.permissions)) {
                    return item.href;
                }
            }

            if (item.children) {
                const found = walk(item.children);
                if (found) return found;
            }
        }
        return null;
    }

    return walk(menuData) ?? fallback;
}

export function ModuleSwitcher() {
    const { environment, setEnvironment } = useEnvironment();
    const { isAdmin, hasAnyPermission } = useAuth();

    const superAdmin = isAdmin();

    const getLandingRoute = (env: EnvironmentType, root: string): string => {
        if (superAdmin) return root;
        return findFirstAccessibleRoute(env, hasAnyPermission, root);
    };

    const allModules = [
        {
            id: "HR" as EnvironmentType,
            label: "HR Module",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-500/10",
            root: "/hr",
            accessCheck: () => superAdmin || hasAnyPermission([
                'hr.dashboard.view',
                'hr.employee.read',
                'hr.attendance.view',
                'hr.leave.read',
                'hr.payroll.read',
            ]),
        },
        {
            id: "ERP" as EnvironmentType,
            label: "ERP Module",
            icon: Package,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
            root: "/erp",
            accessCheck: () => superAdmin || hasAnyPermission([
                'erp.finance.journal-voucher.read',
                'erp.finance.chart-of-account.read',
                'erp.finance.payment-voucher.read',
                'erp.finance.receipt-voucher.read',
                'erp.item.read',
                'procurement.read',
                'inventory.read',
                'sales.read',
                'sales.customer.read',
                'sales.order.read',
                'erp.claims.read',
            ]),
        },
        {
            id: "POS" as EnvironmentType,
            label: "POS Terminal",
            icon: ShoppingCart,
            color: "text-indigo-600",
            bg: "bg-indigo-500/10",
            root: "/pos",
            accessCheck: () => superAdmin || hasAnyPermission([
                'pos.dashboard.view',
                'pos.sale.create',
                'pos.sales.history.view',
                'pos.inventory.view',
            ]),
        },
    ];

    const visibleModules = allModules.filter((m) => m.accessCheck());

    const handleSwitch = (mod: typeof allModules[0]) => {
        const targetHref = getLandingRoute(mod.id, mod.root);
        setEnvironment(mod.id, false, targetHref);
    };

    const currentMod = allModules.find(m => m.id === environment);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2 gap-2 hover:bg-muted/50 transition-all rounded-xl">
                    {currentMod ? (
                        <div className={cn("p-1 rounded-lg", currentMod.bg)}>
                            <currentMod.icon className={cn("h-4 w-4", currentMod.color)} />
                        </div>
                    ) : environment === "ADMIN" ? (
                        <div className="p-1 rounded-lg bg-amber-500/10">
                            <ShieldCheck className="h-4 w-4 text-amber-600" />
                        </div>
                    ) : null}
                    <span className="text-xs font-bold hidden md:inline-block">
                        {currentMod?.label || (environment === "ADMIN" ? "Admin Panel" : "Switch Module")}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl shadow-2xl border-border/50 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5">
                    Select Environment
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="opacity-50" />
                <div className="space-y-1">
                    {visibleModules.map((mod) => (
                        <DropdownMenuItem
                            key={mod.id}
                            onClick={() => handleSwitch(mod)}
                            className={cn(
                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200",
                                environment === mod.id ? "bg-primary/5 text-primary" : "hover:bg-muted"
                            )}
                        >
                            <div className={cn("p-2 rounded-lg shrink-0", mod.bg)}>
                                <mod.icon className={cn("h-4 w-4", mod.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold leading-none">{mod.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">Go to {mod.id} view</p>
                            </div>
                            {environment === mod.id && (
                                <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </div>

                {superAdmin && (
                    <>
                        <DropdownMenuSeparator className="opacity-50" />
                        <DropdownMenuItem
                            onClick={() => {
                                setEnvironment("ADMIN", false, "/admin");
                            }}
                            className={cn(
                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200",
                                environment === "ADMIN" ? "bg-amber-500/10 text-amber-600" : "hover:bg-muted"
                            )}
                        >
                            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                                <ShieldCheck className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold leading-none">Admin Panel</p>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">Manage Platform</p>
                            </div>
                            {environment === "ADMIN" && (
                                <Check className="h-4 w-4 text-amber-600 shrink-0" />
                            )}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
