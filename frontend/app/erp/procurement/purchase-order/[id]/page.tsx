'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PurchaseOrder } from '@/lib/api';
import { getPurchaseOrder } from '@/lib/actions/purchase-order';
import { toast } from 'sonner';
import { Printer, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canCreateGrn = hasPermission('erp.procurement.grn.create');

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const data = await getPurchaseOrder(id);
            console.log('Fetched purchase order data:', data); // Debug log
            
            if (data && !data.items) {
                console.warn('Purchase order data missing items array:', data);
            }
            
            setOrder(data);
        } catch (error) {
            console.error('Error fetching purchase order:', error);
            toast.error('Failed to load purchase order');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-6 text-center">Loading...</div>;
    if (!order) return <div className="p-6 text-center text-red-500">Purchase Order not found</div>;

    return (
        <>
            <style jsx global>{`                @media print {
                    /* Hide everything in the body by default */
                    body {
                        visibility: hidden;
                    }

                    /* Make the print section visible and position it fixed to cover everything */
                    #print-section {
                        visibility: visible;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        background: white;
                        z-index: 9999;
                    }

                    /* Ensure all children of print section are visible */
                    #print-section * {
                        visibility: visible;
                    }

                    /* Hide browser default headers/footers if supported */
                    @page {
                        margin: 0;
                        size: auto;
                    }

                    /* Explicitly hide layout elements that might interfere */
                    header, nav, footer, aside, .banner {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Dashboard View - Hidden in Print */}
            <div className="p-6 space-y-6 max-w-6xl mx-auto print:hidden">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">PO Detail: {order.poNumber}</h1>
                        <p className="text-muted-foreground">Order Date: {new Date(order.orderDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.back()}>Back</Button>
                        {(order.status === 'OPEN' || order.status === 'PARTIALLY_RECEIVED') && canCreateGrn && (
                            <Button variant="default" className="bg-blue-600 hover:bg-blue-700" asChild>
                                <Link href={`/erp/procurement/grn/create/${order.id}`}>
                                    Create GRN
                                </Link>
                            </Button>
                        )}
                        <Button onClick={() => window.print()}>Print PO</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Vendor Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Vendor Name</p>
                                <p className="text-lg font-semibold">{order.vendor?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Vendor Code</p>
                                <p className="text-lg">{order.vendor?.code}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                <Badge variant={order.status === 'OPEN' ? 'default' : 'secondary'}>{order.status}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span className="font-medium">{parseFloat(order.subtotal || '0').toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span className="font-medium text-red-500">+{parseFloat(order.taxAmount || '0').toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Discount</span>
                                <span className="font-medium text-green-600">-{parseFloat(order.discountAmount || '0').toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 text-lg font-bold">
                                <span>Total</span>
                                <span>{parseFloat(order.totalAmount || '0').toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Order Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item ID</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Ordered</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Tax %</TableHead>
                                    <TableHead className="text-right">Line Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items && order.items.length > 0 ? (
                                    order.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.item?.itemId || item.itemId}</TableCell>
                                            <TableCell>{item.description || 'No description'}</TableCell>
                                            <TableCell className="text-right font-mono">{parseFloat(item.quantity).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono text-blue-600">{parseFloat(item.receivedQty || '0').toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{item.taxPercent}%</TableCell>
                                            <TableCell className="text-right font-semibold">{parseFloat(item.lineTotal).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No items found for this purchase order
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {order.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Professional Print View - Hidden on Screen */}
            <div id="print-section" className="hidden print:block min-h-screen bg-white p-0">
                <div className="max-w-4xl mx-auto border-none shadow-none">

                    {/* Header Section */}
                    <div className="p-8 border-b">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-primary font-bold text-2xl mb-2">
                                    <Building2 className="h-8 w-8" />
                                    <span>Speed Limit ERP</span>
                                </div>
                                <p className="text-sm text-muted-foreground">123 Business Avenue</p>
                                <p className="text-sm text-muted-foreground">Karachi, Pakistan</p>
                                <p className="text-sm text-muted-foreground">Phone: +92 300 1234567</p>
                                <p className="text-sm text-muted-foreground">Email: procurement@speedlimit.com</p>
                            </div>
                            <div className="text-right">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">PURCHASE ORDER</h1>
                                <div className="space-y-1">
                                    <p className="text-sm"><span className="font-semibold">PO Number:</span> {order.poNumber}</p>
                                    <p className="text-sm"><span className="font-semibold">Date:</span> {new Date(order.orderDate).toLocaleDateString()}</p>
                                    <div className="mt-2">
                                        <Badge variant={order.status === 'OPEN' ? 'default' : 'secondary'} className="text-sm px-3 py-0.5 print:border print:border-gray-300 print:text-black">
                                            {order.status}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vendor & Ship To Section */}
                    <div className="grid grid-cols-2 gap-8 p-8 border-b">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vendor</h3>
                            <div className="text-sm space-y-1">
                                <p className="font-bold text-gray-900 text-lg">{order.vendor?.name}</p>
                                <p className="text-muted-foreground">Code: {order.vendor?.code}</p>
                                <p className="text-muted-foreground">{order.vendor?.email || 'No Email Provided'}</p>
                                <p className="text-muted-foreground">{order.vendor?.contactNo || 'No Phone Provided'}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Ship To</h3>
                            <div className="text-sm space-y-1">
                                <p className="font-bold text-gray-900">Speed Limit Warehouse</p>
                                <p className="text-muted-foreground">Main Warehouse, Plot #45</p>
                                <p className="text-muted-foreground">Industrial Area</p>
                                <p className="text-muted-foreground">Karachi, Pakistan</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="p-8">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 border-t border-b border-gray-200">
                                    <TableHead className="font-bold text-gray-900">Item Details</TableHead>
                                    <TableHead className="text-right font-bold text-gray-900">Qty</TableHead>
                                    <TableHead className="text-right font-bold text-gray-900">Unit Price</TableHead>
                                    <TableHead className="text-right font-bold text-gray-900">Tax</TableHead>
                                    <TableHead className="text-right font-bold text-gray-900">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items && order.items.length > 0 ? (
                                    order.items.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-transparent">
                                            <TableCell>
                                                <div className="font-medium text-gray-900">{item.item?.itemId || item.itemId}</div>
                                                <div className="text-sm text-muted-foreground">{item.description || '-'}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{parseFloat(item.quantity).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{item.taxPercent}%</TableCell>
                                            <TableCell className="text-right font-mono font-medium">{parseFloat(item.lineTotal).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No items found for this purchase order
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Totals Section */}
                    <div className="p-8 bg-gray-50 print:bg-transparent">
                        <div className="flex justify-end">
                            <div className="w-64 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span className="font-mono font-medium">{parseFloat(order.subtotal || '0').toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax Total:</span>
                                    <span className="font-mono font-medium">{parseFloat(order.taxAmount || '0').toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Discount:</span>
                                    <span className="font-mono font-medium text-green-600">-{parseFloat(order.discountAmount || '0').toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-300 pt-3 mt-3">
                                    <span className="font-bold text-lg">Total:</span>
                                    <span className="font-bold text-lg font-mono">{parseFloat(order.totalAmount || '0').toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Notes / Signature */}
                    <div className="p-8 border-t grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Notes & Instructions:</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {order.notes || "1. Please quote PO number on all correspondence.\n2. Goods must be delivered within 7 days.\n3. Payment terms: Net 30 days."}
                            </p>
                        </div>
                        <div className="pt-8 md:pt-0">
                            <div className="h-16 border-b border-black mb-2"></div>
                            <p className="text-center text-sm font-medium">Authorized Signature</p>
                            <p className="text-center text-xs text-muted-foreground mt-1">Innovative Network Pvt Ltd</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
