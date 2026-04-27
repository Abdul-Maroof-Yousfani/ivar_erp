'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { rfqApi, RequestForQuotation } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function RfqList() {
    const [rfqs, setRfqs] = useState<RequestForQuotation[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('erp.procurement.rfq.create');

    useEffect(() => {
        fetchRfqs();
    }, []);

    const fetchRfqs = async () => {
        try {
            setLoading(true);
            const data = await rfqApi.getAll();
            setRfqs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.rfq.read">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Request For Quotations (RFQ)</h1>
                {canCreate && (
                    <Link href="/erp/procurement/rfq/create">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Create RFQ
                        </Button>
                    </Link>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All RFQs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>RFQ Number</TableHead>
                                <TableHead>PR Number</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Vendors</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : rfqs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">No RFQs found.</TableCell>
                                </TableRow>
                            ) : (
                                rfqs.map((rfq) => (
                                    <TableRow key={rfq.id}>
                                        <TableCell className="font-medium">{rfq.rfqNumber}</TableCell>
                                        <TableCell>{rfq.purchaseRequisition?.prNumber || '-'}</TableCell>
                                        <TableCell>{new Date(rfq.rfqDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{rfq.vendors.length} vendor(s)</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                rfq.status === 'SENT' ? 'default' :
                                                    rfq.status === 'CLOSED' ? 'secondary' : 'outline'
                                            }>
                                                {rfq.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/erp/procurement/rfq/${rfq.id}`}>
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
        </PermissionGuard>
    );
}
