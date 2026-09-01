'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { getTransferRequests } from '@/lib/actions/transfer-request';

interface TransferSlip {
    id: string;
    requestNo: string;
    status: string;
    transferType: string;
    createdAt: string;
    approvedAt?: string;
    fromWarehouse?: { name: string; code: string };
    toWarehouse?: { name: string; code: string };
    fromLocation?: { name: string; code: string };
    toLocation?: { name: string; code: string };
    items: Array<{
        id: string;
        quantity: number;
        item: {
            sku: string;
            description: string;
            color?: { name: string } | null;
            size?: { name: string } | null;
        };
    }>;
    claim?: {
        claimNo: string;
        claimType: string;
    };
}

export default function ClaimTransferSlipPage() {
    const params = useParams();
    const id = params.id as string;
    const [transfer, setTransfer] = useState<TransferSlip | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTransferSlip();
    }, [id]);

    const loadTransferSlip = async () => {
        setLoading(true);
        try {
            const result = await getTransferRequests({ id });

            if (result.status && result.data && result.data.length > 0) {
                setTransfer(result.data[0]);
            } else {
                toast.error('Transfer slip not found');
            }
        } catch (error) {
            console.error('Failed to load transfer slip:', error);
            toast.error('Failed to load transfer slip');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading transfer slip...</p>
                </div>
            </div>
        );
    }

    if (!transfer) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-lg font-semibold mb-2">Transfer Slip Not Found</p>
                    <Link href="/erp/inventory/transactions/plm-claims">
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to PLM Claims
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-area, #print-area * {
                        visibility: visible;
                    }
                    #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-muted/30 p-8">
                {/* Action Buttons */}
                <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center no-print">
                    <Link href="/erp/inventory/transactions/plm-claims">
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <Button onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print Slip
                    </Button>
                </div>

                {/* Print Area */}
                <div id="print-area" className="max-w-4xl mx-auto">
                    <Card>
                        <CardHeader className="border-b bg-muted/50">
                            <div className="text-center space-y-2">
                                <CardTitle className="text-2xl">CLAIM TRANSFER SLIP</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Product Line Management Receipt
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {/* Transfer Details */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Transfer No</p>
                                    <p className="font-mono font-bold text-lg">{transfer.requestNo}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                                    <p className={`font-semibold ${
                                        transfer.status === 'COMPLETED' ? 'text-green-600' : 'text-amber-600'
                                    }`}>
                                        {transfer.status}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Created Date</p>
                                    <p className="font-medium">
                                        {format(new Date(transfer.createdAt), 'dd MMM yyyy, h:mm a')}
                                    </p>
                                </div>
                                {transfer.approvedAt && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-1">Acknowledged Date</p>
                                        <p className="font-medium">
                                            {format(new Date(transfer.approvedAt), 'dd MMM yyyy, h:mm a')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Claim Details */}
                            {transfer.claim && (
                                <div className="border-t pt-6">
                                    <h3 className="font-semibold mb-3">Claim Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Claim Number</p>
                                            <p className="font-mono font-medium">{transfer.claim.claimNo}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Claim Type</p>
                                            <p className="font-medium">{transfer.claim.claimType}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Location Details */}
                            <div className="border-t pt-6">
                                <h3 className="font-semibold mb-3">Transfer Route</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-muted-foreground">FROM</p>
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                            <p className="font-semibold">
                                                {transfer.fromLocation?.name || transfer.fromWarehouse?.name || 'N/A'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {transfer.fromLocation?.code || transfer.fromWarehouse?.code || ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-muted-foreground">TO</p>
                                        <div className="p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                                            <p className="font-semibold">
                                                {transfer.toWarehouse?.name || transfer.toLocation?.name || 'N/A'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {transfer.toWarehouse?.code || transfer.toLocation?.code || ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border-t pt-6">
                                <h3 className="font-semibold mb-3">Items</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left p-3 font-medium">#</th>
                                                <th className="text-left p-3 font-medium">SKU</th>
                                                <th className="text-left p-3 font-medium">Description</th>
                                                <th className="text-left p-3 font-medium">Color</th>
                                                <th className="text-left p-3 font-medium">Size</th>
                                                <th className="text-right p-3 font-medium">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfer.items.map((item, index) => (
                                                <tr key={item.id} className="border-t">
                                                    <td className="p-3">{index + 1}</td>
                                                    <td className="p-3 font-mono">{item.item.sku}</td>
                                                    <td className="p-3">{item.item.description}</td>
                                                    <td className="p-3">{item.item.color?.name || '-'}</td>
                                                    <td className="p-3">{item.item.size?.name || '-'}</td>
                                                    <td className="p-3 text-right font-semibold">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-muted/30 border-t-2">
                                            <tr>
                                                <td colSpan={5} className="p-3 font-semibold text-right">
                                                    Total Items:
                                                </td>
                                                <td className="p-3 text-right font-bold">
                                                    {transfer.items.reduce((sum, item) => sum + Number(item.quantity), 0)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Footer Note */}
                            <div className="border-t pt-6 text-sm text-muted-foreground">
                                <p className="mb-2">
                                    <strong>Note:</strong> This is a system-generated transfer slip for defective items 
                                    received from POS outlet and transferred to Product Line Management for inspection.
                                </p>
                                {transfer.status === 'PENDING' && (
                                    <p className="text-amber-600 font-medium">
                                        ⚠️ This transfer is pending PLM acknowledgment. Inventory will be updated upon acknowledgment.
                                    </p>
                                )}
                                {transfer.status === 'COMPLETED' && (
                                    <p className="text-green-600 font-medium">
                                        ✅ This transfer has been acknowledged and inventory has been updated.
                                    </p>
                                )}
                            </div>

                            {/* Signatures */}
                            <div className="border-t pt-6 grid grid-cols-2 gap-8">
                                <div className="text-center">
                                    <div className="border-t-2 border-dashed pt-2 mt-16">
                                        <p className="font-medium">Sent By</p>
                                        <p className="text-sm text-muted-foreground">POS Outlet</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="border-t-2 border-dashed pt-2 mt-16">
                                        <p className="font-medium">Received By</p>
                                        <p className="text-sm text-muted-foreground">PLM Warehouse</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
