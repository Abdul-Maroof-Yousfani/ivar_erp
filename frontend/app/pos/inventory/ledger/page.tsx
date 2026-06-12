"use client";

import { useEffect, useState, useTransition, useCallback, useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getStockLedger, queueStockLedgerExport } from "@/lib/actions/stock-ledger";
import DataTable from "@/components/common/data-table";
import { columns } from "../../../erp/inventory/transactions/stock-received/stock-received-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, ShieldCheck, Loader2, Download } from "lucide-react";
import { ManagerVerificationDialog } from "@/components/auth/manager-verification-dialog";
import { Button } from "@/components/ui/button";
import { PaginationState } from "@tanstack/react-table";
import { MovementType, StockLedgerEntry } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export default function PosStockLedgerPage() {
    const { user } = useAuth();
    const locationId = user?.terminal?.location?.id || user?.locationId;
    const isParent = user?.terminal?.isParent;

    const roleName = (user?.role?.name || "").toLowerCase().trim();
    const isCurrentUserManager =
        roleName.includes("manager") ||
        roleName.includes("admin") ||
        user?.permissions?.includes("pos.return.create") ||
        user?.permissions?.includes("*");

    const hasAccess = isParent || isCurrentUserManager;

    const [isVerified, setIsVerified] = useState(false);
    const effectiveVerified = isVerified || isCurrentUserManager;

    const [isVerifyOpen, setIsVerifyOpen] = useState(false);
    const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
    const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
    const [isPending, startTransition] = useTransition();

    const [activeMovementType, setActiveMovementType] = useState<string>("");
    const [activeReferenceType, setActiveReferenceType] = useState<string>("");
    const [search, setSearch] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    const fetchLedger = useCallback(
        (pagination: PaginationState, movementType?: string, referenceType?: string, searchStr?: string) => {
            if (!locationId || !effectiveVerified) return;
            startTransition(async () => {
                const result = await getStockLedger({
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    locationId,
                    movementType:
                        movementType && movementType !== "all"
                            ? (movementType as MovementType)
                            : undefined,
                    referenceType:
                        referenceType && referenceType !== "all" ? referenceType : undefined,
                    search: searchStr || undefined,
                });
                if (result?.status !== false) {
                    setEntries(result.data ?? []);
                    setMeta(result.meta ?? { total: (result.data ?? []).length, page: 1, limit: pagination.pageSize, totalPages: 1 });
                }
            });
        },
        [locationId, effectiveVerified]
    );

    useEffect(() => {
        if (effectiveVerified && locationId) {
            fetchLedger({ pageIndex: 0, pageSize: meta.limit }, activeMovementType, activeReferenceType, search);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveVerified, locationId]);

    const handlePaginationChange = useCallback(
        (pagination: PaginationState) => {
            fetchLedger(pagination, activeMovementType, activeReferenceType, search);
        },
        [activeMovementType, activeReferenceType, search, fetchLedger]
    );

    const handleFilterChange = useCallback(
        (key: string, value: string) => {
            const newMovement = key === "movementType" ? value : activeMovementType;
            const newRefType  = key === "referenceType" ? value : activeReferenceType;

            if (key === "movementType") setActiveMovementType(value);
            if (key === "referenceType") setActiveReferenceType(value);

            fetchLedger({ pageIndex: 0, pageSize: meta.limit }, newMovement, newRefType, search);
        },
        [activeMovementType, activeReferenceType, meta.limit, search, fetchLedger]
    );

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearch(value);
            fetchLedger({ pageIndex: 0, pageSize: meta.limit }, activeMovementType, activeReferenceType, value);
        },
        [activeMovementType, activeReferenceType, meta.limit, fetchLedger]
    );

    const handleExport = async () => {
        if (isExporting || !locationId) return;
        setIsExporting(true);
        try {
            const filters = {
                locationId,
                movementType: activeMovementType && activeMovementType !== "all" ? (activeMovementType as any) : undefined,
                referenceType: activeReferenceType && activeReferenceType !== "all" ? activeReferenceType : undefined,
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

    const toolbarSlot = (
        <div className="flex items-center gap-2">
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
        </div>
    );

    // Step 1: Terminal authorization check (Bypassed if manager is logged in)
    if (!hasAccess) {
        return (
            <div className="p-6 max-w-md mx-auto mt-20">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        Stock Ledger features are restricted. This information can only be viewed on the outlet's parent terminal.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Step 2: Manager verification check (Bypassed if logged-in user is already a manager)
    if (!effectiveVerified) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-sm mx-auto text-center gap-4">
                <div className="p-4 bg-amber-500/10 rounded-full text-amber-600">
                    <ShieldAlert className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold">Authentication Required</h2>
                <p className="text-sm text-muted-foreground">
                    This terminal is authorized, but you must verify manager credentials to access the ledger.
                </p>
                <Button onClick={() => setIsVerifyOpen(true)} className="bg-amber-600 hover:bg-amber-700 w-full font-bold">
                    Verify Manager
                </Button>

                <ManagerVerificationDialog
                    open={isVerifyOpen}
                    onOpenChange={setIsVerifyOpen}
                    onVerified={() => setIsVerified(true)}
                    title="Authorized Ledger Access"
                    description="Please enter your manager PIN/Password to load the stock records."
                />
            </div>
        );
    }

    // Step 3: Render secure ledger
    return (
        <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Outlet Stock Ledger</h1>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Showing transactions only for {user?.terminal?.location?.name || "this store"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-2.5 py-1 rounded-full font-medium border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isCurrentUserManager ? "Manager Logged In" : "Manager Session Verified"}
                </div>
            </div>
            <DataTable
                tableId="pos-stock-ledger"
                columns={columns}
                data={flattenedEntries}
                isLoading={isPending}
                searchFields={[
                    { key: "sku", label: "SKU" },
                    { key: "itemDescription", label: "Item" },
                    { key: "warehouseName", label: "Warehouse" },
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
        </div>
    );
}
