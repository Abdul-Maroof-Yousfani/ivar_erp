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
import { TaxSlab, updateTaxSlab, deleteTaxSlab } from "@/lib/actions/tax-slab";
import { useAuth } from "@/components/providers/auth-provider";

export type TaxSlabRow = TaxSlab & { id: string };

export const columns: ColumnDef<TaxSlabRow>[] = [
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
  { header: "Name", accessorKey: "name", size: 200, enableSorting: true, cell: ({ row }) => <HighlightText text={row.original.name} /> },
  { header: "Min Amount", accessorKey: "minAmount", size: 120, enableSorting: true, cell: ({ row }) => row.original.minAmount.toLocaleString() },
  { header: "Max Amount", accessorKey: "maxAmount", size: 120, enableSorting: true, cell: ({ row }) => row.original.maxAmount.toLocaleString() },
  { header: "Rate (%)", accessorKey: "rate", size: 100, enableSorting: true, cell: ({ row }) => `${row.original.rate}%` },
  { header: "Created By", accessorKey: "createdBy", size: 120, enableSorting: true, cell: ({ row }) => row.original.createdBy || "—" },
  { header: "Created At", accessorKey: "createdAt", size: 120, cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(), enableSorting: true },
  { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <RowActions row={row} />, size: 60, enableHiding: false },
];

function RowActions({ row }: { row: Row<TaxSlabRow> }) {
  const ts = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const canEdit = hasPermission("master.tax-slab.update");
  const canDelete = hasPermission("master.tax-slab.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateTaxSlab(ts.id, formData);
      if (result.status) { toast.success(result.message); setEditDialog(false); router.refresh(); }
      else toast.error(result.message);
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteTaxSlab(ts.id);
      if (result.status) { toast.success(result.message); setDeleteDialog(false); router.refresh(); }
      else toast.error(result.message);
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" className="shadow-none" aria-label="Actions"><EllipsisIcon size={16} /></Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditDialog(true)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteDialog(true)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Tax Slab</DialogTitle><DialogDescription>Update the tax slab details</DialogDescription></DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={ts.name} disabled={isPending} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Min Amount</Label><Input name="minAmount" type="number" defaultValue={ts.minAmount} disabled={isPending} required /></div>
                <div className="space-y-2"><Label>Max Amount</Label><Input name="maxAmount" type="number" defaultValue={ts.maxAmount} disabled={isPending} required /></div>
              </div>
              <div className="space-y-2"><Label>Rate (%)</Label><Input name="rate" type="number" step="0.01" defaultValue={ts.rate} disabled={isPending} required /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Tax Slab</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete &quot;{ts.name}&quot;? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

