"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { HsCode, deleteHsCode } from "@/lib/actions/hs-code";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { EllipsisIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

export type HsCodeRow = HsCode & { id: string };

export const columns: ColumnDef<HsCodeRow>[] = [
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
        header: "HS Code",
        accessorKey: "hsCode",
        size: 150,
        enableSorting: true,
        cell: ({ row }) => <HighlightText text={row.original.hsCode} />,
    },
    {
        header: "CD (%)",
        accessorKey: "customsDutyCd",
        size: 100,
        enableSorting: true,
        cell: ({ row }) => <div>{Number(row.original.customsDutyCd).toFixed(2)}%</div>,
    },
    {
        header: "RD (%)",
        accessorKey: "regulatoryDutyRd",
        size: 100,
        enableSorting: true,
        cell: ({ row }) => <div>{Number(row.original.regulatoryDutyRd).toFixed(2)}%</div>,
    },
    {
        header: "Sales Tax (%)",
        accessorKey: "salesTax",
        size: 120,
        enableSorting: true,
        cell: ({ row }) => <div>{Number(row.original.salesTax).toFixed(2)}%</div>,
    },
    {
        header: "Income Tax (%)",
        accessorKey: "incomeTax",
        size: 120,
        enableSorting: true,
        cell: ({ row }) => <div>{Number(row.original.incomeTax).toFixed(2)}%</div>,
    },
    {
        header: "Status",
        accessorKey: "status",
        size: 100,
        enableSorting: true,
        cell: ({ row }) => {
            const status = row.original.status;
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
        size: 150,
        enableSorting: true,
        cell: ({ row }) => format(new Date(row.original.createdAt), "PPP"),
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions row={row} />,
        size: 60,
        enableHiding: false,
    },
];

function RowActions({ row }: { row: Row<HsCodeRow> }) {
    const item = row.original;
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [deleteDialog, setDeleteDialog] = useState(false);

    const canEdit = hasPermission("master.hs-code.update");
    const canDelete = hasPermission("master.hs-code.delete");

    if (!canEdit && !canDelete) return null;

    const handleDeleteConfirm = async () => {
        startTransition(async () => {
            const result = await deleteHsCode(item.id);
            if (result.status) {
                toast.success("HS Code deleted successfully");
                setDeleteDialog(false);
                router.refresh();
            } else {
                toast.error(result.message || "Failed to delete HS code");
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
                        <DropdownMenuItem onClick={() => router.push(`/master/hs-code/${item.id}`)}>
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

            <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete HS Code</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{item.hsCode}&quot;? This action cannot be undone.
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
