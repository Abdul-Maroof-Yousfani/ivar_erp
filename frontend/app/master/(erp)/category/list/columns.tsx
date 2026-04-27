"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Category, deleteCategory, updateCategory, getCategories } from "@/lib/actions/category";
import { getChartOfAccounts, ChartOfAccount } from "@/lib/actions/chart-of-account";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EllipsisIcon, Trash2, Pencil, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategoryRow = Category & { accountHeadName?: string };

// Columns for Top-level Categories
export const categoryColumns: ColumnDef<CategoryRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
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
    size: 40,
  },
  {
    id: "sn",
    header: () => <div className="text-center">S.No</div>,
    cell: ({ row, table }) => <div className="text-center">{table.getSortedRowModel().flatRows.indexOf(row) + 1}</div>,
    size: 60,
  },
  {
    accessorKey: "name",
    header: "Category Name",
  },
  {
    id: "actions",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 80,
  },
];

// Columns for Sub-categories
export const subCategoryColumns: ColumnDef<CategoryRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
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
    size: 40,
  },
  {
    id: "sn",
    header: () => <div className="text-center">S.No</div>,
    cell: ({ row, table }) => <div className="text-center">{table.getSortedRowModel().flatRows.indexOf(row) + 1}</div>,
    size: 60,
  },
  {
    id: "parent",
    accessorKey: "parent.name",
    header: "Category",
    cell: ({ row }) => row.original.parent?.name || "-",
  },
  {
    id: "accountHead",
    accessorKey: "accountHeadName",
    header: "Account Head",
    cell: ({ row }) => row.original.accountHeadName || "-",
  },
  {
    accessorKey: "name",
    header: "Sub Category Name",
  },
  {
    id: "actions",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 80,
  },
];

function RowActions({ row }: { row: Row<CategoryRow> }) {
  const item = row.original;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  
  // States for edit form
  const [name, setName] = useState(item.name);
  const [parentId, setParentId] = useState(item.parentId || "");
  const [accountHeadId, setAccountHeadId] = useState(item.accountHeadId || "");
  
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoadingDeps, setIsLoadingDeps] = useState(false);

  const isSubCategory = !!item.parentId;
  const updatePermission = isSubCategory ? "master.sub-category.update" : "master.category.update";
  const deletePermission = isSubCategory ? "master.sub-category.delete" : "master.category.delete";
  const canUpdate = hasPermission(updatePermission);
  const canDelete = hasPermission(deletePermission);

  useEffect(() => {
    if (editOpen && isSubCategory) {
      async function loadDeps() {
        setIsLoadingDeps(true);
        try {
          const [catRes, accRes] = await Promise.all([
            getCategories(),
            getChartOfAccounts()
          ]);
          if (catRes.status) setParentCategories(catRes.data);
          if (accRes.status) setAccounts(accRes.data);
        } catch (error) {
          toast.error("Failed to load dependency data");
        } finally {
          setIsLoadingDeps(false);
        }
      }
      loadDeps();
    }
  }, [editOpen, isSubCategory]);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    
    startTransition(async () => {
      const result = await deleteCategory(item.id);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await updateCategory(item.id, {
        name: name.trim(),
        parentId: isSubCategory ? parentId : undefined,
        accountHeadId: isSubCategory ? (accountHeadId === "none" ? null : accountHeadId || null) : undefined,
      });

      if (result.status) {
        toast.success(result.message);
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  if (!canUpdate && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-center">
            <Button variant="ghost" size="icon">
              <EllipsisIcon className="h-4 w-4" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {isSubCategory ? "Sub Category" : "Category"}</DialogTitle>
            <DialogDescription>
              Update the details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            {isSubCategory && (
              <>
                <div className="space-y-2">
                  <Label>Parent Category</Label>
                  <Select
                    value={parentId}
                    onValueChange={setParentId}
                    disabled={isPending || isLoadingDeps}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Head</Label>
                  <Select
                    value={accountHeadId}
                    onValueChange={setAccountHeadId}
                    disabled={isPending || isLoadingDeps}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || isLoadingDeps}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
