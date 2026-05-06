"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/common/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EllipsisIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Department, updateDepartment, deleteDepartment } from "@/lib/actions/department";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/components/providers/auth-provider";

export type DepartmentRow = Department & { id: string };

export const columns: ColumnDef<DepartmentRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 28,
  },
  {
    header: "Name",
    accessorKey: "name",
    size: 250,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Head",
    accessorKey: "headName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => row.original.headName || "—",
  },
  {
    header: "Allocation",
    accessorKey: "allocationName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => row.original.allocationName || "—",
  },
  {
    header: "Sub-departments",
    accessorKey: "subDepartmentsCount",
    accessorFn: (row) => row.subDepartments?.length || 0,
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.subDepartments?.length || 0,
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.createdBy || "—",
  },
  {
    header: "Created At",
    accessorKey: "createdAt",
    size: 150,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    enableSorting: true,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

type RowActionsProps = {
  row: Row<DepartmentRow>;
};

function RowActions({ row }: RowActionsProps) {
  const dept = row.original;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [selectedHeadId, setSelectedHeadId] = useState<string>(dept.headId || "");
  const { hasPermission, isAdmin } = useAuth();

  // Admins can always edit/delete, otherwise check specific permissions
  const canEdit = isAdmin() || hasPermission("master.department.update");
  const canDelete = isAdmin() || hasPermission("master.department.delete");
  const canAddSubDept = isAdmin() || hasPermission("master.sub-department.create");

  if (!canEdit && !canDelete && !canAddSubDept) {
    return null;
  }

  // Load employees when dialog opens
  useEffect(() => {
    if (editDialog) {
      getEmployeesForDropdown().then((result) => {
        if (result.status && result.data) {
          setEmployees(result.data);
        }
      });
      setSelectedHeadId(dept.headId || "");
    }
  }, [editDialog, dept.headId]);

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateDepartment(dept.id, formData);
      if (result.status) {
        toast.success(result.message);
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteDepartment(dept.id);
      if (result.status) {
        toast.success(result.message);
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions"
            >
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditDialog(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canAddSubDept && (
            <DropdownMenuItem
              onClick={() => router.push(`/master/sub-department/add?departmentId=${dept.id}`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-Department
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={(open) => {
        setEditDialog(open);
        if (open) {
          getEmployeesForDropdown().then((result) => {
            if (result.status && result.data) {
              setEmployees(result.data);
            }
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update the department details</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Department Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={dept.name}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-head">Department Head (Optional)</Label>
                <Autocomplete
                  options={[
                    { value: "", label: "No Head" },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: `${emp.employeeName} (${emp.employeeId})`,
                    })),
                  ]}
                  value={selectedHeadId}
                  onValueChange={(value) => setSelectedHeadId(value || "")}
                  placeholder="Select department head"
                  searchPlaceholder="Search employee..."
                  emptyMessage="No employees found"
                />
                <input type="hidden" name="headId" value={selectedHeadId} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{dept.name}&quot;? This will also delete all sub-departments under it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

