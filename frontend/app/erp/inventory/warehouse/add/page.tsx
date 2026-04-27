"use client";

import { useState, useEffect, useMemo } from "react";
import { WarehouseForm } from "../warehouse-form";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getWarehouses,
  deleteWarehouse,
  Warehouse,
} from "@/lib/actions/warehouse";
import { Plus, Building2, ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddWarehousePage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { hasPermission } = useAuth();

  const canCreate = hasPermission("erp.inventory.warehouse.create");
  const canUpdate = hasPermission("erp.inventory.warehouse.update");
  const canDelete = hasPermission("erp.inventory.warehouse.delete");

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const data = await getWarehouses();
      setWarehouses(data);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (warehouse: Warehouse) => {
    if (
      !confirm(`Are you sure you want to delete warehouse "${warehouse.name}"?`)
    )
      return;
    try {
      await deleteWarehouse(warehouse.id);
      toast.success("Warehouse deleted successfully");
      loadWarehouses();
    } catch (error) {
      console.error("Failed to delete warehouse:", error);
      toast.error("Failed to delete warehouse");
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    loadWarehouses();
  };

  const columns: ColumnDef<Warehouse>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono font-bold text-sm text-primary">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-background">
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ row }) => (
          <span className="max-w-xs truncate text-muted-foreground text-sm">
            {row.original.address || "-"}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? "default" : "secondary"}
            className={
              row.original.isActive ? "bg-green-600 hover:bg-green-700" : ""
            }
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <PermissionGuard permissions="erp.inventory.warehouse.view">
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Warehouse Management
          </h1>
          <p className="text-muted-foreground">
            View and manage storage locations.
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => setShowForm(true)}
            className="font-bold shadow-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Warehouse
          </Button>
        )}
      </div>

      {canCreate && (
        <Sheet open={showForm} onOpenChange={setShowForm}>
          <SheetContent
            side="bottom"
            className="sm:max-w-full lg:max-w-3xl mx-auto rounded-t-xl overflow-y-auto max-h-[90vh]"
          >
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                Register New Warehouse
              </SheetTitle>
              <SheetDescription>
                Enter the details for the new storage location.
              </SheetDescription>
            </SheetHeader>

            <WarehouseForm
              onSuccess={handleSuccess}
              onCancel={() => setShowForm(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="grid grid-cols-1 gap-6">
        <DataTable
          columns={columns}
          data={warehouses}
          isLoading={loading}
          searchFields={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "address", label: "Address" },
          ]}
          onRowEdit={(w) =>
            router.push(`/erp/inventory/warehouse/edit/${w.id}`)
          }
          onRowDelete={canDelete ? handleDelete : undefined}
          canBulkEdit={canUpdate}
          canBulkDelete={canDelete}
          tableId="warehouse-list"
        />
      </div>
    </div>
    </PermissionGuard>
  );
}
