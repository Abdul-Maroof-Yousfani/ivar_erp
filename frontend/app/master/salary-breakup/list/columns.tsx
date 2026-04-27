"use client";

import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
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
import { EllipsisIcon, Loader2, Pencil, Trash2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSalaryBreakup, deleteSalaryBreakup } from "@/lib/actions/salary-breakup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

export type SalaryBreakupRow = {
  id: string;
  salaryType: string;
  percent: number;
  isTaxable: boolean;
  createdBy: string;
  status: "Active" | "Inactive";
  breakupId: string; // Original salary breakup ID
  breakupName: string; // Original salary breakup name
};

export const columns: ColumnDef<SalaryBreakupRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
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
    accessorKey: "salaryType",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.salaryType} />,
  },
  {
    header: "Percent (%)",
    accessorKey: "percent",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => `${row.original.percent}%`,
  },
  {
    header: "Taxable",
    accessorKey: "isTaxable",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={row.original.isTaxable ? "default" : "secondary"}>
        {row.original.isTaxable ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "Active" ? "default" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.createdBy || "—",
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => <RowActions row={row} table={table} />,
    size: 60,
    enableHiding: false,
  },
];

type RowActionsProps = {
  row: Row<SalaryBreakupRow>;
  table: Table<SalaryBreakupRow>;
};

function RowActions({ row, table }: RowActionsProps) {
  const item = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const canEdit = isAdmin() || hasPermission("salary-breakup.update");
  const canDelete = isAdmin() || hasPermission("salary-breakup.delete");

  if (!canEdit && !canDelete) {
    return null;
  }
  const [editForm, setEditForm] = useState({
    salaryType: item.salaryType,
    percent: item.percent.toString(),
    isTaxable: item.isTaxable,
  });

  // Calculate total percentage with the edited value
  const projectedTotal = useMemo(() => {
    const allRows = table.getRowModel().rows.map((r: Row<SalaryBreakupRow>) => r.original);
    const editedPercent = parseFloat(editForm.percent) || 0;

    // Calculate total: sum of all active items, replacing current item's percent with edited value
    const total = allRows
      .filter((r) => r.status === "Active")
      .reduce((sum: number, r: SalaryBreakupRow) => {
        if (r.id === item.id) {
          return sum + editedPercent;
        }
        return sum + r.percent;
      }, 0);

    return total;
  }, [editForm.percent, item.id, table]);

  const projectedStatus = useMemo(() => {
    const roundedTotal = Math.round(projectedTotal * 100) / 100;
    if (roundedTotal === 100) {
      return { status: "valid" as const, message: "Total will be exactly 100%", diff: 0 };
    } else if (projectedTotal < 100) {
      return {
        status: "under" as const,
        message: `Total will be ${roundedTotal}% (${(100 - roundedTotal).toFixed(2)}% missing)`,
        diff: 100 - roundedTotal
      };
    } else {
      return {
        status: "over" as const,
        message: `Total will be ${roundedTotal}% (${(roundedTotal - 100).toFixed(2)}% over)`,
        diff: roundedTotal - 100
      };
    }
  }, [projectedTotal]);

  const handleEditSubmit = async () => {
    if (!editForm.salaryType.trim()) {
      toast.error("Salary type is required");
      return;
    }
    const percent = parseFloat(editForm.percent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      toast.error("Percent must be between 0 and 100");
      return;
    }

    // Warn if total is not 100% (only for active items)
    if (item.status === "Active" && projectedStatus.status !== "valid") {
      const proceed = window.confirm(
        `Warning: The total percentage will be ${projectedTotal.toFixed(2)}%, not 100%. ` +
        `Do you want to proceed anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    startTransition(async () => {
      const result = await updateSalaryBreakup(item.id, {
        name: editForm.salaryType.trim(),
        percentage: percent,
        isTaxable: editForm.isTaxable,
        status: item.status === "Active" ? "active" : "inactive",
      });
      if (result.status) {
        toast.success(result.message || "Salary breakup updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update salary breakup");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteSalaryBreakup(item.id);
      if (result.status) {
        toast.success(result.message || "Salary breakup deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete salary breakup");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" className="shadow-none" aria-label="Actions">
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && <DropdownMenuItem onClick={() => setEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>}
          {canDelete && <DropdownMenuItem onClick={() => setDeleteDialog(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Salary Breakup Entry</DialogTitle>
            <DialogDescription>Update the salary breakup entry details</DialogDescription>
          </DialogHeader>

          {/* Projected Total Indicator (only show for active items) */}
          {item.status === "Active" && (
            <Alert className={cn(
              "mb-4",
              projectedStatus.status === "valid" && "border-green-500 bg-green-50 dark:bg-green-950/20",
              projectedStatus.status === "under" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
              projectedStatus.status === "over" && "border-red-500 bg-red-50 dark:bg-red-950/20"
            )}>
              {projectedStatus.status === "valid" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
              {projectedStatus.status === "under" && (
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              )}
              {projectedStatus.status === "over" && (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <AlertTitle className={cn(
                "text-sm",
                projectedStatus.status === "valid" && "text-green-700 dark:text-green-300",
                projectedStatus.status === "under" && "text-yellow-700 dark:text-yellow-300",
                projectedStatus.status === "over" && "text-red-700 dark:text-red-300"
              )}>
                Projected Total: {projectedTotal.toFixed(2)}%
              </AlertTitle>
              <AlertDescription className={cn(
                "text-xs",
                projectedStatus.status === "valid" && "text-green-600 dark:text-green-400",
                projectedStatus.status === "under" && "text-yellow-600 dark:text-yellow-400",
                projectedStatus.status === "over" && "text-red-600 dark:text-red-400"
              )}>
                {projectedStatus.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-salary-type">Salary Type</Label>
              <Input
                id="edit-salary-type"
                value={editForm.salaryType}
                onChange={(e) => setEditForm({ ...editForm, salaryType: e.target.value })}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-percent">Percent (%)</Label>
              <Input
                id="edit-percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={editForm.percent}
                onChange={(e) => setEditForm({ ...editForm, percent: e.target.value })}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-taxable">Taxable</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-taxable"
                  checked={editForm.isTaxable}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isTaxable: !!checked })}
                  disabled={isPending}
                />
                <Label htmlFor="edit-taxable" className="font-normal cursor-pointer">
                  This salary component is taxable
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Salary Breakup Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{item.salaryType}&quot;? This action cannot be undone.
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

