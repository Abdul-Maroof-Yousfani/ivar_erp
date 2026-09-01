'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye } from 'lucide-react';
import { PurchaseOrder } from '@/lib/api';
import { getPurchaseOrders } from '@/lib/actions/purchase-order';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function PurchaseOrderList() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('erp.procurement.po.create');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await getPurchaseOrders();
            setOrders(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.po.read">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
                {canCreate && (
                    <div className="flex gap-2">
                        <Link href="/erp/procurement/purchase-order/create" transitionTypes={["nav-forward"]}>
                            <Button variant="secondary">
                                <Plus className="mr-2 h-4 w-4" /> Create Direct PO
                            </Button>
                        </Link>
                        <Link href="/erp/procurement/purchase-order/pending" transitionTypes={["nav-forward"]}>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> From Quotations
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PO #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Order Date</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">No purchase orders found.</TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.poNumber}</TableCell>
                                        <TableCell>{order.vendor?.name}</TableCell>
                                        <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-semibold">Rs. {formatCurrency(order.totalAmount)}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                switch (order.status) {
                                                    case 'PENDING_CHECKER':
                                                        return (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
                                                                Pending Checker
                                                            </Badge>
                                                        );
                                                    case 'PENDING_AUTHORIZER':
                                                        return (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
                                                                Pending Authorizer
                                                            </Badge>
                                                        );
                                                    case 'OPEN':
                                                        return (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                                                                Open
                                                            </Badge>
                                                        );
                                                    case 'REJECTED':
                                                        return (
                                                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-medium dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900">
                                                                Rejected
                                                            </Badge>
                                                        );
                                                    case 'CLOSED':
                                                        return (
                                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900">
                                                                Closed
                                                            </Badge>
                                                        );
                                                    case 'PARTIALLY_RECEIVED':
                                                        return (
                                                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900">
                                                                Partially Received
                                                            </Badge>
                                                        );
                                                    case 'RECEIVED':
                                                        return (
                                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900">
                                                                Received
                                                            </Badge>
                                                        );
                                                    default:
                                                        return (
                                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium">
                                                                {order.status}
                                                            </Badge>
                                                        );
                                                }
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/erp/procurement/purchase-order/${order.id}`} transitionTypes={["nav-forward"]}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="mr-2 h-4 w-4" /> View
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        </PermissionGuard>
    );
}
