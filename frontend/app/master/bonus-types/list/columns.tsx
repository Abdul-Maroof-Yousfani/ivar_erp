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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EllipsisIcon, Loader2, Pencil, Trash2, DollarSign, Percent } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BonusType, updateBonusType, deleteBonusType } from "@/lib/actions/bonus-type";
import { useAuth } from "@/components/providers/auth-provider";

export type BonusTypeRow = BonusType & { id: string };

export const columns: ColumnDef<BonusTypeRow>[] = [
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
      <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
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
    cell: ({ row }) => <HighlightText text={row.original.name} />
  },
  {
    header: "Calculation Type",
    accessorKey: "calculationType",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => {
      const type = row.original.calculationType || "Amount";
      return (
        <Badge variant={type === "Amount" ? "default" : "secondary"}>
          {type}
        </Badge>
      );
    },
  },
  {
    header: "Value",
    id: "value",
    size: 150,
    cell: ({ row }) => {
      const item = row.original;
      if (item.calculationType === "Amount" && item.amount) {
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 2,
              }).format(Number(item.amount))}
            </span>
          </div>
        );
      } else if (item.calculationType === "Percentage" && item.percentage) {
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{Number(item.percentage).toFixed(2)}%</span>
          </div>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    },
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => {
      const status = row.original.status || "active";
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status}
        </Badge>
      );
    },
  },
  {
    header: "Created At",
    accessorKey: "createdAt",
    size: 120,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    enableSorting: true
  },
  { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <RowActions row={row} />, size: 60, enableHiding: false },
];

function RowActions({ row }: { row: Row<BonusTypeRow> }) {
  const item = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: item.name || "",
    calculationType: item.calculationType || "Amount",
    amount: item.amount?.toString() || "",
    percentage: item.percentage?.toString() || "",
  });

  const canEdit = isAdmin() || hasPermission("bonus-type.update");
  const canDelete = isAdmin() || hasPermission("bonus-type.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formDataObj = new FormData();
    formDataObj.append("name", formData.name);
    formDataObj.append("calculationType", formData.calculationType);
    if (formData.calculationType === "Amount" && formData.amount) {
      formDataObj.append("amount", formData.amount);
    } else if (formData.calculationType === "Percentage" && formData.percentage) {
      formDataObj.append("percentage", formData.percentage);
    }

    startTransition(async () => {
      const result = await updateBonusType(item.id, formDataObj);
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
      const result = await deleteBonusType(item.id);
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
            <Button size="icon" variant="ghost" className="shadow-none" aria-label="Actions">
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => {
              setFormData({
                name: item.name || "",
                calculationType: item.calculationType || "Amount",
                amount: item.amount?.toString() || "",
                percentage: item.percentage?.toString() || "",
              });
              setEditDialog(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" />Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem onClick={() => setDeleteDialog(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Bonus Type</DialogTitle>
            <DialogDescription>Update the bonus type details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Bonus Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Calculation Type <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center h-10 border rounded-md px-3 bg-background">
                  <RadioGroup
                    value={formData.calculationType}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        calculationType: value,
                        amount: value === "Amount" ? formData.amount : "",
                        percentage: value === "Percentage" ? formData.percentage : "",
                      });
                    }}
                    disabled={isPending}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Amount" id="edit-calc-amount" />
                      <Label htmlFor="edit-calc-amount" className="cursor-pointer font-normal text-sm">
                        Amount
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Percentage" id="edit-calc-percentage" />
                      <Label htmlFor="edit-calc-percentage" className="cursor-pointer font-normal text-sm">
                        Percent
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {formData.calculationType === "Amount" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    disabled={isPending}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="edit-percentage">
                    Percentage <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                    disabled={isPending}
                    required
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)} disabled={isPending}>
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

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bonus Type</AlertDialogTitle>
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

