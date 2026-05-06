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
import { EOBI, updateEOBI, deleteEOBI } from "@/lib/actions/eobi";
import { useAuth } from "@/components/providers/auth-provider";

export type EOBIRow = EOBI & { id: string };

export const columns: ColumnDef<EOBIRow>[] = [
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
  { header: "Employer Contribution", accessorKey: "employerContribution", size: 150, enableSorting: true, cell: ({ row }) => row.original.employerContribution.toLocaleString() },
  { header: "Employee Contribution", accessorKey: "employeeContribution", size: 150, enableSorting: true, cell: ({ row }) => row.original.employeeContribution.toLocaleString() },
  { header: "Year & Month", accessorKey: "yearMonth", size: 150, enableSorting: true },
  { header: "Created By", accessorKey: "createdBy", size: 120, enableSorting: true, cell: ({ row }) => row.original.createdBy || "—" },
  { header: "Created At", accessorKey: "createdAt", size: 120, cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(), enableSorting: true },
  { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <RowActions row={row} />, size: 60, enableHiding: false },
];

function RowActions({ row }: { row: Row<EOBIRow> }) {
  const e = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const canEdit = hasPermission("master.eobi.update");
  const canDelete = hasPermission("master.eobi.delete");

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateEOBI(e.id, formData);
      if (result.status) { toast.success(result.message); setEditDialog(false); router.refresh(); }
      else toast.error(result.message);
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteEOBI(e.id);
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
          {canEdit && <DropdownMenuItem onClick={() => setEditDialog(true)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>}
          {canDelete && <DropdownMenuItem onClick={() => setDeleteDialog(true)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit EOBI</DialogTitle><DialogDescription>Update the EOBI details</DialogDescription></DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Employer Contribution</Label><Input name="employerContribution" type="number" defaultValue={e.employerContribution} disabled={isPending} required /></div>
              <div className="space-y-2"><Label>Employee Contribution</Label><Input name="employeeContribution" type="number" defaultValue={e.employeeContribution} disabled={isPending} required /></div>
              <div className="space-y-2"><Label>Year & Month</Label><Input name="yearMonth" defaultValue={e.yearMonth} disabled={isPending} required /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete EOBI</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this EOBI record for {e.yearMonth}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

