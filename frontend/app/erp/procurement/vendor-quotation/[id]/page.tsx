'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { vendorQuotationApi, VendorQuotation } from '@/lib/api';
import { createPurchaseOrder } from '@/lib/actions/purchase-order';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { formatCurrency } from '@/lib/utils';

export default function VendorQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [quotation, setQuotation] = useState<VendorQuotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [creatingPo, setCreatingPo] = useState(false);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canSubmit = hasPermission('erp.procurement.vq.submit');
    const canSelect = hasPermission('erp.procurement.vq.select');
    const canCreatePo = hasPermission('erp.procurement.po.create');

    useEffect(() => {
        fetchQuotation();
    }, [id]);

    const fetchQuotation = async () => {
        try {
            setLoading(true);
            const data = await vendorQuotationApi.getById(id);
            setQuotation(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await vendorQuotationApi.submit(id);
            toast.success('Quotation submitted successfully');
            fetchQuotation();
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit quotation');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async () => {
        try {
            setLoading(true);
            await vendorQuotationApi.select(id);
            toast.success('Quotation selected successfully');
            fetchQuotation();
        } catch (error) {
            console.error(error);
            toast.error('Failed to select quotation');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePo = async () => {
        try {
            setCreatingPo(true);
            const po = await createPurchaseOrder({ vendorQuotationId: id });
            toast.success('Purchase Order generated successfully');
            router.push(`/erp/procurement/purchase-order/${po.id}`);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to generate Purchase Order');
        } finally {
            setCreatingPo(false);
        }
    };

    if (loading && !quotation) return <div className="p-0">Loading...</div>;
    if (!quotation) return <div className="p-0">Not found</div>;

    return (
        <PermissionGuard permissions="erp.procurement.vq.read">
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendor Quotation</h1>
                    <p className="text-muted-foreground">
                        {quotation.vendor.name} - RFQ: {quotation.rfq?.rfqNumber}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Back</Button>
                    {quotation.status === 'DRAFT' && canSubmit && (
                        <Button onClick={handleSubmit} disabled={loading}>Submit Quotation</Button>
                    )}
                    {quotation.status === 'SUBMITTED' && canSelect && (
                        <Button onClick={handleSelect} disabled={loading}>Select This Quotation</Button>
                    )}
                    {quotation.status === 'SELECTED' && canCreatePo && (
                        <Button onClick={handleGeneratePo} disabled={creatingPo}>
                            {creatingPo ? 'Generating...' : 'Generate Purchase Order'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                    <CardContent>
                        <Badge className="text-lg px-4 py-1" variant={
                            quotation.status === 'SELECTED' ? 'default' :
                                quotation.status === 'REJECTED' ? 'destructive' :
                                    quotation.status === 'SUBMITTED' ? 'outline' : 'secondary'
                        }>{quotation.status}</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Vendor</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                        <p><strong>{quotation.vendor.name}</strong></p>
                        <p className="text-sm text-muted-foreground">{quotation.vendor.code}</p>
                        <p className="text-sm text-muted-foreground">{quotation.vendor.email || '-'}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Total Amount</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{formatCurrency(parseFloat(quotation.totalAmount))}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Subtotal</p>
                        <p className="text-xl font-semibold">{formatCurrency(parseFloat(quotation.subtotal))}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Tax Amount</p>
                        <p className="text-xl font-semibold">{formatCurrency(parseFloat(quotation.taxAmount))}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Discount</p>
                        <p className="text-xl font-semibold text-green-600">-{formatCurrency(parseFloat(quotation.discountAmount))}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Grand Total</p>
                        <p className="text-2xl font-bold">{formatCurrency(parseFloat(quotation.totalAmount))}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Quoted Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Tax %</TableHead>
                                <TableHead>Disc %</TableHead>
                                <TableHead className="text-right">Line Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotation.items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.item?.itemId || item.itemId}</TableCell>
                                    <TableCell>{item.description || '-'}</TableCell>
                                    <TableCell>{item.quotedQty}</TableCell>
                                    <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                                    <TableCell>{item.taxPercent}%</TableCell>
                                    <TableCell>{item.discountPercent}%</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(parseFloat(item.lineTotal))}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {quotation.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{quotation.notes}</p>
                    </CardContent>
                </Card>
            )}
        </div>
        </PermissionGuard>
    );
}
