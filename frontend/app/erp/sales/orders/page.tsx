"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, FileText, Truck, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { salesOrderApi, customerApi, warehouseApi, inventoryApi, brandApi, categoryApi, SalesOrder, Customer } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

interface SelectedItem {
  id: string;
  sku: string;
  description: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  discount: number;
  total: number;
  availableStock: number;
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create Order Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [taxRate, setTaxRate] = useState(5);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  // Item Selection State
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  // Filter State
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    brandIds: string[];
    categoryIds: string[];
  }>({ brandIds: [], categoryIds: [] });

  // Load data
  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadWarehouses();
    loadFilterData();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await salesOrderApi.getAll(searchTerm, statusFilter);
      console.log('Sales orders response:', response); // Debug log
      setOrders(response.data || []);
    } catch (error) {
      toast.error("Failed to load sales orders");
      console.error(error);
      setOrders([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerApi.getAll();
      setCustomers(response.data);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  };

  const loadWarehouses = async () => {
    try {
      const response = await warehouseApi.getAll();
      setWarehouses(response);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
    }
  };

  const loadFilterData = async () => {
    try {
      const [brandsRes, catsRes] = await Promise.allSettled([
        brandApi.getAll(),
        categoryApi.getAll(),
      ]);

      if (brandsRes.status === 'fulfilled' && brandsRes.value.status) {
        setBrands(brandsRes.value.data);
      }
      if (catsRes.status === 'fulfilled' && catsRes.value.status) {
        setCategories(catsRes.value.data);
      }
    } catch (error) {
      console.error("Failed to load filter data:", error);
    }
  };

  // Search items
  const searchItems = async (query: string) => {
    if ((!query || query.length < 2) && appliedFilters.brandIds.length === 0 && appliedFilters.categoryIds.length === 0) {
      setItemOptions([]);
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse first");
      return;
    }

    setSearchLoading(true);
    try {
      const res = await inventoryApi.search(query, selectedWarehouseId, undefined, appliedFilters);
      if (res.status && res.data) {
        const options = res.data.map((item: any) => ({
          value: item.id,
          label: `${item.sku} - ${item.description}`,
          description: `Available: ${item.totalQuantity || 0} | Cost: Rs. ${item.unitCost || 0}`,
          item: {
            ...item,
            availableStock: item.totalQuantity || 0,
            costPrice: item.unitCost || 0,
          }
        }));
        setItemOptions(options);
        if (!isPopoverOpen) setIsPopoverOpen(true);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add item to order
  const addItem = (itemData: any) => {
    const isSelected = selectedItems.find(i => i.id === itemData.id);
    if (isSelected) {
      toast.warning("Item already added to order");
      return;
    }

    const newItem: SelectedItem = {
      id: itemData.id,
      sku: itemData.sku,
      description: itemData.description,
      costPrice: itemData.unitPrice || 0, // Use unitPrice as cost price
      salePrice: itemData.unitPrice || 0, // Use unitPrice as default sale price (editable)
      quantity: 1,
      discount: 0,
      total: itemData.unitPrice || 0,
      availableStock: itemData.availableStock,
    };

    console.log('Item data:', itemData); // Debug log
    console.log('Unit cost:', itemData.unitCost); // Debug log

    setSelectedItems(prev => [...prev, newItem]);
    setItemSearchQuery("");
    setIsPopoverOpen(false);
  };

  // Update item
  const updateItem = (id: string, field: keyof SelectedItem, value: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total
        updated.total = (updated.salePrice * updated.quantity) - updated.discount;
        return updated;
      }
      return item;
    }));
  };

  // Remove item
  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== id));
  };

  // Calculate totals
  const subtotal = selectedItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount - orderDiscount;

  // Search and filter
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadOrders();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, statusFilter]);

  // Item search
  useEffect(() => {
    const debounce = setTimeout(() => {
      searchItems(itemSearchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [itemSearchQuery, selectedWarehouseId, appliedFilters]);

  const handleCreateOrder = async () => {
    if (!selectedCustomerId || !selectedWarehouseId || selectedItems.length === 0) {
      toast.error("Please fill all required fields and add at least one item");
      return;
    }

    try {
      const orderData = {
        customerId: selectedCustomerId,
        warehouseId: selectedWarehouseId,
        taxRate,
        discount: orderDiscount,
        items: selectedItems.map(item => ({
          itemId: item.id,
          quantity: item.quantity,
          salePrice: item.salePrice,
          discount: item.discount,
        })),
      };

      await salesOrderApi.create(orderData);
      toast.success("Sales order created successfully");
      
      // Reset form
      setSelectedCustomerId("");
      setSelectedWarehouseId("");
      setSelectedItems([]);
      setNotes("");
      setIsCreateOpen(false);
      loadOrders();
    } catch (error) {
      toast.error("Failed to create sales order");
      console.error(error);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await salesOrderApi.confirm(id);
      toast.success("Sales order confirmed successfully");
      loadOrders();
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
            <p className="mt-2 text-muted-foreground">Loading sales orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permissions="erp.sales.order.read">
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Orders</h1>
            <p className="text-muted-foreground">
              Create and manage sales orders
            </p>
          </div>
          <PermissionGuard permissions="erp.sales.order.create" fallback={null}>
            <Button onClick={() => router.push("/erp/sales/orders/create")}>
              <Plus className="mr-2 h-4 w-4" />
              New Sales Order
            </Button>
          </PermissionGuard>
        </div>

        {/* Filter Sheet */}
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Items</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Brands</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {brands.map((brand) => (
                    <label key={brand.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={appliedFilters.brandIds.includes(brand.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAppliedFilters(prev => ({
                              ...prev,
                              brandIds: [...prev.brandIds, brand.id]
                            }));
                          } else {
                            setAppliedFilters(prev => ({
                              ...prev,
                              brandIds: prev.brandIds.filter(id => id !== brand.id)
                            }));
                          }
                        }}
                      />
                      <span className="text-sm">{brand.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={appliedFilters.categoryIds.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAppliedFilters(prev => ({
                              ...prev,
                              categoryIds: [...prev.categoryIds, category.id]
                            }));
                          } else {
                            setAppliedFilters(prev => ({
                              ...prev,
                              categoryIds: prev.categoryIds.filter(id => id !== category.id)
                            }));
                          }
                        }}
                      />
                      <span className="text-sm">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => setAppliedFilters({ brandIds: [], categoryIds: [] })}
              >
                Clear All
              </Button>
              <Button onClick={() => setIsFilterOpen(false)}>
                Apply Filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Orders List */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "No orders found matching your search." : "No sales orders found. Create your first order."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (orders || []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell>{order.customer.name}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>{order.items.length} items</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(order.grandTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View"
                          onClick={() => router.push(`/erp/sales/orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === "DRAFT" && (
                          <PermissionGuard permissions="erp.sales.order.approve" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Confirm Order"
                              onClick={() => handleConfirm(order.id)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                        )}
                        {order.status === "CONFIRMED" && (
                          <PermissionGuard permissions="erp.sales.dc.create" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Create Delivery Challan"
                              onClick={() => router.push(`/erp/sales/delivery-challans/create?orderId=${order.id}`)}
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
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