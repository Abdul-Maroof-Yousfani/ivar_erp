"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Truck, Edit, Trash2 } from "lucide-react";
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
import { salesOrderApi, SalesOrder } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export default function SalesOrderViewPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadOrder(params.id as string);
    }
  }, [params.id]);

  const loadOrder = async (id: string) => {
    try {
      setLoading(true);
      console.log('Loading order with ID:', id); // Debug log
      const response = await salesOrderApi.getById(id);
      console.log('API Response:', response); // Debug log
      
      // Handle different response formats
      const orderData = response.data || response;
      console.log('Order data:', orderData); // Debug log
      setOrder(orderData);
    } catch (error) {
      console.error('Error loading order:', error); // Enhanced error log
      toast.error("Failed to load sales order");
      router.push("/erp/sales/orders");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    
    try {
      await salesOrderApi.confirm(order.id);
      toast.success("Sales order confirmed successfully");
      loadOrder(order.id);
    } catch (error) {
      toast.error("Failed to confirm sales order");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "CONFIRMED":
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
            <p className="mt-2 text-muted-foreground">Loading sales order...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Sales order not found</p>
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
            onClick={() => router.push("/erp/sales/orders")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Sales Order {order.orderNo}
            </h1>
            <p className="text-muted-foreground">
              Created on {new Date(order.orderDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(order.status)}>
            {order.status}
          </Badge>
          
          {order.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                <FileText className="h-4 w-4 mr-2" />
                Confirm Order
              </Button>
            </>
          )}
          
          {order.status === "CONFIRMED" && (
            <Button 
              size="sm"
              onClick={() => router.push(`/erp/sales/delivery-challans/create?salesOrderId=${order.id}`)}
            >
              <Truck className="h-4 w-4 mr-2" />
              Create Delivery Challan
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Order Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Name:</span> {order.customer.name}
              </div>
              <div>
                <span className="font-medium">Code:</span> {order.customer.code}
              </div>
              {order.customer.email && (
                <div>
                  <span className="font-medium">Email:</span> {order.customer.email}
                </div>
              )}
              {order.customer.phone && (
                <div>
                  <span className="font-medium">Phone:</span> {order.customer.phone}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Order No:</span> {order.orderNo}
              </div>
              <div>
                <span className="font-medium">Date:</span> {new Date(order.orderDate).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Warehouse:</span> {order.warehouse?.name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Status:</span> 
                <Badge className={`ml-2 ${getStatusColor(order.status)}`}>
                  {order.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items ({order.items.length})</CardTitle>
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
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
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
                        {formatCurrency(item.salePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.discount || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({order.taxRate}%):</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>{formatCurrency(order.discount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Grand Total:</span>
                <span>{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {order.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}