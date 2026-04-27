'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { vendorQuotationApi, VendorQuotation } from '@/lib/api';
import { awardFromRfq } from '@/lib/actions/purchase-order';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function CompareQuotations({ params }: { params: Promise<{ rfqId: string }> }) {
    const { rfqId } = use(params);
    const [quotations, setQuotations] = useState<VendorQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [awards, setAwards] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canSelect = hasPermission('erp.procurement.vq.select');
    const canCreatePo = hasPermission('erp.procurement.po.create');

    useEffect(() => {
        fetchComparison();
    }, [rfqId]);

    const fetchComparison = async () => {
        try {
            setLoading(true);
            const data = await vendorQuotationApi.compare(rfqId);
            setQuotations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAwardChange = (itemId: string, vendorQuotationId: string) => {
        setAwards(prev => ({ ...prev, [itemId]: vendorQuotationId }));
    };

    const handleAwardSubmit = async () => {
        try {
            setSubmitting(true);
            const prItems = quotations[0]?.rfq?.purchaseRequisition?.items || [];
            const grouped: Record<string, { itemId: string; quantity: number }[]> = {};
            for (const prItem of prItems) {
                const vqid = awards[prItem.itemId];
                if (!vqid) continue;
                const qty = Number(prItem.requiredQty);
                if (!grouped[vqid]) grouped[vqid] = [];
                grouped[vqid].push({ itemId: prItem.itemId, quantity: qty });
            }
            const payload = {
                rfqId,
                awards: Object.entries(grouped).map(([vendorQuotationId, items]) => ({
                    vendorQuotationId,
                    items
                }))
            };
            const result = await awardFromRfq(payload);
            if (Array.isArray(result) && result.length > 0) {
                toast.success('Purchase Orders created for awarded items');
                router.push(`/erp/procurement/purchase-order/${result[0].id}`);
            } else {
                toast.error('No orders created');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to award items');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelect = async (quotationId: string) => {
        try {
            await vendorQuotationApi.select(quotationId);
            toast.success('Vendor selected successfully');
            fetchComparison(); // Refresh
        } catch (error) {
            console.error(error);
            toast.error('Failed to select vendor');
        }
    };

    if (loading) return <div className="p-0">Loading...</div>;
    if (quotations.length === 0) return <div className="p-0">No quotations to compare.</div>;

    // Get all unique items from all quotations
    const allItems = quotations[0]?.rfq?.purchaseRequisition?.items || [];

    return (
        <PermissionGuard permissions="erp.procurement.vq.compare">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Compare Quotations</h1>
                        <Link href={`/erp/procurement/rfq/${rfqId}`} className="text-sm text-blue-600 hover:underline">
                            View RFQ Detail
                        </Link>
                    </div>
                </div>
                <Button variant="outline" onClick={() => router.back()}>Back</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Price Comparison</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[200px]">Item</TableHead>
                                {quotations.map((q) => (
                                    <TableHead key={q.id} className="text-center min-w-[150px]">
                                        <div className="font-semibold">{q.vendor.name}</div>
                                        <Badge className="mt-1" variant={
                                            q.status === 'SELECTED' ? 'default' :
                                                q.status === 'REJECTED' ? 'destructive' : 'outline'
                                        }>
                                            {q.status}
                                        </Badge>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allItems.map((prItem) => (
                                <TableRow key={prItem.id}>
                                    <TableCell className="font-medium">
                                        <div>{(prItem as any).item?.itemId || prItem.itemId}</div>
                                        <div className="text-sm text-muted-foreground">{(prItem as any).item?.description || '-'}</div>
                                        <div className="text-sm text-muted-foreground">Qty: {prItem.requiredQty}</div>
                                        {(prItem as any).lastPurchaseInfo && (
                                            <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-md text-[11px] border border-blue-100 dark:border-blue-900 line-height-tight">
                                                <div className="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-1">Last Purchase</div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Rate:</span>
                                                    <span className="font-semibold">{parseFloat((prItem as any).lastPurchaseInfo.rate).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Date:</span>
                                                    <span>{new Date((prItem as any).lastPurchaseInfo.date).toLocaleDateString()}</span>
                                                </div>
                                                <div className="truncate" title={(prItem as any).lastPurchaseInfo.vendor}>
                                                    <span className="text-muted-foreground">Vendor: </span>
                                                    <span className="font-medium">{(prItem as any).lastPurchaseInfo.vendor}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            <Select onValueChange={(value) => handleAwardChange(prItem.itemId, value)}>
                                                <SelectTrigger className="w-[220px]">
                                                    <SelectValue placeholder="Award to vendor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {quotations.map((q) => {
                                                        const hasItem = q.items.some(i => i.itemId === prItem.itemId);
                                                        return hasItem ? (
                                                            <SelectItem key={q.id} value={q.id}>
                                                                {q.vendor.name}
                                                            </SelectItem>
                                                        ) : null;
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </TableCell>
                                    {quotations.map((quotation) => {
                                        const item = quotation.items.find(i => i.itemId === prItem.itemId);
                                        return (
                                            <TableCell key={quotation.id} className="text-center">
                                                {item ? (
                                                    <div>
                                                        <div className="font-semibold text-lg">{parseFloat(item.unitPrice).toFixed(2)}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Qty: {item.quotedQty}
                                                        </div>
                                                        {parseFloat(item.taxPercent) > 0 && (
                                                            <div className="text-xs text-muted-foreground">Tax: {item.taxPercent}%</div>
                                                        )}
                                                        {parseFloat(item.discountPercent) > 0 && (
                                                            <div className="text-xs text-green-600">Disc: {item.discountPercent}%</div>
                                                        )}
                                                        <div className="text-sm font-medium mt-1">
                                                            Total: {parseFloat(item.lineTotal).toFixed(2)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                            <TableRow className="bg-muted/50">
                                <TableCell className="font-bold">Grand Total</TableCell>
                                {quotations.map((quotation) => (
                                    <TableCell key={quotation.id} className="text-center">
                                        <div className="text-xl font-bold">{parseFloat(quotation.totalAmount).toFixed(2)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Subtotal: {parseFloat(quotation.subtotal).toFixed(2)}
                                        </div>
                                        {parseFloat(quotation.taxAmount) > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                Tax: {parseFloat(quotation.taxAmount).toFixed(2)}
                                            </div>
                                        )}
                                        {parseFloat(quotation.discountAmount) > 0 && (
                                            <div className="text-xs text-green-600">
                                                Discount: -{parseFloat(quotation.discountAmount).toFixed(2)}
                                            </div>
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-bold">Action</TableCell>
                                {quotations.map((quotation) => (
                                    <TableCell key={quotation.id} className="text-center">
                                        {quotation.status === 'SUBMITTED' && canSelect && (
                                            <Button onClick={() => handleSelect(quotation.id)} size="sm">
                                                Select This Vendor
                                            </Button>
                                        )}
                                        {quotation.status === 'SELECTED' && (
                                            <Badge variant="default" className="text-sm">Selected</Badge>
                                        )}
                                        {quotation.status === 'REJECTED' && (
                                            <Badge variant="destructive" className="text-sm">Rejected</Badge>
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={quotations.length + 1}>
                                    <div className="flex justify-end">
                                        {canCreatePo && (
                                            <Button onClick={handleAwardSubmit} disabled={submitting} variant="secondary">
                                                {submitting ? 'Processing...' : 'Award Selected Items & Create POs'}
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        </PermissionGuard>
    );
}
