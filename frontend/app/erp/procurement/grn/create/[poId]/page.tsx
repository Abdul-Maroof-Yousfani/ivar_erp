'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { warehouseApi, PurchaseOrder, Warehouse } from '@/lib/api';
import { getPurchaseOrder } from '@/lib/actions/purchase-order';
import { createGrn } from '@/lib/actions/grn';
import { toast } from 'sonner';
import { ArrowLeft, Save, Warehouse as WarehouseIcon } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function CreateGrnPage({ params }: { params: Promise<{ poId: string }> }) {
    const { poId } = use(params);
    const router = useRouter();
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [poId]);

    const loadData = async () => {
        try {
            const [poData, warehouseData] = await Promise.all([
                getPurchaseOrder(poId),
                warehouseApi.getAll(),
            ]);
            setOrder(poData);
            setWarehouses(warehouseData);

            // Initialize received quantities to 0
            const initialQtys: Record<string, number> = {};
            poData.items.forEach(item => {
                const remaining = parseFloat(item.quantity) - parseFloat(item.receivedQty || '0');
                initialQtys[item.itemId] = remaining > 0 ? remaining : 0;
            });
            setReceivedQtys(initialQtys);

            if (warehouseData.length > 0) {
                setSelectedWarehouse(warehouseData[0].id);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load order or warehouse data');
        } finally {
            setLoading(false);
        }
    };

    const handleQtyChange = (itemId: string, val: string) => {
        const qty = parseFloat(val) || 0;
        setReceivedQtys(prev => ({ ...prev, [itemId]: qty }));
    };

    const handleSubmit = async () => {
        if (!selectedWarehouse) {
            toast.error('Please select a warehouse');
            return;
        }

        const itemsToReceive = order?.items
            .map(item => ({
                itemId: item.itemId,
                description: item.description,
                receivedQty: receivedQtys[item.itemId],
            }))
            .filter(item => item.receivedQty > 0);

        if (!itemsToReceive || itemsToReceive.length === 0) {
            toast.error('Please enter received quantity for at least one item');
            return;
        }

        setSubmitting(true);
        try {
            await createGrn({
                purchaseOrderId: poId,
                warehouseId: selectedWarehouse,
                items: itemsToReceive,
                notes: `Received items for PO ${order?.poNumber}`
            });
            toast.success('GRN created successfully');
            router.push('/erp/procurement/grn');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to create GRN');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-6 text-center">Loading...</div>;
    if (!order) return <div className="p-6 text-center text-red-500">Purchase Order not found</div>;

    return (
        <PermissionGuard permissions="erp.procurement.grn.create">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                {/* <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button> */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create GRN</h1>
                    <p className="text-muted-foreground">PO Number: {order.poNumber}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>PO Items & Quantity Received</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead className="text-right">Ordered</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                    <TableHead className="text-right w-32">Receiving</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item) => {
                                    const remaining = parseFloat(item.quantity) - parseFloat(item.receivedQty || '0');
                                    const itemData = (item as any).item;
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {itemData ? itemData.itemId : 'Item data unavailable'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {itemData ? itemData.description : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{parseFloat(item.quantity).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono text-blue-600">{remaining.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={remaining}
                                                    value={receivedQtys[item.itemId]}
                                                    onChange={(e) => handleQtyChange(item.itemId, e.target.value)}
                                                    className="text-right font-mono"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Warehouse</label>
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name} ({w.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {order.orderType && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Order Type</label>
                                <div className="p-2 bg-muted rounded text-sm">
                                    {order.orderType === 'IMPORT' ? 'Import' : 'Local'}
                                </div>
                            </div>
                        )}

                        {order.goodsType && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Goods Type</label>
                                <div className="p-2 bg-muted rounded text-sm">
                                    {order.goodsType === 'FRESH' ? 'FINISH GOODS' : 'Consumable'}
                                </div>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                                <Save className="h-4 w-4 mr-2" />
                                {submitting ? 'Creating...' : 'Submit GRN'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </PermissionGuard>
    );
}
