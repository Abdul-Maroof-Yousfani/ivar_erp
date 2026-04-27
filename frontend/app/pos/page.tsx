"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ShoppingCart,
    Receipt,
    Users,
    DollarSign,
    TrendingUp,
    Package,
    BarChart3,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    PackageCheck,
    RotateCcw,
    RefreshCw,
    Loader2,
    CreditCard,
    Banknote,
} from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { PermissionGuard } from "@/components/auth/permission-guard";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
    todaySales: number;
    transactions: number;
    customersServed: number;
    avgTransaction: number;
    cashSales: number;
    cardSales: number;
}

interface RecentOrder {
    id: string;
    orderNumber: string;
    grandTotal: string | number;
    status: string;
    createdAt: string;
    customerId?: string | null;
    items: { id: string }[];
}

interface TopItem {
    itemId: string;
    name: string;
    sku: string;
    qtySold: number;
    revenue: number;
}

interface HourlyBucket {
    hour: number;
    label: string;
    sales: number;
    orders: number;
}

interface ClaimSummary {
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
    total: number;
}

interface CashierStats {
    sales: number;
    transactions: number;
    cashSales: number;
    cardSales: number;
    avgTransaction: number;
    recentOrders: RecentOrder[];
}

interface PosDashboardData {
    stats: DashboardStats;
    cashier: CashierStats | null;
    recentOrders: RecentOrder[];
    topItems: TopItem[];
    hourlySales: HourlyBucket[];
    claims: ClaimSummary;
}

interface SessionData {
    session: { id: string; openedAt: string; status: string } | null;
    metrics: { openingFloat: number; cashSales: number; expectedCash: number };
    isDrawerOpen: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function sessionDuration(openedAt: string) {
    const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000 / 60);
    if (diff < 60) return `${diff} min ago`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m > 0 ? `${m}m` : ""} ago`;
}

// ── Quick actions config ─────────────────────────────────────────────────────

const quickActions = [
    {
        title: "New Sale",
        description: "Start a new transaction",
        icon: ShoppingCart,
        href: "/pos/new-sale",
        color: "from-blue-600 to-purple-600",
        badge: "Ctrl+N",
    },
    {
        title: "Customer Lookup",
        description: "Search customer history",
        icon: Users,
        href: "/pos/customers",
        color: "from-purple-600 to-pink-600",
    },
    {
        title: "Stock Check",
        description: "View product availability",
        icon: Package,
        href: "/pos/inventory/view",
        color: "from-orange-600 to-red-600",
    },
    {
        title: "Stock Receiving",
        description: "Accept incoming transfers",
        icon: PackageCheck,
        href: "/pos/inventory/receiving",
        color: "from-indigo-600 to-blue-600",
    },
    {
        title: "Return Requests",
        description: "Approve return requests",
        icon: RotateCcw,
        href: "/pos/inventory/returns",
        color: "from-orange-600 to-amber-600",
    },
    {
        title: "Outbound Transfers",
        description: "Approve outgoing transfers",
        icon: ArrowRight,
        href: "/pos/inventory/outbound",
        color: "from-blue-600 to-indigo-600",
    },
    {
        title: "Inbound Transfers",
        description: "Accept incoming transfers",
        icon: ArrowRight,
        href: "/pos/inventory/inbound",
        color: "from-green-600 to-emerald-600",
    },
    {
        title: "Reports",
        description: "View sales analytics",
        icon: BarChart3,
        href: "/pos/reports",
        color: "from-indigo-600 to-blue-600",
    },
    {
        title: "Session Summary",
        description: "Current session details",
        icon: Receipt,
        href: "/pos/session",
        color: "from-cyan-600 to-blue-600",
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
    title,
    value,
    icon: Icon,
    color,
    sub,
}: {
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
    sub?: string;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                </div>
                <div className={`p-3 rounded-lg bg-linear-to-br ${color}`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
            </div>
        </Card>
    );
}

function SkeletonCard() {
    return (
        <Card className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-3" />
            <div className="h-7 bg-muted rounded w-3/4" />
        </Card>
    );
}

/** CSS-only bar chart — no external deps */
function HourlySalesChart({ data }: { data: HourlyBucket[] }) {
    const maxSales = Math.max(...data.map((d) => d.sales), 1);
    // Show every 3rd label to avoid crowding
    const currentHour = new Date().getHours();

    return (
        <div className="flex items-end gap-0.5 h-28 w-full">
            {data.map((bucket) => {
                const heightPct = (bucket.sales / maxSales) * 100;
                const isCurrent = bucket.hour === currentHour;
                return (
                    <div
                        key={bucket.hour}
                        className="flex-1 flex flex-col items-center gap-1 group relative"
                        title={`${bucket.label}: ${formatCurrency(bucket.sales)} (${bucket.orders} orders)`}
                    >
                        <div className="w-full flex items-end" style={{ height: "88px" }}>
                            <div
                                className={`w-full rounded-t transition-all ${isCurrent
                                        ? "bg-blue-500"
                                        : bucket.sales > 0
                                            ? "bg-blue-300 dark:bg-blue-700"
                                            : "bg-muted"
                                    }`}
                                style={{ height: `${Math.max(heightPct, 4)}%` }}
                            />
                        </div>
                        {bucket.hour % 4 === 0 && (
                            <span className="text-[9px] text-muted-foreground leading-none">
                                {bucket.label}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PosPage() {
    const [dashboard, setDashboard] = useState<PosDashboardData | null>(null);
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [dashRes, sessionRes] = await Promise.allSettled([
                authFetch("/pos-dashboard/stats"),
                authFetch("/pos-session/current"),
            ]);

            if (dashRes.status === "fulfilled" && dashRes.value) {
                setDashboard(dashRes.value as PosDashboardData);
            }
            if (sessionRes.status === "fulfilled" && sessionRes.value) {
                setSession(sessionRes.value as SessionData);
            }
        } catch {
            setError("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats = dashboard?.stats;
    const cashier = dashboard?.cashier;
    const recentOrders = (dashboard?.recentOrders ?? []).slice(0, 5);
    const topItems = dashboard?.topItems ?? [];
    const hourlySales = dashboard?.hourlySales ?? [];
    const claims = dashboard?.claims;

    const statCards = [
        {
            title: "Today's Sales",
            value: formatCurrency(stats?.todaySales ?? 0),
            icon: DollarSign,
            color: "from-green-500 to-emerald-600",
        },
        // {
        //     title: "Transactions",
        //     value: String(stats?.transactions ?? 0),
        //     icon: Receipt,
        //     color: "from-blue-500 to-cyan-600",
        // },
        {
            title: "Customers Served",
            value: String(stats?.customersServed ?? 0),
            icon: Users,
            color: "from-purple-500 to-pink-600",
        },
        {
            title: "Avg. Transaction",
            value: formatCurrency(stats?.avgTransaction ?? 0),
            icon: TrendingUp,
            color: "from-orange-500 to-red-600",
        },
        {
            title: "Cash Sales",
            value: formatCurrency(stats?.cashSales ?? 0),
            icon: Banknote,
            color: "from-teal-500 to-green-600",
        },
        {
            title: "Card Sales",
            value: formatCurrency(stats?.cardSales ?? 0),
            icon: CreditCard,
            color: "from-violet-500 to-purple-600",
        },
    ];

    return (
        <PermissionGuard permissions="pos.dashboard.view">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
                        <p className="text-muted-foreground">
                            Welcome to your POS dashboard. Ready to serve your customers.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Refresh</span>
                    </Button>
                </div>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">
                        {error}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {loading
                        ? Array.from({ length: statCards.length }).map((_, i) => <SkeletonCard key={i} />)
                        : statCards.map((s) => <StatCard key={s.title} {...s} />)}
                </div>

                {/* Hourly Sales Chart */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Hourly Sales</h2>
                            <p className="text-xs text-muted-foreground">Sales activity throughout today</p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {loading ? (
                        <div className="h-28 bg-muted rounded animate-pulse" />
                    ) : hourlySales.length > 0 ? (
                        <HourlySalesChart data={hourlySales} />
                    ) : (
                        <div className="h-28 flex items-center justify-center text-sm text-muted-foreground">
                            No hourly data available.
                        </div>
                    )}
                </Card>

                {/* Cashier Stats */}
                <Card className="p-6 border-2 border-dashed">
                    <h2 className="text-lg font-semibold mb-4">My Sales Today</h2>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 bg-muted rounded" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: "My Sales", value: formatCurrency(cashier?.sales ?? 0), icon: DollarSign, color: "text-green-600" },
                                    { label: "My Transactions", value: String(cashier?.transactions ?? 0), icon: Receipt, color: "text-blue-600" },
                                    { label: "Avg. Sale", value: formatCurrency(cashier?.avgTransaction ?? 0), icon: TrendingUp, color: "text-purple-600" },
                                    { label: "Cash / Card", value: `${formatCurrency(cashier?.cashSales ?? 0)} / ${formatCurrency(cashier?.cardSales ?? 0)}`, icon: CreditCard, color: "text-orange-600" },
                                ].map((s) => (
                                    <div key={s.label} className="flex flex-col gap-1 p-4 rounded-lg bg-muted/40">
                                        <div className="flex items-center gap-2">
                                            <s.icon className={`h-4 w-4 ${s.color}`} />
                                            <span className="text-xs text-muted-foreground">{s.label}</span>
                                        </div>
                                        <span className="text-lg font-bold">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                            {cashier && cashier.recentOrders.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">My recent orders</p>
                                    <div className="divide-y rounded-lg border">
                                        {cashier.recentOrders.map((order) => (
                                            <div key={order.id} className="flex items-center justify-between px-4 py-2 text-sm">
                                                <span className="font-medium">{order.orderNumber}</span>
                                                <span className="text-muted-foreground">{order.items?.length ?? 0} items</span>
                                                <span className="font-semibold">{formatCurrency(Number(order.grandTotal))}</span>
                                                <span className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Claims + Top Items row */}
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Claims summary */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Claims Overview</h2>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/pos/claims">
                                    View All <ArrowRight className="h-4 w-4 ml-1" />
                                </Link>
                            </Button>
                        </div>
                        {loading ? (
                            <div className="space-y-2 animate-pulse">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-8 bg-muted rounded" />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: "Submitted", value: claims?.submitted ?? 0, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
                                        { label: "Under Review", value: claims?.underReview ?? 0, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30" },
                                        { label: "Approved", value: claims?.approved ?? 0, color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
                                        { label: "Rejected", value: claims?.rejected ?? 0, color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
                                    ].map((c) => (
                                        <div key={c.label} className={`flex items-center justify-between px-4 py-3 rounded-lg ${c.color}`}>
                                            <span className="text-sm font-medium">{c.label}</span>
                                            <span className="text-xl font-bold">{c.value}</span>
                                        </div>
                                    ))}
                                </div>
                                {claims?.total === 0 && (
                                    <p className="text-xs text-muted-foreground text-center mt-3">No claims submitted yet today.</p>
                                )}
                            </>
                        )}
                    </Card>

                    {/* Top items */}
                    <Card className="p-6">
                        <h2 className="text-lg font-semibold mb-4">Top Items Today</h2>
                        {loading ? (
                            <div className="space-y-3 animate-pulse">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="h-8 bg-muted rounded" />
                                ))}
                            </div>
                        ) : topItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                                <Package className="h-8 w-8 opacity-30" />
                                <p className="text-sm">No items sold yet today.</p>
                                <p className="text-xs">Top sellers will appear here once sales begin.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {topItems.map((item, idx) => (
                                    <div key={item.itemId} className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold">{formatCurrency(item.revenue)}</p>
                                            <p className="text-xs text-muted-foreground">{item.qtySold} sold</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Quick Actions */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {quickActions.map((action) => (
                            <Link key={action.title} href={action.href}>
                                <Card className="p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group border-2 hover:border-primary">
                                    <div className="flex items-start gap-4">
                                        <div
                                            className={`p-3 rounded-lg bg-linear-to-br ${action.color} group-hover:scale-110 transition-transform`}
                                        >
                                            <action.icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold">{action.title}</h3>
                                                {action.badge && (
                                                    <span className="text-xs bg-muted px-2 py-1 rounded">
                                                        {action.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {action.description}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent Orders */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Recent Orders</h2>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/pos/orders">
                                View All
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                        </Button>
                    </div>
                    <Card>
                        {loading ? (
                            <div className="divide-y">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="p-4 animate-pulse">
                                        <div className="flex justify-between">
                                            <div className="space-y-2">
                                                <div className="h-4 bg-muted rounded w-24" />
                                                <div className="h-3 bg-muted rounded w-32" />
                                            </div>
                                            <div className="h-4 bg-muted rounded w-16" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentOrders.length === 0 ? (
                            <div className="p-8 text-center space-y-2">
                                <Receipt className="h-8 w-8 mx-auto text-muted-foreground opacity-30" />
                                <p className="text-sm text-muted-foreground">No orders today yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {recentOrders.map((order) => (
                                    <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{order.orderNumber}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {order.customerId ? "Customer" : "Walk-in"}
                                                    </span>
                                                </div>
                                                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Package className="h-4 w-4" />
                                                    <span>{order.items?.length ?? 0} items</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold">
                                                    {formatCurrency(Number(order.grandTotal))}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {order.status === "completed" ? (
                                                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Completed
                                                        </span>
                                                    ) : order.status === "void" || order.status === "voided" ? (
                                                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                            <AlertCircle className="h-3 w-3" />
                                                            Void
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {order.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {timeAgo(order.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Session Info */}
                {!loading && (
                    <Card className="p-6 bg-linear-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="font-semibold text-lg">Current Session</h3>
                                {session?.session ? (
                                    <p className="text-sm text-muted-foreground">
                                        Started {sessionDuration(session.session.openedAt)} •{" "}
                                        Float: {formatCurrency(session.metrics.openingFloat)} •{" "}
                                        Cash Sales: {formatCurrency(session.metrics.cashSales)}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No active session found.
                                    </p>
                                )}
                            </div>
                            <Button className="bg-linear-to-r from-blue-600 to-purple-600" asChild>
                                <Link href="/pos/close">
                                    Close Register
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Link>
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </PermissionGuard>
    );
}
