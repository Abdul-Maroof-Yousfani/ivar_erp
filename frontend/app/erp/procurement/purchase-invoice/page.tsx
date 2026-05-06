"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getPurchaseInvoices,
  deletePurchaseInvoice,
} from "@/lib/actions/purchase-invoice";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Autocomplete } from "@/components/ui/autocomplete";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: {
    name: string;
    code: string;
  };
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  paymentStatus: string;
}

export default function PurchaseInvoiceListPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  // Options for autocomplete dropdowns
  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "DRAFT", label: "Draft" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "APPROVED", label: "Approved" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const paymentStatusOptions = [
    { value: "", label: "All Payment Status" },
    { value: "UNPAID", label: "Unpaid" },
    { value: "PARTIALLY_PAID", label: "Partially Paid" },
    { value: "FULLY_PAID", label: "Fully Paid" },
    { value: "OVERDUE", label: "Overdue" },
  ];

  useEffect(() => {
    fetchInvoices();
  }, [searchTerm, statusFilter, paymentStatusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        ...(statusFilter && { status: statusFilter }),
        ...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
      };

      const response = await getPurchaseInvoices(params);
      setInvoices(response.data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      DRAFT: "bg-gray-100 text-gray-800",
      SUBMITTED: "bg-blue-100 text-blue-800",
      APPROVED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return (
      statusColors[status as keyof typeof statusColors] ||
      "bg-gray-100 text-gray-800"
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusColors = {
      UNPAID: "bg-red-100 text-red-800",
      PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
      FULLY_PAID: "bg-green-100 text-green-800",
      OVERDUE: "bg-red-100 text-red-800",
    };
    return (
      statusColors[status as keyof typeof statusColors] ||
      "bg-gray-100 text-gray-800"
    );
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <PermissionGuard permissions="erp.procurement.pi.read">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Purchase Invoices</h1>
            <p className="text-gray-600">
              Manage supplier invoices and payments
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/erp/procurement/purchase-invoice/create-direct"
              transitionTypes={["nav-forward"]}
            >
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Direct PI
              </Button>
            </Link>
            <Link
              href="/erp/procurement/purchase-invoice/create"
              transitionTypes={["nav-forward"]}
            >
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by invoice number or supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Autocomplete
                options={statusOptions}
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="All Status"
                searchPlaceholder="Search status..."
                className="w-48"
              />
              <Autocomplete
                options={paymentStatusOptions}
                value={paymentStatusFilter}
                onValueChange={setPaymentStatusFilter}
                placeholder="All Payment Status"
                searchPlaceholder="Search payment status..."
                className="w-52"
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice List */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Invoice #</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-right p-3">Total Amount</th>
                      <th className="text-right p-3">Paid Amount</th>
                      <th className="text-right p-3">Remaining</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Payment Status</th>
                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b hover:bg-background/80"
                      >
                        <td className="p-3 font-medium">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="p-3">
                          {new Date(invoice.invoiceDate).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">
                              {invoice.supplier.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {invoice.supplier.code}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {invoice.totalAmount.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {invoice.paidAmount.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {invoice.remainingAmount.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={getStatusBadge(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={getPaymentStatusBadge(
                              invoice.paymentStatus,
                            )}
                          >
                            {invoice.paymentStatus.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/erp/procurement/purchase-invoice/${invoice.id}`,
                                )
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <PermissionGuard
                              permissions="erp.procurement.pi.delete"
                              fallback={null}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                                onClick={async () => {
                                  if (!window.confirm("Delete this invoice?"))
                                    return;
                                  try {
                                    await deletePurchaseInvoice(invoice.id);
                                    toast.success("Invoice deleted");
                                    fetchInvoices();
                                  } catch (error: any) {
                                    toast.error(
                                      error.message ||
                                        "Failed to delete invoice",
                                    );
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredInvoices.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No invoices found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
