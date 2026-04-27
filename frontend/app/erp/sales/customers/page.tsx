"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Eye, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { customerApi, Customer } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { CustomerBulkUploadModal } from "@/components/customers/customer-bulk-upload-modal";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    contactNo: "",
    email: "",
  });

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerApi.getAll(searchTerm);
      setCustomers(response.data);
    } catch (error) {
      toast.error("Failed to load customers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Search customers
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadCustomers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customerApi.create(formData);
      toast.success("Customer created successfully");
      setFormData({
        code: "",
        name: "",
        address: "",
        contactNo: "",
        email: "",
      });
      setIsCreateOpen(false);
      loadCustomers();
    } catch (error) {
      toast.error("Failed to create customer");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      await customerApi.delete(id);
      toast.success("Customer deleted successfully");
      loadCustomers();
    } catch (error) {
      toast.error("Failed to delete customer");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permissions="erp.sales.customer.read">
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">
              Manage customer information and accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGuard permissions="erp.sales.customer.create" fallback={null}>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>Add New Customer</DialogTitle>
                      <DialogDescription>
                        Create a new customer account
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="code" className="text-right">
                          Code
                        </Label>
                        <Input
                          id="code"
                          value={formData.code}
                          onChange={(e) =>
                            setFormData({ ...formData, code: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="Auto-generated if empty"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="Customer Name"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contactNo" className="text-right">
                          Contact
                        </Label>
                        <Input
                          id="contactNo"
                          value={formData.contactNo}
                          onChange={(e) =>
                            setFormData({ ...formData, contactNo: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="03001234567"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="customer@example.com"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="address" className="text-right">
                          Address
                        </Label>
                        <Textarea
                          id="address"
                          value={formData.address}
                          onChange={(e) =>
                            setFormData({ ...formData, address: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="Customer address"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Customer</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </PermissionGuard>

            <PermissionGuard permissions="erp.sales.customer.create" fallback={null}>
              <Button onClick={() => setBulkOpen(true)} variant={"outline"} >
                <Upload className="mr-2" />
                Bulk Import
              </Button>
              <CustomerBulkUploadModal
                open={bulkOpen}
                onOpenChange={setBulkOpen}
                onSuccess={loadCustomers}
              />
            </PermissionGuard>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers..."
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm
                        ? "No customers found matching your search."
                        : "No customers found. Create your first customer."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.code}</TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.contactNo || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.address || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        customer.balance > 0 ? "text-red-600" : "text-green-600"
                      }
                    >
                      {formatCurrency(customer.balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
