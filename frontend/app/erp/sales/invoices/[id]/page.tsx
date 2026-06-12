"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, CreditCard, X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { salesInvoiceApi } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

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

export default function SalesInvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      console.log('Loading invoice with ID:', id);
      const response = await salesInvoiceApi.getById(id);
      console.log('API Response:', response);
      
      // Handle different response formats
      const invoiceData = response.data || response;
      console.log('Invoice data:', invoiceData);
      setInvoice(invoiceData);
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error("Failed to load sales invoice");
      router.push("/erp/sales/invoices");
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!invoice) return;
    
    try {
      await salesInvoiceApi.post(invoice.id);
      toast.success("Sales invoice posted successfully");
      loadInvoice(invoice.id);
    } catch (error) {
      toast.error("Failed to post invoice");
      console.error(error);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    
    if (!confirm('Are you sure you want to cancel this sales invoice?')) {
      return;
    }
    
    try {
      await salesInvoiceApi.cancel(invoice.id);
      toast.success("Sales invoice cancelled successfully");
      loadInvoice(invoice.id);
    } catch (error) {
      toast.error("Failed to cancel invoice");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "POSTED":
        return "bg-blue-100 text-blue-800";
      case "PARTIAL":
        return "bg-orange-100 text-orange-800";
      case "PAID":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading sales invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Sales invoice not found</p>
        </div>
      </div>
    );
  }

  return (
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
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/erp/sales/invoices")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sales Invoice {invoice.invoiceNo || 'N/A'}
              </h1>
              <p className="text-muted-foreground">
                Created on {invoice.createdAt 
                  ? new Date(invoice.createdAt).toLocaleDateString()
                  : 'N/A'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(invoice.status || 'PENDING')}>
              {invoice.status || 'PENDING'}
            </Badge>
            
            {invoice.status === "PENDING" && (
              <>
                <Button size="sm" onClick={handlePost}>
                  <FileText className="h-4 w-4 mr-2" />
                  Post Invoice
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
            
            {(invoice.status === "POSTED" || invoice.status === "PARTIAL") && (
              <Button 
                size="sm"
                onClick={() => router.push(`/erp/finance/receipt-voucher/create?customerId=${invoice.customerId}&invoiceId=${invoice.id}`)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Collect Payment
              </Button>
            )}

            <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Invoice Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-medium">Name:</span> {invoice.customer?.name || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Code:</span> {invoice.customer?.code || 'N/A'}
                </div>
                {invoice.customer?.email && (
                  <div>
                    <span className="font-medium">Email:</span> {invoice.customer.email}
                  </div>
                )}
                {invoice.customer?.phone && (
                  <div>
                    <span className="font-medium">Phone:</span> {invoice.customer.phone}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-medium">Invoice No:</span> {invoice.invoiceNo || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Sales Order:</span> {invoice.salesOrder?.orderNo || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Delivery Challan:</span> {invoice.deliveryChallan?.challanNo || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Status:</span> 
                  <Badge className={`ml-2 ${getStatusColor(invoice.status || 'PENDING')}`}>
                    {invoice.status || 'PENDING'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Items ({invoice.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!invoice.items || invoice.items.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoice.items.map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.item?.description || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.item?.sku || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.costPrice || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.salePrice || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.total || 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({invoice.taxRate || 0}%):</span>
                  <span>{formatCurrency(invoice.taxAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>{formatCurrency(invoice.discount || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(invoice.grandTotal || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
                      Sales Invoice
                    </div>
                  </div>

                  {/* Details Box */}
                  <div className="w-[45%] bg-[#f8fafc] text-xs sm:text-[13px] p-2 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
                     <div className="flex justify-between mb-2">
                       <span className="font-bold">Invoice Number:</span>
                       <span className="font-bold">{invoice.invoiceNo}</span>
                     </div>
                     <div className="flex justify-between">
                       <div className="flex gap-2">
                         <span className="font-bold">Date:</span>
                         <span>{new Date(invoice.createdAt).toLocaleDateString('en-GB')}</span>
                       </div>
                     </div>
                  </div>
              </div>

              {/* Customer Box */}
              <div className="flex gap-4 mb-4 text-xs sm:text-[13px]">
                  <div className="w-full p-2 border border-gray-300 flex flex-col justify-center">
                      <div className="font-bold border-b border-gray-300 mb-2 pb-1">Customer Details</div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>{invoice.customer?.name}</span></div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Code:</span> <span>{invoice.customer?.code}</span></div>
                      {invoice.customer?.email && <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Email:</span> <span>{invoice.customer.email}</span></div>}
                      {invoice.customer?.phone && <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Phone:</span> <span>{invoice.customer.phone}</span></div>}
                  </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs sm:text-[13px] mb-4 border-collapse table-fixed">
                  <thead>
                    <tr className="border-y-2 border-black">
                      <th className="py-2 pr-2 text-left font-bold w-[40%]">Item Details</th>
                      <th className="py-2 pr-2 text-right font-bold w-[15%]">Qty</th>
                      <th className="py-2 pr-2 text-right font-bold w-[15%]">Unit Price</th>
                      <th className="py-2 pr-2 text-right font-bold w-[10%]">Tax %</th>
                      <th className="py-2 text-right font-bold w-[20%]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item: any, i: number) => (
                        <tr key={item.id || i} className="border-b border-gray-300 align-top">
                          <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                            <div className="font-medium">{item.item?.sku || '-'}</div>
                            <div className="text-gray-700">{item.item?.description || item.description || '-'}</div>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {fmt(Number(item.salePrice))}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {invoice.taxRate || 0}%
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmt(Number(item.total))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground border-b border-gray-300">
                              No items found for this invoice
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
                          <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(Number(invoice.grandTotal || 0))}</span>
                      </div>
                  </div>
                  <div className="w-[25%] pr-2 text-right">
                      <div className="text-xs sm:text-[13px] text-gray-700">Subtotal:</div>
                      <div className="text-xs sm:text-[13px] text-gray-700">Tax:</div>
                      <div className="text-xs sm:text-[13px] text-gray-700">Discount:</div>
                      <div className="font-bold text-xs sm:text-[13px] mt-1">Total:</div>
                  </div>
                  <div className="w-[20%] text-right">
                      <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(invoice.subtotal || 0))}</div>
                      <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">{fmt(Number(invoice.taxAmount || 0))}</div>
                      <div className="tabular-nums text-xs sm:text-[13px] text-gray-700">-{fmt(Number(invoice.discount || 0))}</div>
                      <div className="ml-auto border-t border-black pb-0.5 mt-1" style={{ borderBottom: '3px double black' }}>
                          <span className="tabular-nums font-bold text-xs sm:text-[13px] block pt-0.5">{fmt(Number(invoice.grandTotal || 0))}</span>
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
  );
}