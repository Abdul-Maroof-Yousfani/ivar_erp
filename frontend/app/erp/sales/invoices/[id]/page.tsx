"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, CreditCard, X } from "lucide-react";
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
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
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
  );
}