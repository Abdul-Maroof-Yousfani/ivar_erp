'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PurchaseOrder } from '@/lib/api';
import { getPurchaseOrder, updatePurchaseOrderStatus } from '@/lib/actions/purchase-order';
import { toast } from 'sonner';
import { Printer, ArrowLeft, Building2, CheckCircle2, Clock, XCircle, ThumbsUp, Check, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';

export function numberToWords(amount: number): string {
    const a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const inWords = (num: number): string => {
        let n = Math.floor(num);
        if (n === 0) return "Zero";
        
        const convert = (n: number): string => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + a[n % 10] : "");
            if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
            if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
            if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
            return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
        };
        
        return convert(n) + " Only";
    };

    return `Rs. ${inWords(amount)}.`;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canCreateGrn = hasPermission('erp.procurement.grn.create');
    const canCheck = hasPermission('erp.procurement.po.check');
    const canAuthorize = hasPermission('erp.procurement.po.authorize');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const handleAction = async (newStatus: string) => {
        try {
            setSubmitting(true);
            const actionText = newStatus === 'REJECTED' ? 'reject' : 'approve';
            await updatePurchaseOrderStatus(id, newStatus);
            toast.success(`Purchase Order ${actionText}ed successfully!`);
            fetchOrder(); // Reload data
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || `Failed to update status`);
        } finally {
            setSubmitting(false);
        }
    };

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

                    /* Make the print section visible and position it absolute to allow scrolling/multiple pages */
                    #print-section {
                        visibility: visible;
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: auto;
                        margin: 0;
                        padding: 0;
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
                        <Button variant="outline" asChild>
                            <Link href="/erp/procurement/purchase-order" transitionTypes={["nav-back"]}>
                                Back
                            </Link>
                        </Button>
                        {(order.status === 'OPEN' || order.status === 'PARTIALLY_RECEIVED') && canCreateGrn && (
                            <Button variant="default" className="bg-blue-600 hover:bg-blue-700" asChild>
                                <Link href={`/erp/procurement/grn/create/${order.id}`} transitionTypes={["nav-forward"]}>
                                    Create GRN
                                </Link>
                            </Button>
                        )}
                        <Button onClick={() => window.print()}>Print PO</Button>
                    </div>
                </div>

                {/* Visual Approval Stepper */}
                <Card className="bg-gradient-to-r from-slate-900/90 to-slate-950/95 text-white border-slate-800 shadow-xl overflow-hidden relative backdrop-blur-md">
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
                    <CardHeader className="relative pb-2">
                        <CardTitle className="text-lg font-medium text-slate-300">Approval Workflow Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="relative py-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                            {/* Connector Line (Only for larger screens) */}
                            <div className="hidden md:block absolute left-[16.6%] right-[16.6%] top-[24px] h-0.5 bg-slate-800 z-0" />
                            
                            {/* Step 1: Prepared */}
                            <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 md:mx-auto animate-none">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">1. Prepared (Maker)</span>
                                    <span className="text-xs text-slate-400 mt-0.5">{order.creatorName || 'Prepared'}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{new Date(order.orderDate).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Step 2: Checked */}
                            <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                                    order.status === 'PENDING_CHECKER'
                                        ? 'bg-amber-500 border-amber-400 text-white animate-pulse shadow-lg shadow-amber-500/20'
                                        : order.status === 'REJECTED' && !order.checkedById
                                        ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                        : order.checkedById
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                    {order.checkedById ? (
                                        <CheckCircle2 className="h-6 w-6" />
                                    ) : order.status === 'PENDING_CHECKER' ? (
                                        <Clock className="h-6 w-6" />
                                    ) : order.status === 'REJECTED' && !order.checkedById ? (
                                        <XCircle className="h-6 w-6" />
                                    ) : (
                                        <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                    )}
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">2. Checked (Checker)</span>
                                    {order.checkedById ? (
                                        <>
                                            <span className="text-xs text-slate-400 mt-0.5">{order.checkerName}</span>
                                            <span className="text-[10px] text-slate-500 mt-0.5">{order.checkedAt ? new Date(order.checkedAt).toLocaleDateString() : ''}</span>
                                        </>
                                    ) : order.status === 'PENDING_CHECKER' ? (
                                        <span className="text-xs text-amber-400 font-medium animate-pulse mt-0.5">Awaiting Verification</span>
                                    ) : (
                                        <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Authorized */}
                            <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                                    order.status === 'OPEN' || order.status === 'CLOSED' || order.status === 'PARTIALLY_RECEIVED' || order.status === 'RECEIVED'
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : order.status === 'PENDING_AUTHORIZER'
                                        ? 'bg-blue-500 border-blue-400 text-white animate-pulse shadow-lg shadow-blue-500/20'
                                        : order.status === 'REJECTED' && order.checkedById
                                        ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                    {order.status === 'OPEN' || order.status === 'CLOSED' || order.status === 'PARTIALLY_RECEIVED' || order.status === 'RECEIVED' ? (
                                        <CheckCircle2 className="h-6 w-6" />
                                    ) : order.status === 'PENDING_AUTHORIZER' ? (
                                        <Clock className="h-6 w-6" />
                                    ) : order.status === 'REJECTED' && order.checkedById ? (
                                        <XCircle className="h-6 w-6" />
                                    ) : (
                                        <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                    )}
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">3. Approved (Authorizer)</span>
                                    {order.authorizedById ? (
                                        <>
                                            <span className="text-xs text-slate-400 mt-0.5">{order.authorizerName}</span>
                                            <span className="text-[10px] text-slate-500 mt-0.5">{order.authorizedAt ? new Date(order.authorizedAt).toLocaleDateString() : ''}</span>
                                        </>
                                    ) : order.status === 'PENDING_AUTHORIZER' ? (
                                        <span className="text-xs text-blue-400 font-medium animate-pulse mt-0.5">Awaiting Authorization</span>
                                    ) : order.status === 'REJECTED' && order.checkedById ? (
                                        <span className="text-xs text-rose-400 font-medium mt-0.5">Rejected</span>
                                    ) : (
                                        <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Approval Actions Panel (Only visible for users with correct role and when pending) */}
                {((order.status === 'PENDING_CHECKER' && canCheck) || 
                  (order.status === 'PENDING_AUTHORIZER' && canAuthorize)) && (
                    <Card className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/40 dark:to-slate-900/20 border-blue-200/60 dark:border-slate-800 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-blue-900 dark:text-blue-400 flex items-center gap-2 text-lg">
                                <ThumbsUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                Pending Approval Action Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-blue-700 dark:text-slate-300">
                                This Purchase Order is currently in <strong>{order.status === 'PENDING_CHECKER' ? 'Pending Checker Verification' : 'Pending Authorizer Release'}</strong>. 
                                As an authorized user, you can either approve/verify this order to forward it to the next step, or reject it.
                            </p>
                            <div className="flex gap-4">
                                <Button 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                                    onClick={() => handleAction(order.status === 'PENDING_CHECKER' ? 'PENDING_AUTHORIZER' : 'OPEN')}
                                    disabled={submitting}
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    {order.status === 'PENDING_CHECKER' ? 'Verify & Forward' : 'Authorize & Release PO'}
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                                    onClick={() => handleAction('REJECTED')}
                                    disabled={submitting}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Reject Purchase Order
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

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
                                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                                {(() => {
                                    switch (order.status) {
                                        case 'PENDING_CHECKER':
                                            return (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
                                                    Pending Checker
                                                </Badge>
                                            );
                                        case 'PENDING_AUTHORIZER':
                                            return (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
                                                    Pending Authorizer
                                                </Badge>
                                            );
                                        case 'OPEN':
                                            return (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                                                    Open
                                                </Badge>
                                            );
                                        case 'REJECTED':
                                            return (
                                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-medium dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900">
                                                    Rejected
                                                </Badge>
                                            );
                                        case 'CLOSED':
                                            return (
                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900">
                                                    Closed
                                                </Badge>
                                            );
                                        case 'PARTIALLY_RECEIVED':
                                            return (
                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900">
                                                    Partially Received
                                                </Badge>
                                            );
                                        case 'RECEIVED':
                                            return (
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900">
                                                    Received
                                                </Badge>
                                            );
                                        default:
                                            return (
                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium">
                                                    {order.status}
                                                </Badge>
                                            );
                                    }
                                })()}
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
                                    <TableHead>Size</TableHead>
                                    <TableHead>Color</TableHead>
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
                                            <TableCell>{item.item?.size?.name || '-'}</TableCell>
                                            <TableCell>{item.item?.color?.name || '-'}</TableCell>
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
                                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-8 font-sans print:p-8 print:max-w-none box-border">
                    {/* Header */}
                    <div className="flex justify-between mb-6 gap-4 items-start">
                        {/* Logo */}
                        <div className="w-[20%] flex flex-col items-start justify-center">
                           <img src="/image.png" alt="Logo" className="w-32 object-contain" />
                        </div>
                        
                        {/* Title */}
                        <div className="w-[35%] flex flex-col justify-center">
                          <div className="bg-[#eef2f6] text-black w-full text-center py-2 text-xl sm:text-xl font-bold  print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
                            Purchase Order
                          </div>
                        </div>

                        {/* Details Box */}
                        <div className="w-[45%] bg-[#f8fafc] text-xs sm:text-[13px] p-2 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
                           <div className="flex justify-between mb-2">
                             <span className="font-bold">PO Number:</span>
                             <span className="font-bold">{order.poNumber}</span>
                           </div>
                           <div className="flex justify-between">
                             <div className="flex gap-2">
                               <span className="font-bold">Date:</span>
                               <span>{new Date(order.orderDate).toLocaleDateString('en-GB')}</span>
                             </div>
                           </div>
                        </div>
                    </div>

                    {/* Vendor / Ship To Box */}
                    <div className="flex gap-4 mb-4 text-xs sm:text-[13px]">
                        <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                            <div className="font-bold border-b border-gray-300 mb-2 pb-1">Vendor Details</div>
                            <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>{order.vendor?.name}</span></div>
                            <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Code:</span> <span>{order.vendor?.code}</span></div>
                            <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Email:</span> <span>{order.vendor?.email || 'N/A'}</span></div>
                            <div className="flex gap-2"><span className="font-bold w-16 shrink-0">Contact:</span> <span>{order.vendor?.contactNo || 'N/A'}</span></div>
                        </div>
                        <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                            <div className="font-bold border-b border-gray-300 mb-2 pb-1">Ship To</div>
                            <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>Speed Limit Warehouse</span></div>
                            <div className="flex gap-2"><span className="font-bold w-16 shrink-0">Address:</span> <span>Main Warehouse, Plot #45, Industrial Area, Karachi, Pakistan</span></div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-xs sm:text-[13px] mb-4 border-collapse table-fixed">
                        <thead>
                          <tr className="border-y-2 border-black">
                            <th className="py-2 pr-2 text-left font-bold w-[30%]">Item Details</th>
                            <th className="py-2 pr-2 text-left font-bold w-[10%]">Size</th>
                            <th className="py-2 pr-2 text-left font-bold w-[10%]">Color</th>
                            <th className="py-2 pr-2 text-right font-bold w-[10%]">Qty</th>
                            <th className="py-2 pr-2 text-right font-bold w-[15%]">Unit Price</th>
                            <th className="py-2 pr-2 text-right font-bold w-[10%]">Tax %</th>
                            <th className="py-2 text-right font-bold w-[15%]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, i) => (
                              <tr key={item.id || i} className="border-b border-gray-300 align-top">
                                <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                                  <div className="font-medium">{item.item?.itemId || item.itemId}</div>
                                  <div className="text-gray-700">{item.description || '-'}</div>
                                </td>
                                <td className="py-2 pr-2 text-left overflow-hidden text-ellipsis">
                                  {item.item?.size?.name || '-'}
                                </td>
                                <td className="py-2 pr-2 text-left overflow-hidden text-ellipsis">
                                  {item.item?.color?.name || '-'}
                                </td>
                                <td className="py-2 pr-2 text-right tabular-nums">
                                  {parseFloat(item.quantity).toFixed(2)}
                                </td>
                                <td className="py-2 pr-2 text-right tabular-nums">
                                  {fmt(Number(item.unitPrice))}
                                </td>
                                <td className="py-2 pr-2 text-right tabular-nums">
                                  {item.taxPercent}%
                                </td>
                                <td className="py-2 text-right tabular-nums">
                                  {fmt(Number(item.lineTotal))}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                                <td colSpan={5} className="py-4 text-center text-muted-foreground border-b border-gray-300">
                                    No items found for this purchase order
                                </td>
                            </tr>
                          )}
                        </tbody>
                    </table>

                    {/* Totals Section */}
                    <div className="flex border-b border-black pb-2 items-end">
                        <div className="w-[55%] pt-4">
                            <div className="flex gap-2 font-bold text-xs sm:text-[13px]">
                                <span className="whitespace-nowrap">In Words</span>
                                <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(Number(order.totalAmount || 0))}</span>
                            </div>
                        </div>
                        <div className="w-[25%] pr-2 text-right">
                            <div className="text-xs sm:text-[13px] text-gray-700">Subtotal:</div>
                            <div className="text-xs sm:text-[13px] text-gray-700">Tax:</div>
                            <div className="text-xs sm:text-[13px] text-gray-700">Discount:</div>
                            <div className="font-bold text-xs sm:text-[13px] mt-1">Total:</div>
                        </div>
                        <div className="w-[20%] text-right">
                            <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(order.subtotal || 0))}</div>
                            <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(order.taxAmount || 0))}</div>
                            <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">-{fmt(Number(order.discountAmount || 0))}</div>
                            <div className="ml-auto border-t border-black pb-0.5 mt-1" style={{ borderBottom: '3px double black' }}>
                                <span className="tabular-nums font-bold text-xs sm:text-[13px] block pt-0.5">{fmt(Number(order.totalAmount || 0))}</span>
                            </div>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="mt-4 mb-8">
                        <div className="font-bold text-xs sm:text-[14px]">Notes & Instructions</div>
                        <p className="text-xs sm:text-[13px] mt-1 text-gray-700 whitespace-pre-wrap">{order.notes || "1. Please quote PO number on all correspondence.\n2. Goods must be delivered within 7 days.\n3. Payment terms: Net 30 days."}</p>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                            <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">PREPARED BY (MAKER)</span>
                            {order.creatorName && (
                                <div className="text-center">
                                    <p className="text-[11px] font-semibold">{order.creatorName}</p>
                                    <p className="text-[9px] text-gray-600">{new Date(order.orderDate).toLocaleDateString('en-GB')}</p>
                                </div>
                            )}
                        </div>
                        <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                            <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">CHECKED BY (CHECKER)</span>
                            {order.checkerName ? (
                                <div className="text-center">
                                    <p className="text-[11px] font-semibold">{order.checkerName}</p>
                                    <p className="text-[9px] text-gray-600">{order.checkedAt ? new Date(order.checkedAt).toLocaleDateString('en-GB') : ''}</p>
                                </div>
                            ) : (
                                <span className="text-[10px] text-gray-400 italic">Pending Verification</span>
                            )}
                        </div>
                        <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                            <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">APPROVED BY (AUTHORIZER)</span>
                            {order.authorizerName ? (
                                <div className="text-center">
                                    <p className="text-[11px] font-semibold">{order.authorizerName}</p>
                                    <p className="text-[9px] text-gray-600">{order.authorizedAt ? new Date(order.authorizedAt).toLocaleDateString('en-GB') : ''}</p>
                                </div>
                            ) : (
                                <span className="text-[10px] text-gray-400 italic">Pending Approval</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
