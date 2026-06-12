"use client";

import { useTransition } from "react";
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
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    submitStockAdjustment,
    deleteStockAdjustment,
    StockAdjustment,
} from "@/lib/actions/stock-adjustment";
import { toast } from "sonner";

interface StockAdjustmentDetailProps {
    adjustment: StockAdjustment;
}

const STATUS_META: Record<string, { label: string; badgeClass: string }> = {
    DRAFT: {
        label: "Draft Document",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300",
    },
    SUBMITTED: {
        label: "Posted / Submitted",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300",
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

    // Handle Submit / Post
    const handleSubmit = () => {
        startTransition(async () => {
            try {
                const result = await submitStockAdjustment(adjustment.id);
                if (result.status !== false) {
                    toast.success("Stock adjustment posted successfully. Stock levels updated.");
                    router.refresh();
                } else {
                    toast.error(result.message || "Failed to submit adjustment");
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

    // Calculate totals
    const totalItems = adjustment.items.length;
    const valueIncrease = adjustment.items.reduce((acc, item) => {
        const diff = Number(item.adjustedQty);
        return diff > 0 ? acc + diff * Number(item.rate) : acc;
    }, 0);
    const valueDecrease = adjustment.items.reduce((acc, item) => {
        const diff = Number(item.adjustedQty);
        return diff < 0 ? acc + Math.abs(diff) * Number(item.rate) : acc;
    }, 0);
    const netChange = valueIncrease - valueDecrease;

    const statusMeta = STATUS_META[adjustment.status] ?? {
        label: adjustment.status,
        badgeClass: "bg-muted text-muted-foreground",
    };

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
                        </div>
                    </div>
                </div>

                {isDraft && (
                    <div className="flex items-center gap-3">
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
                    </div>
                )}
            </div>

            {/* Warn user if draft */}
            {isDraft && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                        This document is a <strong>Draft</strong>. Quantities below have not been adjusted in your stock records. Review and click "Submit / Post Stock" to apply these changes.
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Meta details card */}
                <Card className="lg:col-span-2 shadow-sm border-muted">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Adjustment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-muted-foreground block">Warehouse</span>
                                <span className="text-sm font-semibold">{adjustment.warehouse?.name} ({adjustment.warehouse?.code})</span>
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

                        {adjustment.notes && (
                            <div>
                                <span className="text-xs text-muted-foreground block">Notes / Remarks</span>
                                <span className="text-sm font-medium">{adjustment.notes}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Summary calculation card */}
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

            {/* List of adjustment lines */}
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
                                {adjustment.items.map((item) => {
                                    const discrepancy = Number(item.adjustedQty);
                                    const lineCost = discrepancy * Number(item.rate);

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-sm">{item.item?.sku}</span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-60">
                                                        {item.item?.description || "No description"}
                                                    </span>
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
                                                {Number(item.physicalQty).toFixed(2)}
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
