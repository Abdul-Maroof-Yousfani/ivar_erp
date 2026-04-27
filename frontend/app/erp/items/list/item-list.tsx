"use client";

import { useState, useEffect, useCallback } from "react";
import { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Loader2, Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deleteItem, getItems } from "@/lib/actions/items";
import { BulkUploadModal } from "@/components/items/bulk-upload-modal";
import { useUploadProgress } from "@/hooks/use-upload-progress";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import DataTable from "@/components/common/data-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Item {
    id: string;
    itemId: string;
    sku: string;
    description: string | null;
    unitPrice: number;
    isActive: boolean;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    division?: { name: string } | null;
}

// ─── Column Definitions ───────────────────────────────────────────────────────

function useItemColumns(onDelete: (id: string) => void, canUpdate: boolean, canDelete: boolean): ColumnDef<Item>[] {
    return [
        {
            accessorKey: "itemId",
            header: "Item ID",
            cell: ({ row }) => (
                <span className="font-medium font-mono text-sm">{row.original.itemId}</span>
            ),
        },
        {
            accessorKey: "sku",
            header: "SKU",
            cell: ({ row }) => (
                <span className="font-mono text-sm text-muted-foreground">{row.original.sku}</span>
            ),
        },
        {
            accessorKey: "brand",
            header: "Brand",
            cell: ({ row }) => row.original.brand?.name ?? <span className="text-muted-foreground">—</span>,
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => row.original.category?.name ?? <span className="text-muted-foreground">—</span>,
        },
        {
            accessorKey: "division",
            header: "Division",
            cell: ({ row }) => row.original.division?.name ?? <span className="text-muted-foreground">—</span>,
        },
        {
            accessorKey: "unitPrice",
            header: "Price",
            cell: ({ row }) => (
                <span className="font-mono text-right block">
                    {Number(row.original.unitPrice).toLocaleString("en-US", {
                        style: "currency",
                        currency: "PKR",
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "default" : "secondary"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/erp/items/view/${item.id}`} transitionTypes={["nav-forward"]}>
                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                </Link>
                            </DropdownMenuItem>
                            {canUpdate && (
                                <DropdownMenuItem asChild>
                                    <Link href={`/erp/items/edit/${item.id}`} transitionTypes={["nav-forward"]}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => onDelete(item.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}

// ─── Query Key Factory ────────────────────────────────────────────────────────

const itemsQueryKey = (
    page: number,
    pageSize: number,
    search: string,
    sortBy: string,
    sortOrder: "asc" | "desc",
) => ["items", { page, pageSize, search, sortBy, sortOrder }] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

interface ItemListProps {
    initialItems: Item[];
    initialMeta?: any;
}

export function ItemList({ initialItems, initialMeta }: ItemListProps) {
    const queryClient = useQueryClient();
    const { hasPermission } = useAuth();

    const canCreate = hasPermission("erp.item.create");
    const canUpdate = hasPermission("erp.item.update");
    const canDelete = hasPermission("erp.item.delete");
    const canBulkUpload = hasPermission("erp.item.bulk-upload");

    // ── State ──────────────────────────────────────────────────────────────
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 50,
    });
    const [sorting, setSorting] = useState<SortingState>([
        { id: "createdAt", desc: true },
    ]);
    const [search, setSearch] = useState("");
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    // Persist and recover active uploadId
    useEffect(() => {
        const stored = localStorage.getItem("active_item_upload_id");
        if (stored) setActiveUploadId(stored);
    }, []);

    const handleUploadIdChange = (id: string | null) => {
        setActiveUploadId(id);
        if (id) {
            localStorage.setItem("active_item_upload_id", id);
        } else {
            localStorage.removeItem("active_item_upload_id");
        }
    };

    const { data: uploadProgress } = useUploadProgress(activeUploadId);

    // Note: don't auto-clear on error — a transient network failure shouldn't
    // wipe the active upload ID. The user can manually dismiss via the modal.

    // ── Derived query params ───────────────────────────────────────────────
    const currentPage = pagination.pageIndex + 1; // API is 1-indexed
    const pageSize = pagination.pageSize;
    const sortColumn = sorting[0]?.id ?? "createdAt";
    const sortDir: "asc" | "desc" = sorting[0]?.desc === false ? "asc" : "desc";

    // ── Server-side fetch ──────────────────────────────────────────────────
    const { data, isLoading, isFetching } = useQuery({
        queryKey: itemsQueryKey(currentPage, pageSize, search, sortColumn, sortDir),
        queryFn: () => getItems(currentPage, pageSize, search || undefined, sortColumn, sortDir),
        placeholderData: keepPreviousData,
        staleTime: 30_000, // 30 s — treat cached pages as fresh for 30 s
        initialData:
            currentPage === 1 &&
                pageSize === 50 &&
                !search &&
                sortColumn === "createdAt" &&
                sortDir === "desc"
                ? { status: true, data: initialItems, meta: initialMeta }
                : undefined,
    });

    const items: Item[] = data?.data ?? [];
    const meta = data?.meta ?? {
        total: 0,
        page: 1,
        limit: pageSize,
        totalPages: 0,
    };

    // ── Prefetch next page ─────────────────────────────────────────────────
    useEffect(() => {
        if (currentPage < meta.totalPages) {
            queryClient.prefetchQuery({
                queryKey: itemsQueryKey(currentPage + 1, pageSize, search, sortColumn, sortDir),
                queryFn: () =>
                    getItems(currentPage + 1, pageSize, search || undefined, sortColumn, sortDir),
                staleTime: 30_000,
            });
        }
    }, [currentPage, pageSize, search, sortColumn, sortDir, meta.totalPages, queryClient]);

    // ── Reset to page 1 on search/sort change ─────────────────────────────
    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [search, sortColumn, sortDir]);

    // ── Delete handler ─────────────────────────────────────────────────────
    const handleDelete = useCallback(
        async (id: string) => {
            if (!confirm("Are you sure you want to delete this item?")) return;
            try {
                const result = await deleteItem(id);
                if (result.status) {
                    toast.success("Item deleted successfully");
                    queryClient.invalidateQueries({ queryKey: ["items"] });
                } else {
                    toast.error(result.message || "Failed to delete item");
                }
            } catch {
                toast.error("An unexpected error occurred");
            }
        },
        [queryClient],
    );

    const columns = useItemColumns(handleDelete, canUpdate, canDelete);

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div>
                    <CardTitle className="text-2xl font-bold">Items Catalog</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {meta.total > 0
                            ? `${meta.total.toLocaleString()} items total`
                            : "No items yet"}
                        {isFetching && !isLoading && (
                            <span className="ml-2 inline-flex items-center gap-1 text-primary">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Updating...
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Background upload progress button */}
                    {activeUploadId && !isBulkUploadOpen && (
                        <Button
                            variant={uploadProgress?.status === 'failed' ? 'destructive' : uploadProgress?.status === 'completed' ? 'default' : 'outline'}
                            className={`border-primary text-primary relative overflow-hidden min-w-[180px] ${uploadProgress?.status === 'failed' ? 'text-destructive-foreground! bg-destructive!' : uploadProgress?.status === 'completed' ? 'text-primary-foreground! bg-primary!' : ''}`}
                            onClick={() => setIsBulkUploadOpen(true)}
                        >
                            <div
                                className={`absolute inset-0 bg-primary/10 transition-all duration-500`}
                                style={{ width: `${uploadProgress?.progress ?? 0}%` }}
                            />
                            <div className="relative flex items-center gap-2">
                                {(uploadProgress?.status === "validating" || uploadProgress?.status === "processing" || uploadProgress?.status === "pending") && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                <span className="font-bold">
                                    {uploadProgress?.status === "failed"
                                        ? "Import Failed"
                                        : uploadProgress?.status === "completed"
                                            ? "Import Complete"
                                            : uploadProgress?.status === "validated"
                                                ? "Validation Complete"
                                                : uploadProgress?.status === "validating"
                                                    ? "Validating"
                                                    : "Importing"}
                                    {["failed", "completed", "validated"].includes(uploadProgress?.status || "") ? "" : ` ${uploadProgress?.progress ?? 0}%`}
                                </span>
                            </div>
                        </Button>
                    )}
                    {canBulkUpload && (
                        <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" /> Bulk Upload
                        </Button>
                    )}
                    {canCreate && (
                        <Link href="/erp/items/create" transitionTypes={["nav-forward"]}>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Item
                            </Button>
                        </Link>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                <DataTable
                    columns={columns}
                    data={items}
                    tableId="items-catalog"
                    searchFields={[
                        { key: "itemId", label: "Item ID" },
                        { key: "sku", label: "SKU" },
                        { key: "brand", label: "Brand" },
                        { key: "category", label: "Category" },
                        { key: "division", label: "Division" },
                    ]}
                    /* ── Server-side controls ── */
                    manualPagination
                    manualSorting
                    manualFiltering
                    rowCount={meta.total}
                    pageCount={meta.totalPages}
                    onPaginationChange={setPagination}
                    onSortingChange={setSorting}
                    onSearchChange={setSearch}
                    isLoading={isLoading}
                    /* ── Disable built-in row actions (handled via dropdown) ── */
                    canBulkEdit={false}
                    canBulkDelete={false}
                    canRowEdit={false}
                    canRowDelete={false}
                />
            </CardContent>

            <BulkUploadModal
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                uploadId={activeUploadId}
                onUploadIdChange={handleUploadIdChange}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["items"] });
                    toast.success("Item list refreshed");
                    handleUploadIdChange(null);
                }}
            />
        </Card>
    );
}
