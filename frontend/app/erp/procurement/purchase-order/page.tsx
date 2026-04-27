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
                        <Link href="/erp/procurement/purchase-order/create">
                            <Button variant="secondary">
                                <Plus className="mr-2 h-4 w-4" /> Create Direct PO
                            </Button>
                        </Link>
                        <Link href="/erp/procurement/purchase-order/pending">
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
                                            <Badge variant={
                                                order.status === 'OPEN' ? 'default' :
                                                    order.status === 'CLOSED' ? 'secondary' : 'outline'
                                            }>
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/erp/procurement/purchase-order/${order.id}`}>
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
