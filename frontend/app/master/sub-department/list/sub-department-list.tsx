"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import DataTable, { FilterConfig } from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, setDepartmentsStore, SubDepartmentRow } from "./columns";
import {
  Department,
  SubDepartment,
  deleteSubDepartments,
  updateSubDepartments,
} from "@/lib/actions/department";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";

interface SubDepartmentListProps {
  initialSubDepartments: SubDepartment[];
  departments: Department[];
  newItemId?: string;
}

export function SubDepartmentList({
  initialSubDepartments,
  departments,
  newItemId,
}: SubDepartmentListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<
    { id: string; name: string; departmentId: string }[]
  >([]);

  // Set departments for use in row actions
  useEffect(() => {
    setDepartmentsStore(departments);
  }, [departments]);

  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("master.sub-department.create");
  const canBulkEdit = hasPermission("master.sub-department.update");
  const canBulkDelete = hasPermission("master.sub-department.delete");

  const handleToggle = () => {
    router.push("/master/sub-department/add");
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteSubDepartments(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: SubDepartmentRow[]) => {
    setEditRows(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        departmentId: item.departmentId,
      }))
    );
    setBulkEditOpen(true);
  };

  const updateEditRow = (
    id: string,
    field: "name" | "departmentId",
    value: string
  ) => {
    setEditRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };


  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim() && r.departmentId);
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }

    startTransition(async () => {
      const result = await updateSubDepartments(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Transform data to include string id for DataTable
  const data: SubDepartmentRow[] = initialSubDepartments.map((subDept) => ({
    ...subDept,
    id: subDept.id.toString(),
  }));

  // Build filter options from departments
  const departmentFilter: FilterConfig = {
    key: "departmentName",
    label: "Department",
    options: departments.map((dept) => ({
      label: dept.name,
      value: dept.name,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sub-Departments</h2>
        <p className="text-muted-foreground">
          Manage sub-departments under departments
        </p>
      </div>

      <DataTable<SubDepartmentRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Sub-Department" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "name", label: "Name" },
          { key: "departmentName", label: "Department" },
        ]}
        filters={[departmentFilter]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="sub-department-list"
      />

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Sub-Departments</DialogTitle>
            <DialogDescription>
              Update {editRows.length} sub-department(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="flex gap-2">
                <Select
                  value={row.departmentId}
                  onValueChange={(value) =>
                    updateEditRow(row.id, "departmentId", value)
                  }
                  disabled={isPending}
                >
                  <SelectTrigger className="w-1/3">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={`Sub-department ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                  disabled={isPending}
                  className="flex-1"
                />

              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
