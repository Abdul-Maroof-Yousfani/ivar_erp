'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { VendorQuotation } from '@/lib/api';
import { getPendingQuotations, createPurchaseOrder } from '@/lib/actions/purchase-order';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function PendingPurchaseOrders() {
    const router = useRouter();
    const [quotations, setQuotations] = useState<VendorQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingQuotations();
    }, []);

    const fetchPendingQuotations = async () => {
        try {
            setLoading(true);
            const data = await getPendingQuotations();
            setQuotations(data);
        } catch (error) {
            console.error('Failed to fetch pending quotations:', error);
            toast.error('Failed to load pending quotations');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePO = async (quotationId: string) => {
        try {
            setCreating(quotationId);
            const po = await createPurchaseOrder({
                vendorQuotationId: quotationId,
                notes: 'Generated from Pending POs page'
            });
            toast.success(`Purchase Order ${po.poNumber} created successfully`);
            router.push(`/erp/procurement/purchase-order/${po.id}`);
        } catch (error: any) {
            console.error('Failed to create PO:', error);
            toast.error(error.message || 'Failed to create Purchase Order');
        } finally {
            setCreating(null);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.po.create">
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pending Purchase Orders</h1>
                    <p className="text-muted-foreground">Select an approved quotation to generate a Purchase Order.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ready for Ordering</CardTitle>
                    <CardDescription>Vendor quotations that have been selected but not yet ordered.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>RFQ Ref</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        Loading pending items...
                                    </TableCell>
                                </TableRow>
                            ) : quotations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="h-8 w-8 opacity-20" />
                                            <p>No pending quotations found.</p>
                                            <p className="text-xs">All selected quotations have been processed into POs.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quotations.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell className="font-medium font-mono">
                                            {q.id.slice(0, 8).toUpperCase()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{q.vendor?.name}</span>
                                                <span className="text-xs text-muted-foreground">{q.vendor?.code}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {q.rfq?.rfqNumber || 'N/A'}
                                        </TableCell>
                                        <TableCell>{new Date(q.quotationDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-semibold">
                                            {parseFloat(q.totalAmount).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                onClick={() => handleCreatePO(q.id)}
                                                disabled={creating === q.id}
                                            >
                                                {creating === q.id ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Creating...
                                                    </>
                                                ) : (
                                                    'Create PO'
                                                )}
                                            </Button>
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
