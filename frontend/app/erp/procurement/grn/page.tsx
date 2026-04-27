'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Grn, PurchaseOrder } from '@/lib/api';
import { getPurchaseOrders } from '@/lib/actions/purchase-order';
import { getGrns } from '@/lib/actions/grn';
import { Plus, Eye, Receipt, Search, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function GrnListPage() {
    const [grns, setGrns] = useState<Grn[]>([]);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [poModalOpen, setPoModalOpen] = useState(false);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('erp.procurement.grn.create');

    useEffect(() => {
        loadGrns();
    }, []);

    const loadGrns = async () => {
        try {
            const [grnData, poData] = await Promise.all([
                getGrns(),
                getPurchaseOrders()
            ]);
            setGrns(grnData);
            setGrns(grnData);
            setOrders(poData.filter(po => po.status !== 'CLOSED'));
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateGrn = (poId: string) => {
        router.push(`/erp/procurement/grn/create/${poId}`);
    };

    return (
        <PermissionGuard permissions="erp.procurement.grn.read">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Goods Receipt Notes</h1>
                    <p className="text-muted-foreground">Manage and track received goods and stock entry.</p>
                </div>
                {canCreate && (
                <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Create GRN
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Select Purchase Order</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <p className="text-sm text-muted-foreground">
                                Select an open Purchase Order to generate a Goods Receipt Note.
                            </p>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                                {orders.length === 0 ? (
                                    <p className="text-center py-4 text-sm">No available purchase orders found.</p>
                                ) : (
                                    orders.map((order) => (
                                        <div
                                            key={order.id}
                                            onClick={() => handleGenerateGrn(order.id)}
                                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium">{order.poNumber}</div>
                                                    <Badge variant="outline" className="text-[10px] h-4">
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {order.vendor?.name} • {new Date(order.orderDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <Receipt className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent GRNs</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10">Loading GRNs...</div>
                    ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>GRN Number</TableHead>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead>Order Type</TableHead>
                                        <TableHead>Goods Type</TableHead>
                                        <TableHead>Received Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {grns.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center h-24">
                                                No GRNs found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        grns.map((grn) => (
                                            <TableRow key={grn.id}>
                                                <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                                                <TableCell className="font-mono text-sm">{grn.purchaseOrder?.poNumber || 'N/A'}</TableCell>
                                                <TableCell>{grn.warehouse?.name}</TableCell>
                                                <TableCell>
                                                    {grn.orderType ? (
                                                        <Badge variant="outline" className="text-xs">
                                                            {grn.orderType === 'IMPORT' ? 'Import' : 'Local'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {grn.goodsType ? (
                                                        <Badge variant="outline" className="text-xs">
                                                            {grn.goodsType === 'FRESH' ? 'Fresh' : 'Consumable'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{new Date(grn.receivedDate).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant={grn.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                                                        {grn.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/erp/procurement/grn/${grn.id}`}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                    )}
                </CardContent>
            </Card>
        </div>
        </PermissionGuard>
    );
}
