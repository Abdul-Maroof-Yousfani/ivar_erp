"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { salesOrderApi, SalesOrder } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export default function SalesOrderVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedItems, setVerifiedItems] = useState<any[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadOrder(params.id as string);
    }
  }, [params.id]);

  const loadOrder = async (id: string) => {
    try {
      setLoading(true);
      const response = await salesOrderApi.getById(id);
      const orderData = response.data;
      setOrder(orderData);
      
      // Initialize verified items from order items
      setVerifiedItems(orderData.items.map(item => ({
        itemId: item.itemId,
        description: item.item?.description || 'N/A',
        sku: item.item?.sku || 'N/A',
        quantity: item.quantity,
        salePrice: item.salePrice,
        discount: item.discount
      })));
    } catch (error) {
      toast.error("Failed to load sales order");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    const updated = [...verifiedItems];
    // Ensure quantity is not more than ordered
    const orderedQty = order?.items[index].quantity || 0;
    if (newQty > orderedQty) {
      toast.warning(`Quantity cannot be more than ordered (${orderedQty})`);
      updated[index].quantity = orderedQty;
    } else {
      updated[index].quantity = newQty;
    }
    setVerifiedItems(updated);
  };

  const handleSubmit = async () => {
    if (!order) return;
    
    try {
      setIsVerifying(true);
      await salesOrderApi.verify(order.id, verifiedItems);
      toast.success("Sales order verified by warehouse");
      router.push(`/erp/sales/orders/${order.id}`);
    } catch (error) {
      toast.error("Failed to verify sales order");
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <p>Order not found</p>
        <Button variant="link" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Stock Verification</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isVerifying} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            {isVerifying ? "Verifying..." : "Confirm & Verify Stock"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Order Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{order.orderNo}</div>
            <p className="text-xs text-muted-foreground">
              Date: {new Date(order.orderDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{order.customer.name}</div>
            <p className="text-xs text-muted-foreground">
              Code: {order.customer.code}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{order.warehouseId || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Verification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the actual physical quantity available for each item.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Details</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Ordered Qty</TableHead>
                <TableHead className="text-right w-40">Physical Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifiedItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="font-medium">{item.description}</div>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-right font-bold text-blue-600">
                    {order.items[index].quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Input
                        type="number"
                        min="0"
                        max={order.items[index].quantity}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                        className="text-right w-24 border-2 border-blue-200 focus:border-blue-500"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-amber-700">
              <strong>Note:</strong> Verifying will update the Sales Order status to <code>WAREHOUSE_VERIFIED</code>. 
              Recalculated totals will be based on the physical quantities entered above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
