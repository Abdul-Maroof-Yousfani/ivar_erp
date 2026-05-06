"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Eye, CheckCircle } from "lucide-react";
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
import { salesOrderApi, SalesOrder } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

export default function WarehouseVerificationPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Fetch both CONFIRMED and WAREHOUSE_VERIFIED orders
      const response = await salesOrderApi.getAll(searchTerm, "all");
      // Filter manually for only these two statuses for this specific view
      const filtered = (response.data || []).filter((o: any) => 
        o.status === "CONFIRMED" || o.status === "WAREHOUSE_VERIFIED"
      );
      setOrders(filtered);
    } catch (error) {
      toast.error("Failed to load verifications");
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadOrders();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800">PENDING</Badge>;
      case "WAREHOUSE_VERIFIED":
        return <Badge className="bg-green-100 text-green-800">VERIFIED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading verifications...</p>
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
            <h1 className="text-2xl font-bold tracking-tight">Warehouse Verification</h1>
            <p className="text-muted-foreground">
              Manage and track warehouse stock verifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by order number or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "No orders found matching your search." : "No orders for verification."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell>{order.customer.name}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>{order.warehouseId || 'N/A'}</TableCell>
                    <TableCell>{order.items.length} items</TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === "CONFIRMED" ? (
                        <Button
                          size="sm"
                          asChild
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Link href={`/erp/sales/orders/${order.id}/verify`} transitionTypes={["nav-forward"]}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify Stock
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-600 bg-green-50 cursor-default hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verified
                        </Button>
                      )}
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
