"use client";

import { useState, useCallback, useTransition } from "react";
import { ColumnDef, PaginationState } from "@tanstack/react-table";
import DataTable from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Eye, Plus, Printer, Repeat, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getStockAdjustments } from "@/lib/actions/stock-adjustment";
import { printStockAdjustmentNote } from "@/lib/utils/print-stock-adjustment";

export interface StockAdjustmentRow {
    id: string;
    adjustmentNo: string;
    warehouseId: string;
    adjustmentDate: string;
    status: "DRAFT" | "PENDING_APPROVAL" | "SUBMITTED" | "REJECTED" | "CANCELLED";
    adjustmentType?: "STANDARD" | "SWAP";
    reason: string | null;
    notes: string | null;
    createdAt: string;
    warehouse?: {
        name: string;
        code: string;
    };
    items: any[];
}

const STATUS_META: Record<string, { label: string; badgeClass: string }> = {
    DRAFT: {
        label: "Draft",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300",
    },
    PENDING_APPROVAL: {
        label: "Pending Approval",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300",
    },
    SUBMITTED: {
        label: "Submitted / Approved",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    REJECTED: {
        label: "Rejected",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300",
    },
    CANCELLED: {
        label: "Cancelled",
        badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-300",
    },
};

const columns: ColumnDef<StockAdjustmentRow>[] = [
    {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="text-sm font-medium whitespace-nowrap">
                    {format(new Date(row.original.createdAt), "dd MMM yyyy")}
                </span>
                <span className="text-xs text-muted-foreground">
                    {format(new Date(row.original.createdAt), "HH:mm")}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "adjustmentNo",
        header: "Adjustment No",
        cell: ({ row }) => (
            <span className="font-semibold font-mono text-sm">
                {row.original.adjustmentNo}
            </span>
        ),
    },
    {
        accessorKey: "adjustmentType",
        header: "Type",
        cell: ({ row }) => {
            const isSwap = row.original.adjustmentType === "SWAP";
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1 w-fit",
                        isSwap
                            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300"
                    )}
                >
                    {isSwap ? <Repeat className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                    {isSwap ? "Stock Swap" : "Standard Count"}
                </Badge>
            );
        },
    },
    {
        id: "location",
        header: "Location / Outlet",
        cell: ({ row }) => {
            const locationName =
                row.original.items?.find((i) => i.location?.name)?.location?.name;
            return (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                        {locationName || row.original.warehouse?.name || "Head Office / Warehouse"}
                    </span>
                    {locationName && row.original.warehouse?.name && (
                        <span className="text-xs text-muted-foreground">
                            Warehouse: {row.original.warehouse.name}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground truncate max-w-56 block" title={row.original.reason || ""}>
                {row.original.reason || "—"}
            </span>
        ),
    },
    {
        accessorKey: "items",
        header: "Items Count",
        cell: ({ row }) => (
            <span className="text-sm font-semibold">
                {row.original.items?.length || 0} items
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const meta = STATUS_META[row.original.status] ?? {
                label: row.original.status,
                badgeClass: "bg-muted text-muted-foreground",
            };
            return (
                <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", meta.badgeClass)}>
                    {meta.label}
                </Badge>
            );
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <div className="flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Print Adjustment Note"
                    onClick={() => printStockAdjustmentNote(row.original)}
                >
                    <Printer className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </Button>
                <Link href={`/erp/inventory/transactions/stock-adjustment/${row.original.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View Details">
                        <Eye className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        ),
    },
];

interface StockAdjustmentListProps {
    initialEntries: StockAdjustmentRow[];
    initialMeta?: { total: number; page: number; limit: number; totalPages: number };
}

export function StockAdjustmentList({ initialEntries, initialMeta }: StockAdjustmentListProps) {
    const [entries, setEntries] = useState<StockAdjustmentRow[]>(initialEntries);
    const [meta, setMeta] = useState(
        initialMeta ?? { total: initialEntries.length, page: 1, limit: 50, totalPages: 1 }
    );
    const [isPending, startTransition] = useTransition();
    const [activeStatus, setActiveStatus] = useState<string>("");

    const fetchPage = useCallback(
        (pagination: PaginationState, status?: string) => {
            startTransition(async () => {
                const result = await getStockAdjustments({
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    status: status && status !== "all" ? status : undefined,
                });
                if (result?.status !== false) {
                    setEntries(result.data ?? []);
                    setMeta(result.meta ?? meta);
                }
            });
        },
        [meta]
    );

    const handlePaginationChange = useCallback(
        (pagination: PaginationState) => {
            fetchPage(pagination, activeStatus);
        },
        [activeStatus, fetchPage]
    );

    const handleFilterChange = useCallback(
        (key: string, value: string) => {
            const newStatus = key === "status" ? value : activeStatus;
            if (key === "status") setActiveStatus(value);

            fetchPage({ pageIndex: 0, pageSize: meta.limit }, newStatus);
        },
        [activeStatus, meta.limit, fetchPage]
    );

    const toolbarSlot = (
        <div className="flex items-center gap-2">
            <Link href="/erp/inventory/transactions/stock-adjustment/new">
                <Button className="gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all">
                    <Plus className="h-4 w-4" />
                    New Adjustment
                </Button>
            </Link>
        </div>
    );

    return (
        <DataTable
            tableId="stock-adjustment-list"
            title="Stock Adjustments"
            columns={columns}
            data={entries}
            isLoading={isPending}
            searchFields={[
                { key: "adjustmentNo", label: "Adjustment No" },
                { key: "reason", label: "Reason" },
            ]}
            filters={[
                {
                    key: "status",
                    label: "Status",
                    options: [
                        { label: "Draft", value: "DRAFT" },
                        { label: "Pending Approval", value: "PENDING_APPROVAL" },
                        { label: "Submitted / Approved", value: "SUBMITTED" },
                        { label: "Rejected", value: "REJECTED" },
                        { label: "Cancelled", value: "CANCELLED" },
                    ],
                },
            ]}
            filterSlot={toolbarSlot}
            onFilterChange={handleFilterChange}
            manualPagination
            rowCount={meta.total}
            pageCount={meta.totalPages}
            onPaginationChange={handlePaginationChange}
        />
    );
}
