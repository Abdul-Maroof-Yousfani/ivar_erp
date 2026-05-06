'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, DollarSign, FileText, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getPurchaseInvoice, approvePurchaseInvoice, cancelPurchaseInvoice } from '@/lib/actions/purchase-invoice';
import { PurchaseInvoice as ApiPurchaseInvoice } from '@/lib/api';
import { toast } from 'sonner';
import { PermissionGuard } from "@/components/auth/permission-guard";

interface PaymentVoucherInvoice {
  id: string;
  paidAmount: number;
  paymentVoucher: {
    id: string;
    pvNo: string;
    pvDate: string;
  };
}

interface PurchaseInvoice extends ApiPurchaseInvoice {
  paymentVouchers?: PaymentVoucherInvoice[];
}

interface InvoiceItem {
  id: string;
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  item?: {
    itemId: string;
    description: string;
  };
}

export default function PurchaseInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      // Add cache busting to force fresh data
      const data = await getPurchaseInvoice(id);
      setInvoice(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const result = await approvePurchaseInvoice(id);
      
      console.log('Approve result:', result);
      
      // Check if approval was successful
      if (result && result.status === 'APPROVED') {
        // Immediately update the local state with approved status
        if (invoice) {
          const updatedInvoice = {
            ...invoice,
            status: 'APPROVED' as const
          };
          setInvoice(updatedInvoice);
        }
        
        toast.success('Invoice approved successfully');
        
        // Also fetch fresh data in background
        setTimeout(async () => {
          const freshData = await getPurchaseInvoice(id);
          setInvoice(freshData);
        }, 500);
      } else {
        // If result doesn't have APPROVED status, something went wrong
        toast.error('Failed to approve invoice. Please check configuration.');
      }
    } catch (error: any) {
      console.error('Error approving invoice:', error);
      // Show the actual error message from backend
      const errorMessage = error.message || error.error?.message || 'Failed to approve invoice';
      
      // If it's a finance account configuration error, show helpful message
      if (errorMessage.includes('Finance account not configured')) {
        toast.error(
          'Finance account not configured. Please set up PURCHASES_LOCAL account in Finance → Account Configuration.',
          { duration: 6000 }
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      setActionLoading(true);
      await cancelPurchaseInvoice(id);
      
      // Immediately update the local state with cancelled status
      if (invoice) {
        setInvoice({
          ...invoice,
          status: 'CANCELLED'
        });
      }
      
      toast.success('Invoice cancelled successfully');
      
      // Also fetch fresh data in background
      setTimeout(() => {
        fetchInvoice();
      }, 500);
    } catch (error: any) {
      console.error('Error cancelling invoice:', error);
      toast.error(error.message || 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusColors = {
      UNPAID: 'bg-red-100 text-red-800',
      PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
      FULLY_PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Invoice not found</div>
      </div>
    );
  }

  return (
    <PermissionGuard permissions="erp.procurement.pi.read">
      <div className="container mx-auto p-6" key={invoice.status}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
              <p className="text-gray-600">Purchase Invoice Details</p>
            </div>
          </div>
          <div className="flex gap-2" key={`buttons-${invoice.status}`}>
            <PermissionGuard permissions="erp.procurement.pi.update" fallback={null}>
              <Button
                variant="outline"
                onClick={() => router.push(`/erp/procurement/purchase-invoice/${invoice.id}/edit`)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </PermissionGuard>
            {invoice.status === 'DRAFT' && (
              <>
                <PermissionGuard permissions="erp.procurement.pi.update" fallback={null}>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </PermissionGuard>
                <PermissionGuard permissions="erp.procurement.pi.post" fallback={null}>
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </PermissionGuard>
              </>
            )}
            {invoice.status === 'APPROVED' && (
              <PermissionGuard permissions="erp.finance.payment-voucher.create" fallback={null}>
                <Button
                  onClick={() => router.push(`/erp/finance/payment-voucher/create?invoiceId=${invoice.id}`)}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Create Payment
                </Button>
              </PermissionGuard>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Invoice Number</label>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Invoice Date</label>
                    <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Supplier</label>
                    <p className="font-medium">{invoice.supplier?.name} ({invoice.supplier?.code})</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div>
                      <Badge className={getStatusBadge(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Status</label>
                    <div>
                      <Badge className={getPaymentStatusBadge(invoice.paymentStatus)}>
                        {invoice.paymentStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <p className="font-medium">{invoice.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Item</th>
                        <th className="text-right p-3">Quantity</th>
                        <th className="text-right p-3">Price</th>
                        <th className="text-right p-3">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items?.map((item: any) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3">
                            <div className="font-medium">{item.item?.description || item.description}</div>
                            <div className="text-sm text-gray-500">{item.item?.itemId || item.itemId}</div>
                          </td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">{item.unitPrice.toLocaleString()}</td>
                          <td className="p-3 text-right">{item.lineTotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {invoice.paymentVouchers && invoice.paymentVouchers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">PV Number</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-right p-3">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.paymentVouchers.map((pv) => (
                          <tr key={pv.id} className="border-b">
                            <td className="p-3 font-medium">
                              <Link
                                href={`/erp/finance/payment-voucher/${pv.paymentVoucher.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {pv.paymentVoucher.pvNo}
                              </Link>
                            </td>
                            <td className="p-3">
                              {new Date(pv.paymentVoucher.pvDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right">
                              {pv.paidAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-medium">{invoice.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid Amount</span>
                  <span className="font-medium text-green-600">{invoice.paidAmount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-4 flex justify-between">
                  <span className="text-lg font-bold">Remaining</span>
                  <span className="text-lg font-bold text-red-600">{invoice.remainingAmount.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}