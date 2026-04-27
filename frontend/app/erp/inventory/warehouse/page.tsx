'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, Package, ArrowRightLeft, Activity, Box, Clock } from 'lucide-react';
import { stockLedgerApi, StockLevel, StockLedgerEntry } from '@/lib/api';
import { getTransferRequests } from '@/lib/actions/transfer-request';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function InventoryDashboardPage() {
    const [stats, setStats] = useState({
        lowStockCount: 0,
        totalStockQuantity: 0,
        pendingTransfers: 0,
        completedTransfers: 0,
    });
    const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<StockLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch Levels for Low Stock & Total
            const levels = await stockLedgerApi.getLevels();
            const lowStock = levels.filter(l => Number(l.totalQty) < 10 && Number(l.totalQty) > 0);

            // Reduce lowStock to unique items to avoid duplicating the same item across multiple warehouses in the short list
            const uniqueLowStock: StockLevel[] = [];
            const seenIds = new Set();
            for (const item of lowStock) {
                if (!seenIds.has(item.itemId)) {
                    seenIds.add(item.itemId);
                    uniqueLowStock.push(item);
                }
            }

            setLowStockItems(uniqueLowStock.slice(0, 5));

            // Fetch Recent Ledger Entries
            const ledger = await stockLedgerApi.getAll();
            setRecentTransactions(ledger.slice(0, 6)); // Top 6

            // Fetch Transfer Requests
            const transfersResponse = await getTransferRequests();
            const transfers = transfersResponse.data || [];
            const pending = transfers.filter(t => t.status === 'PENDING').length;
            const completed = transfers.filter(t => t.status === 'COMPLETED').length;

            setStats({
                lowStockCount: uniqueLowStock.length,
                totalStockQuantity: levels.reduce((sum, l) => sum + Number(l.totalQty), 0),
                pendingTransfers: pending,
                completedTransfers: completed,
            });

        } catch (error) {
            console.error('Failed to load inventory dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMovementBadge = (type: string) => {
        switch (type) {
            case 'INBOUND': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">INBOUND</Badge>;
            case 'OUTBOUND': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">OUTBOUND</Badge>;
            case 'TRANSFER': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">TRANSFER</Badge>;
            case 'ADJUSTMENT': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">ADJUSTMENT</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <PermissionGuard permissions="erp.inventory.warehouse.view">
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Inventory Overview</h2>
                    <p className="text-muted-foreground">General stock monitoring and supply chain alerts.</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-red-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Item Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.lowStockCount}</div>
                        <p className="text-xs text-muted-foreground font-medium text-red-600/80">Items near depletion (&lt; 10 units)</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Global Stock Count</CardTitle>
                        <Box className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.totalStockQuantity.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total units recorded in system</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.pendingTransfers}</div>
                        <p className="text-xs text-muted-foreground">Awaiting POS acceptance</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed Transfers</CardTitle>
                        <ArrowRightLeft className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.completedTransfers}</div>
                        <p className="text-xs text-muted-foreground">Successfully received at shops</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

                {/* Recent Transactions */}
                <Card className="col-span-4 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Recent Transactions
                            </CardTitle>
                            <CardDescription>Latest movements across all storage areas.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-6 text-muted-foreground">Loading...</div>
                        ) : recentTransactions.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">No recent transactions.</div>
                        ) : (
                            <div className="space-y-4">
                                {recentTransactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 flex border items-center justify-center rounded-full bg-background shadow-sm">
                                                <Package className={`h-5 w-5 ${tx.movementType === 'INBOUND' ? 'text-green-500' : tx.movementType === 'OUTBOUND' ? 'text-red-500' : 'text-blue-500'}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none mb-1">
                                                    {tx.item?.sku || 'Unknown Item'}
                                                    <span className="text-muted-foreground font-normal ml-2">{tx.item?.name || tx.item?.description}</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')} • {tx.warehouse?.name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold ${Number(tx.qty) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {Number(tx.qty) > 0 ? '+' : ''}{tx.qty}
                                            </span>
                                            {getMovementBadge(tx.movementType)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Low Stock Alerts */}
                <Card className="col-span-3 shadow-sm border-red-100">
                    <CardHeader className="bg-red-50/50 rounded-t-lg border-b border-red-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-red-800">
                            <AlertTriangle className="h-5 w-5" />
                            Needs Attention
                        </CardTitle>
                        <CardDescription className="text-red-600/80">Items requiring immediate reorder.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {loading ? (
                            <div className="text-center py-6 text-muted-foreground">Loading...</div>
                        ) : lowStockItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                                <Box className="h-8 w-8 text-muted-foreground/30" />
                                No low stock items right now.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-right">Available Qty</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lowStockItems.map((item, i) => (
                                        <TableRow key={`${item.itemId}-${i}`}>
                                            <TableCell>
                                                <div className="font-medium text-sm">{item.item?.sku}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">{item.item?.name || item.item?.description}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="destructive" className="font-bold">
                                                    {item.totalQty} {item.item?.uomId || 'Units'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        <div className="mt-6">
                            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" asChild>
                                <Link href="/erp/inventory/explorer">
                                    View Full Inventory
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </PermissionGuard>
    );
}
