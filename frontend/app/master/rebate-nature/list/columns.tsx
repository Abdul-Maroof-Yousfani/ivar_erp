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
import { EllipsisIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RebateNature, updateRebateNature, deleteRebateNature } from "@/lib/actions/rebate-nature";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type RebateNatureRow = RebateNature & { id: string };

export const columns: ColumnDef<RebateNatureRow>[] = [
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
    header: "Type",
    accessorKey: "type",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => {
      const val = row.getValue("type") as string | null;
      return val ? (
        <span className="capitalize px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">
          {val}
        </span>
      ) : "-";
    },
  },
  {
    header: "Category",
    accessorKey: "category",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => {
      const val = row.getValue("category") as string | null;
      return val || "-";
    },
  },
  {
    header: "Max %",
    accessorKey: "maxInvestmentPercentage",
    size: 100,
    cell: ({ row }) => {
      const val = row.getValue("maxInvestmentPercentage") as number | null;
      return val ? `${val}%` : "-";
    },
  },
  {
    header: "Max Amount",
    accessorKey: "maxInvestmentAmount",
    size: 150,
    cell: ({ row }) => {
      const val = row.getValue("maxInvestmentAmount") as number | null;
      return val ? val.toLocaleString() : "-";
    },
  },
  {
    header: "Age Dependent",
    accessorKey: "isAgeDependent",
    size: 120,
    cell: ({ row }) => (row.getValue("isAgeDependent") ? "Yes" : "No"),
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <span className={`capitalize ${row.original.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.createdBy ? `${row.original.createdBy.firstName} ${row.original.createdBy.lastName}` : "—",
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
  row: Row<RebateNatureRow>;
};

function RowActions({ row }: RowActionsProps) {
  const item = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const canEdit = isAdmin() || hasPermission("rebate-nature.update");
  const canDelete = isAdmin() || hasPermission("rebate-nature.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  const getInitialFormData = () => ({
    name: item.name,
    type: item.type || "other",
    category: item.category || "",
    maxInvestmentPercentage: item.maxInvestmentPercentage?.toString() || "",
    maxInvestmentAmount: item.maxInvestmentAmount?.toString() || "",
    details: item.details || "",
    underSection: item.underSection || "",
    isAgeDependent: item.isAgeDependent,
    status: item.status || "active",
  });

  const [formData, setFormData] = useState(getInitialFormData());

  // Reset form data when dialog opens
  const handleEditDialogOpen = (open: boolean) => {
    setEditDialog(open);
    if (open) {
      setFormData(getInitialFormData());
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateRebateNature(item.id, {
        name: formData.name,
        type: formData.type || undefined,
        category: formData.category || undefined,
        maxInvestmentPercentage: formData.maxInvestmentPercentage ? parseFloat(formData.maxInvestmentPercentage) : undefined,
        maxInvestmentAmount: formData.maxInvestmentAmount ? parseFloat(formData.maxInvestmentAmount) : undefined,
        details: formData.details || undefined,
        underSection: formData.underSection || undefined,
        isAgeDependent: formData.isAgeDependent,
        status: formData.status,
      });
      if (result.status) {
        toast.success(result.message);
        handleEditDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteRebateNature(item.id);
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
          {canEdit && <DropdownMenuItem onClick={() => handleEditDialogOpen(true)}>
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
      <Dialog open={editDialog} onOpenChange={handleEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rebate Nature</DialogTitle>
            <DialogDescription>Update the rebate nature details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    disabled={isPending}
                    placeholder="e.g. Education, Banking"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-underSection">Under Section</Label>
                  <Input
                    id="edit-underSection"
                    value={formData.underSection}
                    onChange={(e) => setFormData({ ...formData, underSection: e.target.value })}
                    disabled={isPending}
                    placeholder="e.g. 61"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxPercentage">Max Investment %</Label>
                  <Input
                    id="edit-maxPercentage"
                    type="number"
                    value={formData.maxInvestmentPercentage}
                    onChange={(e) => setFormData({ ...formData, maxInvestmentPercentage: e.target.value })}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxAmount">Max Investment Amount</Label>
                  <Input
                    id="edit-maxAmount"
                    type="number"
                    value={formData.maxInvestmentAmount}
                    onChange={(e) => setFormData({ ...formData, maxInvestmentAmount: e.target.value })}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-details">Details</Label>
                <Textarea
                  id="edit-details"
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  disabled={isPending}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isAgeDependent"
                  checked={formData.isAgeDependent}
                  onChange={(e) => setFormData({ ...formData, isAgeDependent: e.target.checked })}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-isAgeDependent">Age Dependent</Label>
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
            <AlertDialogTitle>Delete Rebate Nature</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{item.name}&quot;? This action cannot be undone.
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
