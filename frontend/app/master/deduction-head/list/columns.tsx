"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EllipsisIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeductionHead, updateDeductionHead, deleteDeductionHead } from "@/lib/actions/deduction-head";
import { useAuth } from "@/components/providers/auth-provider";

export type DeductionHeadRow = DeductionHead & { id: string; sno?: number };

export const columns: ColumnDef<DeductionHeadRow>[] = [
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
    header: "SNO",
    accessorKey: "sno",
    size: 60,
    cell: ({ row, table }) => {
      const pageIndex = table.getState().pagination.pageIndex;
      const pageSize = table.getState().pagination.pageSize;
      return pageIndex * pageSize + row.index + 1;
    },
    enableSorting: false,
  },
  {
    header: "Name",
    accessorKey: "name",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.createdBy || "—"} />
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "inactive" ? "secondary" : "default"}
      >
        {row.original.status || "active"}
      </Badge>
    ),
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
  row: Row<DeductionHeadRow>;
};

function RowActions({ row }: RowActionsProps) {
  const deductionHead = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editData, setEditData] = useState({
    name: deductionHead.name,
    status: deductionHead.status,
  });

  const canEdit = isAdmin() || hasPermission("master.deduction-head.update");
  const canDelete = isAdmin() || hasPermission("master.deduction-head.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleEditSubmit = async () => {
    if (!editData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await updateDeductionHead(deductionHead.id, editData);
      if (result.status) {
        toast.success(result.message || "Deduction Head updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update deduction head");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteDeductionHead(deductionHead.id);
      if (result.status) {
        toast.success(result.message || "Deduction Head deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete deduction head");
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
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deduction Head</DialogTitle>
            <DialogDescription>Update the deduction head details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editData.name}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                disabled={isPending}
                placeholder="Deduction head name"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deduction Head</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deductionHead.name}&quot;? This action cannot be undone.
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

