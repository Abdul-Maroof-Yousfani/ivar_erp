"use client";

import { useState, useCallback, useTransition, useEffect, useMemo } from "react";
import { StockLedgerEntry, MovementType } from "@/lib/api";
import { getStockLedger, queueStockLedgerExport } from "@/lib/actions/stock-ledger";
import { getLocations } from "@/lib/actions/location";
import { ColumnDef, PaginationState } from "@tanstack/react-table";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ArrowLeftRight,
    SlidersHorizontal,
    ExternalLink,
    TrendingDown,
    TrendingUp,
    Upload,
    Loader2,
    Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { StockBulkUploadModal } from "@/components/inventory/stock-bulk-upload-modal";
import { useUploadProgress } from "@/hooks/use-upload-progress";

// ─── Reference type → navigable route ────────────────────────────────
function getReferenceHref(referenceType: string, referenceId: string): string | null {
    switch (referenceType) {
        case "GRN":
            return `/erp/procurement/grn/${referenceId}`;
        case "PURCHASE_RETURN_LC":
        case "PURCHASE_RETURN":
        case "PURCHASE_RETURN_GRN":
            return `/erp/procurement/purchase-returns/${referenceId}`;
        case "TRANSFER_REQUEST":
        case "RETURN_REQUEST":
        case "OUTLET_TRANSFER_IN":
        case "OUTLET_TRANSFER_OUT":
            return `/erp/inventory/transactions/stock-transfer/slip/${referenceId}`;
        case "LANDED_COST":
            return `/erp/procurement/landed-cost`;
        case "DELIVERY_CHALLAN":
            return `/erp/inventory/transactions/delivery-note`;
        default:
            return null;
    }
}

// ─── Movement type config ─────────────────────────────────────────────
const MOVEMENT_META: Record<
    string,
    { label: string; badgeClass: string; rowClass: string; icon: React.ReactNode }
> = {
    INBOUND: {
        label: "Inbound",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        rowClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
        icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
    },
    OUTBOUND: {
        label: "Outbound",
        badgeClass: "bg-red-100 text-red-800 border-red-300",
        rowClass: "bg-red-50/40 dark:bg-red-950/20",
        icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
    },
    TRANSFER: {
        label: "Transfer",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        rowClass: "bg-blue-50/30 dark:bg-blue-950/20",
        icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
    },
    ADJUSTMENT: {
        label: "Adjustment",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        rowClass: "bg-amber-50/30 dark:bg-amber-950/20",
        icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
    },
    OPENING_BALANCE: {
        label: "Opening Balance",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
        rowClass: "bg-purple-50/30 dark:bg-purple-950/20",
        icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
    },
};

// ─── Columns ──────────────────────────────────────────────────────────
export const columns: ColumnDef<StockLedgerEntry>[] = [
    {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="text-sm tabular-nums font-medium whitespace-nowrap">
                    {format(new Date(row.original.createdAt), "dd MMM yyyy")}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(row.original.createdAt), "HH:mm")}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "sku",
        header: "Item",
        accessorFn: (row) => row.item?.sku ?? row.itemId,
        cell: ({ row }) => (
            <div className="flex flex-col min-w-35">
                <span className="font-semibold text-sm font-mono">
                    {row.original.item?.sku || row.original.itemId}
                </span>
                {row.original.item?.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-50">
                        {row.original.item.description}
                    </span>
                )}
            </div>
        ),
    },
    {
        accessorKey: "warehouse",
        header: "Warehouse / Location",
        accessorFn: (row) => row.warehouse?.name ?? row.warehouseId,
        cell: ({ row }) => {
            const qty = Number(row.original.qty);
            const refType = row.original.referenceType;
            const isTransfer = refType === "TRANSFER_REQUEST";
            const isInbound = qty >= 0;
            const locationName = row.original.location?.name;

            // For POS Sale, Outlet Transfer In/Out — show only location, hide warehouse
            const locationOnlyTypes = ["POS_SALE", "POS_RETURN", "OUTLET_TRANSFER_IN", "OUTLET_TRANSFER_OUT", "POS_CLAIM_APPROVED"];
            const showLocationOnly = locationOnlyTypes.includes(refType) && locationName;

            if (showLocationOnly) {
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {locationName}
                        </span>
                        {(refType === "OUTLET_TRANSFER_IN" || refType === "OUTLET_TRANSFER_OUT") && (
                            <span className={cn(
                                "text-xs font-medium flex items-center gap-1",
                                isInbound ? "text-emerald-600" : "text-red-600"
                            )}>
                                {isInbound
                                    ? <><TrendingDown className="h-3 w-3" /> Receiving at outlet</>
                                    : <><TrendingUp className="h-3 w-3" /> Dispatching from outlet</>
                                }
                            </span>
                        )}
                    </div>
                );
            }

            return (
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                        {row.original.warehouse?.name || row.original.warehouseId}
                    </span>
                    {locationName && (
                        <span className="text-xs text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {locationName}
                        </span>
                    )}
                    {isTransfer && !locationName && (
                        <span className={cn(
                            "text-xs font-medium flex items-center gap-1",
                            isInbound ? "text-emerald-600" : "text-red-600"
                        )}>
                            {isInbound
                                ? <><TrendingDown className="h-3 w-3" /> Receiving</>
                                : <><TrendingUp className="h-3 w-3" /> Dispatching</>
                            }
                        </span>
                    )}
                    {isTransfer && locationName && (
                        <span className={cn(
                            "text-xs font-medium flex items-center gap-1",
                            isInbound ? "text-emerald-600" : "text-red-600"
                        )}>
                            {isInbound
                                ? <><TrendingDown className="h-3 w-3" /> Receiving at outlet</>
                                : <><TrendingUp className="h-3 w-3" /> Dispatching from outlet</>
                            }
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "movementType",
        header: "Direction",
        cell: ({ row }) => {
            const qty = Number(row.original.qty);
            const isOut = qty < 0;
            const meta = MOVEMENT_META[row.original.movementType] ?? {
                label: row.original.movementType,
                badgeClass: "bg-muted text-muted-foreground border-border",
                rowClass: "",
                icon: null,
            };

            return (
                <div className="flex flex-col gap-1 items-start">
                    <Badge
                        variant="outline"
                        className={cn("flex items-center gap-1 w-fit text-xs font-semibold px-2 py-0.5", meta.badgeClass)}
                    >
                        {meta.icon}
                        {meta.label}
                    </Badge>
                    {["TRANSFER_REQUEST", "RETURN_REQUEST", "OUTLET_TRANSFER_IN", "OUTLET_TRANSFER_OUT"].includes(row.original.referenceType) && (
                        <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            isOut
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        )}>
                            {isOut ? "← OUT" : "→ IN"}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "qty",
        header: "Qty",
        cell: ({ row }) => {
            const qty = Number(row.original.qty);
            const isOut = qty < 0;
            return (
                <div className="flex items-center gap-1">
                    {isOut
                        ? <ArrowUpCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        : <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    }
                    <span className={cn(
                        "font-bold tabular-nums text-sm",
                        isOut ? "text-red-600" : "text-emerald-600"
                    )}>
                        {isOut ? "" : "+"}{qty.toFixed(2)}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "rate",
        header: "Unit Price",
        cell: ({ row }) => (
            <span className="text-sm tabular-nums text-right block text-muted-foreground">
                {row.original.rate
                    ? Number(row.original.rate).toLocaleString("en-PK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })
                    : "—"}
            </span>
        ),
    },
    {
        accessorKey: "totalCost",
        header: "Total (PKR)",
        accessorFn: (row) =>
            row.rate && row.qty ? Number(row.rate) * Number(row.qty) : null,
        cell: ({ row }) => {
            const total =
                row.original.rate && row.original.qty
                    ? Math.abs(Number(row.original.rate) * Number(row.original.qty))
                    : null;
            return (
                <span className="text-sm tabular-nums font-semibold text-right block">
                    {total != null
                        ? total.toLocaleString("en-PK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })
                        : "—"}
                </span>
            );
        },
    },
    {
        accessorKey: "referenceType",
        header: "Source",
        cell: ({ row }) => {
            const refType = row.original.referenceType;
            const labels: Record<string, string> = {
                GRN: "GRN",
                POS_SALE: "POS Sale",
                POS_RETURN: "POS Return",
                POS_VOID: "POS Void",
                TRANSFER_REQUEST: "Transfer",
                RETURN_REQUEST: "Return Transfer",
                OUTLET_TRANSFER_IN: "Outlet Transfer In",
                OUTLET_TRANSFER_OUT: "Outlet Transfer Out",
                STOCK_MOVEMENT: "Stock Movement",
                RETURN_MOVEMENT: "Return Movement",
                ADJUSTMENT: "Adjustment",
                LANDED_COST: "Landed Cost",
                OPENING_BALANCE: "Opening Bal.",
                DELIVERY_CHALLAN: "Delivery Challan",
                PURCHASE_RETURN_LC: "Purchase Return",
                PURCHASE_RETURN_GRN: "Purchase Return",
                PURCHASE_RETURN: "Purchase Return",
                BULK_STOCK_UPLOAD: "Bulk Upload",
                POS_CLAIM_APPROVED: "POS Claim Return",
                CLAIM_ACKNOWLEDGED: "Claim Acknowledged",
            };
            return (
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                    {labels[refType] ?? refType}
                </span>
            );
        },
    },
    {
        accessorKey: "referenceId",
        header: "Reference",
        cell: ({ row }) => {
            const { referenceType, referenceId } = row.original;
            const href = getReferenceHref(referenceType, referenceId);
            const shortId = `#${referenceId.slice(0, 8)}`;

            if (href) {
                return (
                    <Link
                        href={href}
                        className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        title={`View ${referenceType}: ${referenceId}`}
                    >
                        {shortId}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                );
            }

            return (
                <span className="font-mono text-xs text-muted-foreground" title={referenceId}>
                    {shortId}
                </span>
            );
        },
    },
];

// ─── Filter options ───────────────────────────────────────────────────
const MOVEMENT_FILTER_OPTIONS = [
    { label: "Inbound", value: MovementType.INBOUND },
    { label: "Outbound", value: MovementType.OUTBOUND },
    { label: "Transfer", value: MovementType.TRANSFER },
    { label: "Adjustment", value: MovementType.ADJUSTMENT },
    { label: "Opening Balance", value: MovementType.OPENING_BALANCE },
];

const REFERENCE_TYPE_OPTIONS = [
    { label: "GRN", value: "GRN" },
    { label: "POS Sale", value: "POS_SALE" },
    { label: "POS Return", value: "POS_RETURN" },
    { label: "POS Void", value: "POS_VOID" },
    { label: "Transfer", value: "TRANSFER_REQUEST" },
    { label: "Adjustment", value: "ADJUSTMENT" },
    { label: "Landed Cost", value: "LANDED_COST" },
    { label: "Opening Balance", value: "OPENING_BALANCE" },
    { label: "Delivery Challan", value: "DELIVERY_CHALLAN" },
    { label: "Purchase Return", value: "PURCHASE_RETURN" },
    { label: "Bulk Upload", value: "BULK_STOCK_UPLOAD" },
];

// ─── Background progress button label ────────────────────────────────
function getProgressLabel(status: string | undefined, progress: number): string {
    switch (status) {
        case "failed":     return "Upload Failed";
        case "completed":  return "Upload Complete";
        case "validated":  return "Validation Complete";
        case "validating": return `Validating ${progress}%`;
        case "processing": return `Importing ${progress}%`;
        case "pending":    return "Starting...";
        default:           return `Uploading ${progress}%`;
    }
}

// ─── Main Component ───────────────────────────────────────────────────
interface StockReceivedListProps {
    initialEntries: StockLedgerEntry[];
    initialMeta?: { total: number; page: number; limit: number; totalPages: number };
}

const STORAGE_KEY = "active_stock_upload_id";

export function StockReceivedList({ initialEntries, initialMeta }: StockReceivedListProps) {
    const [entries, setEntries] = useState<StockLedgerEntry[]>(initialEntries);
    const [meta, setMeta] = useState(
        initialMeta ?? { total: initialEntries.length, page: 1, limit: 50, totalPages: 1 }
    );
    const [isPending, startTransition] = useTransition();

    const [activeMovementType, setActiveMovementType] = useState<string>("");
    const [activeReferenceType, setActiveReferenceType] = useState<string>("");
    const [activeLocationId, setActiveLocationId] = useState<string>("");
    const [locations, setLocations] = useState<{ label: string; value: string }[]>([]);
    const [search, setSearch] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        async function loadLocations() {
            const res = await getLocations();
            if (res.status && res.data) {
                setLocations(res.data.map(loc => ({ label: loc.name, value: loc.id })));
            }
        }
        loadLocations();
    }, []);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const filters = {
                movementType: activeMovementType && activeMovementType !== "all" ? (activeMovementType as any) : undefined,
                referenceType: activeReferenceType && activeReferenceType !== "all" ? activeReferenceType : undefined,
                locationId: activeLocationId && activeLocationId !== "all" ? activeLocationId : undefined,
                search: search || undefined,
            };
            const result = await queueStockLedgerExport(filters);
            if (result.status) {
                toast.success("Export queued — you'll get a notification when your file is ready.", {
                    duration: 6000,
                });
            } else {
                toast.error(result.message || "Failed to queue export");
            }
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    // ── Bulk upload state ─────────────────────────────────────────────
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    // Restore persisted upload ID on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setActiveUploadId(stored);
    }, []);

    const handleUploadIdChange = (id: string | null) => {
        setActiveUploadId(id);
        if (id) {
            localStorage.setItem(STORAGE_KEY, id);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const { data: uploadProgress } = useUploadProgress(activeUploadId, "stock");

    const isUploadActive = Boolean(
        activeUploadId &&
        uploadProgress?.status &&
        !["completed", "failed", "cancelled"].includes(uploadProgress.status)
    );

    // ── Ledger fetch ──────────────────────────────────────────────────
    const fetchPage = useCallback(
        (pagination: PaginationState, movementType?: string, referenceType?: string, locationId?: string, searchStr?: string) => {
            startTransition(async () => {
                const result = await getStockLedger({
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    movementType:
                        movementType && movementType !== "all"
                            ? (movementType as MovementType)
                            : undefined,
                    referenceType:
                        referenceType && referenceType !== "all" ? referenceType : undefined,
                    locationId:
                        locationId && locationId !== "all" ? locationId : undefined,
                    search: searchStr || undefined,
                });
                if (result?.status !== false) {
                    setEntries(result.data ?? []);
                    setMeta(result.meta ?? meta);
                }
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const handlePaginationChange = useCallback(
        (pagination: PaginationState) => {
            fetchPage(pagination, activeMovementType, activeReferenceType, activeLocationId, search);
        },
        [activeMovementType, activeReferenceType, activeLocationId, search, fetchPage]
    );

    const handleFilterChange = useCallback(
        (key: string, value: string) => {
            const newMovement = key === "movementType" ? value : activeMovementType;
            const newRefType  = key === "referenceType" ? value : activeReferenceType;
            const newLocation = key === "locationId" ? value : activeLocationId;

            if (key === "movementType") setActiveMovementType(value);
            if (key === "referenceType") setActiveReferenceType(value);
            if (key === "locationId") setActiveLocationId(value);

            fetchPage({ pageIndex: 0, pageSize: meta.limit }, newMovement, newRefType, newLocation, search);
        },
        [activeMovementType, activeReferenceType, activeLocationId, meta.limit, search, fetchPage]
    );

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearch(value);
            fetchPage({ pageIndex: 0, pageSize: meta.limit }, activeMovementType, activeReferenceType, activeLocationId, value);
        },
        [activeMovementType, activeReferenceType, activeLocationId, meta.limit, fetchPage]
    );

    // ── Toolbar slot injected into DataTable ──────────────────────────
    const toolbarSlot = (
        <div className="flex items-center gap-2">
            {/* Background progress pill — visible when modal is closed but job is running */}
            {activeUploadId && !isBulkUploadOpen && (
                <Button
                    variant={
                        uploadProgress?.status === "failed"
                            ? "destructive"
                            : uploadProgress?.status === "completed"
                            ? "default"
                            : "outline"
                    }
                    className={cn(
                        "relative overflow-hidden min-w-47.5",
                        uploadProgress?.status !== "failed" &&
                        uploadProgress?.status !== "completed" &&
                        "border-primary text-primary"
                    )}
                    onClick={() => setIsBulkUploadOpen(true)}
                >
                    {/* Animated fill bar */}
                    <div
                        className="absolute inset-0 bg-primary/10 transition-all duration-500"
                        style={{ width: `${uploadProgress?.progress ?? 0}%` }}
                    />
                    <div className="relative flex items-center gap-2">
                        {isUploadActive && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span className="font-bold">
                            {getProgressLabel(uploadProgress?.status, uploadProgress?.progress ?? 0)}
                        </span>
                    </div>
                </Button>
            )}

            {/* Export button */}
            <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || entries.length === 0}
                className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 gap-2"
            >
                {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Download className="h-4 w-4" />
                )}
                {isExporting ? "Queuing…" : "Export"}
            </Button>

            {/* Primary bulk upload button */}
            <Button
                variant="outline"
                onClick={() => setIsBulkUploadOpen(true)}
                className="gap-2"
            >
                <Upload className="h-4 w-4" />
                Bulk Upload
            </Button>
        </div>
    );

    const flattenedEntries = useMemo(() => {
        return entries.map((entry) => {
            const dateStr = entry.createdAt
                ? format(new Date(entry.createdAt), "dd MMM yyyy HH:mm")
                : "";
            return {
                ...entry,
                sku: entry.item?.sku || entry.itemId || "",
                itemDescription: entry.item?.description || "",
                warehouseName: entry.warehouse?.name || entry.warehouseId || "",
                locationName: entry.location?.name || "",
                referenceIdStr: entry.referenceId || "",
                referenceTypeStr: entry.referenceType || "",
                dateStr,
            };
        });
    }, [entries]);

    return (
        <>
            <DataTable
                tableId="stock-ledger"
                title="Stock Ledger"
                columns={columns}
                data={flattenedEntries}
                isLoading={isPending}
                rowClassName={(row) => {
                    const qty = Number(row.qty);
                    const isTransferType = [
                        "TRANSFER_REQUEST",
                        "RETURN_REQUEST",
                        "OUTLET_TRANSFER_IN",
                        "OUTLET_TRANSFER_OUT",
                    ].includes(row.referenceType);
                    if (isTransferType) {
                        return qty >= 0
                            ? "border-l-4 border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20"
                            : "border-l-4 border-l-red-400 bg-red-50/40 dark:bg-red-950/20";
                    }
                    const moveMeta = MOVEMENT_META[row.movementType];
                    return moveMeta?.rowClass ?? "";
                }}
                searchFields={[
                    { key: "sku", label: "SKU" },
                    { key: "itemDescription", label: "Item" },
                    { key: "warehouseName", label: "Warehouse" },
                    { key: "locationName", label: "Location" },
                    { key: "referenceIdStr", label: "Ref ID" },
                    { key: "referenceTypeStr", label: "Source" },
                    { key: "dateStr", label: "Date" },
                    { key: "movementType", label: "Direction" },
                ]}
                filters={[
                    {
                        key: "movementType",
                        label: "Movement",
                        options: MOVEMENT_FILTER_OPTIONS,
                    },
                    {
                        key: "referenceType",
                        label: "Source",
                        options: REFERENCE_TYPE_OPTIONS,
                    },
                    {
                        key: "locationId",
                        label: "Outlet Location",
                        options: locations,
                    },
                ]}
                filterSlot={toolbarSlot}
                onFilterChange={handleFilterChange}
                manualPagination
                rowCount={meta.total}
                pageCount={meta.totalPages}
                onPaginationChange={handlePaginationChange}
                manualFiltering
                onSearchChange={handleSearchChange}
            />

            <StockBulkUploadModal
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                uploadId={activeUploadId}
                onUploadIdChange={handleUploadIdChange}
                onSuccess={() => {
                    // Refresh the first page of the ledger after a successful import
                    fetchPage(
                        { pageIndex: 0, pageSize: meta.limit },
                        activeMovementType,
                        activeReferenceType,
                        activeLocationId,
                        search,
                    );
                    handleUploadIdChange(null);
                }}
            />
        </>
    );
}
