"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
    CheckCircle,
    Trash,
    Loader2,
    ArrowLeft,
    AlertCircle,
    Printer,
    Repeat,
    ClipboardList,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    submitStockAdjustment,
    rejectStockAdjustment,
    deleteStockAdjustment,
    StockAdjustment,
} from "@/lib/actions/stock-adjustment";
import { printStockAdjustmentNote } from "@/lib/utils/print-stock-adjustment";
import { toast } from "sonner";

interface StockAdjustmentDetailProps {
    adjustment: StockAdjustment;
}

const STATUS_META: Record<string, { label: string; badgeClass: string }> = {
    DRAFT: {
        label: "Draft Document",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300",
    },
    PENDING_APPROVAL: {
        label: "Pending Approval",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300",
    },
    SUBMITTED: {
        label: "Posted / Approved",
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

export function StockAdjustmentDetail({ adjustment }: StockAdjustmentDetailProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const isDraft = adjustment.status === "DRAFT";
    const isPendingApproval = adjustment.status === "PENDING_APPROVAL";
    const isSwap = adjustment.adjustmentType === "SWAP";

    const [managerNotes, setManagerNotes] = useState(adjustment.notes || "");
    const [editableItems, setEditableItems] = useState<any[]>([]);

    useEffect(() => {
        if (adjustment?.items) {
            setEditableItems(
                adjustment.items.map((item) => ({
                    ...item,
                    physicalQty: Number(item.physicalQty),
                }))
            );
            setManagerNotes(adjustment.notes || "");
        }
    }, [adjustment]);

    // Handle Submit / Post
    const handleSubmit = () => {
        const confirmMsg = isPendingApproval
            ? "Are you sure you want to approve and post this stock adjustment? Stock counts will be updated."
            : "Are you sure you want to post this stock adjustment?";

        if (!confirm(confirmMsg)) return;

        startTransition(async () => {
            try {
                const payload = isPendingApproval
                    ? {
                          notes: managerNotes || undefined,
                          items: editableItems.map((item) => ({
                              itemId: item.itemId,
                              physicalQty: item.physicalQty,
                              rate: Number(item.rate),
                          })),
                      }
                    : undefined;

                const result = await submitStockAdjustment(adjustment.id, payload);
                if (result.status !== false) {
                    toast.success("Stock adjustment approved and posted successfully.");
                    router.refresh();
                } else {
                    toast.error(result.message || "Failed to submit adjustment");
                }
            } catch (error: any) {
                toast.error(error.message || "An error occurred");
            }
        });
    };

    // Handle Reject Request
    const handleReject = () => {
        if (!confirm("Are you sure you want to reject this adjustment request?")) return;

        startTransition(async () => {
            try {
                const payload = {
                    notes: managerNotes || undefined,
                };
                const result = await rejectStockAdjustment(adjustment.id, payload);
                if (result.status !== false) {
                    toast.success("Stock adjustment request rejected.");
                    router.refresh();
                } else {
                    toast.error(result.message || "Failed to reject adjustment");
                }
            } catch (error: any) {
                toast.error(error.message || "An error occurred");
            }
        });
    };

    // Handle Delete Draft
    const handleDelete = () => {
        if (!confirm("Are you sure you want to delete this draft adjustment?")) return;

        startTransition(async () => {
            try {
                const result = await deleteStockAdjustment(adjustment.id);
                if (result.status !== false) {
                    toast.success("Draft stock adjustment deleted");
                    router.push("/erp/inventory/transactions/stock-adjustment");
                } else {
                    toast.error(result.message || "Failed to delete adjustment");
                }
            } catch (error: any) {
                toast.error(error.message || "An error occurred");
            }
        });
    };

    // Calculate totals based on current state values
    const totalItems = editableItems.length;
    const valueIncrease = editableItems.reduce((acc, item) => {
        const diff = item.physicalQty - Number(item.currentQty);
        return diff > 0 ? acc + diff * Number(item.rate) : acc;
    }, 0);
    const valueDecrease = editableItems.reduce((acc, item) => {
        const diff = item.physicalQty - Number(item.currentQty);
        return diff < 0 ? acc + Math.abs(diff) * Number(item.rate) : acc;
    }, 0);
    const netChange = valueIncrease - valueDecrease;

    const statusMeta = STATUS_META[adjustment.status] ?? {
        label: adjustment.status,
        badgeClass: "bg-muted text-muted-foreground",
    };

    const locationName = adjustment.items?.find((i) => i.location?.name)?.location?.name;

    return (
        <div className="space-y-6">
            {/* Header Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/erp/inventory/transactions/stock-adjustment")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to List
                    </Button>
                    <div className="h-4 w-px bg-muted" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold tracking-tight font-mono">{adjustment.adjustmentNo}</h2>
                            <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", statusMeta.badgeClass)}>
                                {statusMeta.label}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs font-semibold px-2 py-0.5 flex items-center gap-1",
                                    isSwap
                                        ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300"
                                        : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300"
                                )}
                            >
                                {isSwap ? <Repeat className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                                {isSwap ? "Stock Swap" : "Standard Count"}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => printStockAdjustmentNote(adjustment)}
                        className="gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Print Adjustment Note
                    </Button>

                    {isDraft && (
                        <>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isPending}
                                className="gap-2"
                            >
                                <Trash className="h-4 w-4" />
                                Delete Draft
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Submit / Post Stock
                            </Button>
                        </>
                    )}

                    {isPendingApproval && (
                        <>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleReject}
                                disabled={isPending}
                                className="gap-2"
                            >
                                <Trash className="h-4 w-4" />
                                Reject Request
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Approve & Post Stock
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Alert Banners */}
            {isDraft && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                        This document is a <strong>Draft</strong>. Quantities below have not been adjusted in your stock records. Review and click "Submit / Post Stock" to apply these changes.
                    </span>
                </div>
            )}

            {isPendingApproval && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-sm dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-400">
                    <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                        This document is <strong>Pending Approval</strong> from POS/Outlet. Review details, adjust quantities if necessary, and approve or reject with instructions.
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Meta Details Card */}
                <Card className="lg:col-span-2 shadow-sm border-muted">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Adjustment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <span className="text-xs text-muted-foreground block">Store Location / Outlet</span>
                                <span className="text-sm font-semibold">{locationName || "Warehouse Direct"}</span>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground block">Warehouse</span>
                                <span className="text-sm font-semibold">
                                    {adjustment.warehouse?.name} ({adjustment.warehouse?.code})
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground block">Adjustment Date</span>
                                <span className="text-sm font-semibold">
                                    {format(new Date(adjustment.adjustmentDate || adjustment.createdAt), "dd MMM yyyy HH:mm")}
                                </span>
                            </div>
                        </div>

                        {adjustment.reason && (
                            <div>
                                <span className="text-xs text-muted-foreground block">Reason</span>
                                <span className="text-sm font-medium">{adjustment.reason}</span>
                            </div>
                        )}

                        {isPendingApproval ? (
                            <div className="space-y-1.5">
                                <label htmlFor="manager-notes" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                    Approval/Rejection Instruction Notes
                                </label>
                                <textarea
                                    id="manager-notes"
                                    rows={3}
                                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter approval instructions, rejection reasons, or remarks here..."
                                    value={managerNotes}
                                    onChange={(e) => setManagerNotes(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                        ) : (
                            adjustment.notes && (
                                <div>
                                    <span className="text-xs text-muted-foreground block">Notes / Remarks</span>
                                    <span className="text-sm font-medium">{adjustment.notes}</span>
                                </div>
                            )
                        )}
                    </CardContent>
                </Card>

                {/* Summary Calculation Card */}
                <Card className="shadow-sm border-muted h-fit">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Adjustment Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                            <span className="text-sm text-muted-foreground">Adjusted Lines</span>
                            <span className="text-sm font-semibold">{totalItems}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                            <span className="text-sm text-muted-foreground">Value Increase</span>
                            <span className="text-sm font-semibold text-emerald-600">
                                +{valueIncrease.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                            <span className="text-sm text-muted-foreground">Value Decrease</span>
                            <span className="text-sm font-semibold text-red-600">
                                -{valueDecrease.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-t-2 border-muted">
                            <span className="text-base font-bold">Net Change Value</span>
                            <span className={cn(
                                "text-base font-bold",
                                netChange >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                                {netChange >= 0 ? "+" : ""}
                                {netChange.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* List of Adjustment Lines */}
            <Card className="shadow-sm border-muted">
                <CardHeader>
                    <CardTitle className="text-lg">Adjustment Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-muted">
                                <tr>
                                    <th className="p-3 font-medium">Item Details</th>
                                    <th className="p-3 font-medium">Location</th>
                                    <th className="p-3 font-medium text-right">System Qty</th>
                                    <th className="p-3 font-medium text-right">Physical Count</th>
                                    <th className="p-3 font-medium text-right">Discrepancy Qty</th>
                                    <th className="p-3 font-medium text-right">Unit Rate</th>
                                    <th className="p-3 font-medium text-right">Difference Value (PKR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted">
                                {editableItems.map((item, idx) => {
                                    const discrepancy = item.physicalQty - Number(item.currentQty);
                                    const lineCost = discrepancy * Number(item.rate);

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-sm">{item.item?.sku}</span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-60">
                                                        {item.item?.description || "No description"}
                                                    </span>
                                                    <div className="flex gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                                                        {item.item?.color?.name && <span>Color: {item.item.color.name}</span>}
                                                        {item.item?.size?.name && <span>Size: {item.item.size.name}</span>}
                                                    </div>
                                                    {item.swapItem && (
                                                        <span className="text-[10px] mt-1 text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300 border border-amber-200/50 px-1.5 py-0.5 rounded w-fit font-medium">
                                                            Swapped with: {item.swapItem.sku}
                                                            {item.swapItem.color?.name && ` (${item.swapItem.color.name}`}
                                                            {item.swapItem.size?.name && `, ${item.swapItem.size.name})`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {item.location?.name ? (
                                                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 px-2 py-0.5 rounded">
                                                        {item.location.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Warehouse stock</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right tabular-nums text-muted-foreground font-medium">
                                                {Number(item.currentQty).toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right tabular-nums font-semibold">
                                                {isPendingApproval ? (
                                                    <input
                                                        type="number"
                                                        className="w-24 p-1 text-right text-xs font-bold border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary ml-auto"
                                                        value={item.physicalQty}
                                                        onChange={(e) => {
                                                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                                                            setEditableItems((prev) => {
                                                                const copy = [...prev];
                                                                copy[idx] = { ...copy[idx], physicalQty: val };
                                                                return copy;
                                                            });
                                                        }}
                                                        disabled={isPending}
                                                        min={0}
                                                    />
                                                ) : (
                                                    Number(item.physicalQty).toFixed(2)
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-bold tabular-nums">
                                                {discrepancy === 0 ? (
                                                    <span className="text-slate-400">0.00</span>
                                                ) : discrepancy > 0 ? (
                                                    <span className="text-emerald-600 flex items-center justify-end gap-1">
                                                        <TrendingUp className="h-3 w-3 shrink-0" />
                                                        +{discrepancy.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600 flex items-center justify-end gap-1">
                                                        <TrendingDown className="h-3 w-3 shrink-0" />
                                                        {discrepancy.toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right tabular-nums text-muted-foreground font-medium">
                                                {Number(item.rate).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={cn(
                                                "p-3 text-right tabular-nums font-bold",
                                                lineCost === 0 ? "text-slate-400" : lineCost > 0 ? "text-emerald-600" : "text-red-600"
                                            )}>
                                                {lineCost === 0 ? "" : lineCost > 0 ? "+" : ""}
                                                {lineCost.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
