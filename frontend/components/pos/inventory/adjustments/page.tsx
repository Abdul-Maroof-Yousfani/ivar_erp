"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    Plus, RefreshCcw, Printer, FileText, ArrowLeft,
    CalendarDays, Tag, ClipboardList, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { getStockAdjustments } from "@/lib/actions/stock-adjustment";
import { getLocationById } from "@/lib/actions/location";
import { toast } from "sonner";
import { format } from "date-fns";
import { printStockAdjustmentNote } from "@/lib/utils/print-stock-adjustment";
import Link from "next/link";

interface Adjustment {
    id: string;
    adjustmentNo: string;
    createdAt: string;
    adjustmentDate: string;
    status: "DRAFT" | "PENDING_APPROVAL" | "SUBMITTED" | "REJECTED" | "CANCELLED";
    adjustmentType: "STANDARD" | "SWAP";
    reason: string | null;
    notes: string | null;
    items: any[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300" },
    PENDING_APPROVAL: { label: "Pending Approval", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300" },
    SUBMITTED: { label: "Approved / Posted", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300" },
    REJECTED: { label: "Rejected", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300" },
    CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-950/30 dark:text-slate-300" },
};

export default function PosStockAdjustmentsPage() {
    const { user } = useAuth();
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [warehouseId, setWarehouseId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const locationId = user?.terminal?.location?.id || (user as any)?.locationId;

    const fetchAdjustments = async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getStockAdjustments({ locationId });
            if (res.status !== false) {
                setAdjustments(res.data || []);
            }
        } catch (error) {
            console.error("Failed to load adjustments", error);
            toast.error("Failed to load adjustments");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdjustments();
    }, [locationId]);

    const handlePrint = (adj: Adjustment) => {
        printStockAdjustmentNote(adj, user?.terminal?.location?.name);
    };

    if (!locationId) {
        return (
            <div className="p-6 max-w-md mx-auto mt-20">
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6 text-center space-y-4">
                        <ShieldAlert className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" />
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Terminal Context Required</h3>
                        <p className="text-sm text-red-600 dark:text-red-400">
                            Please log in from an authorized terminal session to access stock adjustments.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Adjustment Requests</h1>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Manage and request physical stock count corrections or item swapping for {user?.terminal?.location?.name || "this outlet"}.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAdjustments}
                        className="gap-2 h-9 border-muted"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <Link href="/pos/inventory/adjustments/new">
                        <Button className="gap-2 h-9 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold">
                            <Plus className="h-4 w-4" />
                            Request Adjustment
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : adjustments.length === 0 ? (
                <Card className="border-dashed border-muted py-12 text-center">
                    <CardContent className="space-y-3">
                        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/60" />
                        <h3 className="text-lg font-semibold">No adjustment requests found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            You haven't requested any stock adjustments yet. Click "Request Adjustment" to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {adjustments.map((adj) => {
                        const isExpanded = expandedId === adj.id;
                        const statusMeta = STATUS_META[adj.status] || { label: adj.status, color: "bg-muted text-muted-foreground" };
                        
                        return (
                            <Card key={adj.id} className="border-muted shadow-sm overflow-hidden hover:border-slate-300 dark:hover:border-slate-800 transition-all">
                                <CardContent className="p-0">
                                    <div 
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10"
                                        onClick={() => setExpandedId(isExpanded ? null : adj.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-600 dark:text-slate-400">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold font-mono text-sm">{adj.adjustmentNo}</span>
                                                    <Badge variant="outline" className={statusMeta.color}>
                                                        {statusMeta.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        {format(new Date(adj.createdAt), "dd MMM yyyy HH:mm")}
                                                    </span>
                                                    <span>•</span>
                                                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                                                        {adj.adjustmentType === "SWAP" ? "Stock Swap" : "Standard Count"}
                                                    </Badge>
                                                    <span>•</span>
                                                    <span>{adj.items?.length || 0} items</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePrint(adj)}
                                                className="gap-1.5 border-slate-200 dark:border-slate-800"
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Print
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setExpandedId(isExpanded ? null : adj.id)}
                                            >
                                                {isExpanded ? "Hide Details" : "Show Details"}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="border-t border-muted bg-slate-50/30 dark:bg-slate-900/10 p-4 space-y-4">
                                            {adj.reason && (
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Reason / Remarks</span>
                                                    <span className="text-sm font-medium">{adj.reason}</span>
                                                </div>
                                            )}
                                            {adj.notes && (
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Internal Notes</span>
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">{adj.notes}</span>
                                                </div>
                                            )}

                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Adjusted Items</span>
                                                <div className="border border-muted rounded-md overflow-hidden bg-white dark:bg-slate-950">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead className="bg-slate-50 dark:bg-slate-900 font-semibold border-b border-muted">
                                                            <tr>
                                                                <th className="p-2.5">Item</th>
                                                                <th className="p-2.5 text-right">System Qty</th>
                                                                <th className="p-2.5 text-right">Physical Count</th>
                                                                <th className="p-2.5 text-right">Discrepancy</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-muted">
                                                            {adj.items.map((item) => {
                                                                const discrepancy = Number(item.adjustedQty);
                                                                return (
                                                                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                                                        <td className="p-2.5">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-semibold font-mono">{item.item?.sku || item.itemId}</span>
                                                                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                                                                    {item.item?.description}
                                                                                </span>
                                                                                {item.swapItem && (
                                                                                    <span className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 px-1 py-0.2 rounded w-fit mt-0.5">
                                                                                        Swapped with: {item.swapItem.sku}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-2.5 text-right text-muted-foreground font-medium">
                                                                            {Number(item.currentQty).toFixed(2)}
                                                                        </td>
                                                                        <td className="p-2.5 text-right font-medium">
                                                                            {Number(item.physicalQty).toFixed(2)}
                                                                        </td>
                                                                        <td className="p-2.5 text-right font-bold">
                                                                            {discrepancy === 0 ? (
                                                                                <span className="text-slate-400">0.00</span>
                                                                            ) : discrepancy > 0 ? (
                                                                                <span className="text-emerald-600">+{discrepancy.toFixed(2)}</span>
                                                                            ) : (
                                                                                <span className="text-red-600">{discrepancy.toFixed(2)}</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
