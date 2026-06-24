'use client';

import { use, useEffect, useState } from 'react';
import { getTransferRequests, updateTransferRequestStatus } from '@/lib/actions/transfer-request';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, Clock, CheckCircle2, XCircle, Check, X, ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';

export default function TransferSlipPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [transfer, setTransfer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { hasPermission } = useAuth();
    const canCheck = hasPermission('erp.inventory.transfer.check') || hasPermission('pos.inventory.transfer.check');
    const canAuthorize = hasPermission('erp.inventory.transfer.authorize') || hasPermission('pos.inventory.transfer.authorize');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadTransferDetails();
    }, [id]);

    const loadTransferDetails = async () => {
        try {
            const res = await getTransferRequests();
            const req = res.data?.find((t: any) => t.id === id);
            if (req) {
                setTransfer(req);
            }
        } catch (error) {
            console.error('Failed to load transfer details', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (newStatus: string) => {
        try {
            setSubmitting(true);
            const actionText = newStatus === 'REJECTED' ? 'reject' : 'approve';
            const res = await updateTransferRequestStatus(id, newStatus);
            if (res.status === false) {
                throw new Error(res.message || 'Failed to update status');
            }
            toast.success(`Transfer request ${actionText}ed successfully!`);
            loadTransferDetails();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || `Failed to update status`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center">Loading Transfer Slip...</div>;
    }

    if (!transfer) {
        return <div className="p-10 text-center text-red-500">Transfer Request Not Found.</div>;
    }

    const printSlip = () => {
        window.print();
    };

    return (
        <PermissionGuard permissions="erp.inventory.stock-transfer.read">
            <div className="min-h-screen bg-gray-100 print:bg-white text-black py-6">
            {/* Non-Printable Action Bar */}
            <div className="print:hidden bg-white border-b p-4 flex justify-between items-center shadow-sm max-w-4xl mx-auto rounded-t-md mb-6">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button onClick={printSlip}>
                    <Printer className="h-4 w-4 mr-2" /> 
                    {transfer?.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Print Return Challan' : 'Print Delivery Challan'}
                </Button>
            </div>

            {/* Visual Approval Stepper & Action Panel */}
            <div className="print:hidden max-w-4xl mx-auto mb-6 space-y-6">
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
                                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 md:mx-auto">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">1. Prepared (Maker)</span>
                                    <span className="text-xs text-slate-400 mt-0.5">{transfer.creatorName || 'Prepared'}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{format(new Date(transfer.createdAt), 'dd MMM yyyy')}</span>
                                </div>
                            </div>

                            {/* Step 2: Checked */}
                            <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                                    transfer.status === 'PENDING_CHECKER'
                                        ? 'bg-amber-500 border-amber-400 text-white animate-pulse shadow-lg shadow-amber-500/20'
                                        : transfer.status === 'REJECTED' && !transfer.checkedById
                                        ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                        : transfer.checkedById
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                    {transfer.checkedById ? (
                                        <CheckCircle2 className="h-6 w-6" />
                                    ) : transfer.status === 'PENDING_CHECKER' ? (
                                        <Clock className="h-6 w-6" />
                                    ) : transfer.status === 'REJECTED' && !transfer.checkedById ? (
                                        <XCircle className="h-6 w-6" />
                                    ) : (
                                        <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                    )}
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">2. Checked (Checker)</span>
                                    {transfer.checkedById ? (
                                        <>
                                            <span className="text-xs text-slate-400 mt-0.5">{transfer.checkerName}</span>
                                            <span className="text-[10px] text-slate-500 mt-0.5">{transfer.checkedAt ? format(new Date(transfer.checkedAt), 'dd MMM yyyy') : ''}</span>
                                        </>
                                    ) : transfer.status === 'PENDING_CHECKER' ? (
                                        <span className="text-xs text-amber-400 font-medium animate-pulse mt-0.5">Awaiting Verification</span>
                                    ) : (
                                        <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Authorized */}
                            <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                                    transfer.status === 'PENDING' || transfer.status === 'COMPLETED' || transfer.status === 'APPROVED'
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : transfer.status === 'PENDING_AUTHORIZER'
                                        ? 'bg-blue-500 border-blue-400 text-white animate-pulse shadow-lg shadow-blue-500/20'
                                        : transfer.status === 'REJECTED' && transfer.checkedById
                                        ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                    {transfer.status === 'PENDING' || transfer.status === 'COMPLETED' || transfer.status === 'APPROVED' ? (
                                        <CheckCircle2 className="h-6 w-6" />
                                    ) : transfer.status === 'PENDING_AUTHORIZER' ? (
                                        <Clock className="h-6 w-6" />
                                    ) : transfer.status === 'REJECTED' && transfer.checkedById ? (
                                        <XCircle className="h-6 w-6" />
                                    ) : (
                                        <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                    )}
                                </div>
                                <div className="flex flex-col md:items-center">
                                    <span className="font-semibold text-slate-100 text-sm">3. Authorized (Authorizer)</span>
                                    {transfer.authorizedById ? (
                                        <>
                                            <span className="text-xs text-slate-400 mt-0.5">{transfer.authorizerName}</span>
                                            <span className="text-[10px] text-slate-500 mt-0.5">{transfer.authorizedAt ? format(new Date(transfer.authorizedAt), 'dd MMM yyyy') : ''}</span>
                                        </>
                                    ) : transfer.status === 'PENDING_AUTHORIZER' ? (
                                        <span className="text-xs text-blue-400 font-medium animate-pulse mt-0.5">Awaiting Authorization</span>
                                    ) : transfer.status === 'REJECTED' && transfer.checkedById ? (
                                        <span className="text-xs text-rose-400 font-medium mt-0.5">Rejected</span>
                                    ) : (
                                        <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Approval Actions Panel */}
                {((transfer.status === 'PENDING_CHECKER' && canCheck) || 
                  (transfer.status === 'PENDING_AUTHORIZER' && canAuthorize)) && (
                    <Card className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/40 dark:to-slate-900/20 border-blue-200/60 dark:border-slate-800 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-blue-900 dark:text-blue-400 flex items-center gap-2 text-lg">
                                <ThumbsUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                Pending Approval Action Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-blue-700 dark:text-slate-300">
                                This Stock Transfer request is currently in <strong>{transfer.status === 'PENDING_CHECKER' ? 'Pending Checker Verification' : 'Pending Authorizer Release'}</strong>. 
                                As an authorized user, you can either approve/verify this transfer to forward it to the next step, or reject it.
                            </p>
                            <div className="flex gap-4">
                                <Button 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md hover:shadow-lg transition-all border-none"
                                    onClick={() => handleAction(transfer.status === 'PENDING_CHECKER' ? 'PENDING_AUTHORIZER' : 'APPROVED')}
                                    disabled={submitting}
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    {transfer.status === 'PENDING_CHECKER' ? 'Verify & Forward' : 'Authorize & Release Transfer'}
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-md hover:shadow-lg transition-all border-none"
                                    onClick={() => handleAction('REJECTED')}
                                    disabled={submitting}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Reject Stock Transfer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Printable Area - Centered A4 sizing approx */}
            <div className="bg-white p-8 md:p-12 max-w-4xl mx-auto shadow-md print:shadow-none print:max-w-none print:p-0 print:m-0">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-900">
                            {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Return Challan' : 'Delivery Challan'}
                        </h1>
                        <p className="text-gray-500 font-medium tracking-widest mt-1 text-sm">
                            {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'INTERNAL STOCK RETURN' : 'INTERNAL STOCK TRANSFER'}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-lg">Speed Limit (ERP)</div>
                        <p className="text-sm text-gray-600">Company Standard Template</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Dispatch Details</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <span className="text-gray-500">Challan No:</span>
                                <span className="col-span-2 font-bold font-mono text-base">{transfer.requestNo}</span>

                                <span className="text-gray-500">Date:</span>
                                <span className="col-span-2 font-medium">{format(new Date(transfer.createdAt), 'dd MMM, yyyy')}</span>

                                <span className="text-gray-500">Status:</span>
                                <span className="col-span-2 font-bold uppercase">{transfer.status}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? (
                                // Return Transfer: Outlet → Warehouse
                                <>
                                    <div className="border border-orange-200 p-3 rounded-md bg-orange-50/30">
                                        <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">From (Origin)</h3>
                                        <p className="font-bold text-orange-900">{transfer.fromLocation?.name || 'Outlet Location'}</p>
                                        <p className="text-xs text-orange-700 font-mono mt-1">{transfer.fromLocation?.code}</p>
                                    </div>
                                    <div className="border border-gray-200 p-3 rounded-md">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">To (Destination)</h3>
                                        <p className="font-bold text-gray-900">{transfer.fromWarehouse?.name || 'Main Warehouse'}</p>
                                    </div>
                                </>
                            ) : (
                                // Normal Transfer: Warehouse → Outlet
                                <>
                                    <div className="border border-gray-200 p-3 rounded-md">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">From (Origin)</h3>
                                        <p className="font-bold text-gray-900">{transfer.fromWarehouse?.name || 'Main Warehouse'}</p>
                                    </div>
                                    <div className="border border-gray-200 p-3 rounded-md bg-blue-50/30">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">To (Destination)</h3>
                                        <p className="font-bold text-blue-900">{transfer.toLocation?.name || 'Shop Location'}</p>
                                        <p className="text-xs text-blue-700 font-mono mt-1">{transfer.toLocation?.code}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-12">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-800 text-gray-800">
                                <th className="py-3 px-2 font-bold text-sm w-12 text-center">#</th>
                                <th className="py-3 px-2 font-bold text-sm">Item Code (SKU)</th>
                                <th className="py-3 px-2 font-bold text-sm">Description</th>
                                <th className="py-3 px-2 font-bold text-sm text-right">
                                    {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Quantity Returned' : 'Quantity Transferred'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfer.items?.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b border-gray-200">
                                    <td className="py-4 px-2 text-center text-gray-500 text-sm">{index + 1}</td>
                                    <td className="py-4 px-2 font-mono text-sm font-semibold">{item.item?.sku}</td>
                                    <td className="py-4 px-2 text-sm">{item.item?.name || item.item?.description || 'N/A'}</td>
                                    <td className="py-4 px-2 text-right font-bold text-lg bg-gray-50/50">
                                        {item.quantity}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-800">
                                <td colSpan={3} className="py-4 px-2 text-right font-bold text-gray-800">
                                    {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Total Quantities Returned:' : 'Total Quantities Dispatched:'}
                                </td>
                                <td className="py-4 px-2 text-right font-black text-2xl">
                                    {transfer.items?.reduce((sum: number, item: any) => sum + Number(item.quantity), 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Signatures Section */}
                <div className="grid grid-cols-3 gap-8 mt-24 pt-8 border-t border-dashed border-gray-300">
                    {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? (
                        // Return Transfer Signatures
                        <>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Prepared By (Shop Manager)</p>
                                <p className="text-xs text-gray-400 mt-1">Sign & Stamp</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Delivered By (Driver)</p>
                                <p className="text-xs text-gray-400 mt-1">Vehicle No. & Sign</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Received By (Warehouse)</p>
                                <p className="text-xs text-gray-400 mt-1">Clear Name & Sign</p>
                            </div>
                        </>
                    ) : (
                        // Normal Transfer Signatures
                        <>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Prepared By (Warehouse)</p>
                                <p className="text-xs text-gray-400 mt-1">Sign & Stamp</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Delivered By (Driver)</p>
                                <p className="text-xs text-gray-400 mt-1">Vehicle No. & Sign</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Received By (Shop Manager)</p>
                                <p className="text-xs text-gray-400 mt-1">Clear Name & Sign</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Note */}
                <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4">
                    <p>This is a computer-generated document. Ensure strict physical verification against quantities mentioned before signing.</p>
                </div>

            </div>
            </div>
        </PermissionGuard>
    );
}
