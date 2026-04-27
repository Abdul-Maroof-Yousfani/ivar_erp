"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, DollarSign, Store, ArrowRightLeft, LayoutGrid } from "lucide-react";
import { stockLedgerApi, StockLevel } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function InventoryDashboard() {
    const [stats, setStats] = useState({
        totalStock: 0,
        mainStock: 0,
        shopStock: 0,
        lowStockItems: 0,
        valuation: 0
    });
    const [loading, setLoading] = useState(true);
    const { hasPermission } = useAuth();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const levels = await stockLedgerApi.getLevels();

            let main = 0;
            let shop = 0;
            let total = 0;

            levels.forEach(l => {
                const qty = Number(l.totalQty);
                total += qty;
                if (l.location?.type === 'MAIN') main += qty;
                if (l.location?.type === 'SHOP') shop += qty;
            });

            setStats({
                totalStock: total,
                mainStock: main,
                shopStock: shop,
                lowStockItems: levels.filter(l => Number(l.totalQty) < 10).length,
                valuation: total * 100 // Mock valuation
            });
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.inventory.view">
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Inventory Intelligence</h2>
                    <p className="text-muted-foreground text-sm">Real-time distribution across Bulk and Shops.</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasPermission("erp.inventory.explorer.view") && (
                        <Button variant="outline" asChild>
                            <Link href="/erp/inventory/explorer">
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                Explorer
                            </Link>
                        </Button>
                    )}
                    {hasPermission("erp.inventory.transfer.create") && (
                        <Button asChild>
                            <Link href="/erp/inventory/transactions/stock-transfer">
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transfer Stock
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bulk Stock (MAIN)</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.mainStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Central Storage</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Shop Stock (SHOP)</CardTitle>
                        <Store className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.shopStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Distributed in Retail</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.lowStockItems}</div>
                        <p className="text-xs text-muted-foreground">Items &lt; 10 units</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Visibility</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.totalStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Units in system</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Sections */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Stock Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[240px] flex flex-col items-center justify-center space-y-6">
                            <div className="w-full max-w-sm space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span>Bulk Area (MAIN)</span>
                                    <span>{loading ? "0" : Math.round((stats.mainStock / (stats.totalStock || 1)) * 100)}%</span>
                                </div>
                                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${(stats.mainStock / (stats.totalStock || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div className="w-full max-w-sm space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span>Shop Floor (SHOP)</span>
                                    <span>{loading ? "0" : Math.round((stats.shopStock / (stats.totalStock || 1)) * 100)}%</span>
                                </div>
                                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-500"
                                        style={{ width: `${(stats.shopStock / (stats.totalStock || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>In-Store Monitoring</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Real-time monitoring of shop locations to prevent OOS (Out of Stock) situations.
                            </p>
                            {hasPermission("erp.inventory.explorer.view") && (
                                <Button className="w-full" variant="outline" asChild>
                                    <Link href="/erp/inventory/explorer">
                                        View Detailed Matrix
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </PermissionGuard>
    );
}
