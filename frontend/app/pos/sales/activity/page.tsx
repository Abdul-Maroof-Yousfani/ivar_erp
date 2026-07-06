"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { PrintClaimReceipt } from "@/components/pos/print-claim-receipt";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
import { listSalesActivities } from "@/lib/actions/pos-sales";
import {
    Loader2, Search, Calendar, RefreshCcw, Printer, RotateCcw,
    Banknote, CreditCard, Ticket, BookOpen, AlertCircle, CheckCircle2,
    XCircle, Info, ShoppingBag, Eye, ArrowRight, User, Building, MapPin,
    ArrowUpDown, History, Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TENDER_ICONS: Record<string, any> = {
    cash: Banknote,
    card: CreditCard,
    voucher: Ticket,
    bank_transfer: Building,
    credit_account: BookOpen,
};

const ACTIVITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    sale: { label: "Sale Checkout", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-400", icon: ShoppingBag },
    return: { label: "Return Slip", color: "bg-rose-500/10 text-rose-700 border-rose-300 dark:bg-rose-950/20 dark:text-rose-400", icon: RotateCcw },
    refund: { label: "Cash Refund", color: "bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-950/20 dark:text-purple-400", icon: Banknote },
    claim: { label: "Claim Request", color: "bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400", icon: AlertCircle },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SalesActivityPage() {
    const { hasPermission } = useAuth();
    const canPrint = hasPermission("pos.sales.history.print");

    // Filters state
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [activityType, setActivityType] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    // Printing state
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedClaim, setSelectedClaim] = useState<any>(null);
    const [returnDetails, setReturnDetails] = useState<any>(null);
    const [showPrint, setShowPrint] = useState(false);
    const [showGiftPrint, setShowGiftPrint] = useState(false);
    const [showReturnPrint, setShowReturnPrint] = useState(false);
    const [showClaimPrint, setShowClaimPrint] = useState(false);
    const [isRefundPrint, setIsRefundPrint] = useState(false);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    // Fetch activities query
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["sales-activities", currentPage, search, dateRange.from, dateRange.to, activityType],
        queryFn: () => listSalesActivities({
            page: currentPage,
            limit: pageSize,
            search: search.trim() || undefined,
            startDate: dateRange.from?.toISOString(),
            endDate: dateRange.to?.toISOString(),
            activityType: activityType === "all" ? undefined : activityType,
        }),
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });

    const orders = data?.data ?? []; // this is a flat list of activities
    const totalRows = data?.meta?.total ?? 0;
    const totalPages = data?.meta?.totalPages ?? 0;

    // Reset pagination when filters change
    const handleFilterChange = () => {
        setCurrentPage(1);
    };

    // Print handlers
    const openSalePrint = async (orderId: string, isGift = false) => {
        setIsLoadingReceipt(true);
        setSelectedOrder(null);
        if (isGift) {
            setShowGiftPrint(true);
        } else {
            setShowPrint(true);
        }
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}`);
            if (res.ok && res.data?.status) {
                setSelectedOrder({ ...res.data.data, isGiftReceipt: isGift });
            } else {
                toast.error("Failed to load order details");
            }
        } catch {
            toast.error("Failed to load order details");
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const openReturnPrint = async (order: any, type: "return" | "refund") => {
        setIsLoadingReceipt(true);
        setSelectedOrder(order);
        setIsRefundPrint(type === "refund");
        setReturnDetails(null);
        setShowReturnPrint(true);
        try {
            const retRes = await authFetch(`/pos-sales/orders/${order.id}/return-details?type=${type}`);
            if (retRes.ok && retRes.data?.status) {
                setReturnDetails(retRes.data.data);
            } else {
                toast.error("Failed to load return/refund details");
            }
        } catch {
            toast.error("Failed to load return/refund details");
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const openClaimPrint = (claim: any, originalOrderNumber: string) => {
        setSelectedClaim({
            ...claim,
            salesOrder: { orderNumber: originalOrderNumber }
        });
        setShowClaimPrint(true);
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-primary" /> Sales Activity Log
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Trace and audit individual transaction actions (sales, returns, cash refunds, claims) sorted by activity date.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 shrink-0">
                    <RefreshCcw className="h-3.5 w-3.5" /> Refresh
                </Button>
            </div>

            {/* Filters panel */}
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5 col-span-1 md:col-span-1">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                type="search"
                                placeholder="Order #, Return #, Claim #, Voucher..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); handleFilterChange(); }}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <Label>Date Range</Label>
                        <DateRangePicker
                            range={dateRange}
                            onUpdate={({ range }) => { setDateRange(range); handleFilterChange(); }}
                            placeholder="Filter by activity date (defaults to last 30 days)"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-1.5 col-span-1">
                        <Label htmlFor="activityType">Activity Type</Label>
                        <Select
                            value={activityType}
                            onValueChange={v => { setActivityType(v); handleFilterChange(); }}
                        >
                            <SelectTrigger id="activityType">
                                <SelectValue placeholder="All Activities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Activities</SelectItem>
                                <SelectItem value="sale">Sales Only</SelectItem>
                                <SelectItem value="return">Returns Only</SelectItem>
                                <SelectItem value="refund">Refunds Only</SelectItem>
                                <SelectItem value="claim">Claims Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Active Filters Clear Button */}
                {(search || dateRange.from || activityType !== "all") && (
                    <div className="flex justify-end pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearch("");
                                setDateRange({ from: undefined, to: undefined });
                                setActivityType("all");
                                setCurrentPage(1);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground h-8"
                        >
                            Clear All Filters
                        </Button>
                    </div>
                )}
            </div>

            {/* List Loader / Empty State */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Loading sales activity records...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20">
                    <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-base font-semibold">No Activities Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        We couldn't find any activities matching your search filters and selected date range.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Flat Activities Loop */}
                    {orders.map((act: any) => {
                        const cfg = ACTIVITY_CONFIG[act.type] || { label: "Activity", color: "bg-muted text-muted-foreground", icon: Info };
                        const Icon = cfg.icon;

                        return (
                            <div key={act.id} className={cn(
                                "bg-card border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 border-l-4",
                                act.type === "sale" ? "border-l-emerald-500" :
                                act.type === "return" ? "border-l-rose-500" :
                                act.type === "refund" ? "border-l-purple-500" :
                                "border-l-amber-500"
                            )}>
                                {/* Card Header: Activity Summary */}
                                <div className="bg-muted/30 border-b p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={cn("font-bold text-xs uppercase px-2 py-0.5", cfg.color)}>
                                                {cfg.label}
                                            </Badge>
                                            <span className="font-mono text-sm font-bold text-foreground">
                                                #{act.number}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            <span>{fmtDate(act.date)} at {fmtTime(act.date)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                            <User className="h-3 w-3" /> Customer Details
                                        </div>
                                        <div className="text-sm font-semibold truncate">
                                            {act.customer?.name || "Walk-in Customer"}
                                        </div>
                                        {act.customer?.contactNo && (
                                            <div className="text-xs font-mono text-muted-foreground">{act.customer.contactNo}</div>
                                        )}
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> Location / Terminal
                                        </div>
                                        <div className="text-xs text-muted-foreground font-semibold truncate text-foreground">
                                            Store Location ID: {act.locationId || "N/A"}
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground">
                                            POS ID: {act.posId || "N/A"}
                                        </div>
                                    </div>

                                    <div className="flex justify-between md:justify-end items-center gap-4">
                                        <div className="text-left md:text-right space-y-0.5">
                                            <div className="text-xs text-muted-foreground font-medium">
                                                {act.type === "claim" ? "Claim Total" : act.type === "return" ? "Returned Value" : act.type === "refund" ? "Refund Amount" : "Sale Amount"}
                                            </div>
                                            <div className="text-base font-bold text-foreground font-mono">
                                                Rs. {formatCurrency(act.approvedAmount ?? act.amount)}
                                            </div>
                                        </div>
                                        
                                        {/* Print Action */}
                                        {canPrint && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full shrink-0"
                                                    title={`Print ${cfg.label}`}
                                                    onClick={() => {
                                                        if (act.type === "sale") {
                                                            openSalePrint(act.orderId);
                                                        } else if (act.type === "return") {
                                                            openReturnPrint({ id: act.orderId, orderNumber: act.orderNumber, grandTotal: act.amount }, "return");
                                                        } else if (act.type === "refund") {
                                                            openReturnPrint({ id: act.orderId, orderNumber: act.orderNumber, grandTotal: act.amount }, "refund");
                                                        } else if (act.type === "claim") {
                                                            openClaimPrint(act, act.orderNumber);
                                                        }
                                                    }}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Body: Items and Voucher Trace */}
                                <div className="p-4 space-y-3">
                                    {/* Link to Parent Order */}
                                    {act.type !== "sale" && (
                                        <div className="text-xs text-muted-foreground">
                                            Original Order: <span className="font-mono font-semibold text-foreground">#{act.orderNumber}</span>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    {act.items && act.items.length > 0 && (
                                        <div className="overflow-x-auto border rounded-lg bg-muted/10">
                                            <table className="w-full text-xs text-left">
                                                <thead>
                                                    <tr className="bg-muted/40 border-b text-muted-foreground">
                                                        <th className="font-semibold p-2">SKU / Item</th>
                                                        <th className="font-semibold p-2 text-center">Attributes</th>
                                                        <th className="font-semibold p-2 text-center">
                                                            {act.type === "claim" ? "Claim / Appr Qty" : "Qty"}
                                                        </th>
                                                        <th className="font-semibold p-2 text-right">Price</th>
                                                        <th className="font-semibold p-2 text-right">Total</th>
                                                        {act.type === "claim" && <th className="font-semibold p-2 text-center">Status</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {act.items.map((it: any, itIdx: number) => (
                                                        <tr key={itIdx} className="border-b last:border-0 border-muted/20 hover:bg-muted/5 transition-colors">
                                                            <td className="p-2 font-medium">
                                                                <div className="font-semibold text-foreground text-sm">{it.description}</div>
                                                                <div className="text-[10px] text-muted-foreground font-mono">{it.sku}</div>
                                                            </td>
                                                            <td className="p-2 text-center text-muted-foreground">
                                                                {it.size || it.color ? `${it.size || "-"} / ${it.color || "-"}` : "—"}
                                                            </td>
                                                            <td className="p-2 text-center font-semibold">
                                                                {act.type === "claim" ? (
                                                                    <span>{it.quantity} <ArrowRight className="inline h-2.5 w-2.5 text-muted-foreground mx-0.5" /> {it.approvedQty ?? 0}</span>
                                                                ) : (
                                                                    it.quantity
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-right font-mono text-muted-foreground">
                                                                Rs. {formatCurrency(it.price)}
                                                            </td>
                                                            <td className="p-2 text-right font-mono font-semibold">
                                                                Rs. {formatCurrency(act.type === "claim" ? (it.approvedAmount ?? it.lineTotal) : it.lineTotal)}
                                                            </td>
                                                            {act.type === "claim" && (
                                                                <td className="p-2 text-center">
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[9px] uppercase px-1.5 py-0 h-4 font-mono",
                                                                        it.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" :
                                                                        it.status === "REJECTED" ? "bg-rose-500/10 text-rose-700 border-rose-300" :
                                                                        "bg-amber-500/10 text-amber-700 border-amber-300"
                                                                    )}>
                                                                        {it.status || "Pending"}
                                                                    </Badge>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Vouchers and Tenders Info */}
                                    <div className="flex flex-wrap gap-4 items-center justify-between pt-2 text-xs">
                                        <div className="flex flex-wrap gap-2.5 items-center">
                                            {/* Tenders Displayed (for Sale) */}
                                            {act.tenders && act.tenders.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-muted-foreground">Payment Tenders:</span>
                                                    {act.tenders.map((tend: any, tIdx: number) => {
                                                        const TendIcon = TENDER_ICONS[tend.method] || Banknote;
                                                        return (
                                                            <Badge key={tIdx} variant="secondary" className="gap-1 font-mono text-[10px] capitalize">
                                                                    <TendIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                                    {tend.method.replace("_", " ")}
                                                                    {tend.slipNo && <span className="text-[9px] text-muted-foreground ml-0.5">#{tend.slipNo}</span>}
                                                                    <span className="font-semibold text-foreground ml-1">Rs.{formatCurrency(tend.amount)}</span>
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Issued Vouchers Highlight Box */}
                                            {act.issuedVouchers && act.issuedVouchers.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Issued Voucher:</span>
                                                    {act.issuedVouchers.map((v: any, vIdx: number) => (
                                                        <div key={vIdx} className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-200 dark:border-rose-950 text-rose-700 dark:text-rose-300 rounded px-2 py-0.5 font-mono text-[10px] font-semibold">
                                                            <Ticket className="h-3 w-3" />
                                                            <span>{v.code}</span>
                                                            <span className="text-muted-foreground border-l pl-1.5">Rs.{formatCurrency(v.faceValue)}</span>
                                                            {v.expiresAt && (
                                                                <span className="text-muted-foreground border-l pl-1.5 text-[9px]">Expires {fmtDate(v.expiresAt)}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {act.reasonNotes && (
                                                <div className="text-muted-foreground truncate">
                                                    <span className="font-semibold">Reason:</span> {act.reasonNotes}
                                                </div>
                                            )}
                                            {act.reviewNotes && (
                                                <div className="text-muted-foreground truncate">
                                                    <span className="font-semibold">Reviewer Notes:</span> {act.reviewNotes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
                        <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                            Showing page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
                            <span className="font-bold text-foreground">{totalPages}</span> ({totalRows} total activities)
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || isLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Printing dialogs ─── */}
            {/* Sale Receipt */}
            {showPrint && selectedOrder && (
                <PrintReceipt
                    order={selectedOrder}
                    tenders={selectedOrder?.tenders ?? []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => setShowPrint(false)}
                />
            )}

            {/* Gift Receipt */}
            {showGiftPrint && selectedOrder && (
                <PrintReceipt
                    order={selectedOrder}
                    tenders={selectedOrder?.tenders ?? []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => setShowGiftPrint(false)}
                />
            )}

            {/* Return / Refund Slip */}
            {showReturnPrint && selectedOrder && (
                <PrintReturnReceipt
                    returnRef={
                        isRefundPrint
                            ? (returnDetails?.refundNumber || selectedOrder?.refundNumber || selectedOrder?.orderNumber || "")
                            : (returnDetails?.returnNumber || selectedOrder?.returnNumber || selectedOrder?.orderNumber || "")
                    }
                    isRefund={isRefundPrint}
                    isAlliance={!!selectedOrder?.alliance}
                    originalOrders={[{ orderNumber: selectedOrder?.orderNumber ?? "", grandTotal: Number(selectedOrder?.grandTotal ?? 0) }]}
                    returnedLines={
                        (returnDetails?.items ?? []).map((item: any) => ({
                            name:            item.item?.description ?? "Item",
                            sku:             item.item?.sku ?? "",
                            size:            item.item?.size?.name ?? "",
                            brand:           item.item?.brand?.name ?? "",
                            returnQty:       item.returnableQty ?? item.quantity ?? 1,
                            paidPerUnit:     item.originalPaidPerUnit ?? Number(item.unitPrice ?? 0),
                            refundAmount:    item.refundAmount ?? 0,
                            orderNumber:     selectedOrder?.orderNumber ?? "",
                            unitPrice:       Number(item.unitPrice ?? 0),
                            discountAmount:  Number(item.discountAmount ?? 0),
                            discountPercent: Number(item.discountPercent ?? 0),
                            taxAmount:       Number(item.taxAmount ?? 0),
                            taxPercent:      Number(item.taxPercent ?? 0),
                            refundPerUnit:   item.refundPerUnit,
                            priceAdjusted:   item.priceAdjusted,
                            originalPaidPerUnit: item.originalPaidPerUnit,
                            couponDeduction: item.couponDeduction,
                        }))
                    }
                    refundTotal={returnDetails?.items?.reduce((s: number, i: any) => s + (i.refundAmount ?? 0), 0) ?? 0}
                    notes={returnDetails?.reason}
                    discountNotes={returnDetails?.discountNotes}
                    returnedAt={returnDetails?.returnedAt}
                    exchangeVoucher={returnDetails?.exchangeVoucher}
                    isLoading={isLoadingReceipt}
                    onClose={() => setShowReturnPrint(false)}
                />
            )}

            {/* Claim Receipt */}
            {showClaimPrint && selectedClaim && (
                <PrintClaimReceipt
                    claim={selectedClaim}
                    isLoading={isLoadingReceipt}
                    onClose={() => setShowClaimPrint(false)}
                />
            )}
        </div>
    );
}

// Simple fallback helper component since GiftIcon is a custom icon or not standard in lucide
function GiftIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("lucide lucide-gift", props.className)}
        >
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M12 8v13" />
            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5a2.5 2.5 0 0 1 0 5" />
        </svg>
    );
}
