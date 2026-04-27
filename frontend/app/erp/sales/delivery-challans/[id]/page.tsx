"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Truck, FileText, CheckCircle, X } from "lucide-react";
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
import { deliveryChallanApi } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

export default function DeliveryChallanViewPage() {
  const params = useParams();
  const router = useRouter();
  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const canDeliver = hasPermission('erp.sales.dc.deliver');
  const canCancel = hasPermission('erp.sales.dc.cancel');
  const canCreateInvoice = hasPermission('erp.sales.invoice.create');

  useEffect(() => {
    if (params.id) {
      loadChallan(params.id as string);
    }
  }, [params.id]);

  const loadChallan = async (id: string) => {
    try {
      setLoading(true);
      console.log('Loading challan with ID:', id);
      const response = await deliveryChallanApi.getById(id);
      console.log('API Response:', response);
      
      // Handle different response formats
      const challanData = response.data || response;
      console.log('Challan data:', challanData);
      setChallan(challanData);
    } catch (error) {
      console.error('Error loading challan:', error);
      toast.error("Failed to load delivery challan");
      router.push("/erp/sales/delivery-challans");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!challan) return;
    
    try {
      await deliveryChallanApi.markDelivered(challan.id);
      toast.success("Delivery challan marked as delivered");
      loadChallan(challan.id);
    } catch (error) {
      toast.error("Failed to mark as delivered");
      console.error(error);
    }
  };

  const handleCancel = async () => {
    if (!challan) return;
    
    if (!confirm('Are you sure you want to cancel this delivery challan? This will restore the inventory.')) {
      return;
    }
    
    try {
      await deliveryChallanApi.cancel(challan.id);
      toast.success("Delivery challan cancelled successfully");
      loadChallan(challan.id);
    } catch (error) {
      toast.error("Failed to cancel delivery challan");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "INVOICED":
        return "bg-blue-100 text-blue-800";
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
            <p className="mt-2 text-muted-foreground">Loading delivery challan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!challan) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Delivery challan not found</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permissions="erp.sales.dc.read">
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/erp/sales/delivery-challans")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Delivery Challans
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Delivery Challan {challan.challanNo || 'N/A'}
            </h1>
            <p className="text-muted-foreground">
              Created on {challan.challanDate 
                ? new Date(challan.challanDate).toLocaleDateString() 
                : challan.createdAt 
                  ? new Date(challan.createdAt).toLocaleDateString()
                  : 'N/A'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(challan.status || 'PENDING')}>
            {challan.status || 'PENDING'}
          </Badge>
          
          {challan.status === "PENDING" && (
            <>
              {canDeliver && (
                <Button size="sm" onClick={handleMarkDelivered}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Delivered
                </Button>
              )}
              {canCancel && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </>
          )}
          
          {challan.status === "DELIVERED" && canCreateInvoice && (
            <Button 
              size="sm"
              onClick={() => router.push(`/erp/sales/invoices/create?challanId=${challan.id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Challan Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Order No:</span> {challan.salesOrder?.orderNo || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Customer:</span> {challan.customer?.name || challan.salesOrder?.customer?.name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Order Date:</span> {challan.salesOrder?.orderDate 
                  ? new Date(challan.salesOrder.orderDate).toLocaleDateString() 
                  : 'N/A'
                }
              </div>
              <div>
                <span className="font-medium">Order Total:</span> {formatCurrency(challan.salesOrder?.grandTotal || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Challan No:</span> {challan.challanNo || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Challan Date:</span> {challan.challanDate 
                  ? new Date(challan.challanDate).toLocaleDateString() 
                  : challan.createdAt 
                    ? new Date(challan.createdAt).toLocaleDateString()
                    : 'N/A'
                }
              </div>
              <div>
                <span className="font-medium">Driver:</span> {challan.driverName || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Vehicle:</span> {challan.vehicleNo || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Transport Mode:</span> {challan.transportMode || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Status:</span> 
                <Badge className={`ml-2 ${getStatusColor(challan.status || 'PENDING')}`}>
                  {challan.status || 'PENDING'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Delivery Items ({challan.items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Delivered Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!challan.items || challan.items.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    challan.items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.item?.description || item.description || 'N/A'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.item?.sku || item.sku || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.salePrice || item.unitPrice || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.deliveredQty || item.quantity || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency((item.deliveredQty || item.quantity || 0) * (item.salePrice || item.unitPrice || 0))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span>{challan.totalQty || challan.items?.reduce((sum: number, item: any) => sum + (item.deliveredQty || item.quantity || 0), 0) || 0}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total Amount:</span>
                <span>{formatCurrency(challan.totalAmount || challan.items?.reduce((sum: number, item: any) => sum + ((item.deliveredQty || item.quantity || 0) * (item.salePrice || item.unitPrice || 0)), 0) || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {challan.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{challan.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </PermissionGuard>
  );
}