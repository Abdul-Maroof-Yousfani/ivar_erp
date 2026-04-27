import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getRfq } from '@/lib/actions/rfq';
import { getVendors } from '@/lib/actions/procurement';
import { RfqDetailClient } from './rfq-detail-client';
import { RfqVendorTable } from './rfq-vendor-table';
import { notFound, redirect } from 'next/navigation';
import { RequestForQuotation, PurchaseRequisitionItem } from '@/lib/api';
import { hasPermission } from '@/lib/auth';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function RfqDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const canRead = await hasPermission('erp.procurement.rfq.read');
    if (!canRead) <AccessDenied/>;

    const canAddVendors = await hasPermission('erp.procurement.rfq.add-vendors');
    const canSend = await hasPermission('erp.procurement.rfq.send');

    // Fetch data in parallel
    const [rfqResult, suppliersResult] = await Promise.all([
        getRfq(id),
        getVendors()
    ]);

    const rfq = rfqResult as RequestForQuotation;
    const suppliers = suppliersResult.status !== false ? (suppliersResult.data || []) : [];

    if (!rfq || (rfq as any).status === false) {
        notFound();
    }

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{rfq.rfqNumber}</h1>
                    <p className="text-muted-foreground">
                        Created from PR: {rfq.purchaseRequisition?.prNumber} on {new Date(rfq.rfqDate).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/erp/procurement/rfq">
                        <Button variant="outline">Back</Button>
                    </Link>
                    <RfqDetailClient rfq={rfq} suppliers={suppliers} canAddVendors={canAddVendors} canSend={canSend} />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                    <CardContent>
                        <Badge className="text-lg px-4 py-1" variant={
                            rfq.status === 'SENT' ? 'default' :
                                rfq.status === 'CLOSED' ? 'secondary' : 'outline'
                        }>{rfq.status}</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <p><strong>Notes:</strong> {rfq.notes || '-'}</p>
                        <p><strong>Vendors:</strong> {rfq.vendors.length}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Items (from PR)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Code</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rfq.purchaseRequisition?.items.map((item: any) => {
                                const itemData = item.item;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {itemData ? itemData.itemId : 'Item data unavailable'}
                                        </TableCell>
                                        <TableCell>
                                            {itemData ? itemData.description : '-'}
                                        </TableCell>
                                        <TableCell>{itemData ? itemData.sku : '-'}</TableCell>
                                        <TableCell>{item.requiredQty}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                    <RfqVendorTable rfq={rfq} />
                </CardContent>
            </Card>
        </div>
    );
}
