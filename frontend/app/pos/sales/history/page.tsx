"use client";

import { useState, useEffect, useCallback, useMemo, useTransition, startTransition, addTransitionType, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Printer, Eye, ShoppingCart, Wallet, Calendar as CalendarIcon,
    PauseCircle, RotateCcw, Clock, Pencil, Plus, Trash2, Loader2,
    Banknote, CreditCard, Building2, Ticket, BookOpen, FileText,
    CheckCircle2, XCircle, Upload, ShieldCheck, RefreshCw,
} from "lucide-react";

import DataTable from "@/components/common/data-table";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { PrintClaimReceipt } from "@/components/pos/print-claim-receipt";
import { SalesHistoryBulkUploadModal } from "@/components/pos/sales-history-bulk-upload-modal";
import { OnlineSalesBulkUploadModal } from "@/components/pos/online-sales-bulk-upload-modal";
import { useUploadProgress } from "@/hooks/use-upload-progress";
import { cn, getCookie } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";


function isSameDay(date: Date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

const TENDER_OPTIONS = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
    { value: "voucher", label: "Voucher", icon: Ticket },
    { value: "credit_account", label: "Credit Account", icon: BookOpen },
];

interface Tender { method: string; amount: number; cardLast4?: string; slipNo?: string; voucherId?: string; }

function canEditOrderTender(order: any): { canEdit: boolean; reason?: string } {
    if (!order) return { canEdit: false, reason: "Order not found" };
    if (order.status === "voided") return { canEdit: false, reason: "Order is voided" };
    if (order.status === "hold") return { canEdit: false, reason: "Order is on hold" };

    const isToday = isSameDay(new Date(order.createdAt));
    if (!isToday) return { canEdit: false, reason: "Tender can only be updated for today's orders" };

    if (order.status === "exchanged" || (order.exchanges && order.exchanges.length > 0) || order.hasExchange) {
        return { canEdit: false, reason: "Cannot edit tender: An exchange was processed for this order" };
    }

    if (order.claims && order.claims.length > 0) {
        return { canEdit: false, reason: "Cannot edit tender: A claim was created for this order" };
    }

    if (
        order.hasReturn || 
        order.hasRefund || 
        order.status === "returned" || 
        order.status === "partially_returned" || 
        order.status === "refunded"
    ) {
        return { canEdit: false, reason: "Cannot edit tender: A return or refund was processed for this order" };
    }

    const voucherAmount = Number(order.voucherAmount || 0);
    const hasVoucherRedemptions = order.voucherRedemptions && order.voucherRedemptions.length > 0;
    if (voucherAmount > 0 || hasVoucherRedemptions) {
        return { canEdit: false, reason: "Cannot edit tender: A voucher was used on this order" };
    }

    if (order.hasIssuedVoucher || (order.issuedVouchers && order.issuedVouchers.length > 0) || order.issuedVouchersCount > 0) {
        return { canEdit: false, reason: "Cannot edit tender: A voucher was issued from this order" };
    }

    if (order.paymentMethod === "credit_account" || order.tenderType === "credit_account") {
        return { canEdit: false, reason: "Cannot edit tender: Credit account orders cannot be edited" };
    }

    const existingTenders = order.tenders ?? [];
    if (existingTenders.length > 0) {
        const hasDisallowedTender = existingTenders.some(
            (t: any) => !["cash", "card", "bank_transfer"].includes(t.method)
        );
        if (hasDisallowedTender) {
            return { canEdit: false, reason: "Cannot edit tender: Only Cash, Card, and Bank Transfer orders can be edited" };
        }
    } else if (
        order.paymentMethod &&
        !["cash", "card", "bank_transfer", "split"].includes(order.paymentMethod)
    ) {
        return { canEdit: false, reason: "Cannot edit tender: Only Cash, Card, and Bank Transfer orders can be edited" };
    }

    return { canEdit: true };
}

// ─── Update Tender Modal ──────────────────────────────────────────────────
function UpdateTenderModal({ order, open, onOpenChange, onSuccess }: {
    order: any; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void;
}) {
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [cardAmount, setCardAmount] = useState<number>(0);
    const [bankTransferAmount, setBankTransferAmount] = useState<number>(0);
    const [cardLast4, setCardLast4] = useState<string>("");
    const [slipNo, setSlipNo] = useState<string>("");
    const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
    const [merchants, setMerchants] = useState<any[]>([]);
    const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isAlliance = !!order?.allianceId;
    const grandTotal = Number(order?.grandTotal ?? 0);

    // Fetch merchants for order location
    useEffect(() => {
        if (open && order?.locationId) {
            setIsLoadingMerchants(true);
            authFetch(`/pos-config/merchants/for-location?locationId=${order.locationId}`)
                .then(res => {
                    if (res.ok && res.data?.status) {
                        setMerchants(res.data.data || []);
                    }
                })
                .catch(() => {})
                .finally(() => setIsLoadingMerchants(false));
        }
    }, [open, order?.locationId]);

    // Initialize values when modal opens
    useEffect(() => {
        if (open && order) {
            const existingTenders = order.tenders ?? [];
            const cash = existingTenders.find((t: any) => t.method === "cash");
            const card = existingTenders.find((t: any) => t.method === "card");
            const bank = existingTenders.find((t: any) => t.method === "bank_transfer");

            let initCash = cash ? Number(cash.amount) : 0;
            let initCard = card ? Number(card.amount) : 0;
            let initBank = bank ? Number(bank.amount) : 0;

            if (existingTenders.length === 0) {
                if (order.paymentMethod === "cash") {
                    initCash = Number(order.cashAmount ?? order.grandTotal ?? 0);
                } else if (order.paymentMethod === "bank_transfer") {
                    initBank = Number(order.cardAmount ?? order.grandTotal ?? 0);
                } else if (order.paymentMethod === "card") {
                    initCard = Number(order.cardAmount ?? order.grandTotal ?? 0);
                } else {
                    initCash = Number(order.cashAmount ?? 0);
                    initCard = Number(order.cardAmount ?? 0);
                }
            }

            setCashAmount(initCash);
            setCardAmount(initCard);
            setBankTransferAmount(initBank);

            const nonCashTender = card || bank;
            let parsedCardLast4 = nonCashTender?.cardLast4 || "";
            let parsedSlipNo = nonCashTender?.slipNo || "";

            if (!parsedCardLast4 && order.notes) {
                const match = order.notes.match(/Card:\s*\*{0,4}(\d{4})/i);
                if (match) parsedCardLast4 = match[1];
            }
            if (!parsedSlipNo && order.notes) {
                const match = order.notes.match(/Slip:\s*([^|\n\r]+)/i);
                if (match) parsedSlipNo = match[1].trim();
            }

            setCardLast4(parsedCardLast4);
            setSlipNo(parsedSlipNo);
            setSelectedMerchantId(order.merchantId || order.merchant?.id || "");
        }
    }, [open, order]);

    const totalPaid = Math.round((cashAmount + cardAmount + bankTransferAmount) * 100) / 100;
    const isOverLimit = totalPaid > Math.round(grandTotal * 100) / 100 + 0.01;
    const hasNonCash = cardAmount > 0 || bankTransferAmount > 0;
    const requiresMerchant = hasNonCash && merchants.length > 0 && !selectedMerchantId;

    const handleSave = async () => {
        if (isOverLimit) {
            toast.error("Total tender amount cannot exceed order bill total");
            return;
        }
        if (totalPaid <= 0) {
            toast.error("Please enter a valid tender amount");
            return;
        }
        if (requiresMerchant) {
            toast.error("Please select a merchant terminal for card / bank transfer payment");
            return;
        }
        if (isAlliance) {
            if (cashAmount > 0) {
                toast.error("Cash payment is not allowed for Alliance orders");
                return;
            }
            if (!cardLast4 || cardLast4.trim().length !== 4) {
                toast.error("Card number (last 4 digits) is required for Alliance orders");
                return;
            }
        }

        setIsSaving(true);
        try {
            const tendersPayload: Tender[] = [];
            if (cashAmount > 0) {
                tendersPayload.push({ method: "cash", amount: cashAmount });
            }
            if (cardAmount > 0) {
                tendersPayload.push({
                    method: "card",
                    amount: cardAmount,
                    cardLast4: cardLast4 || undefined,
                    slipNo: slipNo || undefined,
                });
            }
            if (bankTransferAmount > 0) {
                tendersPayload.push({
                    method: "bank_transfer",
                    amount: bankTransferAmount,
                    cardLast4: cardLast4 || undefined,
                    slipNo: slipNo || undefined,
                });
            }

            const res = await authFetch(`/pos-sales/orders/${order.id}/update-tender`, {
                method: "POST",
                body: {
                    tenders: tendersPayload,
                    merchantId: selectedMerchantId || undefined,
                },
            });
            if (res.ok && res.data?.status) {
                toast.success("Tender updated successfully");
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(res.data?.message || "Failed to update tender");
            }
        } catch {
            toast.error("Failed to update tender");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-violet-600" /> Update Tender
                        <Badge variant="outline" className="font-mono text-xs">{order?.orderNumber}</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Alliance banner */}
                    {isAlliance && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                            <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                <strong>Alliance Order:</strong> Payment amounts & methods are fixed. Only the merchant terminal and card details can be modified.
                            </span>
                        </div>
                    )}

                    {/* Order bill reference */}
                    <div className="flex justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Order Bill Total</span>
                        <span className="font-bold font-mono">{formatCurrency(grandTotal)}</span>
                    </div>

                    {/* Quick Switch Buttons (non-Alliance) */}
                    {!isAlliance && (
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                type="button"
                                variant={cashAmount === grandTotal && cardAmount === 0 && bankTransferAmount === 0 ? "default" : "outline"}
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() => {
                                    setCashAmount(grandTotal);
                                    setCardAmount(0);
                                    setBankTransferAmount(0);
                                }}
                            >
                                <Banknote className="h-3.5 w-3.5" /> 100% Cash
                            </Button>
                            <Button
                                type="button"
                                variant={cardAmount === grandTotal && cashAmount === 0 && bankTransferAmount === 0 ? "default" : "outline"}
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() => {
                                    setCardAmount(grandTotal);
                                    setCashAmount(0);
                                    setBankTransferAmount(0);
                                }}
                            >
                                <CreditCard className="h-3.5 w-3.5" /> 100% Card
                            </Button>
                            <Button
                                type="button"
                                variant={bankTransferAmount === grandTotal && cashAmount === 0 && cardAmount === 0 ? "default" : "outline"}
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() => {
                                    setBankTransferAmount(grandTotal);
                                    setCashAmount(0);
                                    setCardAmount(0);
                                }}
                            >
                                <Building2 className="h-3.5 w-3.5" /> 100% Bank
                            </Button>
                        </div>
                    )}

                    {/* Tenders Edit Form */}
                    <div className="space-y-3 border rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Breakdown</Label>

                        {/* Cash Amount */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Cash Payment
                                </span>
                            </div>
                            <Input
                                type="number"
                                min={0}
                                max={grandTotal}
                                disabled={isAlliance}
                                className="font-mono text-sm h-9"
                                placeholder="0.00"
                                value={cashAmount || ""}
                                onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setCashAmount(val);
                                }}
                            />
                        </div>

                        {/* Card Amount */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <CreditCard className="h-3.5 w-3.5 text-blue-600" /> Card Payment
                                </span>
                            </div>
                            <Input
                                type="number"
                                min={0}
                                max={grandTotal}
                                disabled={isAlliance}
                                className="font-mono text-sm h-9"
                                placeholder="0.00"
                                value={cardAmount || ""}
                                onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setCardAmount(val);
                                }}
                            />
                        </div>

                        {/* Bank Transfer Amount */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Building2 className="h-3.5 w-3.5 text-violet-600" /> Bank Transfer
                                </span>
                            </div>
                            <Input
                                type="number"
                                min={0}
                                max={grandTotal}
                                disabled={isAlliance}
                                className="font-mono text-sm h-9"
                                placeholder="0.00"
                                value={bankTransferAmount || ""}
                                onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setBankTransferAmount(val);
                                }}
                            />
                        </div>

                        {/* Merchant & Card / Bank Details */}
                        {(hasNonCash || isAlliance) && (
                            <div className="pt-2 border-t space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                        Merchant Bank Terminal {merchants.length > 0 && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder={isLoadingMerchants ? "Loading merchants..." : "Select Merchant Bank"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {merchants.map((m) => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.bankName} {m.description ? `(${m.description})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">
                                            Card # (last 4){isAlliance && <span className="text-destructive font-bold ml-0.5">*</span>}
                                        </Label>
                                        <Input
                                            className="mt-1 h-8 text-xs font-mono"
                                            maxLength={4}
                                            placeholder="••••"
                                            value={cardLast4}
                                            onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Auth ID / Slip # / Ref</Label>
                                        <Input
                                            className="mt-1 h-8 text-xs font-mono"
                                            placeholder="e.g. 123456"
                                            value={slipNo}
                                            onChange={(e) => setSlipNo(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Over-limit warning */}
                    {isOverLimit && (
                        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                            <span>Total payment ({formatCurrency(totalPaid)}) cannot exceed bill total ({formatCurrency(grandTotal)})</span>
                        </div>
                    )}

                    <div className={cn("flex justify-between rounded-lg px-3 py-2 text-sm font-semibold",
                        totalPaid === grandTotal ? "bg-emerald-500/10 text-emerald-600" : (isOverLimit ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"))}>
                        <span>Total Tendered</span>
                        <span className="font-mono">{formatCurrency(totalPaid)}</span>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || isOverLimit || requiresMerchant}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                        Save Tender
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SalesHistoryPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { hasPermission, user } = useAuth();
    const canPrint = hasPermission('pos.sales.history.print');
    const canUpdateTender = hasPermission('pos.sales.history.update-tender');
    const canResumeHold = hasPermission('pos.hold.resume');
    const canImport = hasPermission('pos.sales.history.import');

    // ── Bulk-upload state ──────────────────────────────────────────────
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isOnlineSalesUploadOpen, setIsOnlineSalesUploadOpen] = useState(false);
    const [activeUploadId,   setActiveUploadId]   = useState<string | null>(null);
    const { data: uploadProgress } = useUploadProgress(activeUploadId, 'sales-history');

    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rowCount, setRowCount] = useState(0);
    const [pageCount, setPageCount] = useState(0);

    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 100 });

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [returnDetails, setReturnDetails] = useState<any>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showPrint, setShowPrint] = useState(false);
    const [showGiftPrint, setShowGiftPrint] = useState(false);
    const [showReturnPrint, setShowReturnPrint] = useState(false);
    const [showUpdateTender, setShowUpdateTender] = useState(false);
    // isLoadingReceipt: dialog opens immediately, receipt fetches in background
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [isRefundPrint, setIsRefundPrint] = useState(false);
    const [showClaimReceipt, setShowClaimReceipt] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<any>(null);
    const [retryingFbrId, setRetryingFbrId] = useState<string | null>(null);
    const [isSyncingAllFbr, setIsSyncingAllFbr] = useState(false);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch("/pos-sales/orders", {
                params: {
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    search: search.trim() || undefined,
                    startDate: dateRange.from?.toISOString(),
                    endDate: dateRange.to?.toISOString(),
                    locationId: user?.locationId || undefined,
                }
            });
            if (res.ok && res.data?.status) {
                // hold_expired orders are excluded by the backend
                setOrders(res.data.data || []);
                setRowCount(res.data.meta?.total || 0);
                setPageCount(res.data.meta?.totalPages || 0);
            }
        } catch { toast.error("Failed to load sales history"); }
        finally { setIsLoading(false); }
    }, [pagination.pageIndex, pagination.pageSize, search, dateRange]);

    useEffect(() => { setPagination(p => ({ ...p, pageIndex: 0 })); }, [search, dateRange]);
    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Refresh table when a bulk import finishes
    useEffect(() => {
        if (uploadProgress?.status === 'completed') fetchOrders();
    }, [uploadProgress?.status]);

    // Debug: Log orders when they update
    useEffect(() => {
        console.log('📊 Orders updated:', {
            totalOrders: orders.length,
            ordersWithClaims: orders.filter(o => o.claims && o.claims.length > 0).length,
            sampleOrder: orders[0] ? {
                orderNumber: orders[0].orderNumber,
                hasClaims: !!orders[0].claims,
                claimsCount: orders[0].claims?.length || 0,
                claims: orders[0].claims
            } : null
        });
    }, [orders]);

    // Open print dialog immediately with skeleton, then fetch full order in background
    const openPrintDialog = useCallback(async (
        listOrder: any,
        mode: "sales" | "gift" | "return" | "refund",
    ) => {
        // Open dialog right away with loading state
        setIsLoadingReceipt(true);
        if (mode === "sales") {
            setSelectedOrder({ ...listOrder, isGiftReceipt: false });
            setShowPrint(true);
        } else if (mode === "gift") {
            setSelectedOrder({ ...listOrder, isGiftReceipt: true });
            setShowGiftPrint(true);
        } else if (mode === "return") {
            setSelectedOrder(listOrder);
            setIsRefundPrint(false);
            setReturnDetails(null);
            setShowReturnPrint(true);
        } else if (mode === "refund") {
            setSelectedOrder(listOrder);
            setIsRefundPrint(true);
            setReturnDetails(null);
            setShowReturnPrint(true);
        }

        try {
            const res = await authFetch(`/pos-sales/orders/${listOrder.id}`);
            if (res.ok && res.data?.status) {
                const full = res.data.data;
                if (mode === "sales")  setSelectedOrder({ ...full, isGiftReceipt: false });
                if (mode === "gift")   setSelectedOrder({ ...full, isGiftReceipt: true });
                if (mode === "return" || mode === "refund") {
                    setSelectedOrder(full);
                    const typeParam = mode === "refund" ? "refund" : "return";
                    const retRes = await authFetch(`/pos-sales/orders/${listOrder.id}/return-details?type=${typeParam}`);
                    if (retRes.ok && retRes.data?.status) setReturnDetails(retRes.data.data);
                }
            } else {
                toast.error("Failed to load order details");
            }
        } catch {
            toast.error("Failed to load order details");
        } finally {
            setIsLoadingReceipt(false);
        }
    }, []);

    // Resume a hold order into new-sale
    const handleResumeHold = useCallback(async (order: any) => {
        try {
            const res = await authFetch(`/pos-sales/orders/${order.id}/resume`, { method: "POST" });
            if (res.ok && res.data?.status) {
                const resumed = res.data.data;
                const cartItems = resumed.items.map((oi: any) => ({
                    id: oi.itemId,
                    upc: oi.item?.barCode || oi.itemId || "-",
                    sku: oi.item?.sku || "-",
                    name: oi.item?.description || "Unknown Item",
                    brand: "-", size: "-", color: "-",
                    quantity: oi.quantity,
                    price: Number(oi.unitPrice),
                    discountPercent: Number(oi.discountPercent),
                    discountAmount: Number(oi.discountAmount),
                    taxPercent: Number(oi.taxPercent),
                    taxAmount: Number(oi.taxAmount),
                    total: Number(oi.lineTotal),
                    inStock: true, stockQty: 999,
                }));
                sessionStorage.setItem("pos_resume_cart", JSON.stringify(cartItems));
                toast.success(`Resuming ${resumed.orderNumber}`);
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push("/pos/new-sale?resume=1");
                });
            } else {
                toast.error(res.data?.message || "Failed to resume hold");
            }
        } catch { toast.error("Failed to resume hold order"); }
    }, [router]);

    // Print claim receipt
    const handlePrintClaim = useCallback(async (claimId: string) => {
        try {
            const res = await authFetch(`/pos-claims/${claimId}`);
            if (res.ok && res.data?.status) {
                setSelectedClaim(res.data.data);
                setShowClaimReceipt(true);
            } else {
                toast.error("Failed to load claim details");
            }
        } catch {
            toast.error("Failed to load claim details");
        }
    }, []);

    const handleRetryFbr = useCallback(async (orderId: string) => {
        setRetryingFbrId(orderId);
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}/retry-fbr`, {
                method: "POST"
            });
            if (res.ok && res.data?.status && res.data.data?.fbrInvoiceNumber) {
                toast.success(`FBR Invoice fiscalized: ${res.data.data.fbrInvoiceNumber}`);
                fetchOrders();
            } else {
                toast.error(res.data?.message || "FBR fiscalization failed");
            }
        } catch {
            toast.error("Failed to sync invoice with FBR");
        } finally {
            setRetryingFbrId(null);
        }
    }, [fetchOrders]);

    const handleSyncAllFbr = useCallback(async () => {
        setIsSyncingAllFbr(true);
        try {
            const res = await authFetch("/pos-sales/fbr/sync-unsynced", {
                method: "POST",
                body: JSON.stringify({
                    locationId: user?.locationId || undefined,
                    startDate: dateRange.from?.toISOString(),
                    endDate: dateRange.to?.toISOString(),
                })
            });
            if (res.ok && res.data?.status) {
                const count = res.data.data?.syncedCount || res.data.data?.length || 0;
                toast.success(`FBR sync complete! Processed ${count} unposted invoices.`);
                fetchOrders();
            } else {
                toast.error(res.data?.message || "Failed to sync unposted FBR invoices");
            }
        } catch {
            toast.error("Failed to trigger bulk FBR sync");
        } finally {
            setIsSyncingAllFbr(false);
        }
    }, [user?.locationId, dateRange, fetchOrders]);

    const STATUS_BADGE: Record<string, string> = {
        completed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
        hold: "bg-amber-500/10 text-amber-700 border-amber-300",
        hold_expired: "bg-muted text-muted-foreground border-border",
        voided: "bg-destructive/10 text-destructive border-destructive/30",
        partially_returned: "bg-blue-500/10 text-blue-700 border-blue-300",
        refunded: "bg-purple-500/10 text-purple-700 border-purple-300",
        exchanged: "bg-cyan-500/10 text-cyan-700 border-cyan-300",
    };

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "orderNumber",
            header: "Order #",
            cell: ({ row }) => (
                <span className="font-mono font-bold text-primary">{row.getValue("orderNumber")}</span>
            ),
        },
        {
            accessorKey: "createdAt",
            header: "Date & Time",
            cell: ({ row }) => {
                const date = new Date(row.getValue("createdAt"));
                return (
                    <div className="text-sm">
                        {date.toLocaleDateString()}
                        <div className="text-[10px] text-muted-foreground">
                            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "itemsCount",
            header: () => <div className="text-right">Items</div>,
            cell: ({ row }) => <div className="text-right">{row.original.items?.length || 0}</div>,
        },
        {
            accessorKey: "grandTotal",
            header: () => <div className="text-right">Total</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold">{formatCurrency(row.getValue("grandTotal"))}</div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const claims = row.original.claims || [];
                const hasClaims = claims.length > 0;
                
                // Determine claim status badge
                let claimBadge = null;
                if (hasClaims) {
                    const pendingClaims = claims.filter((c: any) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW');
                    const approvedClaims = claims.filter((c: any) => c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED');
                    const rejectedClaims = claims.filter((c: any) => c.status === 'REJECTED');
                    
                    if (pendingClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-700 border-amber-300 ml-1">
                                ⏳ Claim Pending
                            </Badge>
                        );
                    } else if (approvedClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-700 border-green-300 ml-1">
                                ✓ Claim Approved
                            </Badge>
                        );
                    } else if (rejectedClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-red-500/10 text-red-700 border-red-300 ml-1">
                                ✗ Claim Rejected
                            </Badge>
                        );
                    }
                }
                
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0 h-5", STATUS_BADGE[status] ?? "")}>
                            {status === "hold" && <PauseCircle className="h-2.5 w-2.5 mr-1" />}
                            {status.replace(/_/g, " ")}
                        </Badge>
                        {claimBadge}
                    </div>
                );
            },
        },
        {
            id: "fbrStatus",
            header: "FBR Invoice",
            cell: ({ row }) => {
                const order = row.original;
                const isSynced = order.fbrStatus === "SYNCED" && !!order.fbrInvoiceNumber;
                const isRetrying = retryingFbrId === order.id;

                if (order.status === "hold" || order.status === "hold_expired") {
                    return <span className="text-xs text-muted-foreground">-</span>;
                }

                if (isSynced) {
                    return (
                        <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-mono text-[10px] px-1.5 py-0 h-5 w-fit">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-1 text-emerald-600" />
                                {order.fbrInvoiceNumber}
                            </Badge>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-5">
                            Unsynced
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isRetrying}
                            className="h-6 px-2 text-[10px] font-bold border-amber-300 text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/40 gap-1 rounded-md"
                            title="Post this invoice to FBR"
                            onClick={() => handleRetryFbr(order.id)}
                        >
                            {isRetrying ? (
                                <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                            ) : (
                                <RefreshCw className="h-3 w-3 text-amber-600" />
                            )}
                            Sync FBR
                        </Button>
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const order = row.original;
                const isHold = order.status === "hold";
                const { canEdit: isTenderEditable, reason: editDisabledReason } = canEditOrderTender(order);

                return (
                    <div className="flex items-center justify-end gap-1">
                        {/* Resume hold */}
                        {isHold && canResumeHold && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Continue hold order"
                                onClick={() => handleResumeHold(order)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {/* Update tender */}
                        {canUpdateTender && (
                            <Button variant="ghost" size="icon"
                                disabled={!isTenderEditable}
                                className={cn(
                                    "h-8 w-8 rounded-full transition-colors",
                                    isTenderEditable
                                        ? "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                        : "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent"
                                )}
                                title={isTenderEditable ? "Update tender / payment" : editDisabledReason}
                                onClick={() => {
                                    if (isTenderEditable) {
                                        setSelectedOrder(order);
                                        setShowUpdateTender(true);
                                    }
                                }}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {/* View details */}
                        <Button variant="ghost" size="icon"
                            className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                            title="View details"
                            onClick={() => {
                                startTransition(() => {
                                    addTransitionType("nav-forward");
                                    router.push(`/pos/sales/order-details/${order.id}`);
                                });
                            }}>
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {/* Print */}
                        {!isHold && canPrint && (<>
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-primary hover:bg-primary/5"
                                title="Print receipt"
                                onClick={() => openPrintDialog(order, "sales")}>
                                <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {/* Gift receipt button - always show on sales history */}
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30"
                                title="Print gift receipt (no prices)"
                                onClick={() => openPrintDialog(order, "gift")}>
                                <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {(order.hasReturn || order.status === 'returned' || order.status === 'partially_returned') && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/5"
                                    title="Print return slip"
                                    onClick={() => openPrintDialog(order, "return")}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {(order.hasRefund || order.status === 'refunded' || (order.status === 'partially_returned' && !order.hasReturn && !order.hasRefund)) && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                    title="Print refund slip"
                                    onClick={() => openPrintDialog(order, "refund")}>
                                    <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
                                </Button>
                            )}
                            {/* Claim receipt button - show if order has claims */}
                            {order.claims && order.claims.length > 0 && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                    title={`Print claim receipt (${order.claims[0].claimNumber})`}
                                    onClick={() => handlePrintClaim(order.claims[0].id)}>
                                    <FileText className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            </>
                        )}
                    </div>
                );
            },
        },
    ], [handleResumeHold]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 px-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales History</h1>
                    <p className="text-slate-400 text-sm">Manage and view all POS transactions.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-75">
                        <DateRangePicker
                            onUpdate={(values) => setDateRange(values.range)}
                            initialDateFrom={dateRange.from}
                            initialDateTo={dateRange.to}
                            placeholder="Filter by date"
                        />
                    </div>
                    {/* ── Floating import progress button ── */}
                    {activeUploadId && !isBulkUploadOpen && (
                        <Button
                            variant={
                                uploadProgress?.status === 'failed'    ? 'destructive' :
                                uploadProgress?.status === 'completed' ? 'default'     : 'outline'
                            }
                            className={`border-primary text-primary relative overflow-hidden min-w-48 ${
                                uploadProgress?.status === 'failed'    ? 'text-destructive-foreground! bg-destructive!' :
                                uploadProgress?.status === 'completed' ? 'text-primary-foreground! bg-primary!'        : ''
                            }`}
                            onClick={() => setIsBulkUploadOpen(true)}
                        >
                            <div
                                className="absolute inset-0 bg-primary/10 transition-all duration-500"
                                style={{ width: `${uploadProgress?.progress ?? 0}%` }}
                            />
                            <div className="relative flex items-center gap-2">
                                {(uploadProgress?.status === 'validating' ||
                                  uploadProgress?.status === 'processing' ||
                                  uploadProgress?.status === 'pending') && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                <span className="font-bold">
                                    {uploadProgress?.status === 'failed'    ? 'Import Failed'       :
                                     uploadProgress?.status === 'completed' ? 'Import Complete'     :
                                     uploadProgress?.status === 'validated' ? 'Validation Complete' :
                                     uploadProgress?.status === 'validating'? 'Validating'          :
                                                                              'Importing'}
                                    {!['failed', 'completed', 'validated'].includes(uploadProgress?.status || '')
                                        ? ` ${uploadProgress?.progress ?? 0}%` : ''}
                                </span>
                            </div>
                        </Button>
                    )}
                    {/* ── Import History button ── */}
                    {canImport && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsOnlineSalesUploadOpen(true)}
                                className="gap-2"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Import Online Sales
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsBulkUploadOpen(true)}
                                className="gap-2"
                            >
                                <Upload className="h-4 w-4" />
                                Import History
                            </Button>
                        </div>
                    )}
                  
                    <Button
                        variant="outline"
                        onClick={() => {
                            startTransition(() => {
                                addTransitionType("nav-forward");
                                router.push("/pos/new-sale?showHolds=1");
                            });
                        }}
                        className="gap-2 border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                    >
                        <PauseCircle className="h-4 w-4" />
                        Hold Orders
                        {orders.filter(o => o.status === 'hold').length > 0 && (
                            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 ml-0.5">
                                {orders.filter(o => o.status === 'hold').length}
                            </Badge>
                        )}
                    </Button>
                    <Button onClick={() => {
                        startTransition(() => {
                            addTransitionType("nav-forward");
                            router.push("/pos/new-sale");
                        });
                    }}>
                        <ShoppingCart className="h-4 w-4" /> New Sale
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 p-6 px-10 overflow-hidden">
                <div id="pos-sales-history-card">
                    <DataTable
                        columns={columns}
                        data={orders}
                        isLoading={isLoading}
                        manualPagination={true}
                        rowCount={rowCount}
                        pageCount={pageCount}
                        onPaginationChange={setPagination}
                        searchFields={[{ key: "orderNumber", label: "Order #" }]}
                        onSearchChange={setSearch}
                        tableId="pos-sales-history"
                    />
                </div>
            </div>

            {/* Order Details Modal */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent showCloseButton={false} className="max-w-[1400px] max-h-[90vh] flex flex-col p-0 w-[98vw]">
                    {(() => {
                        const totalPaid = selectedOrder?.tenders?.reduce((s: number, t: any) => s + Number(t.amount), 0) || 0;
                        const balanceDue = Math.max(0, (selectedOrder?.grandTotal || 0) - totalPaid);
                        const isHold = selectedOrder?.status === "hold";
                        const isToday = selectedOrder ? isSameDay(new Date(selectedOrder.createdAt)) : false;
                        const canEditTender = canUpdateTender && canEditOrderTender(selectedOrder).canEdit;

                        return (
                            <>
                                <DialogHeader className="p-6 pb-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                                            Order Details
                                            <Badge variant="outline" className="font-mono text-[10px] font-normal border-primary/20 text-primary">
                                                {selectedOrder?.orderNumber}
                                            </Badge>
                                        </DialogTitle>
                                        <div className="flex items-center gap-2">
                                            {isHold && (
                                                <Badge variant="outline" className="uppercase text-[10px] px-2 h-5 border-amber-400 text-amber-600">
                                                    <PauseCircle className="h-2.5 w-2.5 mr-1" /> On Hold
                                                </Badge>
                                            )}
                                            {!isHold && (
                                                <Badge variant={balanceDue > 0 ? "outline" : "default"}
                                                    className={cn("uppercase text-[10px] px-2 h-5", balanceDue > 0 ? "border-orange-500 text-orange-500" : "bg-emerald-600")}>
                                                    {balanceDue > 0 ? "Partial" : "Fully Paid"}
                                                </Badge>
                                            )}
                                            <Badge variant={selectedOrder?.status === "completed" ? "default" : "secondary"}
                                                className={cn("uppercase text-[10px] px-2 h-5", STATUS_BADGE[selectedOrder?.status] ?? "")}>
                                                {selectedOrder?.status?.replace(/_/g, " ")}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                        Placed on {selectedOrder && new Date(selectedOrder.createdAt).toLocaleString()}
                                    </p>
                                </DialogHeader>

                                <Separator className="opacity-50 shrink-0" />

                                <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
                                    <div className="px-6 py-6 space-y-6">{/* Hold notice */}
                                    {isHold && (
                                        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
                                            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                                            <div className="flex-1 text-sm">
                                                <p className="font-semibold text-amber-700">Order is on hold</p>
                                                <p className="text-amber-600 text-xs">
                                                    Expires: {selectedOrder?.holdExpiresAt
                                                        ? new Date(selectedOrder.holdExpiresAt).toLocaleTimeString()
                                                        : "at midnight"}
                                                </p>
                                            </div>
                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                                                onClick={() => { setShowDetails(false); handleResumeHold(selectedOrder); }}
                                                disabled={!canResumeHold}>
                                                <RotateCcw className="h-3.5 w-3.5" /> Continue Order
                                            </Button>
                                        </div>
                                    )}

                                    {/* Summary Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-muted/50 px-4 py-3 rounded-xl border border-border/50">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Subtotal</p>
                                            <p className="text-sm font-black tracking-tight">{formatCurrency(selectedOrder?.subtotal || 0)}</p>
                                        </div>
                                        <div className="bg-primary/5 px-4 py-3 rounded-xl border border-primary/20">
                                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5">Discount</p>
                                            <p className="text-sm font-black tracking-tight text-primary">{formatCurrency(selectedOrder?.discountAmount || 0)}</p>
                                        </div>
                                        <div className="bg-primary px-4 py-3 rounded-xl shadow-lg shadow-primary/20">
                                            <p className="text-[9px] font-black text-primary-foreground/70 uppercase tracking-widest mb-1.5">Grand Total</p>
                                            <p className="text-sm font-black tracking-tight text-primary-foreground">{formatCurrency(selectedOrder?.grandTotal || 0)}</p>
                                        </div>
                                        {!isHold && (
                                            <div className={cn("px-4 py-3 rounded-xl border shadow-lg",
                                                balanceDue > 0 ? "bg-orange-500/10 border-orange-500/30 text-orange-600" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600")}>
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-80">{balanceDue > 0 ? "Balance Due" : "Settled"}</p>
                                                <p className="text-sm font-black tracking-tight">{formatCurrency(balanceDue)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Discount badges */}
                                    {(selectedOrder?.promo || selectedOrder?.coupon || selectedOrder?.alliance || selectedOrder?.notes) && (
                                        <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {selectedOrder?.promo && (
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 px-3 rounded-lg">
                                                        <ShoppingCart className="h-3 w-3" />
                                                        Promo: <span className="font-black">{selectedOrder.promo.name || selectedOrder.promo.code}</span>
                                                    </Badge>
                                                )}
                                                {selectedOrder?.coupon && (
                                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                                    <Wallet className="h-3 w-3" />
                                                        Coupon: <span className="font-black">{selectedOrder.coupon.code}</span>
                                                    </Badge>
                                                )}
                                                {selectedOrder?.alliance && (
                                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                                        <CalendarIcon className="h-3 w-3" />
                                                        Alliance: <span className="font-black">{selectedOrder.alliance.partnerName}</span>
                                                    </Badge>
                                                )}
                                            </div>
                                            {selectedOrder?.notes && (
                                                <div className="text-[11px] text-muted-foreground bg-background/50 p-2.5 rounded-xl border border-border/30 italic">
                                                    "{selectedOrder.notes}"
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Items */}
                                    <div className="space-y-3">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                            <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Items Breakdown
                                        </h3>
                                        <div className="rounded-2xl border border-border/60 overflow-x-auto shadow-sm bg-background">
                                            <Table className="min-w-full">
                                                <TableHeader className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                                                    <TableRow className="h-10 hover:bg-transparent">
                                                        <TableHead className="text-[10px] font-bold uppercase text-muted-foreground px-4 min-w-[250px]">Item</TableHead>
                                                        <TableHead className="text-center text-[10px] font-bold uppercase text-muted-foreground w-20">Qty</TableHead>
                                                        {(selectedOrder?.status === 'returned' || selectedOrder?.status === 'partially_returned') && (
                                                            <>
                                                                <TableHead className="text-center text-[10px] font-bold uppercase text-destructive w-20">Ret</TableHead>
                                                                <TableHead className="text-center text-[10px] font-bold uppercase text-emerald-600 w-20">Rem</TableHead>
                                                            </>
                                                        )}
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground w-32">Price</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground w-28">Disc</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground pr-4 w-32">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder?.items?.map((item: any, i: number) => {
                                                        const orderedQty = Number(item.quantity);
                                                        const returnedQty = Number(item.returnedQty || 0);
                                                        const remainingQty = orderedQty - returnedQty;
                                                        const isFullyReturned = remainingQty === 0;
                                                        const isPartiallyReturned = returnedQty > 0 && remainingQty > 0;

                                                        return (
                                                            <TableRow key={i} className={cn(
                                                                "hover:bg-muted/10 border-border/30 group",
                                                                isFullyReturned && "bg-destructive/5"
                                                            )}>
                                                                <TableCell className="px-4 py-3">
                                                                    <div className="flex items-start gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-black text-xs leading-tight group-hover:text-primary transition-colors">
                                                                                {item.item?.description}
                                                                            </p>
                                                                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                                                                {item.item?.sku}
                                                                            </p>
                                                                        </div>
                                                                        {isPartiallyReturned && (
                                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30 shrink-0">
                                                                                Partial
                                                                            </Badge>
                                                                        )}
                                                                        {isFullyReturned && (
                                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30 shrink-0">
                                                                                Returned
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-muted/50">{orderedQty}</span>
                                                                </TableCell>
                                                                {(selectedOrder?.status === 'returned' || selectedOrder?.status === 'partially_returned') && (
                                                                    <>
                                                                        <TableCell className="text-center">
                                                                            {returnedQty > 0 ? (
                                                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-destructive/10 text-destructive">{returnedQty}</span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">—</span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            {remainingQty > 0 ? (
                                                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600">{remainingQty}</span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">—</span>
                                                                            )}
                                                                        </TableCell>
                                                                    </>
                                                                )}
                                                                <TableCell className="text-right text-xs font-mono text-muted-foreground/80">
                                                                    {formatCurrency(item.unitPrice)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-mono text-destructive">
                                                                    {Number(item.discountAmount) > 0 ? `-${formatCurrency(item.discountAmount)}` : "—"}
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-xs font-mono pr-4">
                                                                    {formatCurrency(item.lineTotal ?? (item.unitPrice - (item.discountAmount || 0)) * item.quantity)}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Payment */}
                                    {!isHold && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                                    <Wallet className="h-4 w-4 text-muted-foreground" /> Payment Information
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground px-3 py-1 bg-muted/50 rounded-lg">
                                                        Total Paid: <span className="text-foreground ml-1">{formatCurrency(totalPaid)}</span>
                                                    </span>
                                                    {canEditTender && (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                                                            onClick={() => { setShowDetails(false); setShowUpdateTender(true); }}>
                                                            <Pencil className="h-3 w-3" /> Edit
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedOrder?.tenders?.map((t: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border/80 bg-secondary/5 shadow-sm">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 bg-background border border-border/40 rounded-lg shadow-sm">
                                                                <Wallet className="h-3.5 w-3.5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Method</p>
                                                                <p className="text-[11px] font-black capitalize leading-none">{t.method.replace("_", " ")}</p>
                                                            </div>
                                                            {t.cardLast4 && <span className="text-[9px] font-mono font-black text-primary ml-1 ring-1 ring-primary/20 px-1.5 py-0.5 rounded-md bg-primary/5">••••{t.cardLast4}</span>}
                                                            {t.slipNo && <span className="text-[9px] font-mono font-black text-muted-foreground ml-1 ring-1 ring-border px-1.5 py-0.5 rounded-md bg-muted/30">{t.method === "voucher" ? `#${t.slipNo}` : t.slipNo}</span>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Paid</p>
                                                            <p className="text-[12px] font-black font-mono">{formatCurrency(t.amount)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </ScrollArea>

                                <Separator className="opacity-50 shrink-0" />

                                <DialogFooter className="p-4 bg-muted/20 shrink-0">
                                    <Button variant="ghost" onClick={() => setShowDetails(false)}
                                        className="rounded-xl font-black text-[10px] uppercase hover:bg-muted/80 tracking-widest px-6 h-11">
                                        Close
                                    </Button>
                                    {isHold ? (
                                        <Button className="rounded-xl font-black text-[10px] uppercase px-8 h-11 gap-2.5 tracking-widest bg-amber-600 hover:bg-amber-700"
                                            onClick={() => { setShowDetails(false); handleResumeHold(selectedOrder); }}>
                                            <RotateCcw className="h-4 w-4" /> Continue Order
                                        </Button>
                                    ) : (
                                        <>
                                        {selectedOrder?.isGiftReceipt && (
                                            <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase px-8 h-11 gap-2.5 tracking-widest border-pink-300 text-pink-600 hover:bg-pink-50"
                                                onClick={() => { setShowDetails(false); openPrintDialog(selectedOrder, "gift"); }}>
                                                <Printer className="h-4 w-4" /> Gift Receipt
                                            </Button>
                                        )}
                                        <Button className="rounded-xl font-black text-[10px] uppercase px-8 h-11 shadow-lg shadow-primary/30 gap-2.5 tracking-widest"
                                            onClick={() => { setShowDetails(false); openPrintDialog(selectedOrder, "sales"); }}>
                                            <Printer className="h-4 w-4" /> Print Receipt
                                        </Button>
                                        </>
                                    )}
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Print Receipt */}
            {showPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: false }}
                    tenders={selectedOrder.tenders || []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => { setShowPrint(false); setIsLoadingReceipt(false); }}
                />
            )}

            {/* Print Gift Receipt */}
            {showGiftPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: true }}
                    tenders={selectedOrder.tenders || []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => { setShowGiftPrint(false); setIsLoadingReceipt(false); }}
                />
            )}

            {/* Update Tender Modal */}
            {showUpdateTender && selectedOrder && (
                <UpdateTenderModal
                    order={selectedOrder}
                    open={showUpdateTender}
                    onOpenChange={setShowUpdateTender}
                    onSuccess={fetchOrders}
                />
            )}

            {/* Print Return Receipt */}
            {showReturnPrint && selectedOrder && (
                <PrintReturnReceipt
                    returnRef={
                        isRefundPrint
                            ? (returnDetails?.refundNumber || selectedOrder.refundNumber || selectedOrder.orderNumber || "")
                            : (returnDetails?.returnNumber || selectedOrder.returnNumber || selectedOrder.orderNumber || "")
                    }
                    isRefund={isRefundPrint}
                    isAlliance={!!selectedOrder.alliance}
                    originalOrders={[{ orderNumber: selectedOrder.orderNumber, grandTotal: Number(selectedOrder.grandTotal) }]}
                    returnedLines={(returnDetails?.items ?? []).map((item: any) => ({
                        name: item.item?.description || "Unknown Item",
                        sku: item.item?.sku || "-",
                        size: item.item?.size?.name ?? "",
                        brand: item.item?.brand?.name,
                        returnQty: item.returnableQty || item.quantity,
                        paidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        refundAmount: Number(item.refundAmount || 0),
                        orderNumber: selectedOrder.orderNumber,
                        unitPrice: Number(item.unitPrice || 0),
                        discountAmount: Number(item.discountAmount || 0),
                        discountPercent: Number(item.discountPercent || 0),
                        taxAmount: Number(item.taxAmount || 0),
                        taxPercent: Number(item.taxPercent || 0),
                        refundPerUnit: item.refundPerUnit,
                        priceAdjusted: item.priceAdjusted || false,
                        originalPaidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        couponDeduction: Number(item.couponDeduction || 0),
                    }))}
                    refundTotal={returnDetails?.items?.reduce((sum: number, item: any) => sum + Number(item.refundAmount || 0), 0) ?? 0}
                    notes={returnDetails?.reason}
                    discountNotes={returnDetails?.discountNotes}
                    returnedAt={returnDetails?.returnedAt}
                    exchangeVoucher={returnDetails?.exchangeVoucher ?? null}
                    paymentMethod={selectedOrder.paymentMethod}
                    isLoading={isLoadingReceipt}
                    onClose={() => setShowReturnPrint(false)}
                />
            )}

            {/* Claim Receipt */}
            {showClaimReceipt && selectedClaim && (
                <PrintClaimReceipt
                    claim={selectedClaim}
                    onClose={() => {
                        setShowClaimReceipt(false);
                        setSelectedClaim(null);
                    }}
                />
            )}

            {/* ── Sales History Bulk Import Modal ── */}
            <SalesHistoryBulkUploadModal
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                uploadId={activeUploadId}
                onUploadIdChange={setActiveUploadId}
                onSuccess={fetchOrders}
            />

            {/* ── Online Sales Bulk upload modal ── */}
            <OnlineSalesBulkUploadModal
                open={isOnlineSalesUploadOpen}
                onOpenChange={setIsOnlineSalesUploadOpen}
                onSuccess={fetchOrders}
            />
        </div>
    );
}
