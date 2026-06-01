"use client";

import { useEffect } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Printer, Receipt, Loader2 } from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import type { PosSettings } from "@/hooks/use-pos-settings";
import { POS_SETTINGS_DEFAULTS } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtDate(dateStr?: string | null): string {
    const d = dateStr ? new Date(dateStr) : new Date();
    return [
        String(d.getDate()).padStart(2, "0"),
        String(d.getMonth() + 1).padStart(2, "0"),
        d.getFullYear(),
    ].join("-");
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
    isLoading?: boolean;
    creditVouchers?: { code: string; faceValue: number; expiresAt: Date | null }[];
    onClose: () => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ReceiptSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 select-none">
            {/* Animated receipt illustration */}
            <div className="relative flex flex-col items-center">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150 animate-pulse" />

                {/* Receipt icon with spin */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
                    <Receipt className="h-9 w-9 text-primary animate-pulse" />
                </div>

                {/* Orbiting dot */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
                    <div
                        className="absolute w-2.5 h-2.5 rounded-full bg-primary shadow-md shadow-primary/40"
                        style={{
                            top: "50%",
                            left: "50%",
                            transformOrigin: "0 0",
                            animation: "orbit 1.4s linear infinite",
                            marginTop: "-5px",
                            marginLeft: "-5px",
                        }}
                    />
                </div>
            </div>

            {/* Text */}
            <div className="text-center space-y-1.5">
                <p className="text-base font-bold tracking-tight">Generating Receipt</p>
                <p className="text-sm text-muted-foreground">Fetching order details, please wait…</p>
            </div>

            {/* Skeleton lines mimicking a receipt */}
            <div className="w-64 space-y-2 opacity-40">
                <div className="h-2.5 bg-muted rounded-full w-3/4 mx-auto animate-pulse" />
                <div className="h-2 bg-muted rounded-full w-1/2 mx-auto animate-pulse delay-75" />
                <div className="h-px bg-border w-full my-3" />
                {[80, 60, 90, 55, 70].map((w, i) => (
                    <div
                        key={i}
                        className="h-2 bg-muted rounded-full animate-pulse"
                        style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }}
                    />
                ))}
                <div className="h-px bg-border w-full my-3" />
                <div className="h-3 bg-muted rounded-full w-2/3 mx-auto animate-pulse" />
            </div>

            <style>{`
                @keyframes orbit {
                    from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
                    to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
                }
            `}</style>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PrintReceipt({
    order,
    cartItems: propCartItems,
    tenders,
    discountMode,
    selectedPromo,
    appliedCoupon,
    selectedAlliance,
    settings: settingsOverride,
    isLoading = false,
    creditVouchers,
    onClose,
}: PrintReceiptProps) {
    const settings: PosSettings = { ...POS_SETTINGS_DEFAULTS, ...settingsOverride };
    const { user } = useAuth();
    const isGiftReceipt = order?.isGiftReceipt || false;

    useEffect(() => {
        if (!isLoading && settings.receiptAutoPrint) {
            const timer = setTimeout(() => window.print(), 400);
            return () => clearTimeout(timer);
        }
    }, [isLoading, settings.receiptAutoPrint]);

    // ── Store info ────────────────────────────────────────────────────
    const storeName =
        settings.receiptStoreName ||
        (typeof user?.terminal?.location?.fbrSellerName === "string" ? user.terminal.location.fbrSellerName : "") ||
        (typeof user?.terminal?.location?.name === "string" ? user.terminal.location.name : "") ||
        getCookie("companyName") ||
        "Store";

    const storeAddress = settings.receiptAddress || (typeof user?.terminal?.location?.address === "string" ? user.terminal.location.address : "") || "";
    const storePhone   = settings.receiptPhone   || (typeof user?.terminal?.location?.phone   === "string" ? user.terminal.location.phone   : "") || "";
    const storeNTN     = settings.receiptNTN     || (typeof user?.terminal?.location?.fbrNtn  === "string" ? user.terminal.location.fbrNtn  : "") || "";
    const storeSTRN    = settings.receiptSTRN    || "";
    const terminalName = (typeof user?.terminal?.name === "string" ? user.terminal.name : "") || (typeof user?.terminal?.code === "string" ? user.terminal.code : "") || "";

    const cashierName =
        order?.cashierName ||
        order?.cashier?.name ||
        order?.cashierUser?.name ||
        (user ? `${user.firstName} ${user.lastName}`.trim() : "");

    // ── Normalise items ───────────────────────────────────────────────
    // Always prefer order.items (from database) over propCartItems (from cart)
    // because order.items has the final calculated values after all discounts
    const items: any[] = (order?.items && order.items.length > 0)
        ? (order.items).map((oi: any) => ({
            id:              oi.id,
            name:            oi.item?.description || oi.item?.sku || "Item",
            sku:             oi.item?.sku   || "",
            upc:             oi.item?.upc   || oi.upc  || "",
            size:            oi.item?.size  || oi.size || "",
            price:           Number(oi.unitPrice),
            quantity:        Number(oi.quantity),
            discountPercent: Number(oi.discountPercent ?? 0),
            discountAmount:  Number(oi.discountAmount  ?? 0),
            taxPercent:      Number(oi.taxPercent  ?? 0),
            taxAmount:       Number(oi.taxAmount   ?? 0),
        }))
        : (propCartItems ?? []);

    // ── Totals ────────────────────────────────────────────────────────
    // Subtotal should be sum of WOST (not retail price × quantity)
    // Always calculate from items, don't trust backend subtotal
    const subtotal = items.reduce((s, i) => {
        const taxDivisor = 1 + ((i.taxPercent ?? 0) / 100);
        const wostPerUnit = i.price / taxDivisor;
        return s + (wostPerUnit * i.quantity);
    }, 0);
    
    // Always calculate totalTax from items (don't trust backend taxAmount)
    const totalTax = items.reduce((s, i) => {
        const itemTax = Number(i.taxAmount ?? 0);
        return s + itemTax;
    }, 0);

    const itemDiscountsRaw = items.reduce((s, i) => s + (i.discountAmount ?? 0), 0);
    const orderDiscount    = Number(order?.globalDiscountAmount ?? 0);

    // Alliance suppression logic: if alliance is active and >= item discounts, item discounts are zeroed
    const isAlliance = (discountMode === "alliance" || !!order?.alliance || !!order?.allianceId);
    const suppressItemDiscounts = isAlliance && orderDiscount >= itemDiscountsRaw && orderDiscount > 0;

    const totalDiscount   = (suppressItemDiscounts ? 0 : itemDiscountsRaw) + orderDiscount;
    const valueForSales   = subtotal - totalDiscount;
    const grandTotal      = Number(order?.grandTotal ?? 0) || (valueForSales + totalTax);
    const fbrPosFee       = Number(order?.fbrPosFee ?? 0) || 1; // Default to 1 if not set
    const finalGrandTotal = grandTotal + fbrPosFee;
    const changeAmount    = Number(order?.changeAmount ?? 0);
    const totalPaid       = tenders.reduce((s, t) => s + t.amount, 0);

    // Alliance distribution for display - proportional to item value
    const calculateProportionalDiscount = (itemValue: number, totalValue: number, totalDiscount: number): number => {
        if (totalValue === 0) return 0;
        return Math.round((totalDiscount * itemValue) / totalValue);
    };

    const orderDiscountLabel = (() => {
        if (discountMode === "promo")    return `Promo: ${selectedPromo?.code    ?? order?.promo?.code    ?? ""}`;
        if (discountMode === "coupon")   return `Coupon: ${appliedCoupon?.code   ?? order?.coupon?.code   ?? ""}`;
        if (discountMode === "alliance") return `Alliance: ${selectedAlliance?.code ?? order?.alliance?.code ?? ""}`;
        if (discountMode === "manual")   return "Manual Discount";
        if (order?.promo?.code)    return `Promo: ${order.promo.code}`;
        if (order?.coupon?.code)   return `Coupon: ${order.coupon.code}`;
        if (order?.alliance?.code) return `Alliance: ${order.alliance.code}`;
        return "Order Discount";
    })();

    const fbrVerifyUrl = order?.fbrInvoiceUrl ||
        `https://taxasaan.fbr.gov.pk/verify?inv=${encodeURIComponent(order?.orderNumber ?? "")}`;

    const bodyProps: ReceiptBodyProps = {
        isGiftReceipt, storeName, storeAddress, storePhone, storeNTN, storeSTRN,
        terminalName, cashierName, order, items, subtotal, totalTax, orderDiscount,
        totalDiscount, valueForSales, grandTotal, fbrPosFee, finalGrandTotal,
        changeAmount, totalPaid, tenders, orderDiscountLabel, fbrVerifyUrl, settings,
        suppressItemDiscounts, creditVouchers,
    };

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #receipt-print-root,
                    #receipt-print-root * { visibility: visible !important; }
                    #receipt-print-root {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 80mm !important;
                        padding: 4mm 3mm !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-size: 9pt !important;
                        line-height: 1.35 !important;
                    }
                    @page { margin: 0; size: 80mm auto; }
                    #receipt-print-root > div > * { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>

            {/* ── Screen: dialog preview ────────────────────────────────── */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            Receipt Preview
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? "Loading order data…" : "Review before printing."}
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isLoading ? <ReceiptSkeleton /> : <ReceiptBody {...bodyProps} />}
                    </div>

                    <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                        <Button
                            onClick={() => window.print()}
                            className="flex-1 gap-2"
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                                : <><Printer className="h-4 w-4" /> Print Receipt</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Print target — off-screen but rendered, visible only on print ── */}
            {!isLoading && (
                <div
                    id="receipt-print-root"
                    style={{ position: "fixed", left: "-9999px", top: 0, width: "80mm", pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <ReceiptBody {...bodyProps} />
                </div>
            )}
        </>
    );
}

// ── ReceiptBody ───────────────────────────────────────────────────────────────

interface ReceiptBodyProps {
    isGiftReceipt: boolean;
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeNTN: string;
    storeSTRN: string;
    terminalName: string;
    cashierName: string;
    order: any;
    items: any[];
    subtotal: number;
    totalTax: number;
    orderDiscount: number;
    totalDiscount: number;
    valueForSales: number;
    grandTotal: number;
    fbrPosFee: number;
    finalGrandTotal: number;
    changeAmount: number;
    totalPaid: number;
    tenders: Tender[];
    orderDiscountLabel: string;
    fbrVerifyUrl: string;
    settings: PosSettings;
    suppressItemDiscounts: boolean;
    creditVouchers?: { code: string; faceValue: number; expiresAt: Date | null }[];
}

function ReceiptBody({
    isGiftReceipt, storeName, storeAddress, storePhone, storeNTN, storeSTRN,
    terminalName, cashierName, order, items, subtotal, totalTax, orderDiscount,
    totalDiscount, valueForSales, grandTotal, fbrPosFee, finalGrandTotal,
    changeAmount, totalPaid, tenders, orderDiscountLabel, fbrVerifyUrl, settings,
    suppressItemDiscounts, creditVouchers,
}: ReceiptBodyProps) {

    // Calculate total WOST value for proportional discount
    const totalWostValue = items.reduce((sum, item) => {
        const taxPct = item.taxPercent ?? 0;
        const taxDivisor = 1 + (taxPct / 100);
        // Retail price is item.price (not adding tax)
        const retailPrice = item.price;
        const wostPerUnit = retailPrice / taxDivisor;
        return sum + (wostPerUnit * item.quantity);
    }, 0);

    // Proportional discount calculation for alliance/coupon
    const calculateProportionalDiscount = (itemValue: number, totalValue: number, totalDiscount: number): number => {
        if (totalValue === 0) return 0;
        const proportionalDisc = Math.round((totalDiscount * itemValue) / totalValue);
        // Safety: discount cannot exceed item value
        return Math.min(proportionalDisc, itemValue);
    };

    const Row = ({ label, value, bold = false, indent = false }: {
        label: string; value: string; bold?: boolean; indent?: boolean;
    }) => (
        <div
            className="rpt-flex flex justify-between text-[11px]"
            style={{ paddingLeft: indent ? "12px" : undefined, fontWeight: bold ? "bold" : undefined }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    return (
        <div className="font-mono text-xs w-full max-w-95 mx-auto space-y-2">

            {/* ── Store Header ── */}
            <div className="text-center space-y-0.5">
                <p className="font-black text-sm leading-tight uppercase tracking-wide">{storeName}</p>
                {(storeAddress || storePhone) && (
                    <p className="text-[11px] leading-snug">
                        {storeAddress}{storeAddress && storePhone ? " | " : ""}{storePhone}
                    </p>
                )}
            </div>

            <Separator />

            {/* ── Invoice Title ── */}
            {!isGiftReceipt ? (
                <div className="text-center space-y-0.5">
                    <p className="font-bold text-sm tracking-widest uppercase">Sales Tax Invoice</p>
                    <p className="font-black text-2xl tracking-wider">*{order?.orderNumber ?? ""}*</p>
                </div>
            ) : (
                <div className="text-center">
                    <p className="font-bold text-sm tracking-widest uppercase">Gift Receipt</p>
                </div>
            )}

            <Separator />

            {/* ── Receipt meta ── */}
            <div className="space-y-0.5 text-[11px]">
                <Row label="Receipt No." value={order?.orderNumber ?? ""} bold />
                <Row label="Date"        value={fmtDate(order?.createdAt)} />
                {cashierName  && <Row label="Sales By" value={cashierName}  />}
                {terminalName && <Row label="Terminal" value={terminalName} />}
            </div>

            <Separator />

            {/* ── Column headers ── */}
            {!isGiftReceipt ? (
                <div
                    className="rpt-grid-hdr text-[10px] font-bold border-b pb-1"
                    style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr 0.8fr 0.8fr 0.8fr", gap: "0 4px" }}
                >
                    <span>Name / Code</span>
                    <span style={{ textAlign: "center" }}>Size</span>
                    <span style={{ textAlign: "center" }}>Qty</span>
                    <span style={{ textAlign: "right" }}>Retail</span>
                    <span style={{ textAlign: "right" }}>WOST</span>
                    <span style={{ textAlign: "right" }}>Total</span>
                </div>
            ) : (
                <div
                    className="rpt-grid-hdr-g text-[10px] font-bold border-b pb-1"
                    style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr", gap: "0 4px" }}
                >
                    <span>Name / Code</span>
                    <span style={{ textAlign: "center" }}>Size</span>
                    <span style={{ textAlign: "center" }}>Qty</span>
                </div>
            )}

            {/* ── Item lines ── */}
            {items.map((item: any, idx: number) => {
                const taxPct       = item.taxPercent ?? 0;
                const taxDivisor   = 1 + (taxPct / 100); // e.g., 1.18 for 18%, 1.25 for 25%
                
                // Step 1: Retail price is the unit price (item.price)
                const retailPrice  = item.price;
                
                // Step 2: WOST = Retail / (1 + tax%) - this removes the tax to get the base price
                const wostPerUnit  = retailPrice / taxDivisor;
                const totalWost    = wostPerUnit * item.quantity;
                
                // Step 3: Discount % from item (use override if present)
                const itemDiscPct  = item.overrideDiscountPercent ?? item.discountPercent ?? 0;
                // Discount Amount = Total WOST × Discount %
                const rawDisc      = Math.round(totalWost * (itemDiscPct / 100));
                
                // If alliance/coupon suppressed item discount, calculate proportional discount
                let disc = suppressItemDiscounts ? 0 : rawDisc;
                let displayDisc = disc;
                let displayDiscPct = suppressItemDiscounts ? 0 : itemDiscPct;
                
                if (suppressItemDiscounts) {
                    // Proportional discount: (orderDiscount × itemWOST) / totalWOST
                    displayDisc = calculateProportionalDiscount(totalWost, totalWostValue, orderDiscount);
                    displayDiscPct = totalWost > 0 ? Math.round((displayDisc / totalWost) * 100 * 100) / 100 : 0;
                }

                // Step 4: Amount after Discount
                const amtAfterDisc = totalWost - (suppressItemDiscounts ? displayDisc : disc);
                
                // Step 5: Tax = Amount after Discount × tax%
                const tax = Math.round(amtAfterDisc * (taxPct / 100));
                
                // Step 6: Value Including Tax
                const valueIncludingTax = amtAfterDisc + tax;
                
                const uniqueNo = item.sku || item.upc || "—";

                return (
                    <div key={item.id ?? idx} className="pb-2 border-b border-dashed last:border-0">
                        <p className="font-bold text-[11px] leading-tight mb-0.5">{item.name}</p>

                        {!isGiftReceipt ? (
                            <div
                                className="rpt-grid-item text-[11px]"
                                style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr 0.8fr 0.8fr 0.8fr", gap: "0 4px" }}
                            >
                                <span className="text-muted-foreground truncate">{uniqueNo}</span>
                                <span style={{ textAlign: "center" }}>{item.size || "—"}</span>
                                <span style={{ textAlign: "center", fontWeight: "bold" }}>{item.quantity}</span>
                                <span style={{ textAlign: "right" }}>{fmt(retailPrice)}</span>
                                <span style={{ textAlign: "right" }}>{fmt(wostPerUnit)}</span>
                                <span style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(totalWost)}</span>
                            </div>
                        ) : (
                            <div
                                className="rpt-grid-gift text-[11px]"
                                style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr", gap: "0 4px" }}
                            >
                                <span className="text-muted-foreground truncate">{uniqueNo}</span>
                                <span style={{ textAlign: "center" }}>{item.size || "—"}</span>
                                <span style={{ textAlign: "center", fontWeight: "bold" }}>{item.quantity}</span>
                            </div>
                        )}

                        {!isGiftReceipt && (
                            <div className="mt-1 space-y-0.5 text-[10px]">
                                {!suppressItemDiscounts && <Row label="Discount %" value={`${displayDiscPct}%`} />}
                                <Row label={suppressItemDiscounts ? "Alliance Disc" : "Discount Amount"} value={displayDisc > 0 ? fmt(displayDisc) : "—"} />
                                <Row label="Amount after Discount"  value={fmt(amtAfterDisc)} />
                                <Row label="Sales Tax Rate"         value={`${taxPct}%`} />
                                <Row label="Sales Tax Amount"       value={tax > 0 ? fmt(tax) : "—"} />
                                <div
                                    className="rpt-fbr-row flex justify-between font-bold text-[10px] border-t border-dashed pt-0.5 mt-0.5"
                                    style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}
                                >
                                    <span>Value Including Sales Tax</span>
                                    <span>{fmt(valueIncludingTax)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <Separator />

            {/* ── Summary totals ── */}
            {!isGiftReceipt ? (
                <div className="space-y-0.5 text-[11px]">
                    <Row label={`Total Value Excluding Sales Tax (${items.length})`} value={fmt(subtotal)} />
                    <Row label="Total Discount"  value={totalDiscount > 0 ? fmt(totalDiscount) : "—"} />
                    <Row label="Value for Sales" value={fmt(valueForSales)} />
                    {settings.receiptShowTax && (
                        <Row label="Total Sales Tax" value={fmt(totalTax)} />
                    )}
                    <div
                        className="rpt-flex flex justify-between font-bold text-[11px] border-t pt-0.5 mt-0.5"
                        style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}
                    >
                        <span>Total Value Including Sales Tax</span>
                        <span>{fmt(valueForSales + totalTax)}</span>
                    </div>
                    <Row label="FBR POS Fee" value={fmt(fbrPosFee)} />
                    <div
                        className="rpt-flex flex justify-between font-black text-sm border-t pt-0.5 mt-0.5"
                        style={{ display: "flex", justifyContent: "space-between", fontWeight: "900" }}
                    >
                        <span>Grand Total</span>
                        <span>{fmt(valueForSales + totalTax + fbrPosFee)}</span>
                    </div>
                </div>
            ) : (
                <p className="text-center text-[11px] py-2">
                    Price information not included — this is a gift for you.
                </p>
            )}

            <Separator />

            {/* ── Payment breakdown ── */}
            {!isGiftReceipt && (
                <div className="space-y-0.5 text-[11px]">
                    {tenders.map((t, i) => (
                        <div
                            key={i}
                            className="rpt-flex flex justify-between"
                            style={{ display: "flex", justifyContent: "space-between" }}
                        >
                            <span className="capitalize">
                                {t.method.replace(/_/g, " ")}
                                {t.cardLast4 ? ` ••••${t.cardLast4}` : ""}
                                {t.slipNo ? (t.method === "voucher" ? ` #${t.slipNo}` : ` (${t.slipNo})`) : ""}
                            </span>
                            <span className="font-semibold">{fmt(t.amount)}</span>
                        </div>
                    ))}
                    {totalPaid > 0 && totalPaid !== finalGrandTotal && (
                        <Row label="Total Paid" value={fmt(totalPaid)} />
                    )}
                    {changeAmount > 0 && (
                        <Row label="Change" value={fmt(changeAmount)} bold />
                    )}
                </div>
            )}

            {/* ── Credit Vouchers ── */}
            {creditVouchers && creditVouchers.length > 0 && (
                <>
                    <Separator />
                    <div className="text-center space-y-2 border-2 border-dashed border-green-600 rounded-lg px-3 py-3 bg-green-50">
                        <p className="font-bold text-xs uppercase tracking-wide text-green-700">Credit Voucher Issued</p>
                        {creditVouchers.map((voucher, idx) => (
                            <div key={idx} className="bg-white border-2 border-green-600 rounded px-2 py-2 space-y-1">
                                <p className="font-black text-xl tracking-widest text-green-700">{voucher.code}</p>
                                <p className="font-semibold text-sm">Value: <span className="font-black text-base">Rs. {fmt(Number(voucher.faceValue))}</span></p>
                                {voucher.expiresAt && (
                                    <p className="text-[9px] text-muted-foreground">
                                        Expires: {new Date(voucher.expiresAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        ))}
                        <p className="text-[9px] text-muted-foreground pt-1 border-t border-dashed">
                            Unused voucher balance - Use on next purchase
                        </p>
                    </div>
                </>
            )}

            <Separator />

            {/* ── FBR Logo + QR ── */}
            {!isGiftReceipt && (
                <div
                    className="flex items-center gap-3"
                    style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                    <div className="rpt-img shrink-0" style={{ flexShrink: 0 }}>
                        <Image
                            src="/fbr_logo.png"
                            alt="FBR POS Invoicing System"
                            width={52}
                            height={52}
                            className="object-contain"
                            unoptimized
                        />
                    </div>

                    <p className="flex-1 text-[10px] leading-snug" style={{ flex: 1, fontSize: "9pt", lineHeight: 1.3 }}>
                        This Receipt / Invoice is verified by FBR POS Invoicing System.
                        Verify through FBR Tax Asaan App or SMS at{" "}
                        <strong>9966</strong> and win exciting prizes in draw.
                    </p>

                    <div className="shrink-0 flex flex-col items-center gap-0.5" style={{ flexShrink: 0, textAlign: "center" }}>
                        <QRCodeSVG value={fbrVerifyUrl} size={58} level="M" />
                        <p className="text-[9px]" style={{ fontSize: "8pt", marginTop: "2px" }}>Scan to verify</p>
                    </div>
                </div>
            )}

            <Separator />

            {/* ── Terms & Conditions ── */}
            <div className="text-[10px] space-y-0.5">
                <p className="font-bold text-[11px]">TERMS &amp; CONDITIONS</p>
                <p>• Damaged / defective items must be reported within 4 days of purchase</p>
                <p>• Exchanges are only accepted within 7 days of purchase</p>
                <p>• Refunds only eligible only on manufacturing defects</p>
                <p>• Used, washed, altered, or worn items are not eligible for exchanges</p>
                <p>• Tags must be intact for any exchange</p>
                <p>• One exchange per order only (exchanged item can not be exchanged again)</p>
                <p>• Sale items are non-returnable &amp; non-exchangeable (unless defected)</p>
            </div>

            <Separator />

            {/* ── Footer ── */}
            <div className="text-center text-[10px] space-y-0.5 pb-1">
                {storeNTN  && <p>Sales Tax No.: {storeNTN}</p>}
                {storeSTRN && <p>NTN: {storeSTRN}</p>}
                <p>{settings.receiptFooter || "*** THANK YOU FOR SHOPPING ***"}</p>
                <p className="tracking-widest font-bold">{order?.orderNumber}</p>
            </div>

        </div>
    );
}
