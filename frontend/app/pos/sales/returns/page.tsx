"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft, Search, Loader2, RotateCcw, ArrowLeftRight,
    AlertCircle, CheckCircle2, Minus, Plus, Info, FileText, Send, X, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
import { PrintReturnReceipt, type ReturnReceiptLine } from "@/components/pos/print-return-receipt";
import { ManagerVerificationDialog } from "@/components/auth/manager-verification-dialog";

function paidPerUnit(oi: any, orderGrandTotal: number, orderLineTotalsSum: number) {
  // Distribute grandTotal proportionally based on each item's lineTotal share
  // This correctly handles global discounts (coupon/promo applied at order level)
  const qty = Number(oi.quantity);
  if (qty <= 0) {
    console.warn(`Invalid quantity for item ${oi.itemId}:`, qty);
    return 0;
  }
  
  // If the order line totals sum is extremely close to grand total (within FBR fee and minor rounding),
  // then we can just return the actual lineTotal divided by quantity to avoid distributing FBR fee/rounding.
  const lineTotal = Number(oi.lineTotal);
  if (Math.abs(orderLineTotalsSum - orderGrandTotal) <= 5) {
    return lineTotal / qty;
  }
  
  const itemShare = orderLineTotalsSum > 0 ? (lineTotal / orderLineTotalsSum) * orderGrandTotal : lineTotal;
  return itemShare / qty;
}

const REASON_CODES = [
    { value: "DEFECTIVE", label: "Defective / Damaged" },
    { value: "WRONG_ITEM", label: "Wrong Item Delivered" },
    { value: "SIZE_ISSUE", label: "Size / Fit Issue" },
    { value: "QUALITY", label: "Quality Not as Expected" },
    { value: "CUSTOMER_CHANGE_MIND", label: "Customer Changed Mind" },
    { value: "OTHER", label: "Other" },
];

type Mode = "return" | "exchange" | "claim" | "refund";

interface ReturnLine {
    orderId: string; orderNumber: string;
    orderItemId: string; itemId: string;
    name: string; sku: string; brand?: string; size?: string; color?: string;
    orderedQty: number; returnQty: number;
    paidPerUnit: number; originalUnitPrice: number; discountPercent: number;
    discountAmount?: number; taxAmount?: number; taxPercent?: number;
    originalQty?: number;
}

interface NewLine { itemId: string; name: string; sku: string; size?: string; color?: string; quantity: number; unitPrice: number; discountPct: number; }
interface LoadedOrder { id: string; orderNumber: string; grandTotal: number; createdAt: string; items: any[]; coupon?: string; promo?: string; alliance?: string; }

export default function ReturnsPage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canReturn = hasPermission('pos.return.create');
    const canExchange = hasPermission('pos.exchange.create');
    const canClaim = hasPermission('pos.claim.create');

    // ── Order search ──────────────────────────────────────────────────
    const [orderSearch, setOrderSearch] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // ── Loaded orders (multi-order support) ───────────────────────────
    const [loadedOrders, setLoadedOrders] = useState<LoadedOrder[]>([]);
    const isAllianceCase = loadedOrders.some(o => !!o.alliance);

    // ── Return lines (flat, tagged with orderId) ──────────────────────
    const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

    // ── New items for exchange ────────────────────────────────────────
    const [newLines, setNewLines] = useState<NewLine[]>([]);
    const [newItemSearch, setNewItemSearch] = useState("");
    const [newItemResults, setNewItemResults] = useState<any[]>([]);

    // ── Mode & misc ───────────────────────────────────────────────────
    const [mode, setMode] = useState<Mode | "">( "");
    const [pendingMode, setPendingMode] = useState<Mode | "">("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [reasonCode, setReasonCode] = useState("DEFECTIVE");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVerify, setShowVerify] = useState(false);

    const handleSelectionClick = useCallback((selected: Mode) => {
        if (selected === mode || (selected === "return" && mode === "exchange")) {
            return;
        }
        setPendingMode(selected);
        setShowConfirmModal(true);
    }, [mode]);

    const confirmModeSelection = useCallback(() => {
        if (pendingMode) {
            setMode(pendingMode);
            if (pendingMode !== "return" && pendingMode !== "exchange") {
                setNewLines([]);
            }
        }
        setShowConfirmModal(false);
    }, [pendingMode]);

    // ── Memo-level discount on new items (exchange only) ──────────────
    const [memoDiscType, setMemoDiscType] = useState<"pct" | "flat">("pct");
    const [memoDiscValue, setMemoDiscValue] = useState<number>(0);

    // ── Return receipt dialog ─────────────────────────────────────────
    const [returnReceipt, setReturnReceipt] = useState<{
        returnRef: string;
        refundTotal: number;
        returnedAt: string;
        itemRefundDetails?: {
            orderItemId: string;
            itemId: string;
            quantity: number;
            originalPaidPerUnit: number;
            refundPerUnit: number;
            priceAdjusted: boolean;
            couponDeduction?: number;
            unitPrice?: number;
            discountPercent?: number;
            discountAmount?: number;
            taxAmount?: number;
            taxPercent?: number;
        }[];
        exchangeVoucher?: { code: string; faceValue: number; expiresAt: string } | null;
    } | null>(null);

    // ── Add an order ──────────────────────────────────────────────────
    const handleAddOrder = useCallback(async () => {
        if (!orderSearch.trim()) return;
        if (loadedOrders.find(o => o.orderNumber.toLowerCase() === orderSearch.trim().toLowerCase())) {
            toast.info("Order already added"); return;
        }
        setIsSearching(true);
        try {
            const res = await authFetch("/pos-sales/orders", { params: { search: orderSearch.trim(), limit: 5 } });
            if (res.ok && res.data?.status) {
                const found = res.data.data?.[0];
                if (!found) { toast.error("Order not found"); return; }
                if (found.status === "voided") { toast.error("Cannot process a voided order"); return; }

                setLoadedOrders(prev => [...prev, {
                    id: found.id, orderNumber: found.orderNumber,
                    grandTotal: Number(found.grandTotal), createdAt: found.createdAt,
                    items: found.items || [],
                    coupon: found.coupon?.code || undefined,
                    promo: found.promo?.code || undefined,
                    alliance: found.alliance?.code || undefined,
                }]);

                // Append return lines for this order (qty = 0 by default)
                const orderItems = found.items || [];
                const lineTotalsSum = orderItems.reduce((s: number, oi: any) => s + Number(oi.lineTotal), 0);
                const orderGrandTotal = Number(found.grandTotal);

                const lines: ReturnLine[] = orderItems
                    .filter((oi: any) => {
                        const alreadyReturned = Number(oi.returnedQty ?? 0);
                        const alreadyClaimed = Number(oi.claimedQty ?? 0);
                        const totalProcessed = alreadyReturned + alreadyClaimed;
                        return Number(oi.quantity) - totalProcessed > 0; // skip fully returned/claimed items
                    })
                    .map((oi: any) => {
                    const alreadyReturned = Number(oi.returnedQty ?? 0);
                    const alreadyClaimed = Number(oi.claimedQty ?? 0);
                    const totalProcessed = alreadyReturned + alreadyClaimed;
                    const remainingQty = Number(oi.quantity) - totalProcessed;
                    return {
                        orderId: found.id, orderNumber: found.orderNumber,
                        orderItemId: oi.id, itemId: oi.itemId,
                        name: oi.item?.description || oi.itemId,
                        sku: oi.item?.sku || "",
                        brand: oi.item?.brand || oi.item?.brandName || "",
                        size: oi.item?.size?.name || "",
                        color: oi.item?.color?.name || "",
                        orderedQty: remainingQty, returnQty: 0,
                        paidPerUnit: paidPerUnit(oi, orderGrandTotal, lineTotalsSum),
                        originalUnitPrice: Number(oi.unitPrice),
                        discountPercent: Number(oi.discountPercent ?? 0),
                        discountAmount: Number(oi.discountAmount ?? 0),
                        taxAmount: Number(oi.taxAmount ?? 0),
                        taxPercent: Number(oi.taxPercent ?? 0),
                        originalQty: Number(oi.quantity),
                    };
                });
                setReturnLines(prev => [...prev, ...lines]);
                setOrderSearch("");
            } else { toast.error(res.data?.message || "Order not found"); }
        } catch { toast.error("Failed to search order"); }
        finally { setIsSearching(false); }
    }, [orderSearch, loadedOrders]);

    // ── Remove an order ───────────────────────────────────────────────
    const removeOrder = (orderId: string) => {
        setLoadedOrders(prev => {
            const updated = prev.filter(o => o.id !== orderId);
            if (updated.length === 0) {
                setMode("");
            }
            return updated;
        });
        setReturnLines(prev => prev.filter(l => l.orderId !== orderId));
    };

    // ── Return qty ────────────────────────────────────────────────────
    const setReturnQty = (orderItemId: string, qty: number) =>
        setReturnLines(prev => prev.map(l =>
            l.orderItemId === orderItemId
                ? { ...l, returnQty: Math.min(Math.max(0, qty), l.orderedQty) }
                : l
        ));

    // ── New item search ───────────────────────────────────────────────
    const handleNewItemSearch = useCallback(async (q: string) => {
        setNewItemSearch(q);
        if (q.trim().length < 2) { setNewItemResults([]); return; }
        try {
            const res = await authFetch("/pos-sales/lookup", { params: { q: q.trim() } });
            if (res.ok && res.data?.status) setNewItemResults(res.data.data || []);
        } catch { /* ignore */ }
    }, []);

    const addNewItem = (p: any) => {
        setNewLines(prev => {
            const ex = prev.find(l => l.itemId === p.id);
            if (ex) return prev.map(l => l.itemId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
            return [...prev, { itemId: p.id, name: p.description, sku: p.sku, size: typeof p.size === "object" ? p.size?.name : (p.size || ""), color: typeof p.color === "object" ? p.color?.name : (p.color || ""), quantity: 1, unitPrice: Number(p.unitPrice), discountPct: 0 }];
        });
        setNewItemSearch(""); setNewItemResults([]);
    };

    const setNewQty = (itemId: string, qty: number) => {
        if (qty <= 0) {
            setNewLines(prev => {
                const updated = prev.filter(l => l.itemId !== itemId);
                if (updated.length === 0 && mode === "exchange") {
                    setMode("return");
                }
                return updated;
            });
            return;
        }
        setNewLines(prev => prev.map(l => l.itemId === itemId ? { ...l, quantity: qty } : l));
    };

    const setNewDisc = (itemId: string, pct: number) =>
        setNewLines(prev => prev.map(l => l.itemId === itemId ? { ...l, discountPct: Math.min(100, Math.max(0, pct)) } : l));

    // ── Derived ───────────────────────────────────────────────────────
    const selectedLines = returnLines.filter(l => l.returnQty > 0);
    const refundTotal = selectedLines.reduce((s, l) => s + l.paidPerUnit * l.returnQty, 0);

    // New items: apply item-level discount first
    const newLinesNet = newLines.map(l => {
        const gross = l.unitPrice * l.quantity;
        const discAmt = Math.round(gross * (l.discountPct / 100));
        return { ...l, gross, discAmt, net: gross - discAmt };
    });
    const newSubtotal = newLinesNet.reduce((s, l) => s + l.gross, 0);
    const newItemDiscTotal = newLinesNet.reduce((s, l) => s + l.discAmt, 0);
    const newAfterItemDisc = newSubtotal - newItemDiscTotal;

    // Memo-level discount applied on top
    const memoDiscAmt = memoDiscType === "pct"
        ? Math.round(newAfterItemDisc * (memoDiscValue / 100))
        : Math.min(memoDiscValue, newAfterItemDisc);
    const newTotal = Math.max(0, newAfterItemDisc - memoDiscAmt);

    const diff = newTotal - refundTotal;
    const isMultiOrder = loadedOrders.length > 1;

    // ── Submit ────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (managerUserId?: string) => {
        if (loadedOrders.length === 0) { toast.error("Add at least one order"); return; }
        if (selectedLines.length === 0) { toast.error("Select at least one item to return"); return; }
        if (mode === "exchange" && newLines.length === 0) { toast.error("Add new items for exchange"); return; }

        setIsSubmitting(true);
        try {
            let res: any;

            if (mode === "return") {
                // Single-order return (or loop per order for multi)
                if (!isMultiOrder) {
                    const orderId = loadedOrders[0].id;
                    res = await authFetch(`/pos-sales/orders/${orderId}/return`, {
                        method: "POST",
                        body: {
                            items: selectedLines.map(l => ({ orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty })),
                            reason: notes || undefined,
                        },
                    });
                } else {
                    // Multi-order return: process each order separately
                    let totalRefund = 0;
                    let allOk = true;
                    for (const order of loadedOrders) {
                        const orderLines = selectedLines.filter(l => l.orderId === order.id);
                        if (orderLines.length === 0) continue;
                        const r = await authFetch(`/pos-sales/orders/${order.id}/return`, {
                            method: "POST",
                            body: {
                                items: orderLines.map(l => ({ orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty })),
                                reason: notes || undefined,
                            },
                        });
                        if (r.ok && r.data?.status) { totalRefund += r.data.refundAmount ?? 0; }
                        else { toast.error(`Failed for ${order.orderNumber}: ${r.data?.message}`); allOk = false; }
                    }
                    if (allOk) toast.success(`Returns processed across ${loadedOrders.length} orders. Total refund: ${formatCurrency(totalRefund)}`);
                    router.push("/pos/sales/history"); return;
                }
            } else if (mode === "exchange") {
                if (isMultiOrder) {
                    // Multi-order exchange — single endpoint
                    res = await authFetch("/pos-sales/orders/multi-exchange", {
                        method: "POST",
                        body: {
                            returnedItems: selectedLines.map(l => ({ orderId: l.orderId, orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty })),
                            newItems: newLinesNet.map(l => ({
                                itemId: l.itemId, quantity: l.quantity,
                                // effective unit price = (net after item disc - proportional memo disc) / qty
                                unitPrice: newAfterItemDisc > 0
                                    ? Math.round(((l.net - memoDiscAmt * (l.net / newAfterItemDisc)) / l.quantity) * 100) / 100
                                    : l.unitPrice,
                            })),
                            reason: notes || undefined,
                        },
                    });
                } else {
                    res = await authFetch(`/pos-sales/orders/${loadedOrders[0].id}/exchange`, {
                        method: "POST",
                        body: {
                            returnedItems: selectedLines.map(l => ({ orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty })),
                            newItems: newLinesNet.map(l => ({
                                itemId: l.itemId, quantity: l.quantity,
                                unitPrice: newAfterItemDisc > 0
                                    ? Math.round(((l.net - memoDiscAmt * (l.net / newAfterItemDisc)) / l.quantity) * 100) / 100
                                    : l.unitPrice,
                            })),
                            reason: notes || undefined,
                        },
                    });
                }
            } else if (mode === "refund") {
                // Refund — cash refund with refund voucher (record-only)
                if (!isMultiOrder) {
                    const orderId = loadedOrders[0].id;
                    // Calculate total refund amount
                    const totalRefundAmount = selectedLines.reduce((sum, l) => sum + (l.paidPerUnit * l.returnQty), 0);
                    const items = selectedLines.map(l => ({ orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty }));
                    
                    res = await authFetch(`/pos-sales/orders/${orderId}/refund`, {
                        method: "POST",
                        body: {
                            refundAmount: totalRefundAmount,
                            items,
                            reason: notes || undefined,
                            managerUserId,
                        },
                    });
                } else {
                    // Multi-order refund: process each order separately
                    let totalRefund = 0;
                    let allOk = true;
                    for (const order of loadedOrders) {
                        const orderLines = selectedLines.filter(l => l.orderId === order.id);
                        if (orderLines.length === 0) continue;
                        const refundAmount = orderLines.reduce((sum, l) => sum + (l.paidPerUnit * l.returnQty), 0);
                        const items = orderLines.map(l => ({ orderItemId: l.orderItemId, itemId: l.itemId, quantity: l.returnQty }));
                        
                        const r = await authFetch(`/pos-sales/orders/${order.id}/refund`, {
                            method: "POST",
                            body: {
                                refundAmount,
                                items,
                                reason: notes || undefined,
                                managerUserId,
                            },
                        });
                        if (r.ok && r.data?.status) { totalRefund += refundAmount; }
                        else { toast.error(`Failed for ${order.orderNumber}: ${r.data?.message}`); allOk = false; }
                    }
                    if (allOk) toast.success(`Cash refunds processed across ${loadedOrders.length} orders. Total: ${formatCurrency(totalRefund)}`);
                    router.push("/pos/sales/history"); return;
                }
            } else {
                // Claim — only single order supported
                res = await authFetch("/pos-claims", {
                    method: "POST",
                    body: {
                        salesOrderId: loadedOrders[0].id,
                        claimType: "RETURN", reasonCode,
                        reasonNotes: notes || undefined,
                        items: selectedLines.map(l => ({ salesOrderItemId: l.orderItemId, itemId: l.itemId, claimedQty: l.returnQty, unitPaidPrice: l.paidPerUnit })),
                    },
                });
            }

            if (res?.ok && res.data?.status) {
                if (mode === "return") {
                    const voucherMsg = res.data.exchangeVoucher 
                        ? ` Exchange Voucher: ${res.data.exchangeVoucher.code}` 
                        : ` Refund: ${formatCurrency(res.data.refundAmount ?? refundTotal)}`;
                    toast.success(`Return processed.${voucherMsg}`);
                    // Show return receipt instead of redirecting
                    setReturnReceipt({
                        returnRef: res.data.returnRef || res.data.data?.returnNumber || `RET-${Date.now()}`,
                        refundTotal: res.data.refundAmount ?? refundTotal,
                        returnedAt: new Date().toISOString(),
                        itemRefundDetails: res.data.itemRefundDetails,
                        exchangeVoucher: res.data.exchangeVoucher || null,
                    });
                } else if (mode === "refund") {
                    const refundVoucherMsg = res.data.refundVoucher 
                        ? ` Refund Voucher: ${res.data.refundVoucher.code} (Record only)` 
                        : '';
                    toast.success(`Cash refunded: ${formatCurrency(res.data.refundAmount ?? refundTotal)}.${refundVoucherMsg}`);
                    router.push("/pos/sales/history");
                } else if (mode === "exchange") {
                    const d = res.data.data?.difference ?? diff;
                    toast.success(d > 0 ? `Exchange done. Customer pays ${formatCurrency(d)} extra` : d < 0 ? `Exchange done. Refund ${formatCurrency(Math.abs(d))}` : "Exchange done. No balance");
                    router.push("/pos/sales/history");
                } else {
                    toast.success(res.data.message || "Claim submitted");
                    router.push("/pos/sales/history");
                }
            } else { toast.error(res?.data?.message || "Operation failed"); }
        } catch { toast.error("Operation failed. Check connection."); }
        finally { setIsSubmitting(false); }
    }, [loadedOrders, selectedLines, newLines, mode, notes, reasonCode, isMultiOrder, refundTotal, diff, router]);

    return (
        <>
        <div className="flex flex-col gap-5 p-6 px-10 max-w-5xl mx-auto">

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/pos/sales/history")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Returns, Exchanges & Claims</h1>
                    <p className="text-sm text-muted-foreground">Supports multiple receipts in one exchange</p>
                </div>
            </div>

            {/* Policy notice */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-sm">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-blue-700 dark:text-blue-400">
                    <strong>Policy:</strong> Refunds are always at the <strong>price the customer paid</strong>.
                    Add multiple receipts for a consolidated exchange. Claims go to ERP for approval.
                </p>
            </div>

            {/* Order search — add multiple */}
            <div className="rounded-xl border bg-card p-5 space-y-3">
                <Label className="text-sm font-semibold">
                    Add Receipt(s)
                    {isMultiOrder && <Badge variant="secondary" className="ml-2 text-xs">{loadedOrders.length} orders</Badge>}
                </Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="Order number (e.g. SO-20260401-0001)"
                        value={orderSearch}
                        onChange={e => setOrderSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddOrder()}
                        className="flex-1 font-mono"
                    />
                    <Button onClick={handleAddOrder} disabled={isSearching || !orderSearch.trim()}>
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-1.5 hidden sm:inline">Add</span>
                    </Button>
                </div>

                {/* Loaded orders chips */}
                {loadedOrders.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {loadedOrders.map(o => (
                            <div key={o.id} className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-300/80 dark:border-emerald-700/80 px-4 py-2 shadow-sm transition-all hover:shadow duration-200">
                                <div className="p-1 bg-emerald-500 text-white rounded-full">
                                    <Receipt className="h-3 w-3 shrink-0" />
                                </div>
                                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm tracking-wide">{o.orderNumber}</span>
                                <div className="h-3 w-px bg-emerald-300/60 dark:bg-emerald-700/60" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">{formatCurrency(o.grandTotal)}</span>
                                <button 
                                    onClick={() => removeOrder(o.id)} 
                                    className="text-emerald-600 hover:text-destructive dark:text-emerald-400 dark:hover:text-red-400 transition-colors ml-1 hover:scale-110 duration-200"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {loadedOrders.length > 0 && (
                <>
                    {mode === "" ? (
                        <div className="rounded-xl border bg-card p-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold tracking-tight">Select Transaction Type</h2>
                                <p className="text-sm text-muted-foreground">Please choose the type of action you want to perform for the loaded order(s).</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                                {/* Return / Exchange Card */}
                                {canReturn && (
                                    <button
                                        onClick={() => handleSelectionClick("return")}
                                        className="group relative flex flex-col items-center text-center p-6 bg-emerald-50/30 hover:bg-emerald-50 dark:bg-emerald-950/5 dark:hover:bg-emerald-950/20 border border-emerald-200/60 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                                    >
                                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                                            <RotateCcw className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1 text-sm sm:text-base">Return / Exchange</h3>
                                        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Return items for store credit/voucher or exchange for other products.</p>
                                    </button>
                                )}

                                {/* Cash Refund Card */}
                                {canReturn && (
                                    <button
                                        onClick={() => handleSelectionClick("refund")}
                                        className="group relative flex flex-col items-center text-center p-6 bg-indigo-50/30 hover:bg-indigo-50 dark:bg-indigo-950/5 dark:hover:bg-indigo-950/20 border border-indigo-200/60 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                                    >
                                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                                            <Receipt className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-indigo-800 dark:text-indigo-300 mb-1 text-sm sm:text-base">Cash Refund</h3>
                                        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Process a cash refund directly to the customer for their returned items.</p>
                                    </button>
                                )}

                                {/* ERP Claim Card */}
                                {!isMultiOrder && canClaim && (
                                    <button
                                        onClick={() => handleSelectionClick("claim")}
                                        className="group relative flex flex-col items-center text-center p-6 bg-amber-50/30 hover:bg-amber-50 dark:bg-amber-950/5 dark:hover:bg-amber-950/20 border border-amber-200/60 hover:border-amber-500 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                                    >
                                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-1 text-sm sm:text-base">ERP Claim</h3>
                                        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Submit items to ERP for validation and inspection approval.</p>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Tabs value={mode === "exchange" ? "return" : mode} onValueChange={(v: any) => handleSelectionClick(v)}>
                            <TabsList className={`grid w-full max-w-md ${isMultiOrder ? "grid-cols-2" : "grid-cols-3"}`}>
                                {canReturn && (
                                    <TabsTrigger value="return" className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                                        <RotateCcw className="h-3.5 w-3.5" />Return
                                    </TabsTrigger>
                                )}
                                {canReturn && (
                                    <TabsTrigger value="refund" className="gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                        <Receipt className="h-3.5 w-3.5" />Refund
                                    </TabsTrigger>
                                )}
                                {!isMultiOrder && canClaim && (
                                    <TabsTrigger value="claim" className="gap-1.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                                        <FileText className="h-3.5 w-3.5" />Claim
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            {isMultiOrder && mode === "claim" && setMode("return") as any}

                            {mode === "refund" && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700">
                                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>Cash refund at original price. Refund voucher generated for record keeping only.</span>
                                </div>
                            )}

                            {mode === "claim" && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>Claim is submitted to ERP for review. No immediate refund — ERP verifies and approves.</span>
                                </div>
                            )}

                            <TabsContent value={mode === "exchange" ? "return" : mode} className="mt-4 space-y-4">

                            {/* Items table — grouped by order */}
                            <div className="rounded-xl border bg-card overflow-hidden">
                                <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
                                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm">Items to Return</span>
                                    {isMultiOrder && <span className="text-xs text-muted-foreground">— from {loadedOrders.length} receipts</span>}
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent bg-muted/20">
                                            {isMultiOrder && <TableHead className="text-xs uppercase text-muted-foreground">Receipt</TableHead>}
                                            <TableHead className="text-xs uppercase">Item</TableHead>
                                            <TableHead className="text-center text-xs uppercase">Size</TableHead>
                                            <TableHead className="text-center text-xs uppercase">Color</TableHead>
                                            <TableHead className="text-right text-xs uppercase">Ordered</TableHead>
                                            <TableHead className="text-right text-xs uppercase">Unit Price</TableHead>
                                            <TableHead className="text-right text-xs uppercase">
                                                {isAllianceCase ? "Disc Amt" : "Disc %"}
                                            </TableHead>
                                            <TableHead className="text-right text-xs uppercase">Tax %</TableHead>
                                            <TableHead className="text-right text-xs uppercase text-emerald-700">Paid/Unit</TableHead>
                                            <TableHead className="text-center text-xs uppercase">Return Qty</TableHead>
                                            <TableHead className="text-right text-xs uppercase text-destructive">Refund</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {returnLines.map(line => (
                                            <TableRow key={line.orderItemId} className={cn(line.returnQty > 0 && "bg-destructive/5")}>
                                                {isMultiOrder && (
                                                    <TableCell>
                                                        <span className="font-mono text-xs text-muted-foreground">{line.orderNumber}</span>
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <p className="font-medium text-sm">
                                                        {line.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-mono">{line.sku}</p>
                                                </TableCell>
                                                <TableCell className="text-center text-sm font-semibold">{line.size || "—"}</TableCell>
                                                <TableCell className="text-center text-sm font-semibold">{line.color || "—"}</TableCell>
                                                <TableCell className="text-right text-sm">{line.orderedQty}</TableCell>
                                                <TableCell className="text-right text-sm font-mono">{formatCurrency(line.originalUnitPrice)}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {isAllianceCase ? (
                                                        line.discountAmount && line.discountAmount > 0 ? (
                                                            <span className="text-destructive font-medium">
                                                                {formatCurrency(line.discountAmount / (line.originalQty || 1))}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )
                                                    ) : (
                                                        line.discountPercent > 0 ? (
                                                            <span className="text-destructive font-medium">{line.discountPercent}%</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {line.taxPercent && line.taxPercent > 0
                                                        ? <span className="text-muted-foreground font-medium">{line.taxPercent}%</span>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm font-mono text-emerald-700">
                                                    {formatCurrency(line.paidPerUnit)}
                                                    <div className="text-[10px] text-muted-foreground font-normal">
                                                        (incl. tax & disc)
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Button variant="outline" size="icon" className="h-7 w-7"
                                                            onClick={() => setReturnQty(line.orderItemId, line.returnQty - 1)}
                                                            disabled={line.returnQty <= 0}><Minus className="h-3 w-3" /></Button>
                                                        <span className="w-8 text-center font-bold tabular-nums">{line.returnQty}</span>
                                                        <Button variant="outline" size="icon" className="h-7 w-7"
                                                            onClick={() => setReturnQty(line.orderItemId, line.returnQty + 1)}
                                                            disabled={line.returnQty >= line.orderedQty}><Plus className="h-3 w-3" /></Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm font-mono text-destructive">
                                                    {line.returnQty > 0 ? `${formatCurrency(line.paidPerUnit * line.returnQty)}` : "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* New items for exchange */}
                            {mode === "exchange" && (
                                <>
                                <div className="rounded-xl border bg-card overflow-hidden">
                                    <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
                                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-semibold text-sm">New Items</span>
                                        <span className="text-xs text-muted-foreground">— at current price</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input className="pl-9" placeholder="Search item by name or SKU..."
                                                value={newItemSearch} onChange={e => handleNewItemSearch(e.target.value)} />
                                            {newItemResults.length > 0 && (
                                                <div className="absolute left-0 right-0 top-11 z-50 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {newItemResults.map(p => (
                                                        <button key={p.id} onClick={() => addNewItem(p)}
                                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted text-sm border-b last:border-0">
                                                            <div className="text-left">
                                                                <p className="font-medium">
                                                                    {p.description}
                                                                    {(typeof p.size === "object" ? p.size?.name : p.size) && (
                                                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                                                                            Size: {typeof p.size === "object" ? p.size?.name : p.size}
                                                                        </span>
                                                                    )}
                                                                    {(typeof p.color === "object" ? p.color?.name : p.color) && (
                                                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                                                                            Color: {typeof p.color === "object" ? p.color?.name : p.color}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                                                            </div>
                                                            <span className="font-bold font-mono">{formatCurrency(p.unitPrice)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {newLines.length > 0 && (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent bg-muted/20">
                                                        <TableHead className="text-xs uppercase">Item</TableHead>
                                                         <TableHead className="text-center text-xs uppercase">Size</TableHead>
                                                         <TableHead className="text-center text-xs uppercase">Color</TableHead>
                                                        <TableHead className="text-right text-xs uppercase">Price</TableHead>
                                                        <TableHead className="text-center text-xs uppercase">Qty</TableHead>
                                                        <TableHead className="text-center text-xs uppercase text-primary">Disc %</TableHead>
                                                        <TableHead className="text-right text-xs uppercase">Net Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {newLinesNet.map(line => (
                                                        <TableRow key={line.itemId}>
                                                            <TableCell>
                                                                <p className="font-medium text-sm">
                                                                    {line.name}
                                                                    {line.size && (
                                                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                                                                            Size: {line.size}
                                                                        </span>
                                                                    )}
                                                                    {line.color && (
                                                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                                                                            Color: {line.color}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground font-mono">{line.sku}</p>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatCurrency(line.unitPrice)}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setNewQty(line.itemId, line.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                                                    <span className="w-8 text-center font-bold tabular-nums">{line.quantity}</span>
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setNewQty(line.itemId, line.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Input
                                                                        type="number" min={0} max={100}
                                                                        className="w-16 h-7 text-center text-xs font-mono"
                                                                        value={line.discountPct || ""}
                                                                        placeholder="0"
                                                                        onChange={e => setNewDisc(line.itemId, parseFloat(e.target.value) || 0)}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">%</span>
                                                                </div>
                                                                {line.discAmt > 0 && (
                                                                    <div className="text-[10px] text-destructive text-center mt-0.5">−{formatCurrency(line.discAmt)}</div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold font-mono text-sm">
                                                                {formatCurrency(line.net)}
                                                                {line.discAmt > 0 && (
                                                                    <div className="text-[10px] text-muted-foreground font-normal line-through">{formatCurrency(line.gross)}</div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>

                                {/* Memo-level discount on new items */}
                                {newLines.length > 0 && (
                                    <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-2">
                                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Memo Discount (applied to all new items)</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <select
                                                className="h-8 rounded-md border bg-background px-2 text-xs"
                                                value={memoDiscType}
                                                onChange={e => setMemoDiscType(e.target.value as "pct" | "flat")}
                                            >
                                                <option value="pct">Percent (%)</option>
                                                <option value="flat">Flat (Rs.)</option>
                                            </select>
                                            <Input
                                                type="number" min={0}
                                                max={memoDiscType === "pct" ? 100 : undefined}
                                                className="w-28 h-8 text-sm font-mono"
                                                placeholder={memoDiscType === "pct" ? "0 – 100" : "Amount"}
                                                value={memoDiscValue || ""}
                                                onChange={e => setMemoDiscValue(parseFloat(e.target.value) || 0)}
                                            />
                                            {memoDiscAmt > 0 && (
                                                <span className="text-sm text-primary font-semibold">−{formatCurrency(memoDiscAmt)}</span>
                                            )}
                                            {memoDiscValue > 0 && (
                                                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                                                    onClick={() => setMemoDiscValue(0)}>Clear</Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                            )}

                            {/* Claim reason */}
                            {mode === "claim" && (
                                <div className="rounded-xl border bg-card p-4 space-y-3">
                                    <Label className="text-sm font-semibold">Claim Reason</Label>
                                    <Select value={reasonCode} onValueChange={setReasonCode}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{REASON_CODES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Summary */}
                            {selectedLines.length > 0 && (
                                <div className="rounded-xl border bg-card p-5 space-y-4">
                                    <h3 className="font-semibold text-sm">Summary</h3>
                                    <div className="space-y-2 text-sm">
                                        {isMultiOrder && (
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Receipts</span>
                                                <span>{loadedOrders.length} orders ({formatCurrency(loadedOrders.reduce((s, o) => s + o.grandTotal, 0))} total)</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Items returning</span>
                                            <span>{selectedLines.reduce((s, l) => s + l.returnQty, 0)} unit(s)</span>
                                        </div>
                                        <div className="flex justify-between text-destructive font-medium">
                                            <span>{mode === "claim" ? "Claimed amount" : "Return value (at paid price)"}</span>
                                            <span>{formatCurrency(refundTotal)}</span>
                                        </div>
                                        {mode === "exchange" && newLines.length > 0 && (
                                            <>
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>New items subtotal</span>
                                                    <span className="font-mono">{formatCurrency(newSubtotal)}</span>
                                                </div>
                                                {newItemDiscTotal > 0 && (
                                                    <div className="flex justify-between text-destructive">
                                                        <span>Item discounts</span>
                                                        <span className="font-mono">−{formatCurrency(newItemDiscTotal)}</span>
                                                    </div>
                                                )}
                                                {memoDiscAmt > 0 && (
                                                    <div className="flex justify-between text-primary">
                                                        <span>Memo discount ({memoDiscType === "pct" ? `${memoDiscValue}%` : `flat ${formatCurrency(memoDiscValue)}`})</span>
                                                        <span className="font-mono">−{formatCurrency(memoDiscAmt)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-blue-600 font-medium">
                                                    <span>New items net total</span>
                                                    <span className="font-mono">{formatCurrency(newTotal)}</span>
                                                </div>
                                                <Separator />
                                                <div className={cn("flex justify-between font-bold text-base",
                                                    diff > 0 ? "text-destructive" : diff < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                                    <span>{diff > 0 ? "Customer pays extra" : diff < 0 ? "Refund to customer" : "No balance"}</span>
                                                    <span>{formatCurrency(Math.abs(diff))}</span>
                                                </div>
                                            </>
                                        )}
                                        {mode === "return" && (
                                            <>
                                                <Separator />
                                                <div className="flex justify-between font-bold text-base text-emerald-600">
                                                    <span>Total refund</span>
                                                    <span>{formatCurrency(refundTotal)}</span>
                                                </div>
                                            </>
                                        )}
                                        {mode === "claim" && (
                                            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>Claim sent to ERP. Refund not processed until ERP approves.</span>
                                            </div>
                                        )}
                                        {mode !== "claim" && selectedLines.some(l => l.discountPercent > 0) && (
                                            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>Refund is at the discounted price paid, not the original list price.</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                                        <Textarea placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none text-sm" />
                                    </div>
                                    <div className="flex gap-3 pt-1">
                                        <Button variant="outline" className="flex-1" onClick={() => router.push("/pos/sales/history")}>Cancel</Button>
                                        <Button
                                            className={cn("flex-1 gap-2",
                                                mode === "exchange" ? "bg-blue-600 hover:bg-blue-700"
                                                    : mode === "claim" ? "bg-amber-600 hover:bg-amber-700"
                                                        : "bg-destructive hover:bg-destructive/90")}
                                            onClick={(mode === "claim" || mode === "refund") ? () => setShowVerify(true) : () => handleSubmit()}
                                            disabled={
                                                isSubmitting ||
                                                selectedLines.length === 0 ||
                                                (mode === "exchange" && newLines.length === 0) ||
                                                (mode === "return" && !canReturn) ||
                                                (mode === "exchange" && !canExchange) ||
                                                (mode === "refund" && !canReturn) ||
                                                (mode === "claim" && !canClaim)
                                            }>
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : mode === "return" ? <RotateCcw className="h-4 w-4" />
                                                    : mode === "exchange" ? <ArrowLeftRight className="h-4 w-4" />
                                                        : mode === "refund" ? <Receipt className="h-4 w-4" />
                                                            : <Send className="h-4 w-4" />}
                                            {isSubmitting ? "Processing..."
                                                : mode === "return" ? `Process Return${isMultiOrder ? ` (${loadedOrders.length} receipts)` : ""}`
                                                    : mode === "exchange" ? `Process Exchange${isMultiOrder ? ` (${loadedOrders.length} receipts)` : ""}`
                                                        : mode === "refund" ? `Process Cash Refund${isMultiOrder ? ` (${loadedOrders.length} receipts)` : ""}`
                                                            : "Submit Claim to ERP"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                    )}
                </>
            )}
        </div>

            {/* ── Transaction Mode Confirmation Dialog ─────────────────── */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border rounded-2xl shadow-2xl p-6 max-w-md w-full mx-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            {/* Icon & Title based on pendingMode */}
                            {pendingMode === "return" && (
                                <>
                                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-4">
                                        <RotateCcw className="h-10 w-10 animate-bounce" />
                                    </div>
                                    <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">Confirm Return / Exchange</h3>
                                    <p className="text-sm text-muted-foreground mt-2 px-2 leading-relaxed">
                                        Are you sure you want to select <span className="font-semibold text-emerald-600 dark:text-emerald-400">Return / Exchange</span>? You will be able to return items for store credit/vouchers or exchange them for new products.
                                    </p>
                                </>
                            )}
                            {pendingMode === "refund" && (
                                <>
                                    <div className="p-4 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
                                        <Receipt className="h-10 w-10 animate-bounce" />
                                    </div>
                                    <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-300">Confirm Cash Refund</h3>
                                    <p className="text-sm text-muted-foreground mt-2 px-2 leading-relaxed">
                                        Are you sure you want to select <span className="font-semibold text-indigo-600 dark:text-indigo-400">Cash Refund</span>? This will refund the amount directly in cash to the customer.
                                    </p>
                                </>
                            )}
                            {pendingMode === "claim" && (
                                <>
                                    <div className="p-4 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl mb-4">
                                        <FileText className="h-10 w-10 animate-bounce" />
                                    </div>
                                    <h3 className="text-xl font-bold text-amber-800 dark:text-amber-300">Confirm ERP Claim</h3>
                                    <p className="text-sm text-muted-foreground mt-2 px-2 leading-relaxed">
                                        Are you sure you want to select <span className="font-semibold text-amber-600 dark:text-amber-400">ERP Claim</span>? This will submit a claim request to the ERP for review and inspection approval.
                                    </p>
                                </>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 w-full mt-6">
                                <Button 
                                    variant="outline" 
                                    className="flex-1 rounded-xl"
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setPendingMode("");
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className={cn(
                                        "flex-1 rounded-xl font-bold text-white transition-all hover:scale-105 duration-200 shadow-md hover:shadow-lg",
                                        pendingMode === "return" ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-emerald-500/20" :
                                        pendingMode === "refund" ? "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 shadow-indigo-500/20" :
                                        "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 shadow-amber-500/20"
                                    )}
                                    onClick={confirmModeSelection}
                                >
                                    Yes, Proceed
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Return Receipt Dialog ─────────────────────────────────── */}
            {returnReceipt && (
                <PrintReturnReceipt
                    returnRef={returnReceipt.returnRef}
                    isAlliance={isAllianceCase}
                    originalOrders={loadedOrders.map(o => ({ orderNumber: o.orderNumber, grandTotal: o.grandTotal }))}
                    returnedLines={selectedLines.map(l => {
                        const detail = returnReceipt.itemRefundDetails?.find((d: any) => d.orderItemId === l.orderItemId);
                        const refundPerUnit = detail ? detail.refundPerUnit : l.paidPerUnit;
                        return {
                            name: l.name,
                            sku: l.sku,
                            size: l.size,
                            color: l.color,
                            brand: l.brand,
                            returnQty: l.returnQty,
                            paidPerUnit: l.paidPerUnit,
                            refundPerUnit,
                            refundAmount: refundPerUnit * l.returnQty,
                            priceAdjusted: detail?.priceAdjusted ?? false,
                            originalPaidPerUnit: detail?.originalPaidPerUnit ?? l.paidPerUnit,
                            couponDeduction: detail?.couponDeduction ?? 0,
                            orderNumber: l.orderNumber,
                            unitPrice: detail?.unitPrice ?? l.originalUnitPrice,
                            discountPercent: detail?.discountPercent ?? l.discountPercent,
                            discountAmount: detail?.discountAmount ?? l.discountAmount,
                            taxAmount: detail?.taxAmount ?? l.taxAmount,
                            taxPercent: detail?.taxPercent ?? l.taxPercent,
                        };
                    })}
                    refundTotal={returnReceipt.refundTotal}
                    notes={notes || undefined}
                    returnedAt={returnReceipt.returnedAt}
                    exchangeVoucher={returnReceipt.exchangeVoucher}
                    discountNotes={loadedOrders
                        .filter(o => o.coupon || o.promo || o.alliance)
                        .map(o => {
                            const parts = [];
                            if (o.coupon) parts.push(`Coupon: ${o.coupon}`);
                            if (o.promo) parts.push(`Promo: ${o.promo}`);
                            if (o.alliance) parts.push(`Alliance: ${o.alliance}`);
                            return `${o.orderNumber} — ${parts.join(', ')}`;
                        })}
                    onClose={() => {
                        setReturnReceipt(null);
                        router.push("/pos/sales/history");
                    }}
                />
            )}

            {/* ── Manager Verification (ERP Claim) ─────────────────────── */}
            <ManagerVerificationDialog
                open={showVerify}
                onOpenChange={setShowVerify}
                onVerified={handleSubmit}
                title={mode === "refund" ? "Manager Verification for Refund Voucher" : "Manager Verification Required"}
                description={mode === "refund" 
                    ? "Preparing a refund voucher requires manager authorization. Enter manager credentials to proceed." 
                    : "Submitting a claim to ERP requires manager authorisation. Enter manager credentials to proceed."}
            />
        </>
    );
}
