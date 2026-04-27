"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer } from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import type { PosSettings } from "@/hooks/use-pos-settings";
import { POS_SETTINGS_DEFAULTS } from "@/hooks/use-pos-settings";

function getCookie(name: string): string {
    if (typeof document === "undefined") return "";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
}

function fmt(val: number) {
    return val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface Tender { method: string; amount: number; cardLast4?: string; slipNo?: string; }

interface PrintReceiptProps {
    order: any;
    cartItems?: CartItem[];
    tenders: Tender[];
    discountMode?: string;
    selectedPromo?: any;
    appliedCoupon?: any;
    selectedAlliance?: any;
    settings?: Partial<PosSettings>;
    onClose: () => void;
}

export function PrintReceipt({
    order,
    cartItems: propCartItems,
    tenders,
    discountMode,
    selectedPromo,
    appliedCoupon,
    selectedAlliance,
    settings: settingsOverride,
    onClose,
}: PrintReceiptProps) {
    const settings: PosSettings = { ...POS_SETTINGS_DEFAULTS, ...settingsOverride };
    const isGiftReceipt = order?.isGiftReceipt || false;

    // Auto-print if setting is enabled
    useEffect(() => {
        if (settings.receiptAutoPrint) {
            const timer = setTimeout(() => window.print(), 400);
            return () => clearTimeout(timer);
        }
    }, [settings.receiptAutoPrint]);
    // Normalise items — works from both live cart and order.items (history view)
    const items: any[] = propCartItems?.length
        ? propCartItems
        : (order?.items ?? []).map((oi: any) => ({
            id: oi.id,
            name: oi.item?.description || oi.item?.sku || "Item",
            sku: oi.item?.sku || "",
            price: Number(oi.unitPrice),
            quantity: Number(oi.quantity),
            discountPercent: Number(oi.discountPercent ?? 0),
            discountAmount: Number(oi.discountAmount ?? 0),
            taxPercent: Number(oi.taxPercent ?? 0),
            taxAmount: Number(oi.taxAmount ?? 0),
            total: Number(oi.lineTotal ?? 0),
        }));

    // ── Use backend calculated values directly (don't recalculate!) ──
    const subtotal = Number(order?.subtotal ?? 0) || items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalItemDiscount = items.reduce((s, i) => s + (i.discountAmount ?? 0), 0);
    const totalTax = Number(order?.taxAmount ?? 0) || items.reduce((s, i) => s + (i.taxAmount ?? 0), 0);
    // Use globalDiscountAmount for order-level discount (promo/coupon/alliance/manual)
    const orderDiscount = Number(order?.globalDiscountAmount ?? 0);
    const grandTotal = Number(order?.grandTotal ?? 0);
    const changeAmount = Number(order?.changeAmount ?? 0);
    const totalPaid = tenders.reduce((s, t) => s + t.amount, 0);

    // ── Discount label ────────────────────────────────────────────────
    const orderDiscountLabel = (() => {
        if (discountMode === "promo") return `Promo: ${selectedPromo?.code ?? order?.promo?.code ?? ""}`;
        if (discountMode === "coupon") return `Coupon: ${appliedCoupon?.code ?? order?.coupon?.code ?? ""}`;
        if (discountMode === "alliance") return `Alliance: ${selectedAlliance?.code ?? order?.alliance?.code ?? ""}`;
        if (discountMode === "manual") return "Manual Discount";
        if (order?.promo?.code) return `Promo: ${order.promo.code}`;
        if (order?.coupon?.code) return `Coupon: ${order.coupon.code}`;
        if (order?.alliance?.code) return `Alliance: ${order.alliance.code}`;
        return "Order Discount";
    })();

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg print:shadow-none print:border-none">
                <DialogHeader className="print:hidden">
                    <DialogTitle>Receipt Preview</DialogTitle>
                    <p className="text-sm text-muted-foreground">Review before printing.</p>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] print:max-h-none">
                    <div id="receipt-content" className="font-mono text-xs space-y-2 px-1">

                        {/* ── Header ─────────────────────────────────────────── */}
                        <div className="text-center space-y-0.5">
                            <p className="font-bold text-sm">
                                {settings.receiptStoreName || getCookie("companyName") || "Store"}
                            </p>
                            <p className="text-muted-foreground">
                                {new Date(order?.createdAt || Date.now()).toLocaleString("en-PK")}
                            </p>
                            <p className="font-semibold">Receipt #: {order?.orderNumber}</p>
                            {settings.receiptShowCashier && order?.cashierUserId && (
                                <p className="text-muted-foreground">Cashier: {order.cashierUserId.slice(0, 8)}</p>
                            )}
                        </div>

                        <Separator />

                        {/* ── Item lines ─────────────────────────────────────── */}
                        {/* Column header - Hide Net column for gift receipts */}
                        {!isGiftReceipt && (
                            <div className="grid grid-cols-[1fr_auto] gap-x-2 font-bold text-muted-foreground border-b pb-1">
                                <span>Item</span>
                                <span className="text-right">Net</span>
                            </div>
                        )}
                        {isGiftReceipt && (
                            <div className="font-bold text-muted-foreground border-b pb-1">
                                <span>Item</span>
                            </div>
                        )}

                        {items.map((item: any, idx: number) => {
                            const lineSubtotal = item.price * item.quantity;
                            const disc = item.discountAmount ?? 0;
                            const tax = item.taxAmount ?? 0;
                            const net = item.total ?? (lineSubtotal - disc + tax);

                            return (
                                <div key={item.id ?? idx} className="space-y-0.5 pb-1.5 border-b border-dashed last:border-0">
                                    {/* Name + net total - Hide net for gift receipts */}
                                    {!isGiftReceipt && (
                                        <div className="grid grid-cols-[1fr_auto] gap-x-2">
                                            <span className="font-semibold truncate">{item.name}</span>
                                            <span className="font-bold text-right">{fmt(net)}</span>
                                        </div>
                                    )}
                                    {isGiftReceipt && (
                                        <div>
                                            <span className="font-semibold">{item.name}</span>
                                        </div>
                                    )}

                                    {/* SKU */}
                                    {item.sku && (
                                        <p className="text-muted-foreground pl-1">SKU: {item.sku}</p>
                                    )}

                                    {/* Qty × Unit Price = Subtotal - Hide for gift receipts */}
                                    {!isGiftReceipt && (
                                        <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                            <span>{item.quantity} × {fmt(item.price)}</span>
                                            <span className="text-right">{fmt(lineSubtotal)}</span>
                                        </div>
                                    )}

                                    {/* For gift receipts, just show quantity */}
                                    {isGiftReceipt && (
                                        <div className="pl-1 text-muted-foreground">
                                            <span>Quantity: {item.quantity}</span>
                                        </div>
                                    )}

                                    {/* Discount line (only if non-zero) - Hide for gift receipts */}
                                    {!isGiftReceipt && disc > 0 && (
                                        <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-destructive">
                                            <span>
                                                Discount
                                                {item.discountPercent > 0 && ` (${item.discountPercent}%)`}
                                            </span>
                                            <span className="text-right">−{fmt(disc)}</span>
                                        </div>
                                    )}

                                    {/* Tax line (only if non-zero) - Hide for gift receipts */}
                                    {!isGiftReceipt && tax > 0 && (
                                        <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-amber-600 dark:text-amber-400">
                                            <span>
                                                Tax
                                                {item.taxPercent > 0 && ` (${item.taxPercent}%)`}
                                            </span>
                                            <span className="text-right">+{fmt(tax)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <Separator />

                        {/* ── Lump-sum totals - Hide for gift receipts ─────────────────────────────────── */}
                        {!isGiftReceipt && (
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{fmt(subtotal)}</span>
                                </div>

                                {totalItemDiscount > 0 && (
                                    <div className="flex justify-between text-destructive">
                                        <span>Item Discounts</span>
                                        <span>−{fmt(totalItemDiscount)}</span>
                                    </div>
                                )}

                                {orderDiscount > 0 && (
                                    <div className="flex justify-between text-primary font-bold">
                                        <span>{orderDiscountLabel}</span>
                                        <span>−{fmt(orderDiscount)}</span>
                                    </div>
                                )}

                                {totalTax > 0 && settings.receiptShowTax && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                        <span>Total Tax</span>
                                        <span>+{fmt(totalTax)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between font-bold text-sm pt-1 border-t">
                                    <span>TOTAL</span>
                                    <span>{fmt(grandTotal)}</span>
                                </div>
                            </div>
                        )}

                        {/* Gift Receipt Message */}
                        {isGiftReceipt && (
                            <div className="text-center py-4">
                                <p className="font-semibold text-lg">GIFT RECEIPT</p>
                                <p className="text-sm text-muted-foreground mt-1">Price information not included its Just Gift For you</p>
                            </div>
                        )}

                        <Separator />

                        {/* ── Payment breakdown - Hide for gift receipts ───────────────────────────────── */}
                        {!isGiftReceipt && (
                            <div className="space-y-1">
                                {tenders.map((t, i) => (
                                    <div key={i} className="flex justify-between">
                                        <span className="text-muted-foreground capitalize">
                                            {t.method.replace(/_/g, " ")}
                                            {t.cardLast4 ? ` ••••${t.cardLast4}` : ""}
                                            {t.slipNo ? (t.method === "voucher" ? ` #${t.slipNo}` : ` (${t.slipNo})`) : ""}
                                        </span>
                                        <span className="font-semibold">{fmt(t.amount)}</span>
                                    </div>
                                ))}
                                {totalPaid > 0 && totalPaid !== grandTotal && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Total Paid</span>
                                        <span>{fmt(totalPaid)}</span>
                                    </div>
                                )}
                                {changeAmount > 0 && (
                                    <div className="flex justify-between font-semibold text-primary">
                                        <span>Change</span>
                                        <span>{fmt(changeAmount)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <Separator />
                        <p className="text-center text-muted-foreground">
                            {settings.receiptFooter || "*** THANK YOU FOR SHOPPING ***"}
                        </p>
                        <p className="text-center text-muted-foreground tracking-widest">{order?.orderNumber}</p>
                    </div>
                </ScrollArea>

                <DialogFooter className="print:hidden gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                    <Button onClick={() => window.print()} className="flex-1 gap-2">
                        <Printer className="h-4 w-4" /> Print Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
