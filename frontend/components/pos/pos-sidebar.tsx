"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import {
    ShoppingCart,
    Receipt,
    Package,
    Users,
    Percent,
    TrendingUp,
    Settings,
    LogOut,
    Store,
    Zap,
    RefreshCw,
    Wallet,
    PauseCircle,
    BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

const posMenuGroups = [
    {
        label: "Sales Operations",
        items: [
            { title: "New Sale", icon: ShoppingCart, href: "/pos" },
            { title: "Quick Sale", icon: Zap, href: "/pos/quick" },
            { title: "Current Orders", icon: Receipt, href: "/pos/orders" },
            { title: "Hold Orders", icon: PauseCircle, href: "/pos/holds" },
            { title: "Returns & Exchanges", icon: RefreshCw, href: "/pos/sales/returns" },
            { title: "Customer Ladger", icon: BookOpen, href: "/pos/customer-ledger" },
            { title: "Cash Drawer", icon: Wallet, href: "/pos/terminal/drawer" },
        ],
    },
    {
        label: "Inventory & Products",
        items: [
            { title: "Products", icon: Package, href: "/pos/products" },
            { title: "Stock", icon: TrendingUp, href: "/pos/stock" },
        ],
    },
    {
        label: "Customers",
        items: [
            { title: "Search", icon: Users, href: "/pos/customers" },
        ],
    },
    {
        label: "Promotions",
        items: [
            { title: "Discounts", icon: Percent, href: "/pos/discounts" },
        ],
    },
];

export function PosSidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { state } = useSidebar();

    const terminalName = (user as any)?.terminal?.name || "Terminal";
    const locationName = (user as any)?.terminal?.location?.name || "Store";

    return (
        <Sidebar collapsible="icon" className="border-0 overflow-hidden">
            <SidebarRail />
            <SidebarHeader className="border-b border-sidebar-border/50 bg-linear-to-r from-sidebar to-sidebar-accent/30 px-4 py-3 backdrop-blur-sm shadow-sm">
                <div className="flex flex-col gap-3 group-data-[collapsible=icon]:gap-0">
                    <div className="flex items-center gap-3 px-2 justify-center group-data-[collapsible=icon]:justify-center">
                        <div className="flex items-center justify-center size-10 aspect-square rounded-xl bg-white text-primary shadow-sm group-data-[collapsible=icon]:rounded-lg transition-all duration-200">
                            <Image
                                src={"/image.png"}
                                alt="Logo"
                                width={30}
                                height={30}
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-200">
                            <span className="font-bold text-base leading-tight text-sidebar-foreground">
                                Speed Pvt. Ltd
                            </span>
                            <span className="text-xs text-sidebar-foreground/60 font-medium">
                                POS Terminal
                            </span>
                        </div>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-2">
                {/* Terminal Info Widget */}
                <div className="group-data-[collapsible=icon]:hidden mt-2 p-3 bg-linear-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Store className="w-12 h-12 rotate-12" />
                    </div>
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="font-bold text-xs tracking-wide leading-none text-primary uppercase">{terminalName}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{locationName}</span>
                    </div>
                </div>

                <div className="mt-4 space-y-4">
                    {posMenuGroups.map((group) => (
                        <div key={group.label} className="space-y-1">
                            <div className="group-data-[collapsible=icon]:hidden px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-4 py-2">
                                {group.label}
                            </div>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href;
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive}
                                                className={cn(
                                                    "group relative transition-all duration-200",
                                                    "hover:bg-sidebar-accent/80 hover:shadow-sm",
                                                    isActive && "bg-sidebar-accent shadow-md font-semibold",
                                                )}
                                            >
                                                <Link href={item.href}>
                                                    <Icon className={cn("h-4 w-4 transition-transform duration-200", isActive && "scale-110")} />
                                                    <span>{item.title}</span>
                                                    {isActive && (
                                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-l-full bg-primary group-data-[collapsible=icon]:hidden" />
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/50 px-4 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild className="hover:bg-sidebar-accent/80 transition-colors">
                            <Link href="/pos/settings">
                                <Settings className="h-4 w-4" />
                                <span>Terminal Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            onClick={logout}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors pointer-events-auto cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Close Terminal</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                <div className="flex items-center gap-2 px-2 mt-2 group-data-[collapsible=icon]:justify-center">
                    <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden transition-opacity duration-200">
                        <div className="flex items-center justify-center size-8 rounded-lg overflow-hidden bg-transparent">
                            <Image
                                src="/logo.png"
                                alt="Logo"
                                width={32}
                                height={32}
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-sidebar-foreground truncate">
                                {/* Speed (Pvt.) Limited */}
                                Innovative Network
                            </span>
                        </div>
                    </div>
                    <div className="group-data-[collapsible=icon]:block hidden">
                        <div className="flex items-center justify-center size-8 rounded-lg overflow-hidden bg-transparent">
                            <Image
                                src="/logo.png"
                                alt="Logo"
                                width={32}
                                height={32}
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
