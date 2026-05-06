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
import { ItemSubclass, updateItemSubclass, deleteItemSubclass } from "@/lib/actions/item-subclass";
import { ItemClass } from "@/lib/actions/item-class";
import { useAuth } from "@/components/providers/auth-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SubclassRow = ItemSubclass & { id: string };

export const getColumns = (classes: ItemClass[]): ColumnDef<SubclassRow>[] => [
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
        header: "Item Class",
        accessorKey: "itemClass.name",
        size: 200,
        enableSorting: true,
        cell: ({ row }) => row.original.itemClass?.name || "—",
    },
    {
        header: "Status",
        accessorKey: "status",
        size: 150,
        enableSorting: true,
        cell: ({ row }) => (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.original.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {row.original.status || 'Active'}
            </span>
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
        header: "Created At",
        accessorKey: "createdAt",
        size: 150,
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
        enableSorting: true,
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions row={row} classes={classes} />,
        size: 60,
        enableHiding: false,
    },
];

type RowActionsProps = {
    row: Row<SubclassRow>;
    classes: ItemClass[];
};

function RowActions({ row, classes }: RowActionsProps) {
    const subclass = row.original;
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editDialog, setEditDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const { hasPermission, isAdmin } = useAuth();

    const canEdit = isAdmin() || hasPermission("master.item-subclass.update");
    const canDelete = isAdmin() || hasPermission("master.item-subclass.delete");

    if (!canEdit && !canDelete) {
        return null;
    }

    const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;
        const itemClassId = formData.get("itemClassId") as string;

        startTransition(async () => {
            const result = await updateItemSubclass(subclass.id, { name, status, itemClassId });
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
            const result = await deleteItemSubclass(subclass.id);
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
                        <DialogTitle>Edit Item Subclass</DialogTitle>
                        <DialogDescription>Update the item subclass details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Subclass Name</Label>
                                <Input
                                    id="edit-name"
                                    name="name"
                                    defaultValue={subclass.name}
                                    disabled={isPending}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-class">Item Class</Label>
                                <Select name="itemClassId" defaultValue={subclass.itemClassId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map((cls) => (
                                            <SelectItem key={cls.id} value={cls.id}>
                                                {cls.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select name="status" defaultValue={subclass.status || 'active'}>
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
                        <AlertDialogTitle>Delete Item Subclass</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{subclass.name}&quot;? This action cannot be undone.
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
