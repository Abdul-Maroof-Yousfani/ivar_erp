'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { vendorQuotationApi, VendorQuotation } from '@/lib/api';

export default function VendorQuotationList({ params }: { params: { rfqId: string } }) {
    const [quotations, setQuotations] = useState<VendorQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const rfqId = params.rfqId;

    useEffect(() => {
        fetchQuotations();
    }, [rfqId]);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const data = await vendorQuotationApi.getAll(rfqId);
            setQuotations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const rfqNumber = quotations[0]?.rfq?.rfqNumber || 'RFQ';

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendor Quotations</h1>
                    <p className="text-muted-foreground">For {rfqNumber}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/erp/procurement/rfq')}>
                        Back to RFQs
                    </Button>
                    <Link href={`/erp/procurement/vendor-quotation/compare/${rfqId}`}>
                        <Button variant="secondary">Compare Quotations</Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Quotations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
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
                                    <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : quotations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">No quotations found.</TableCell>
                                </TableRow>
                            ) : (
                                quotations.map((quotation) => (
                                    <TableRow key={quotation.id}>
                                        <TableCell className="font-medium">{quotation.vendor.name}</TableCell>
                                        <TableCell>{new Date(quotation.quotationDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{quotation.items.length} item(s)</TableCell>
                                        <TableCell className="font-semibold">{formatCurrency(parseFloat(quotation.totalAmount))}</TableCell>
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
                                            <Link href={`/erp/procurement/vendor-quotation/list/${quotation.id}`}>
                                                <Button variant="ghost" size="sm">View</Button>
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
    );
}
