"use client";

import { useState, useEffect, useCallback } from "react";
import { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Loader2, Eye, Edit, Trash2, Sparkles, Filter, X, ChevronRight, Search } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { brandApi, categoryApi, silhouetteApi, genderApi } from "@/lib/api";
import { BarcodePrintModal } from "@/components/items/barcode-print-modal";
import { ScanBarcode } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Item {
    id: string;
    itemId: string;
    sku: string;
    barCode: string | null;
    description: string | null;
    unitPrice: number;
    isActive: boolean;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    division?: { name: string } | null;
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

interface AppliedFilters {
    brandIds: string[];
    categoryIds: string[];
    silhouetteIds: string[];
    genderIds: string[];
}

interface FilterSheetProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    brands: any[];
    categories: any[];
    silhouettes: any[];
    genders: any[];
    pendingBrandIds: string[];
    pendingCategoryIds: string[];
    pendingSilhouetteIds: string[];
    pendingGenderIds: string[];
    setPendingBrandIds: (v: string[]) => void;
    setPendingCategoryIds: (v: string[]) => void;
    setPendingSilhouetteIds: (v: string[]) => void;
    setPendingGenderIds: (v: string[]) => void;
    onApply: (f: AppliedFilters) => void;
    onClear: () => void;
}

function FilterSheet({
    open, onOpenChange, brands, categories, silhouettes, genders,
    pendingBrandIds, pendingCategoryIds, pendingSilhouetteIds, pendingGenderIds,
    setPendingBrandIds, setPendingCategoryIds, setPendingSilhouetteIds, setPendingGenderIds,
    onApply, onClear,
}: FilterSheetProps) {
    const [filterSearch, setFilterSearch] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

    const sections = [
        { key: "brand", label: "Brand", items: brands, ids: pendingBrandIds, setIds: setPendingBrandIds },
        { key: "category", label: "Category", items: categories, ids: pendingCategoryIds, setIds: setPendingCategoryIds },
        { key: "silhouette", label: "Silhouette", items: silhouettes, ids: pendingSilhouetteIds, setIds: setPendingSilhouetteIds },
        { key: "gender", label: "Gender", items: genders, ids: pendingGenderIds, setIds: setPendingGenderIds },
    ] as const;

    const totalPending =
        pendingBrandIds.length + pendingCategoryIds.length +
        pendingSilhouetteIds.length + pendingGenderIds.length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-90 sm:w-100 flex flex-col p-0">
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        Filter Items
                        {totalPending > 0 && (
                            <Badge className="h-5 text-[10px] px-1.5 bg-primary text-primary-foreground">
                                {totalPending}
                            </Badge>
                        )}
                    </SheetTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search across all filters..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="pl-9 h-9 text-sm"
                        />
                        {filterSearch && (
                            <button
                                type="button"
                                onClick={() => setFilterSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </SheetHeader>
                <ScrollArea className="flex-1 px-5 py-3">
                    <div className="space-y-3">
                        {sections.map(({ key, label, items, ids, setIds }) => {
                            const filtered = filterSearch
                                ? items.filter((i: any) =>
                                    i.name.toLowerCase().includes(filterSearch.toLowerCase())
                                )
                                : items;
                            if (filtered.length === 0) return null;
                            const isCollapsed = collapsed[key];
                            return (
                                <div key={key} className="rounded-md border border-border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggle(key)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{label}</span>
                                            {ids.length > 0 && (
                                                <Badge variant="secondary" className="h-4 text-[10px] px-1">
                                                    {ids.length}
                                                </Badge>
                                            )}
                                        </div>
                                        <ChevronRight
                                            className={cn(
                                                "h-4 w-4 text-muted-foreground transition-transform",
                                                !isCollapsed && "rotate-90",
                                            )}
                                        />
                                    </button>
                                    {!isCollapsed && (
                                        <div className="p-3">
                                            <ScrollArea className="h-40">
                                                <div className="flex flex-wrap gap-1.5 pr-3">
                                                    {filtered.map((item: any) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() =>
                                                                (setIds as any)((prev: string[]) =>
                                                                    prev.includes(item.id)
                                                                        ? prev.filter((x: string) => x !== item.id)
                                                                        : [...prev, item.id],
                                                                )
                                                            }
                                                            className={cn(
                                                                "px-2.5 py-1 rounded-full text-xs border transition-all",
                                                                ids.includes(item.id)
                                                                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                                                                    : "bg-background border-border hover:border-primary/60 hover:bg-primary/5",
                                                            )}
                                                        >
                                                            {item.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <SheetFooter className="px-5 py-4 border-t flex-row gap-2">
                    <Button
                        className="flex-1"
                        onClick={() =>
                            onApply({
                                brandIds: pendingBrandIds,
                                categoryIds: pendingCategoryIds,
                                silhouetteIds: pendingSilhouetteIds,
                                genderIds: pendingGenderIds,
                            })
                        }
                    >
                        Apply Filters
                    </Button>
                    <Button variant="outline" onClick={onClear}>
                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// ─── Column Definitions ───────────────────────────────────────────────────────

function useItemColumns(onDelete: (id: string) => void, canUpdate: boolean, canDelete: boolean): ColumnDef<Item>[] {
    return [
        {
            accessorKey: "sku",
            header: "SKU / Description",
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-sm font-medium">{row.original.sku}</span>
                    {row.original.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {row.original.description}
                        </span>
                    )}
                </div>
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
    filters: AppliedFilters,
) => ["items", { page, pageSize, search, sortBy, sortOrder, filters }] as const;

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
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

    // ── Filter state ───────────────────────────────────────────────────────
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [silhouettes, setSilhouettes] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    // Pending = staged in sheet; applied = sent to API
    const [pendingBrandIds, setPendingBrandIds] = useState<string[]>([]);
    const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);
    const [pendingSilhouetteIds, setPendingSilhouetteIds] = useState<string[]>([]);
    const [pendingGenderIds, setPendingGenderIds] = useState<string[]>([]);
    const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
        brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [],
    });

    const activeFilterCount =
        appliedFilters.brandIds.length + appliedFilters.categoryIds.length +
        appliedFilters.silhouetteIds.length + appliedFilters.genderIds.length;
    // Persist and recover active uploadId
    useEffect(() => {
        const stored = localStorage.getItem("active_item_upload_id");
        if (stored) setActiveUploadId(stored);
    }, []);

    // ── Load master data for filters ───────────────────────────────────────
    useEffect(() => {
        Promise.allSettled([
            brandApi.getAll(),
            categoryApi.getAll(),
            silhouetteApi.getAll(),
            genderApi.getAll(),
        ]).then(([b, c, s, g]) => {
            if (b.status === "fulfilled" && b.value.status) setBrands(b.value.data);
            if (c.status === "fulfilled" && c.value.status) setCategories(c.value.data);
            if (s.status === "fulfilled" && s.value.status) setSilhouettes(s.value.data);
            if (g.status === "fulfilled" && g.value.status) setGenders(g.value.data);
        });
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
        queryKey: itemsQueryKey(currentPage, pageSize, search, sortColumn, sortDir, appliedFilters),
        queryFn: () => getItems(currentPage, pageSize, search || undefined, sortColumn, sortDir, {
            brandIds: appliedFilters.brandIds.length ? appliedFilters.brandIds : undefined,
            categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
            silhouetteIds: appliedFilters.silhouetteIds.length ? appliedFilters.silhouetteIds : undefined,
            genderIds: appliedFilters.genderIds.length ? appliedFilters.genderIds : undefined,
        }),
        placeholderData: keepPreviousData,
        staleTime: 30_000, // 30 s — treat cached pages as fresh for 30 s
        initialData:
            currentPage === 1 &&
                pageSize === 50 &&
                !search &&
                sortColumn === "createdAt" &&
                sortDir === "desc" &&
                activeFilterCount === 0
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
                queryKey: itemsQueryKey(currentPage + 1, pageSize, search, sortColumn, sortDir, appliedFilters),
                queryFn: () =>
                    getItems(currentPage + 1, pageSize, search || undefined, sortColumn, sortDir, {
                        brandIds: appliedFilters.brandIds.length ? appliedFilters.brandIds : undefined,
                        categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
                        silhouetteIds: appliedFilters.silhouetteIds.length ? appliedFilters.silhouetteIds : undefined,
                        genderIds: appliedFilters.genderIds.length ? appliedFilters.genderIds : undefined,
                    }),
                staleTime: 30_000,
            });
        }
    }, [currentPage, pageSize, search, sortColumn, sortDir, appliedFilters, meta.totalPages, queryClient]);

    // ── Reset to page 1 on search/sort/filter change ──────────────────────
    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [search, sortColumn, sortDir, appliedFilters]);

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

    // ── Filter handlers ────────────────────────────────────────────────────
    const handleApplyFilters = (filters: AppliedFilters) => {
        setAppliedFilters(filters);
        setIsFilterOpen(false);
    };

    const handleClearFilters = () => {
        setPendingBrandIds([]);
        setPendingCategoryIds([]);
        setPendingSilhouetteIds([]);
        setPendingGenderIds([]);
        setAppliedFilters({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });
    };

    // ── Filter slot (injected into DataTable toolbar) ──────────────────────
    const filterSlot = (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative inline-flex">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1.5"
                            onClick={() => {
                                setPendingBrandIds(appliedFilters.brandIds);
                                setPendingCategoryIds(appliedFilters.categoryIds);
                                setPendingSilhouetteIds(appliedFilters.silhouetteIds);
                                setPendingGenderIds(appliedFilters.genderIds);
                                setIsFilterOpen(true);
                            }}
                        >
                            <Filter className="h-3.5 w-3.5" /> Filter
                        </Button>
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>Filter by brand, category, silhouette or gender</TooltipContent>
            </Tooltip>
            {activeFilterCount > 0 && (
                <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                    <X className="h-3 w-3" /> Clear filters
                </button>
            )}
        </>
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
                    <Button variant="outline" onClick={() => setIsBarcodeModalOpen(true)} disabled={items.length === 0}>
                        <ScanBarcode className="mr-2 h-4 w-4" /> Print Barcodes
                    </Button>
                    {canUpdate && (
                        <Link href="/erp/items/bulk-discount" transitionTypes={["nav-forward"]}>
                            <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/5">
                                <Sparkles className="mr-2 h-4 w-4" /> Bulk Discount
                            </Button>
                        </Link>
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
                        { key: "sku", label: "SKU" },
                        { key: "description", label: "Description" },
                        { key: "brand", label: "Brand" },
                        { key: "category", label: "Category" },
                        { key: "division", label: "Division" },
                    ]}
                    filterSlot={filterSlot}
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

            <FilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                brands={brands}
                categories={categories}
                silhouettes={silhouettes}
                genders={genders}
                pendingBrandIds={pendingBrandIds}
                pendingCategoryIds={pendingCategoryIds}
                pendingSilhouetteIds={pendingSilhouetteIds}
                pendingGenderIds={pendingGenderIds}
                setPendingBrandIds={setPendingBrandIds}
                setPendingCategoryIds={setPendingCategoryIds}
                setPendingSilhouetteIds={setPendingSilhouetteIds}
                setPendingGenderIds={setPendingGenderIds}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
            />

            <BarcodePrintModal
                open={isBarcodeModalOpen}
                onOpenChange={setIsBarcodeModalOpen}
                items={items}
            />
        </Card>
    );
}
