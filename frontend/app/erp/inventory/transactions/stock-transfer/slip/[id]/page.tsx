'use client';

import { use, useEffect, useState } from 'react';
import { getTransferRequests } from '@/lib/actions/transfer-request';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function TransferSlipPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [transfer, setTransfer] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTransferDetails();
    }, [id]);

    const loadTransferDetails = async () => {
        try {
            // Re-using getAll by filtering locally if getById doesn't exist yet
            // Ideally backend should have a getById for transfer request
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
            <div className="min-h-screen bg-gray-100 print:bg-white text-black">
            {/* Non-Printable Action Bar */}
            <div className="print:hidden bg-white border-b p-4 flex justify-between items-center shadow-sm max-w-4xl mx-auto mt-4 rounded-t-md">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button onClick={printSlip}>
                    <Printer className="h-4 w-4 mr-2" /> 
                    {transfer?.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Print Return Challan' : 'Print Delivery Challan'}
                </Button>
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
