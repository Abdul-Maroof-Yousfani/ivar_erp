"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { HighlightText } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EllipsisIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Department,
  SubDepartment,
  updateSubDepartment,
  deleteSubDepartment,
} from "@/lib/actions/department";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/components/providers/auth-provider";

export type SubDepartmentRow = SubDepartment & { id: string };

// Store departments for use in RowActions
let departmentsStore: Department[] = [];
export const setDepartmentsStore = (departments: Department[]) => {
  departmentsStore = departments;
};

export const columns: ColumnDef<SubDepartmentRow>[] = [
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
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Department",
    accessorKey: "departmentName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.departmentName || row.original.department?.name || "—"} />,
  },
  {
    header: "Head",
    accessorKey: "headName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => row.original.headName || "—",
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
  row: Row<SubDepartmentRow>;
};

function RowActions({ row }: RowActionsProps) {
  const subDept = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [selectedHeadId, setSelectedHeadId] = useState<string>(subDept.headId || "");

  const canEdit = hasPermission("master.sub-department.update");
  const canDelete = hasPermission("master.sub-department.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  useEffect(() => {
    if (editDialog) {
      getEmployeesForDropdown().then((result) => {
        if (result.status && result.data) {
          setEmployees(result.data);
        }
      });
      setSelectedHeadId(subDept.headId || "");
    }
  }, [editDialog, subDept.headId]);

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateSubDepartment(subDept.id, formData);
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
      const result = await deleteSubDepartment(subDept.id);
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
          {canEdit && <DropdownMenuItem onClick={() => setEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>}
          {canDelete && <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>}
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
            <DialogTitle>Edit Sub-Department</DialogTitle>
            <DialogDescription>Update the sub-department details</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select name="departmentId" defaultValue={subDept.departmentId.toString()}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsStore.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Sub-Department Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={subDept.name}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-head">Sub-Department Head (Optional)</Label>
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
                  placeholder="Select sub-department head"
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
            <AlertDialogTitle>Delete Sub-Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{subDept.name}&quot;? This action cannot be undone.
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

