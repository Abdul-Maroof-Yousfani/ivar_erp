"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, FileText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { deliveryChallanApi, salesOrderApi } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

// Sample data - Remove this dummy data
const sampleChallans: any[] = []; // Empty array instead of dummy data

export default function DeliveryChallansPage() {
  const router = useRouter();
  const [challans, setChallans] = useState(sampleChallans);
  const [salesOrders, setSalesOrders] = useState<any[]>([]); // Add state for sales orders
  const [selectedOrder, setSelectedOrder] = useState<any>(null); // Add state for selected order
  const [deliveryItems, setDeliveryItems] = useState<any[]>([]); // Add state for delivery items
  const [formData, setFormData] = useState({
    driverName: '',
    vehicleNo: '',
    transportMode: ''
  }); // Add form state
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('erp.sales.dc.create');
  const canCancel = hasPermission('erp.sales.dc.cancel');

  // Load data on component mount
  useEffect(() => {
    loadChallans();
    loadSalesOrders();
  }, []);

  const loadChallans = async () => {
    try {
      setLoading(true);
      const response = await deliveryChallanApi.getAll();
      console.log('Challans API response:', response); // Debug log
      
      // Handle both array and object response formats
      const challansData = Array.isArray(response) ? response : (response.data || response);
      console.log('Challans data:', challansData); // Debug log
      console.log('Challans data type:', typeof challansData, 'Is array:', Array.isArray(challansData)); // Debug log
      
      if (Array.isArray(challansData)) {
        setChallans(challansData);
        console.log('Set challans to:', challansData.length, 'items'); // Debug log
      } else {
        console.error('Challans data is not an array:', challansData);
        setChallans([]);
      }
    } catch (error) {
      toast.error("Failed to load delivery challans");
      console.error('Load challans error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesOrders = async () => {
    try {
      const response = await salesOrderApi.getAll();
      console.log('Sales orders API response:', response); // Debug log
      
      // Filter only confirmed sales orders that can be delivered
      const confirmedOrders = response.data?.filter((order: any) => 
        order.status === 'CONFIRMED' || order.status === 'PARTIALLY_DELIVERED'
      ) || [];
      setSalesOrders(confirmedOrders);
      console.log('Sales orders loaded:', confirmedOrders); // Debug log
    } catch (error) {
      toast.error("Failed to load sales orders");
      console.error('Load sales orders error:', error);
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
        console.log('Order items loaded:', items); // Debug log
      }
    } catch (error) {
      toast.error("Failed to load order details");
      console.error(error);
    }
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
        transportMode: formData.transportMode || 'ROAD',
        items: deliveryItems.map(item => ({
          itemId: item.itemId,
          deliveredQty: Number(item.deliveredQty),
          salePrice: Number(item.salePrice)
        }))
      };

      console.log('Creating challan with data:', challanData); // Debug log
      console.log('Items data types:', challanData.items.map(item => ({
        itemId: typeof item.itemId,
        deliveredQty: typeof item.deliveredQty,
        salePrice: typeof item.salePrice
      }))); // Debug log

      const createResponse = await deliveryChallanApi.create(challanData);
      console.log('Create challan response:', createResponse); // Debug log
      
      toast.success("Delivery challan created successfully");
      
      // Reset form and close dialog
      setSelectedOrder(null);
      setDeliveryItems([]);
      setFormData({ driverName: '', vehicleNo: '', transportMode: '' });
      setIsCreateOpen(false);
      
      // Reload challans
      console.log('Reloading challans after creation...'); // Debug log
      await loadChallans();
      console.log('Challans reloaded successfully'); // Debug log
    } catch (error) {
      toast.error("Failed to create delivery challan");
      console.error('Create challan error:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredChallans = challans.filter(
    (challan) =>
      challan.challanNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (challan.customer?.name || challan.customer)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (challan.salesOrder?.orderNo || challan.salesOrder)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log('Current challans state:', challans); // Debug log
  console.log('Filtered challans:', filteredChallans); // Debug log

  const handleCancelChallan = async (challanId: string) => {
    try {
      if (!confirm('Are you sure you want to cancel this delivery challan? This will restore the inventory.')) {
        return;
      }

      await deliveryChallanApi.cancel(challanId);
      toast.success("Delivery challan cancelled successfully");
      
      // Reload challans
      loadChallans();
    } catch (error) {
      toast.error("Failed to cancel delivery challan");
      console.error('Cancel challan error:', error);
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

  return (
    <PermissionGuard permissions="erp.sales.dc.read">
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Challans</h1>
          <p className="text-muted-foreground">
            Manage goods dispatch and delivery records
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/erp/sales/delivery-challans/create")}>
            <Plus className="mr-2 h-4 w-4" />
            New Delivery Challan
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search challans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Challan No</TableHead>
              <TableHead>Sales Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Challan Date</TableHead>
              <TableHead>Driver/Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading delivery challans...
                </TableCell>
              </TableRow>
            ) : filteredChallans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <div className="mb-2">📦</div>
                    <p>No delivery challans found</p>
                    {searchTerm && <p className="text-sm">Try adjusting your search terms</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredChallans.map((challan) => (
                <TableRow key={challan.id}>
                  <TableCell className="font-medium">{challan.challanNo || 'N/A'}</TableCell>
                  <TableCell>{challan.salesOrder?.orderNo || challan.salesOrder || 'N/A'}</TableCell>
                  <TableCell>{challan.customer?.name || challan.customer || 'N/A'}</TableCell>
                  <TableCell>
                    {challan.challanDate 
                      ? new Date(challan.challanDate).toLocaleDateString() 
                      : challan.createdAt 
                        ? new Date(challan.createdAt).toLocaleDateString()
                        : 'N/A'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{challan.driverName || 'N/A'}</div>
                      <div className="text-muted-foreground">{challan.vehicleNo || 'N/A'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(challan.status || 'PENDING')}>
                      {challan.status || 'PENDING'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">
                      <div>{formatCurrency(challan.totalAmount || 0)}</div>
                      <div className="text-muted-foreground">{challan.totalQty || 0} items</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="View"
                        onClick={() => router.push(`/erp/sales/delivery-challans/${challan.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {challan.status === "PENDING" && canCancel && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Cancel Challan"
                          onClick={() => handleCancelChallan(challan.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <span className="text-xs">✕</span>
                        </Button>
                      )}
                      {challan.status === "DELIVERED" && (
                        <Button variant="ghost" size="sm" title="Create Invoice">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    </PermissionGuard>
  );
}