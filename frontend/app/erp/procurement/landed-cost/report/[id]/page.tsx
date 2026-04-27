'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLandedCost } from '@/lib/actions/landed-cost';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LandedCostReportPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const id = params.id as string;

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            const res = await getLandedCost(id);
            setData(res);
        } catch (err: any) {
            toast.error(err.message || 'Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-red-500">
                Record not found or failed to load.
            </div>
        );
    }

    return (
        <div className="p-2 space-y-4 printable-report max-w-[100vw] overflow-x-hidden">
            <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .printable-report { margin: 0; padding: 10px; width: 100%; max-width: none; font-size: 8px; }
          body { background: white !important; }
          .card { border: none !important; box-shadow: none !important; margin-bottom: 5px; }
          .table-header { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; }
          .bg-orange-50 { background-color: #fff7ed !important; -webkit-print-color-adjust: exact; }
          .bg-purple-50 { background-color: #faf5ff !important; -webkit-print-color-adjust: exact; }
          .bg-green-100 { background-color: #dcfce7 !important; -webkit-print-color-adjust: exact; }
          th, td { padding: 4px 2px !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

            {/* Action Bar */}
            <div className="flex justify-between items-center no-print px-4">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/erp/procurement/landed-cost/report')}>
                        Report List
                    </Button>
                    <Button size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print Report
                    </Button>
                </div>
            </div>

            {/* Header Info */}
            <Card className="card shadow-sm border-gray-200">
                <CardHeader className="bg-gray-50 py-3 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-xl font-bold text-gray-800">Landed Cost Detailed Report</CardTitle>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-blue-700">{data.landedCostNumber}</p>
                            <p className="text-[10px] text-gray-500">{data.date ? format(new Date(data.date), 'dd MMM yyyy HH:mm') : '-'}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
                    <div className="space-y-1 bg-gray-50 p-2 rounded border">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Shipment</p>
                        <p><strong>LC No:</strong> {data.lcNo || '-'}</p>
                        <p><strong>B/L No:</strong> {data.blNo || '-'}</p>
                        <p><strong>B/L Date:</strong> {data.blDate ? format(new Date(data.blDate), 'dd-MM-yyyy') : '-'}</p>
                    </div>
                    <div className="space-y-1 bg-gray-50 p-2 rounded border">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Customs</p>
                        <p><strong>GD No:</strong> {data.gdNo || '-'}</p>
                        <p><strong>Origin:</strong> {data.countryOfOrigin || '-'}</p>
                        <p><strong>Season/Cat:</strong> {data.season || '-'} / {data.category || '-'}</p>
                    </div>
                    <div className="space-y-1 bg-gray-50 p-2 rounded border">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Reference</p>
                        <p><strong>GRN:</strong> {data.grn?.grnNumber}</p>
                        <p><strong>Supplier:</strong> {data.supplier?.name}</p>
                        <p><strong>Currency:</strong> {data.currency} (@{Number(data.exchangeRate).toFixed(2)})</p>
                    </div>
                    <div className="space-y-1 bg-blue-50 p-2 rounded border border-blue-100">
                        <p className="text-[9px] text-blue-400 uppercase font-black tracking-tighter">Summary</p>
                        <p><strong>Total Items:</strong> {data.items.length}</p>
                        <p><strong>Total Qty:</strong> {Number(data.totalQuantity).toLocaleString()}</p>
                        <p className="text-blue-700 font-bold"><strong>Total Cost:</strong> {Number(data.totalLandedCost).toLocaleString()} PKR</p>
                    </div>
                </CardContent>
            </Card>

            {/* Comprehensive Table */}
            <Card className="card shadow-md border-gray-200">
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="text-[9px] whitespace-nowrap">
                        <TableHeader className="table-header">
                            {/* Group Headers */}
                            <TableRow className="bg-gray-200 divide-x divide-gray-300">
                                <TableHead colSpan={12} className="text-center font-bold text-black border-r border-gray-300">SHIPMENT & ITEM DETAILS</TableHead>
                                <TableHead colSpan={10} className="text-center font-bold bg-blue-50 text-blue-900 border-r border-gray-300">ASSESSABLE VALUE</TableHead>
                                <TableHead colSpan={9} className="text-center font-bold bg-orange-50 text-orange-950 border-r border-gray-300">DUTY CALCULATION</TableHead>
                                <TableHead colSpan={1} className="text-center font-bold bg-purple-50 text-purple-950 border-r border-gray-300">FREIGHT (MIS)</TableHead>
                                <TableHead colSpan={12} className="text-center font-bold bg-green-100 text-green-950 border-r border-gray-300">MIS BREAKDOWN (SHARES)</TableHead>
                                <TableHead colSpan={3} className="text-center font-bold bg-gray-300 text-black">TOTALS</TableHead>
                            </TableRow>
                            {/* Detailed Headers */}
                            <TableRow className="bg-gray-100 divide-x divide-gray-200">
                                {/* Shipment */}
                                <TableHead className="px-1 text-center">LC#</TableHead>
                                <TableHead className="px-1 text-center">BL#</TableHead>
                                <TableHead className="px-1 text-center">BL Date</TableHead>
                                <TableHead className="px-1 text-center">GD#</TableHead>
                                <TableHead className="px-1 text-center">Origin</TableHead>
                                <TableHead className="px-1 text-center">Season</TableHead>
                                <TableHead className="px-1 text-center">Cat</TableHead>
                                <TableHead className="px-1 text-center">S.Inv</TableHead>
                                <TableHead className="px-1 text-center">Date</TableHead>
                                <TableHead className="px-1 text-center font-bold">SKU</TableHead>
                                <TableHead className="px-1 text-center">Description</TableHead>
                                <TableHead className="px-1 text-center border-r-2 border-gray-400">HS Code</TableHead>

                                {/* AV */}
                                <TableHead className="px-1 text-center bg-blue-50">Qty</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">FOB$</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">Inv$</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">Frg$</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">Rate</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">InvPKR</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">Ins</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50">Land</TableHead>
                                <TableHead className="px-1 text-center bg-blue-50 font-bold border-r-2 border-blue-300">AV (PKR)</TableHead>

                                {/* Duties */}
                                <TableHead className="px-1 text-center bg-orange-50">CD</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">RD</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">ACD</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">vST</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">ST</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">AST</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">vIT</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50">IT</TableHead>
                                <TableHead className="px-1 text-center bg-orange-50 font-bold border-r-2 border-orange-300">Total Duty</TableHead>

                                {/* Freight (MIS) */}
                                <TableHead className="px-1 text-center bg-purple-50 border-r-2 border-purple-300">Freight (MIS)</TableHead>

                                {/* MIS */}
                                <TableHead className="px-1 text-center bg-green-50">Frg$</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">FrgPKR</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Inv#</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Date</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">DO/THC</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">PO#</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Date</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Bank</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Ins</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Pol#</TableHead>
                                <TableHead className="px-1 text-center bg-green-50">Clg/Fwd</TableHead>
                                <TableHead className="px-1 text-center bg-green-50 border-r-2 border-green-300">Bill#</TableHead>

                                <TableHead className="px-1 text-center bg-gray-50">Total Other Charges</TableHead>
                                <TableHead className="px-1 text-center bg-gray-50">UnitCost</TableHead>
                                <TableHead className="px-1 text-center bg-blue-700 text-white font-bold">Final Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y">
                            {data.items.map((item: any, idx: number) => (
                                <TableRow key={idx} className="divide-x divide-gray-100 hover:bg-gray-50">
                                    {/* Shipment & Item */}
                                    <TableCell className="px-1">{data.lcNo}</TableCell>
                                    <TableCell className="px-1">{data.blNo}</TableCell>
                                    <TableCell className="px-1">{data.blDate ? format(new Date(data.blDate), 'dd-MM-yy') : '-'}</TableCell>
                                    <TableCell className="px-1">{data.gdNo}</TableCell>
                                    <TableCell className="px-1">{data.countryOfOrigin}</TableCell>
                                    <TableCell className="px-1">{data.season}</TableCell>
                                    <TableCell className="px-1">{data.category}</TableCell>
                                    <TableCell className="px-1">{data.shippingInvoiceNo}</TableCell>
                                    <TableCell className="px-1">{data.shippingInvoiceDate ? format(new Date(data.shippingInvoiceDate), 'dd-yy') : '-'}</TableCell>
                                    <TableCell className="px-1 font-bold">{item.sku}</TableCell>
                                    <TableCell className="px-1 max-w-[100px] truncate" title={item.description}>{item.description}</TableCell>
                                    <TableCell className="px-1 border-r-2 border-gray-400">{item.hsCode}</TableCell>

                                    {/* AV */}
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.qty).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.unitFob).toFixed(2)}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.invoiceForeign).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.freightForeign).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.exchangeRate).toFixed(2)}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.invoicePKR).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.insuranceCharges).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50/30">{Number(item.landingCharges).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-blue-50 font-bold border-r-2 border-blue-300">{Number(item.assessableValue).toLocaleString()}</TableCell>

                                    {/* Duties */}
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.customsDutyAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.regulatoryDutyAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.additionalCustomsDutyAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{(Number(item.assessableValue) + Number(item.customsDutyAmount) + Number(item.regulatoryDutyAmount) + Number(item.additionalCustomsDutyAmount)).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.salesTaxAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.additionalSalesTaxAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{(Number(item.assessableValue) + Number(item.customsDutyAmount) + Number(item.regulatoryDutyAmount) + Number(item.additionalCustomsDutyAmount) + Number(item.salesTaxAmount) + Number(item.additionalSalesTaxAmount)).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50/30">{Number(item.incomeTaxAmount).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right bg-orange-50 font-bold border-r-2 border-orange-300">
                                        {(Number(item.customsDutyAmount) + Number(item.regulatoryDutyAmount) + Number(item.additionalCustomsDutyAmount) + Number(item.salesTaxAmount) + Number(item.additionalSalesTaxAmount) + Number(item.incomeTaxAmount)).toLocaleString()}
                                    </TableCell>

                                    {/* Freight (MIS) */}
                                    <TableCell className="px-1 text-right bg-purple-50 font-bold border-r-2 border-purple-300">{Number(item.misFreightPKR || 0).toLocaleString()}</TableCell>

                                    {/* MIS shares */}
                                    <TableCell className="px-1 text-right">{Number(item.misFreightUSD || 0).toFixed(2)}</TableCell>
                                    <TableCell className="px-1 text-right">{Number(item.misFreightPKR || 0).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-center">{item.misFreightInvNo || '-'}</TableCell>
                                    <TableCell className="px-1 text-center">{item.misFreightDate || '-'}</TableCell>
                                    <TableCell className="px-1 text-right">{Number(item.misDoThcPKR || 0).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-center">{item.misDoThcPoNo || '-'}</TableCell>
                                    <TableCell className="px-1 text-center">{item.misDoThcDate || '-'}</TableCell>
                                    <TableCell className="px-1 text-right">{Number(item.misBankPKR || 0).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right">{Number(item.misInsurancePKR || 0).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-center">{item.misInsurancePolicyNo || '-'}</TableCell>
                                    <TableCell className="px-1 text-right">{Number(item.misClgFwdPKR || 0).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-center border-r-2 border-green-300">{item.misClgFwdBillNo || '-'}</TableCell>

                                    {/* Totals */}
                                    <TableCell className="px-1 text-right font-bold bg-yellow-50 text-orange-800">
                                        {(Number(item.misFreightPKR || 0) + Number(item.misDoThcPKR || 0) + Number(item.misBankPKR || 0) + Number(item.misInsurancePKR || 0) + Number(item.misClgFwdPKR || 0)).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="px-1 text-right font-bold bg-gray-50 text-blue-800">{Number(item.unitCostPKR).toLocaleString()}</TableCell>
                                    <TableCell className="px-1 text-right font-black bg-blue-700 text-white text-[10px]">{Number(item.totalCostPKR).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Signature Section */}
            <div className="mt-8 grid grid-cols-3 gap-8 text-center pt-8 text-[11px]">
                <div className="border-t-2 border-black pt-2 uppercase font-bold">Prepared By</div>
                <div className="border-t-2 border-black pt-2 uppercase font-bold">Internal Audit</div>
                <div className="border-t-2 border-black pt-2 uppercase font-bold">Management Approval</div>
            </div>
        </div>
    );
}
