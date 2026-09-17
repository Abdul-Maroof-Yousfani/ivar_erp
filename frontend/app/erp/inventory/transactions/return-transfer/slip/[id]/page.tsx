'use client';

import { use, useEffect, useState } from 'react';
import { getTransferRequests } from '@/lib/actions/transfer-request';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { COMPANY_NAME } from '@/lib/utils';

export default function ReturnTransferSlipPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [transfer, setTransfer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadDetails = async () => {
        try {
            setLoading(true);
            const res = await getTransferRequests({ id });
            const record = Array.isArray(res.data) ? res.data.find((t: any) => t.id === id) : null;
            if (record) {
                setTransfer(record);
            } else {
                setNotFound(true);
            }
        } catch (err) {
            console.error('Failed to load return transfer details', err);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    const printSlip = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RotateCcw className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Loading Return Challan...</p>
                </div>
            </div>
        );
    }

    if (notFound || !transfer) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-sm">
                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <XCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Return Request Not Found</h2>
                    <p className="text-gray-500 text-sm mb-6">
                        The return transfer request could not be found or you may not have permission to view it.
                    </p>
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const statusConfig: Record<string, { label: string; color: string; Icon: any }> = {
        PENDING_CHECKER: { label: 'Pending Checker', color: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock },
        PENDING_AUTHORIZER: { label: 'Pending Authorizer', color: 'bg-blue-100 text-blue-700 border-blue-200', Icon: Clock },
        APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
        REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', Icon: XCircle },
    };
    const statusInfo = statusConfig[transfer.status] ?? {
        label: transfer.status,
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        Icon: AlertTriangle,
    };
    const { Icon: StatusIcon } = statusInfo;

    const totalQty = transfer.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) ?? 0;

    return (
        <>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore */}
            <style jsx global>{`
                @media print {
                    body { visibility: hidden !important; background: white !important; }
                    #print-section {
                        visibility: visible !important;
                        position: absolute !important;
                        top: 0 !important; left: 0 !important;
                        width: 100% !important; height: auto !important;
                        margin: 0 !important;
                        padding: 10mm 12mm !important;
                        background: white !important;
                        color: black !important;
                        z-index: 99999 !important;
                    }
                    #print-section * { visibility: visible !important; }
                    @page { margin: 0; size: auto; }
                    header, nav, footer, aside, .banner, .print\\:hidden { display: none !important; }
                }
            `}</style>

            <div className="min-h-screen bg-gray-100 print:bg-white text-black py-6">

                {/* Action Bar (no-print) */}
                <div className="print:hidden bg-white border-b p-4 flex justify-between items-center shadow-sm max-w-4xl mx-auto rounded-t-md mb-6">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div className="flex items-center gap-3">
                        <Badge className={`${statusInfo.color} border font-semibold px-3 py-1 flex items-center gap-1.5`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusInfo.label}
                        </Badge>
                        <Button onClick={printSlip} className="bg-orange-600 hover:bg-orange-700 text-white">
                            <Printer className="h-4 w-4 mr-2" />
                            Print Return Challan
                        </Button>
                    </div>
                </div>

                {/* Approval Stepper (no-print) */}
                <div className="print:hidden max-w-4xl mx-auto mb-6">
                    <Card className="bg-gradient-to-r from-slate-900/90 to-slate-950/95 text-white border-slate-800 shadow-xl overflow-hidden relative">
                        <CardHeader className="relative pb-2">
                            <CardTitle className="text-lg font-medium text-slate-300">Return Request Workflow</CardTitle>
                        </CardHeader>
                        <CardContent className="relative py-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                                <div className="hidden md:block absolute left-[16.6%] right-[16.6%] top-[24px] h-0.5 bg-slate-800 z-0" />

                                {/* Step 1 */}
                                <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                    <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 bg-emerald-500 border-emerald-400 text-white shadow-lg md:mx-auto">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col md:items-center">
                                        <span className="font-semibold text-slate-100 text-sm">1. Requested</span>
                                        <span className="text-xs text-slate-400 mt-0.5">{transfer.creatorName ?? 'POS Operator'}</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5">{format(new Date(transfer.createdAt), 'dd MMM yyyy')}</span>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all ${
                                        transfer.status === 'PENDING_CHECKER'
                                            ? 'bg-amber-500 border-amber-400 text-white animate-pulse'
                                            : transfer.checkedById
                                            ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : 'bg-slate-900 border-slate-700 text-slate-500'
                                    }`}>
                                        {transfer.checkedById ? (
                                            <CheckCircle2 className="h-6 w-6" />
                                        ) : transfer.status === 'PENDING_CHECKER' ? (
                                            <Clock className="h-6 w-6" />
                                        ) : (
                                            <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                        )}
                                    </div>
                                    <div className="flex flex-col md:items-center">
                                        <span className="font-semibold text-slate-100 text-sm">2. Checked</span>
                                        {transfer.checkedById ? (
                                            <span className="text-xs text-slate-400 mt-0.5">{transfer.checkerName}</span>
                                        ) : transfer.status === 'PENDING_CHECKER' ? (
                                            <span className="text-xs text-amber-400 font-medium animate-pulse mt-0.5">Awaiting Verification</span>
                                        ) : (
                                            <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all ${
                                        transfer.status === 'APPROVED'
                                            ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : transfer.status === 'PENDING_AUTHORIZER'
                                            ? 'bg-blue-500 border-blue-400 text-white animate-pulse'
                                            : 'bg-slate-900 border-slate-700 text-slate-500'
                                    }`}>
                                        {transfer.status === 'APPROVED' ? (
                                            <CheckCircle2 className="h-6 w-6" />
                                        ) : transfer.status === 'PENDING_AUTHORIZER' ? (
                                            <Clock className="h-6 w-6" />
                                        ) : (
                                            <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                                        )}
                                    </div>
                                    <div className="flex flex-col md:items-center">
                                        <span className="font-semibold text-slate-100 text-sm">3. Approved</span>
                                        {transfer.status === 'APPROVED' ? (
                                            <span className="text-xs text-emerald-400 font-medium mt-0.5">Return Completed</span>
                                        ) : transfer.status === 'PENDING_AUTHORIZER' ? (
                                            <span className="text-xs text-blue-400 font-medium animate-pulse mt-0.5">Awaiting Approval</span>
                                        ) : (
                                            <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Printable Challan */}
                <div id="print-section" className="bg-white p-8 md:p-12 max-w-4xl mx-auto shadow-md print:shadow-none print:max-w-none print:p-0 print:m-0">

                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-900">Return Challan</h1>
                            <p className="text-gray-500 font-medium tracking-widest mt-1 text-sm">INTERNAL STOCK RETURN — POS TO WAREHOUSE</p>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-lg">{COMPANY_NAME}</div>
                            <p className="text-sm text-gray-600">Return Transfer Document</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                        <div>
                            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Return Details</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="text-gray-500">Challan No:</span>
                                    <span className="col-span-2 font-bold font-mono text-base">{transfer.requestNo}</span>

                                    <span className="text-gray-500">Date:</span>
                                    <span className="col-span-2 font-medium">{format(new Date(transfer.createdAt), 'dd MMM, yyyy')}</span>

                                    <span className="text-gray-500">Status:</span>
                                    <span className="col-span-2 font-bold uppercase">{transfer.status?.replace(/_/g, ' ')}</span>

                                    {transfer.notes && (
                                        <>
                                            <span className="text-gray-500">Reason:</span>
                                            <span className="col-span-2 text-gray-700">{transfer.notes}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="border border-orange-200 p-3 rounded-md bg-orange-50/30">
                                <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">From (Outlet / Origin)</h3>
                                <p className="font-bold text-orange-900">{transfer.fromLocation?.name ?? 'POS Outlet'}</p>
                                {transfer.fromLocation?.code && (
                                    <p className="text-xs text-orange-700 font-mono mt-1">{transfer.fromLocation.code}</p>
                                )}
                            </div>
                            <div className="border border-gray-200 p-3 rounded-md">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">To (Destination Warehouse)</h3>
                                <p className="font-bold text-gray-900">{transfer.toWarehouse?.name ?? 'Main Warehouse'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-12">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-800 text-gray-800">
                                    <th className="py-3 px-2 font-bold text-sm w-10 text-center">#</th>
                                    <th className="py-3 px-2 font-bold text-sm">SKU</th>
                                    <th className="py-3 px-2 font-bold text-sm">Description</th>
                                    <th className="py-3 px-2 font-bold text-sm">Color</th>
                                    <th className="py-3 px-2 font-bold text-sm">Size</th>
                                    <th className="py-3 px-2 font-bold text-sm text-right">Return Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfer.items?.map((item: any, index: number) => {
                                    const sizeStr = item.item?.size?.name ?? item.size?.name ?? item.sizeName ?? null;
                                    const colorStr = item.item?.color?.name ?? item.color?.name ?? item.colorName ?? null;

                                    return (
                                        <tr key={item.id} className="border-b border-gray-200">
                                            <td className="py-4 px-2 text-center text-gray-500 text-sm">{index + 1}</td>
                                            <td className="py-4 px-2 font-mono text-sm font-semibold">{item.item?.sku ?? 'N/A'}</td>
                                            <td className="py-4 px-2 text-sm">
                                                <div className="font-medium text-gray-900">{item.item?.description ?? item.item?.name ?? 'N/A'}</div>
                                                {item.item?.barCode && (
                                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.item.barCode}</div>
                                                )}
                                            </td>
                                            <td className="py-4 px-2 text-sm">
                                                {colorStr ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                                                        {colorStr}
                                                    </span>
                                                ) : <span className="text-gray-400 text-xs">—</span>}
                                            </td>
                                            <td className="py-4 px-2 text-sm">
                                                {sizeStr ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                                                        {sizeStr}
                                                    </span>
                                                ) : <span className="text-gray-400 text-xs">—</span>}
                                            </td>
                                            <td className="py-4 px-2 text-right font-bold text-base bg-orange-50/40">
                                                {Number(item.quantity ?? 0)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-800">
                                    <td colSpan={5} className="py-4 px-2 text-right font-bold text-gray-800">
                                        Total Return Quantity:
                                    </td>
                                    <td className="py-4 px-2 text-right font-black text-xl text-orange-700">
                                        {totalQty}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Signature Section */}
                    <div className="grid grid-cols-3 gap-8 mt-24 pt-8 border-t border-dashed border-gray-300">
                        <div className="text-center">
                            <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                            <p className="text-xs font-bold text-gray-600 uppercase">Prepared By (Shop Manager)</p>
                            <p className="text-xs text-gray-400 mt-1">Sign &amp; Stamp</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                            <p className="text-xs font-bold text-gray-600 uppercase">Delivered By (Driver)</p>
                            <p className="text-xs text-gray-400 mt-1">Vehicle No. &amp; Sign</p>
                        </div>
                        <div className="text-center">
                            <div className="border-b border-gray-400 w-3/4 mx-auto mb-2"></div>
                            <p className="text-xs font-bold text-gray-600 uppercase">Received By (Warehouse)</p>
                            <p className="text-xs text-gray-400 mt-1">Clear Name &amp; Sign</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4">
                        <p>This is a computer-generated document. Please verify quantities physically before signing.</p>
                    </div>

                </div>
            </div>
        </>
    );
}
