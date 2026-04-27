'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { vendorQuotationApi, VendorQuotation } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function AllVendorQuotationList() {
    const [quotations, setQuotations] = useState<VendorQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('erp.procurement.vq.create');
    const canSubmit = hasPermission('erp.procurement.vq.submit');
    const canCompare = hasPermission('erp.procurement.vq.compare');

    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const data = await vendorQuotationApi.getAll();
            setQuotations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Group quotations by RFQ
    const groupedQuotations = quotations.reduce((groups, quotation) => {
        const rfqId = quotation.rfqId || 'direct';
        if (!groups[rfqId]) {
            groups[rfqId] = {
                rfq: quotation.rfq,
                items: []
            };
        }
        groups[rfqId].items.push(quotation);
        return groups;
    }, {} as Record<string, { rfq?: any, items: VendorQuotation[] }>);

    return (
        <PermissionGuard permissions="erp.procurement.vq.read">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Vendor Quotations</h1>
                {canCreate && (
                    <Link href="/erp/procurement/vendor-quotation/create">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Create Quotation
                        </Button>
                    </Link>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Received Quotations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : Object.keys(groupedQuotations).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">No quotations found.</TableCell>
                                </TableRow>
                            ) : (
                                Object.entries(groupedQuotations).map(([rfqId, group]) => (
                                    <>
                                        {/* Group Header Row */}
                                        <TableRow key={`header-${rfqId}`} className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                            <TableCell colSpan={6}>
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        RFQ: {group.rfq?.rfqNumber || 'Direct Orders'}
                                                    </span>
                                                    <Badge variant="secondary">
                                                        {group.items.length} Quotation{group.items.length > 1 ? 's' : ''}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {group.rfq && group.items.length > 1 && canCompare && (
                                                    <Link href={`/erp/procurement/vendor-quotation/compare/${rfqId}`}>
                                                        <Button variant="outline" size="sm">Compare All</Button>
                                                    </Link>
                                                )}
                                            </TableCell>
                                        </TableRow>

                                        {/* Individual Quotation Rows */}
                                        {group.items.map((quotation) => (
                                            <TableRow key={quotation.id}>
                                                <TableCell className="pl-8 font-medium">
                                                    {quotation.id.substring(0, 8)}...
                                                </TableCell>
                                                <TableCell>{quotation.vendor?.name || '-'}</TableCell>
                                                <TableCell>{new Date(quotation.quotationDate).toLocaleDateString()}</TableCell>
                                                <TableCell>{quotation.items.length} item(s)</TableCell>
                                                <TableCell className="font-semibold">{formatCurrency(quotation.totalAmount)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        quotation.status === 'SELECTED' ? 'default' :
                                                            quotation.status === 'REJECTED' ? 'destructive' :
                                                                quotation.status === 'SUBMITTED' ? 'outline' : 'secondary'
                                                    }>
                                                        {quotation.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2 justify-end">
                                                        <Link href={`/erp/procurement/vendor-quotation/${quotation.id}`}>
                                                            <Button variant="ghost" size="sm">View</Button>
                                                        </Link>
                                                        {quotation.status === 'DRAFT' && canSubmit && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        await vendorQuotationApi.submit(quotation.id);
                                                                        toast.success('Quotation submitted');
                                                                        fetchQuotations();
                                                                    } catch (error) {
                                                                        toast.error('Failed to submit');
                                                                    }
                                                                }}
                                                            >
                                                                Submit
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
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
