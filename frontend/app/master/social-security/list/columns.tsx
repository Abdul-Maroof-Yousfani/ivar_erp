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
import { SocialSecurityInstitution, updateSocialSecurityInstitution, deleteSocialSecurityInstitution } from "@/lib/actions/social-security";
import { useAuth } from "@/components/providers/auth-provider";

export type SocialSecurityInstitutionRow = SocialSecurityInstitution & { id: string };

export const columns: ColumnDef<SocialSecurityInstitutionRow>[] = [
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
    header: "Code",
    accessorKey: "code",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.code} />
  },
  {
    header: "Name",
    accessorKey: "name",
    size: 250,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />
  },
  {
    header: "Province",
    accessorKey: "province",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => row.original.province || "—"
  },
  {
    header: "Rate (%)",
    accessorKey: "contributionRate",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => row.original.contributionRate ? `${row.original.contributionRate}%` : "0%"
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <span className={`px-2 py-1 text-xs rounded-full ${row.original.status === "active"
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
        }`}>
        {row.original.status}
      </span>
    )
  },
  {
    header: "Contact",
    accessorKey: "contactNumber",
    size: 150,
    cell: ({ row }) => row.original.contactNumber || "—"
  },
  {
    header: "Created At",
    accessorKey: "createdAt",
    size: 120,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    enableSorting: true
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false
  },
];

function RowActions({ row }: { row: Row<SocialSecurityInstitutionRow> }) {
  const institution = row.original;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("master.social-security.update");
  const canDelete = hasPermission("master.social-security.delete");
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  if (!canEdit && !canDelete) {
    return null;
  }

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateSocialSecurityInstitution(institution.id, formData);
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
      const result = await deleteSocialSecurityInstitution(institution.id);
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
            <DropdownMenuItem onClick={() => setEditDialog(true)}>
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
            <DialogTitle>Edit Social Security Institution</DialogTitle>
            <DialogDescription>Update the institution details</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input name="code" defaultValue={institution.code} disabled={isPending} required />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input name="name" defaultValue={institution.name} disabled={isPending} required />
                </div>
                <div className="space-y-2">
                  <Label>Province</Label>
                  <Input name="province" defaultValue={institution.province || ""} disabled={isPending} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input name="status" defaultValue={institution.status} disabled={isPending} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input name="website" type="url" defaultValue={institution.website || ""} disabled={isPending} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input name="contactNumber" defaultValue={institution.contactNumber || ""} disabled={isPending} />
                </div>
                <div className="space-y-2">
                  <Label>Contribution Rate (%)</Label>
                  <Input name="contributionRate" type="number" step="0.01" defaultValue={institution.contributionRate} disabled={isPending} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Address</Label>
                  <Input name="address" defaultValue={institution.address || ""} disabled={isPending} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Input name="description" defaultValue={institution.description || ""} disabled={isPending} />
                </div>
              </div>
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
            <AlertDialogTitle>Delete Social Security Institution</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{institution.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

