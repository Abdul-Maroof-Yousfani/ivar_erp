"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, RotateCcw } from "lucide-react";
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

export interface ReturnReceiptLine {
    name: string;
    sku: string;
    brand?: string;
    returnQty: number;
    paidPerUnit: number;
    refundAmount: number;
    orderNumber: string;
    unitPrice?: number;
    discountAmount?: number;
    discountPercent?: number;
    taxAmount?: number;
    taxPercent?: number;
    /** Actual refund per unit after price rule */
    refundPerUnit?: number;
    /** True when current price was lower than original */
    priceAdjusted?: boolean;
    /** Original paid per unit before price adjustment */
    originalPaidPerUnit?: number;
    /** Order-level coupon/voucher deduction proportionally allocated to this item */
    couponDeduction?: number;
}

export interface PrintReturnReceiptProps {
    returnRef: string;
    originalOrders: { orderNumber: string; grandTotal: number }[];
    returnedLines: ReturnReceiptLine[];
    refundTotal: number;
    notes?: string;
    discountNotes?: string[];
    returnedAt?: string;
    /** Payment method used in original order */
    paymentMethod?: string;
    settings?: Partial<PosSettings>;
    onClose: () => void;
}

export function PrintReturnReceipt({
    returnRef,
    originalOrders,
    returnedLines,
    refundTotal,
    notes,
    discountNotes,
    returnedAt,
    paymentMethod,
    settings: settingsOverride,
    onClose,
}: PrintReturnReceiptProps) {
    const settings: PosSettings = { ...POS_SETTINGS_DEFAULTS, ...settingsOverride };

    useEffect(() => {
        if (settings.receiptAutoPrint) {
            const timer = setTimeout(() => window.print(), 400);
            return () => clearTimeout(timer);
        }
    }, [settings.receiptAutoPrint]);

    const storeName = settings.receiptStoreName || getCookie("companyName") || "Store";
    const timestamp = returnedAt
        ? new Date(returnedAt).toLocaleString("en-PK")
        : new Date().toLocaleString("en-PK");

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg print:shadow-none print:border-none">
                <DialogHeader className="print:hidden">
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-destructive" />
                        Return Receipt
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">Review before printing.</p>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] print:max-h-none">
                    <div id="return-receipt-content" className="font-mono text-xs space-y-2 px-1">

                        {/* ── Header ─────────────────────────────────────────── */}
                        <div className="text-center space-y-0.5">
                            <p className="font-bold text-sm">{storeName}</p>
                            <p className="text-muted-foreground">{timestamp}</p>
                            <p className="font-bold text-sm">*** RETURN RECEIPT ***</p>
                            <p className="font-semibold">Return Ref: {returnRef}</p>
                        </div>

                        <Separator />

                        {/* ── Original order(s) ──────────────────────────────── */}
                        <div className="space-y-0.5">
                            <p className="font-bold text-muted-foreground">
                                Original Receipt{originalOrders.length > 1 ? "s" : ""}:
                            </p>
                            {originalOrders.map(o => (
                                <div key={o.orderNumber} className="flex justify-between pl-2">
                                    <span>{o.orderNumber}</span>
                                    <span>Rs. {fmt(o.grandTotal)}</span>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        {/* ── Returned items ─────────────────────────────────── */}
                        <div className="grid grid-cols-[1fr_auto] gap-x-2 font-bold text-muted-foreground border-b pb-1">
                            <span>Returned Item</span>
                            <span className="text-right">Refund</span>
                        </div>

                        {returnedLines.map((line, idx) => {
                            const qty = line.returnQty;
                            const unitPrice = line.unitPrice ?? line.paidPerUnit;
                            const subtotal = unitPrice * qty;
                            const discAmt = line.discountAmount ?? 0;
                            const taxAmt = line.taxAmount ?? 0;
                            const couponDed = line.couponDeduction ?? 0;
                            const refundPerUnit = line.refundPerUnit ?? line.paidPerUnit;
                            const lineRefund = refundPerUnit * qty;

                            // Running total after each step
                            const afterDiscount = subtotal - discAmt;
                            const afterTax = afterDiscount + taxAmt;
                            const afterCoupon = afterTax - couponDed;

                            return (
                                <div key={idx} className="space-y-0.5 pb-2 border-b border-dashed last:border-0">
                                    {/* Item name + final refund */}
                                    <div className="grid grid-cols-[1fr_auto] gap-x-2">
                                        <span className="font-semibold truncate">{line.name}</span>
                                        <span className="font-bold text-right">{fmt(lineRefund)}</span>
                                    </div>

                                    {/* SKU · Brand */}
                                    {(line.sku || line.brand) && (
                                        <p className="text-muted-foreground pl-1">
                                            {[line.sku, line.brand].filter(Boolean).join(' · ')}
                                        </p>
                                    )}

                                    {/* Original unit price × qty = subtotal */}
                                    <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                        <span>{qty} × {fmt(unitPrice)}</span>
                                        <span className="text-right">{fmt(subtotal)}</span>
                                    </div>

                                    {/* Item-level discount */}
                                    {discAmt > 0 && (
                                        <>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-primary">
                                                <span>Discount{line.discountPercent ? ` (${line.discountPercent}%)` : ""}</span>
                                                <span className="text-right">−{fmt(discAmt)}</span>
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                                <span className="text-[10px]">After discount</span>
                                                <span className="text-right">{fmt(afterDiscount)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Tax */}
                                    {taxAmt > 0 && (
                                        <>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                                <span>Tax{line.taxPercent ? ` (${line.taxPercent}%)` : ""}</span>
                                                <span className="text-right">+{fmt(taxAmt)}</span>
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                                <span className="text-[10px]">After tax</span>
                                                <span className="text-right">{fmt(afterTax)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Coupon / voucher deduction */}
                                    {couponDed > 0 && (
                                        <>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-emerald-600">
                                                <span>Coupon / Voucher</span>
                                                <span className="text-right">−{fmt(couponDed)}</span>
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-muted-foreground">
                                                <span className="text-[10px]">After coupon</span>
                                                <span className="text-right">{fmt(afterCoupon)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Price-drop adjustment */}
                                    {line.priceAdjusted && (
                                        <>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-2 pl-1 text-amber-600">
                                                <span>Current price (lower)</span>
                                                <span className="text-right">{fmt(lineRefund)}</span>
                                            </div>
                                            <p className="pl-1 text-[10px] text-amber-600">* Refund at current lower price</p>
                                        </>
                                    )}

                                    {originalOrders.length > 1 && (
                                        <p className="text-[10px] text-muted-foreground pl-1">{line.orderNumber}</p>
                                    )}
                                </div>
                            );
                        })}

                        <Separator />

                        {/* ── Totals ─────────────────────────────────────────── */}
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Items returned</span>
                                <span>{returnedLines.reduce((s, l) => s + l.returnQty, 0)} unit(s)</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm pt-1 border-t text-destructive">
                                <span>TOTAL REFUND</span>
                                <span>Rs. {fmt(refundTotal)}</span>
                            </div>
                            {paymentMethod && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Refund via</span>
                                    <span className="capitalize">{paymentMethod}</span>
                                </div>
                            )}
                        </div>

                        {/* ── Coupon/promo returned to customer ──────────────── */}
                        {discountNotes && discountNotes.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-0.5 rounded border border-dashed border-emerald-400 px-2 py-1.5">
                                    <p className="font-bold">Coupon / Voucher Returned to Customer:</p>
                                    {discountNotes.map((note, i) => (
                                        <p key={i} className="pl-2">{note}</p>
                                    ))}
                                    <p className="text-muted-foreground text-[10px] mt-1">
                                        * Coupon/voucher code restored and can be reused.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* ── Notes ──────────────────────────────────────────── */}
                        {notes && (
                            <>
                                <Separator />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-muted-foreground">Notes:</p>
                                    <p className="pl-2">{notes}</p>
                                </div>
                            </>
                        )}

                        <Separator />
                        <p className="text-center text-muted-foreground">
                            {settings.receiptFooter || "*** THANK YOU ***"}
                        </p>
                        <p className="text-center text-muted-foreground tracking-widest">{returnRef}</p>
                    </div>
                </ScrollArea>

                <DialogFooter className="print:hidden gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                    <Button onClick={() => window.print()} className="flex-1 gap-2">
                        <Printer className="h-4 w-4" /> Print Return Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
