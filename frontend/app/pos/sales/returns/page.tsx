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

function paidPerUnit(oi: any, orderGrandTotal: number, orderLineTotalsSum: number) {
  // Distribute grandTotal proportionally based on each item's lineTotal share
  // This correctly handles global discounts (coupon/promo applied at order level)
  const qty = Number(oi.quantity);
  if (qty <= 0) {
    console.warn(`Invalid quantity for item ${oi.itemId}:`, qty);
    return 0;
  }
  const lineTotal = Number(oi.lineTotal);
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

type Mode = "return" | "exchange" | "claim";

interface ReturnLine {
    orderId: string; orderNumber: string;
    orderItemId: string; itemId: string;
    name: string; sku: string; brand?: string;
    orderedQty: number; returnQty: number;
    paidPerUnit: number; originalUnitPrice: number; discountPercent: number;
    discountAmount?: number; taxAmount?: number; taxPercent?: number;
}

interface NewLine { itemId: string; name: string; sku: string; quantity: number; unitPrice: number; discountPct: number; }
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

    // ── Return lines (flat, tagged with orderId) ──────────────────────
    const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

    // ── New items for exchange ────────────────────────────────────────
    const [newLines, setNewLines] = useState<NewLine[]>([]);
    const [newItemSearch, setNewItemSearch] = useState("");
    const [newItemResults, setNewItemResults] = useState<any[]>([]);

    // ── Mode & misc ───────────────────────────────────────────────────
    const [mode, setMode] = useState<Mode>("return");
    const [reasonCode, setReasonCode] = useState("DEFECTIVE");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Memo-level discount on new items (exchange only) ──────────────
    const [memoDiscType, setMemoDiscType] = useState<"pct" | "flat">("pct");
    const [memoDiscValue, setMemoDiscValue] = useState<number>(0);

    // ── Return receipt dialog ─────────────────────────────────────────
    const [returnReceipt, setReturnReceipt] = useState<{
        returnRef: string;
        refundTotal: number;
        returnedAt: string;
        itemRefundDetails?: { orderItemId: string; itemId: string; quantity: number; originalPaidPerUnit: number; refundPerUnit: number; priceAdjusted: boolean }[];
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
                        return Number(oi.quantity) - alreadyReturned > 0; // skip fully returned items
                    })
                    .map((oi: any) => {
                    const alreadyReturned = Number(oi.returnedQty ?? 0);
                    const remainingQty = Number(oi.quantity) - alreadyReturned;
                    return {
                        orderId: found.id, orderNumber: found.orderNumber,
                        orderItemId: oi.id, itemId: oi.itemId,
                        name: oi.item?.description || oi.itemId,
                        sku: oi.item?.sku || "",
                        brand: oi.item?.brand || oi.item?.brandName || "",
                        orderedQty: remainingQty, returnQty: 0,
                        paidPerUnit: paidPerUnit(oi, orderGrandTotal, lineTotalsSum),
                        originalUnitPrice: Number(oi.unitPrice),
                        discountPercent: Number(oi.discountPercent ?? 0),
                        discountAmount: Number(oi.discountAmount ?? 0),
                        taxAmount: Number(oi.taxAmount ?? 0),
                        taxPercent: Number(oi.taxPercent ?? 0),
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
        setLoadedOrders(prev => prev.filter(o => o.id !== orderId));
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
            return [...prev, { itemId: p.id, name: p.description, sku: p.sku, quantity: 1, unitPrice: Number(p.unitPrice), discountPct: 0 }];
        });
        setNewItemSearch(""); setNewItemResults([]);
    };

    const setNewQty = (itemId: string, qty: number) => {
        if (qty <= 0) { setNewLines(prev => prev.filter(l => l.itemId !== itemId)); return; }
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
    const handleSubmit = useCallback(async () => {
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
                    toast.success(`Return processed. Refund: ${formatCurrency(res.data.refundAmount ?? refundTotal)}`);
                    // Show return receipt instead of redirecting
                    setReturnReceipt({
                        returnRef: res.data.returnRef || res.data.data?.returnNumber || `RET-${Date.now()}`,
                        refundTotal: res.data.refundAmount ?? refundTotal,
                        returnedAt: new Date().toISOString(),
                        itemRefundDetails: res.data.itemRefundDetails,
                    });
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
                            <div key={o.id} className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 px-3 py-1.5">
                                <Receipt className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="font-mono font-bold text-emerald-700 text-sm">{o.orderNumber}</span>
                                <span className="text-muted-foreground text-xs">{formatCurrency(o.grandTotal)}</span>
                                <button onClick={() => removeOrder(o.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {loadedOrders.length > 0 && (
                <>
                    {/* Mode tabs — hide Claim for multi-order */}
                    <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
                        <TabsList className={`grid w-full max-w-md ${isMultiOrder ? "grid-cols-2" : "grid-cols-3"}`}>
                            {canReturn && <TabsTrigger value="return" className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Return</TabsTrigger>}
                            {canExchange && <TabsTrigger value="exchange" className="gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Exchange</TabsTrigger>}
                            {!isMultiOrder && canClaim && <TabsTrigger value="claim" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Claim</TabsTrigger>}
                        </TabsList>

                        {isMultiOrder && mode === "claim" && setMode("return") as any}

                        {mode === "claim" && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>Claim is submitted to ERP for review. No immediate refund — ERP verifies and approves.</span>
                            </div>
                        )}

                        <TabsContent value={mode} className="mt-4 space-y-4">

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
                                            <TableHead className="text-right text-xs uppercase">Ordered</TableHead>
                                            <TableHead className="text-right text-xs uppercase">Unit Price</TableHead>
                                            <TableHead className="text-right text-xs uppercase">Disc %</TableHead>
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
                                                    <p className="font-medium text-sm">{line.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{line.sku}</p>
                                                </TableCell>
                                                <TableCell className="text-right text-sm">{line.orderedQty}</TableCell>
                                                <TableCell className="text-right text-sm font-mono">{formatCurrency(line.originalUnitPrice)}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {line.discountPercent > 0
                                                        ? <span className="text-destructive font-medium">{line.discountPercent}%</span>
                                                        : <span className="text-muted-foreground">—</span>}
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
                                                                <p className="font-medium">{p.description}</p>
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
                                                                <p className="font-medium text-sm">{line.name}</p>
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
                                            onClick={handleSubmit}
                                            disabled={
                                                isSubmitting ||
                                                selectedLines.length === 0 ||
                                                (mode === "exchange" && newLines.length === 0) ||
                                                (mode === "return" && !canReturn) ||
                                                (mode === "exchange" && !canExchange) ||
                                                (mode === "claim" && !canClaim)
                                            }>
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : mode === "return" ? <RotateCcw className="h-4 w-4" />
                                                    : mode === "exchange" ? <ArrowLeftRight className="h-4 w-4" />
                                                        : <Send className="h-4 w-4" />}
                                            {isSubmitting ? "Processing..."
                                                : mode === "return" ? `Process Return${isMultiOrder ? ` (${loadedOrders.length} receipts)` : ""}`
                                                    : mode === "exchange" ? `Process Exchange${isMultiOrder ? ` (${loadedOrders.length} receipts)` : ""}`
                                                        : "Submit Claim to ERP"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>

            {/* ── Return Receipt Dialog ─────────────────────────────────── */}
            {returnReceipt && (
                <PrintReturnReceipt
                    returnRef={returnReceipt.returnRef}
                    originalOrders={loadedOrders.map(o => ({ orderNumber: o.orderNumber, grandTotal: o.grandTotal }))}
                    returnedLines={selectedLines.map(l => {
                        const detail = returnReceipt.itemRefundDetails?.find((d: any) => d.orderItemId === l.orderItemId);
                        const refundPerUnit = detail ? detail.refundPerUnit : l.paidPerUnit;
                        return {
                            name: l.name,
                            sku: l.sku,
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
        </>
    );
}
