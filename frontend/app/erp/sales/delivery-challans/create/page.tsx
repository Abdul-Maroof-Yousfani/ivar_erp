"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deliveryChallanApi, salesOrderApi } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

export default function CreateDeliveryChallanPage() {
  const router = useRouter();
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [deliveryItems, setDeliveryItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    driverName: '',
    vehicleNo: '',
    transportMode: 'SELF'
  });
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadSalesOrders();
  }, []);

  const loadSalesOrders = async () => {
    try {
      setLoading(true);
      const response = await salesOrderApi.getAvailableForDelivery();
      
      // These are already filtered to only show orders without delivery challans
      setSalesOrders(response.data || []);
    } catch (error) {
      toast.error("Failed to load available sales orders");
      console.error('Load sales orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelection = async (orderId: string) => {
    try {
      const order = salesOrders.find(o => o.id === orderId);
      setSelectedOrder(order);
      
      if (order && order.items) {
        // Set delivery items with default delivery quantities
        const items = order.items.map((item: any) => ({
          ...item,
          deliveredQty: item.quantity, // Default to full quantity
        }));
        setDeliveryItems(items);
      }
    } catch (error) {
      toast.error("Failed to load order details");
      console.error(error);
    }
  };

  const updateDeliveryQuantity = (index: number, qty: number) => {
    setDeliveryItems(prev => prev.map((item, i) => 
      i === index ? { ...item, deliveredQty: qty } : item
    ));
  };

  // Calculate totals
  const totalQuantity = deliveryItems.reduce((sum, item) => sum + (item.deliveredQty || 0), 0);
  const subtotal = deliveryItems.reduce((sum, item) => sum + ((item.deliveredQty || 0) * (item.salePrice || 0)), 0);
  
  // Calculate tax and total amount like sales order
  const taxRate = selectedOrder?.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const orderDiscount = selectedOrder?.discount || 0;
  const totalAmount = subtotal + taxAmount - orderDiscount;

  const handleCreateChallan = async () => {
    try {
      setCreateLoading(true);
      
      if (!selectedOrder) {
        toast.error("Please select a sales order");
        return;
      }

      if (!formData.driverName || !formData.vehicleNo) {
        toast.error("Please fill in driver name and vehicle number");
        return;
      }

      if (deliveryItems.length === 0) {
        toast.error("No items to deliver");
        return;
      }

      const challanData = {
        salesOrderId: selectedOrder.id,
        driverName: formData.driverName,
        vehicleNo: formData.vehicleNo,
        transportMode: formData.transportMode || 'SELF',
        items: deliveryItems.map(item => ({
          itemId: item.itemId,
          deliveredQty: Number(item.deliveredQty),
          salePrice: Number(item.salePrice)
        }))
      };

      await deliveryChallanApi.create(challanData);
      toast.success("Delivery challan created successfully");
      router.push("/erp/sales/delivery-challans");
    } catch (error) {
      toast.error("Failed to create delivery challan");
      console.error('Create challan error:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <PermissionGuard permissions="erp.sales.dc.create">
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
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
            <h1 className="text-2xl font-bold tracking-tight">Create Delivery Challan</h1>
            <p className="text-muted-foreground">
              Create a delivery challan from a sales order
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/erp/sales/delivery-challans")}>
            Cancel
          </Button>
          <Button onClick={handleCreateChallan} disabled={createLoading || !selectedOrder}>
            {createLoading ? "Creating..." : "Create Challan"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Order Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Sales Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sales Order *</Label>
                <Select onValueChange={handleOrderSelection} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Loading orders..." : "Select sales order"} />
                  </SelectTrigger>
                  <SelectContent>
                    {salesOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.orderNo}</span>
                          <span className="text-sm text-muted-foreground">
                            {order.customer?.name} - {formatCurrency(order.grandTotal || 0)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrder && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Order Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customer:</span> {selectedOrder.customer?.name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Order Date:</span> {new Date(selectedOrder.orderDate).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span> {selectedOrder.status}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span> {formatCurrency(selectedOrder.grandTotal || 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Driver Name *</Label>
                <Input
                  placeholder="Enter driver name"
                  value={formData.driverName}
                  onChange={(e) => setFormData(prev => ({ ...prev, driverName: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Vehicle Number *</Label>
                <Input
                  placeholder="ABC-123"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleNo: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label>Transport Mode</Label>
                <Select 
                  value={formData.transportMode}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, transportMode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELF">Self Transport</SelectItem>
                    <SelectItem value="COURIER">Courier</SelectItem>
                    <SelectItem value="TRANSPORT">Transport Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Delivery Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deliveryItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No items selected</p>
                <p>Select a sales order to view items for delivery</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deliveryItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.item?.sku || item.itemId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.item?.description || 'No description'}
                      </div>
                      <div className="text-sm text-blue-600 mt-1">
                        Unit Price: {formatCurrency(item.salePrice || 0)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Ordered</div>
                        <div className="font-medium">{item.quantity}</div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Deliver Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.deliveredQty}
                          onChange={(e) => updateDeliveryQuantity(index, Number(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total</div>
                        <div className="font-medium">
                          {formatCurrency((item.deliveredQty || 0) * (item.salePrice || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Summary */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax ({taxRate}%):</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                    {orderDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Discount:</span>
                        <span>{formatCurrency(orderDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t pt-2">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Total Items</div>
                        <div className="font-bold text-lg">{totalQuantity}</div>
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="text-sm text-muted-foreground">Total Amount</div>
                        <div className="font-bold text-lg text-green-600">
                          {formatCurrency(totalAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </PermissionGuard>
  );
}