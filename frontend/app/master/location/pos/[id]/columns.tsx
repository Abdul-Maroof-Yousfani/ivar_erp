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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EllipsisIcon, Loader2, Pencil, Trash2, Key } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pos, updatePos, deletePos } from "@/lib/actions/pos";
import { Company } from "@/lib/actions/companies";

export type PosRow = Pos & { id: string };

export const getColumns = (companies: Company[]): ColumnDef<PosRow>[] => [
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
        header: "Terminal ID",
        accessorKey: "posId",
        size: 100,
        enableSorting: true,
        cell: ({ row }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-bold">{row.original.posId}</code>,
    },
    {
        header: "Name",
        accessorKey: "name",
        size: 200,
        enableSorting: true,
        cell: ({ row }) => <HighlightText text={row.original.name} />,
    },
    {
        header: "Company",
        accessorKey: "companyId",
        size: 200,
        cell: ({ row }) => {
            const company = companies.find(c => c.id === row.original.companyId);
            return company?.name || <span className="text-muted-foreground italic">No Company</span>;
        },
    },
    {
        header: "Status",
        accessorKey: "status",
        size: 100,
        cell: ({ row }) => (
            <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
                {row.original.status}
            </Badge>
        ),
        enableSorting: true,
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
        cell: ({ row }) => <RowActions row={row} companies={companies} />,
        size: 60,
        enableHiding: false,
    },
];

type RowActionsProps = {
    row: Row<PosRow>;
    companies: Company[];
};

function RowActions({ row, companies }: RowActionsProps) {
    const pos = row.original;
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editDialog, setEditDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);

    const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const result = await updatePos(pos.id, {
                name: formData.get("name") as string,
                companyId: formData.get("companyId") as string,
                terminalPin: formData.get("terminalPin") as string || undefined,
                status: formData.get("status") as string,
                locationId: pos.locationId,
            });
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
            const result = await deletePos(pos.id, pos.locationId);
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
                    <DropdownMenuItem onClick={() => setEditDialog(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit / Pin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit Dialog */}
            <Dialog open={editDialog} onOpenChange={setEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit POS Terminal</DialogTitle>
                        <DialogDescription>Update terminal details and PIN</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input id="edit-name" name="name" defaultValue={pos.name} disabled={isPending} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-company">Company</Label>
                                <Select name="companyId" defaultValue={pos.companyId || ""} disabled={isPending}>
                                    <SelectTrigger id="edit-company">
                                        <SelectValue placeholder="Select Company" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map((company) => (
                                            <SelectItem key={company.id} value={company.id}>
                                                {company.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-pin">Terminal PIN (Optional)</Label>
                                <div className="relative">
                                    <Input
                                        id="edit-pin"
                                        name="terminalPin"
                                        placeholder="Leave empty to keep current"
                                        type="password"
                                        maxLength={6}
                                        disabled={isPending}
                                    />
                                    <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                                </div>
                                <p className="text-[10px] text-muted-foreground">4-6 digits numeric PIN for terminal login.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select name="status" defaultValue={pos.status} disabled={isPending}>
                                    <SelectTrigger id="edit-status">
                                        <SelectValue />
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
                        <AlertDialogTitle>Delete POS Terminal</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete terminal &quot;{pos.name}&quot; ({pos.posId})? This action cannot be undone.
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
