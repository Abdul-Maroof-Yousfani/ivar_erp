'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Check, X, Printer, Building2 } from 'lucide-react';
import Link from 'next/link';
import { purchaseReturnApi, PurchaseReturn } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PermissionGuard } from "@/components/auth/permission-guard";

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

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const returnTypeLabels = {
  DEFECTIVE: 'Defective',
  EXCESS: 'Excess',
  WRONG_ITEM: 'Wrong Item',
  DAMAGED: 'Damaged',
};

export default function PurchaseReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadPurchaseReturn(params.id as string);
    }
  }, [params.id]);

  const loadPurchaseReturn = async (id: string) => {
    try {
      setLoading(true);
      const data = await purchaseReturnApi.getById(id);
      setPurchaseReturn(data);
    } catch (error) {
      console.error('Error loading purchase return:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!purchaseReturn) return;

    try {
      await purchaseReturnApi.updateStatus(purchaseReturn.id, status, 'current-user-id'); // Replace with actual user ID
      loadPurchaseReturn(purchaseReturn.id);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSubmit = async () => {
    if (!purchaseReturn) return;
    
    if (confirm('Submit this return for approval?')) {
      await handleStatusUpdate('SUBMITTED');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading purchase return...</div>;
  }

  if (!purchaseReturn) {
    return <div className="p-6 text-center text-red-500">Purchase return not found</div>;
  }

  return (
    <PermissionGuard permissions="erp.procurement.pret.read">
      <>
        <style jsx global>{`
            @media print {
                body {
                    visibility: hidden;
                }
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
                #print-section * {
                    visibility: visible;
                }
                @page {
                    margin: 0;
                    size: auto;
                }
                header, nav, footer, aside, .banner {
                    display: none !important;
                }
            }
        `}</style>
        <div className="p-6 space-y-6 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">Purchase Return {purchaseReturn.returnNumber}</h1>
                <p className="text-gray-600">Return details and status</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {purchaseReturn.status === 'DRAFT' && (
                <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                  <>
                    <Link href={`/erp/procurement/purchase-returns/${purchaseReturn.id}/edit`} transitionTypes={["nav-forward"]}>
                      <Button variant="outline">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button onClick={handleSubmit}>
                      Submit for Approval
                    </Button>
                  </>
                </PermissionGuard>
              )}
              {purchaseReturn.status === 'SUBMITTED' && (
                <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="text-green-600"
                      onClick={() => handleStatusUpdate('APPROVED')}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="text-red-600"
                      onClick={() => handleStatusUpdate('REJECTED')}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </PermissionGuard>
              )}
              <Button onClick={() => window.print()} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" /> Print Return
              </Button>
            </div>
          </div>

        {/* Return Header */}
        <Card>
          <CardHeader>
            <CardTitle>Return Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-gray-700">Return Details</h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Return Number:</span>
                    <div className="font-medium">{purchaseReturn.returnNumber}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Source Type:</span>
                    <div>
                      <Badge variant="outline">
                        {purchaseReturn.sourceType === 'GRN' ? 'GRN' : 'Landed Cost'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Return Type:</span>
                    <div className="font-medium">{returnTypeLabels[purchaseReturn.returnType]}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Status:</span>
                    <div>
                      <Badge className={statusColors[purchaseReturn.status]}>
                        {purchaseReturn.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700">Supplier & Warehouse</h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Supplier:</span>
                    <div className="font-medium">{purchaseReturn.supplier?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Warehouse:</span>
                    <div className="font-medium">{purchaseReturn.warehouse?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Return Date:</span>
                    <div className="font-medium">{formatDate(purchaseReturn.returnDate)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700">Financial Summary</h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Subtotal:</span>
                    <div className="font-medium">{formatCurrency(purchaseReturn.subtotal)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Tax Amount:</span>
                    <div className="font-medium">{formatCurrency(purchaseReturn.taxAmount)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Total Amount:</span>
                    <div className="font-bold text-lg">{formatCurrency(purchaseReturn.totalAmount)}</div>
                  </div>
                </div>
              </div>
            </div>

            {purchaseReturn.reason && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-700">Return Reason</h3>
                <p className="mt-2 text-gray-600">{purchaseReturn.reason}</p>
              </div>
            )}

            {purchaseReturn.notes && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-700">Notes</h3>
                <p className="mt-2 text-gray-600">{purchaseReturn.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Return Items */}
        <Card>
          <CardHeader>
            <CardTitle>Return Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Return Qty</th>
                    <th className="text-left p-3">Unit Price</th>
                    <th className="text-left p-3">Line Total</th>
                    <th className="text-left p-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseReturn.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-gray-500">{item.item?.itemId || item.itemId}</div>
                        </div>
                      </td>
                      <td className="p-3">{item.returnQty}</td>
                      <td className="p-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3">{formatCurrency(item.lineTotal)}</td>
                      <td className="p-3">{item.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Source Document Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Source Document</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseReturn.sourceType === 'GRN' && purchaseReturn.grn && (
              <div>
                <h3 className="font-semibold">GRN Reference</h3>
                <p className="text-gray-600">GRN Number: {purchaseReturn.grn.grnNumber}</p>
                <p className="text-gray-600">PO Number: {purchaseReturn.grn.purchaseOrder?.poNumber}</p>
              </div>
            )}
            {purchaseReturn.sourceType === 'LANDED_COST' && purchaseReturn.landedCost && (
              <div>
                <h3 className="font-semibold">Landed Cost Reference</h3>
                <p className="text-gray-600">LC Number: {purchaseReturn.landedCost.landedCostNumber}</p>
                <p className="text-gray-600">PO Number: {purchaseReturn.landedCost.purchaseOrder?.poNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Information */}
        {purchaseReturn.status === 'APPROVED' && purchaseReturn.approvedBy && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Approval & Financial Impact</CardTitle>
              {purchaseReturn.debitNote && (
                <Link href={`/erp/procurement/debit-notes/${purchaseReturn.debitNote.id}`} transitionTypes={["nav-forward"]}>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                    View Debit Note
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Approved By:</span>
                  <div className="font-medium">{purchaseReturn.approvedBy}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Approved At:</span>
                  <div className="font-medium">{formatDate(purchaseReturn.approvedAt!)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print View */}
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
                      Purchase Return
                    </div>
                  </div>

                  {/* Details Box */}
                  <div className="w-[45%] bg-[#f8fafc] text-xs sm:text-[13px] p-2 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
                     <div className="flex justify-between mb-2">
                       <span className="font-bold">Return Number:</span>
                       <span className="font-bold">{purchaseReturn.returnNumber}</span>
                     </div>
                     <div className="flex justify-between">
                       <div className="flex gap-2">
                         <span className="font-bold">Date:</span>
                         <span>{formatDate(purchaseReturn.returnDate)}</span>
                       </div>
                     </div>
                  </div>
              </div>

              {/* Vendor / Ship To Box */}
              <div className="flex gap-4 mb-4 text-xs sm:text-[13px]">
                  <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                      <div className="font-bold border-b border-gray-300 mb-2 pb-1">Supplier Details</div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>{purchaseReturn.supplier?.name || 'N/A'}</span></div>
                  </div>
                  <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                      <div className="font-bold border-b border-gray-300 mb-2 pb-1">Warehouse</div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>{purchaseReturn.warehouse?.name || 'N/A'}</span></div>
                  </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs sm:text-[13px] mb-4 border-collapse table-fixed">
                  <thead>
                    <tr className="border-y-2 border-black">
                      <th className="py-2 pr-2 text-left font-bold w-[40%]">Item Details</th>
                      <th className="py-2 pr-2 text-right font-bold w-[15%]">Qty</th>
                      <th className="py-2 pr-2 text-right font-bold w-[15%]">Unit Price</th>
                      <th className="py-2 text-right font-bold w-[30%]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseReturn.items && purchaseReturn.items.length > 0 ? (
                      purchaseReturn.items.map((item, i) => (
                        <tr key={item.id || i} className="border-b border-gray-300 align-top">
                          <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                            <div className="font-medium">{item.item?.itemId || item.itemId}</div>
                            <div className="text-gray-700">{item.description || '-'}</div>
                            <div className="text-gray-500 text-[11px] mt-1 italic">Reason: {item.reason || '-'}</div>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {item.returnQty}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {fmt(Number(item.unitPrice))}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmt(Number(item.lineTotal))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground border-b border-gray-300">
                              No items found for this return
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
                          <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(Number(purchaseReturn.totalAmount || 0))}</span>
                      </div>
                  </div>
                  <div className="w-[25%] pr-2 text-right">
                      <div className="text-xs sm:text-[13px] text-gray-700">Subtotal:</div>
                      <div className="text-xs sm:text-[13px] text-gray-700">Tax:</div>
                      <div className="font-bold text-xs sm:text-[13px] mt-1">Total:</div>
                  </div>
                  <div className="w-[20%] text-right">
                      <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(purchaseReturn.subtotal || 0))}</div>
                      <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(purchaseReturn.taxAmount || 0))}</div>
                      <div className="ml-auto border-t border-black pb-0.5 mt-1" style={{ borderBottom: '3px double black' }}>
                          <span className="tabular-nums font-bold text-xs sm:text-[13px] block pt-0.5">{fmt(Number(purchaseReturn.totalAmount || 0))}</span>
                      </div>
                  </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-3 mt-8">
                  <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center">PREPARED BY</span>
                  </div>
                  <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center">CHECKED BY</span>
                  </div>
                  <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center">APPROVED BY</span>
                  </div>
              </div>
          </div>
      </div>
      </>
    </PermissionGuard>
  );
}