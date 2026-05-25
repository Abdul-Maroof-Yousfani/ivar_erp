"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Printer, RotateCcw, Loader2 } from "lucide-react";
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

export interface ReturnReceiptLine {
    name: string;
    sku: string;
    size?: string;
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
    paymentMethod?: string;
    settings?: Partial<PosSettings>;
    isLoading?: boolean;
    exchangeVoucher?: { code: string; faceValue: number; expiresAt: string } | null;
    onClose: () => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ReturnReceiptSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 select-none">
            <div className="relative flex flex-col items-center">
                <div className="absolute inset-0 rounded-full bg-destructive/10 blur-2xl scale-150 animate-pulse" />
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20 shadow-lg shadow-destructive/10">
                    <RotateCcw className="h-9 w-9 text-destructive animate-pulse" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
                    <div
                        className="absolute w-2.5 h-2.5 rounded-full bg-destructive shadow-md shadow-destructive/40"
                        style={{
                            top: "50%", left: "50%",
                            transformOrigin: "0 0",
                            animation: "orbit-ret 1.4s linear infinite",
                            marginTop: "-5px", marginLeft: "-5px",
                        }}
                    />
                </div>
            </div>
            <div className="text-center space-y-1.5">
                <p className="text-base font-bold tracking-tight">Generating Return Slip</p>
                <p className="text-sm text-muted-foreground">Fetching return details, please wait…</p>
            </div>
            <div className="w-64 space-y-2 opacity-40">
                <div className="h-2.5 bg-muted rounded-full w-3/4 mx-auto animate-pulse" />
                <div className="h-2 bg-muted rounded-full w-1/2 mx-auto animate-pulse delay-75" />
                <div className="h-px bg-border w-full my-3" />
                {[75, 55, 85, 50, 65].map((w, i) => (
                    <div key={i} className="h-2 bg-muted rounded-full animate-pulse"
                        style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
                ))}
                <div className="h-px bg-border w-full my-3" />
                <div className="h-3 bg-muted rounded-full w-2/3 mx-auto animate-pulse" />
            </div>
            <style>{`
                @keyframes orbit-ret {
                    from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
                    to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
                }
            `}</style>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    isLoading = false,
    exchangeVoucher,
    onClose,
}: PrintReturnReceiptProps) {
    const settings: PosSettings = { ...POS_SETTINGS_DEFAULTS, ...settingsOverride };
    const { user } = useAuth();

    useEffect(() => {
        if (!isLoading && settings.receiptAutoPrint) {
            const timer = setTimeout(() => window.print(), 400);
            return () => clearTimeout(timer);
        }
    }, [isLoading, settings.receiptAutoPrint]);

    // ── Store info (same priority as sales receipt) ───────────────────
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

    const cashierName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

    const bodyProps: ReturnBodyProps = {
        storeName, storeAddress, storePhone, storeNTN, storeSTRN, terminalName,
        cashierName, returnRef, originalOrders, returnedLines, refundTotal,
        notes, discountNotes, returnedAt, paymentMethod, settings, exchangeVoucher,
    };

    return (
        <>
            {/* ── Print styles — identical strategy to sales receipt ── */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }

                    #return-print-root,
                    #return-print-root * { visibility: visible !important; }

                    #return-print-root {
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
                    #return-print-root > div > * { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>

            {/* ── Screen: dialog preview ── */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            {isLoading
                                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                : <RotateCcw className="h-4 w-4 text-destructive" />
                            }
                            Return Receipt
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? "Loading return details…" : "Review before printing."}
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isLoading ? <ReturnReceiptSkeleton /> : <ReturnBody {...bodyProps} />}
                    </div>

                    <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                        <Button onClick={() => window.print()} className="flex-1 gap-2" disabled={isLoading}>
                            {isLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                                : <><Printer className="h-4 w-4" /> Print Return Receipt</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Print target — off-screen, always rendered ── */}
            {!isLoading && (
                <div
                    id="return-print-root"
                    style={{ position: "fixed", left: "-9999px", top: 0, width: "80mm", pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <ReturnBody {...bodyProps} />
                </div>
            )}
        </>
    );
}

// ── ReturnBody ────────────────────────────────────────────────────────────────

interface ReturnBodyProps {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeNTN: string;
    storeSTRN: string;
    terminalName: string;
    cashierName: string;
    returnRef: string;
    originalOrders: { orderNumber: string; grandTotal: number }[];
    returnedLines: ReturnReceiptLine[];
    refundTotal: number;
    notes?: string;
    discountNotes?: string[];
    returnedAt?: string;
    paymentMethod?: string;
    settings: PosSettings;
    exchangeVoucher?: { code: string; faceValue: number; expiresAt: string } | null;
}

function ReturnBody({
    storeName, storeAddress, storePhone, storeNTN, storeSTRN, terminalName,
    cashierName, returnRef, originalOrders, returnedLines, refundTotal,
    notes, discountNotes, returnedAt, paymentMethod, settings, exchangeVoucher,
}: ReturnBodyProps) {

    const Row = ({ label, value, bold = false, indent = false }: {
        label: string; value: string; bold?: boolean; indent?: boolean;
    }) => (
        <div
            className="flex justify-between text-[11px]"
            style={{ paddingLeft: indent ? "12px" : undefined, fontWeight: bold ? "bold" : undefined, display: "flex", justifyContent: "space-between" }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    const totalUnits = returnedLines.reduce((s, l) => s + l.returnQty, 0);

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

            {/* ── Return Invoice Title ── */}
            <div className="text-center space-y-0.5">
                <p className="font-bold text-sm tracking-widest uppercase">Return Invoice</p>
                <p className="font-black text-2xl tracking-wider">*{fmt(refundTotal)}*</p>
            </div>

            <Separator />

            {/* ── Receipt meta ── */}
            <div className="space-y-0.5 text-[11px]">
                <Row label="Return Ref."  value={returnRef} bold />
                <Row label="Date"         value={fmtDate(returnedAt)} />
                {cashierName  && <Row label="Processed By" value={cashierName}  />}
                {terminalName && <Row label="Terminal"     value={terminalName} />}
            </div>

            <Separator />

            {/* ── Original order(s) ── */}
            <div className="space-y-0.5 text-[11px]">
                <p className="font-bold">Original Receipt{originalOrders.length > 1 ? "s" : ""}:</p>
                {originalOrders.map(o => (
                    <Row key={o.orderNumber} label={o.orderNumber} value={`Rs. ${fmt(o.grandTotal)}`} indent />
                ))}
            </div>

            <Separator />

            {/* ── Column headers ── */}
            <div
                className="text-[10px] font-bold border-b pb-1"
                style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr 0.8fr 0.8fr 0.8fr", gap: "0 4px" }}
            >
                <span>Name / Code</span>
                <span style={{ textAlign: "center" }}>Size</span>
                <span style={{ textAlign: "center" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Retail</span>
                <span style={{ textAlign: "right" }}>WOST</span>
                <span style={{ textAlign: "right" }}>Total</span>
            </div>

            {/* ── Returned item lines ── */}
            {returnedLines.map((line, idx) => {
                const qty          = line.returnQty;
                const unitPrice    = line.unitPrice ?? line.paidPerUnit;
                const taxPct       = line.taxPercent ?? 0;
                const taxDivisor   = 1 + (taxPct / 100);
                
                // Calculate WOST from retail price
                const retailPrice  = unitPrice;
                const wostPerUnit  = retailPrice / taxDivisor;
                const totalWost    = Math.round(wostPerUnit * qty * 100) / 100;
                
                // Discount
                const discPct      = line.discountPercent ?? 0;
                const discAmt      = line.discountAmount  ?? 0;
                const afterDisc    = totalWost - discAmt;
                
                // Tax
                const taxAmt       = line.taxAmount ?? 0;
                
                // Value including tax
                const valueIncludingTax = afterDisc + taxAmt;
                
                const uniqueNo = line.sku || "—";

                return (
                    <div key={idx} className="pb-2 border-b border-dashed last:border-0">
                        {/* Item name — full width bold */}
                        <p className="font-bold text-[11px] leading-tight mb-0.5">{line.name}</p>

                        {/* Data row */}
                        <div
                            className="text-[11px]"
                            style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 0.5fr 0.8fr 0.8fr 0.8fr", gap: "0 4px" }}
                        >
                            <span className="text-muted-foreground truncate">{uniqueNo}</span>
                            <span style={{ textAlign: "center" }}>{line.size || "—"}</span>
                            <span style={{ textAlign: "center", fontWeight: "bold" }}>{qty}</span>
                            <span style={{ textAlign: "right" }}>{fmt(retailPrice)}</span>
                            <span style={{ textAlign: "right" }}>{fmt(wostPerUnit)}</span>
                            <span style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(totalWost)}</span>
                        </div>

                        {/* FBR-style breakdown */}
                        <div className="mt-1 space-y-0.5 text-[10px]">
                            <Row label="Discount %" value={`${discPct}%`} />
                            <Row label="Discount Amount" value={discAmt > 0 ? fmt(discAmt) : "—"} />
                            <Row label="Amount after Discount" value={fmt(afterDisc)} />
                            <Row label="Sales Tax Rate" value={`${taxPct}%`} />
                            <Row label="Sales Tax Amount" value={taxAmt > 0 ? fmt(taxAmt) : "—"} />
                            <div
                                className="flex justify-between font-bold text-[10px] border-t border-dashed pt-0.5 mt-0.5"
                                style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}
                            >
                                <span>Value Including Sales Tax</span>
                                <span>{fmt(valueIncludingTax)}</span>
                            </div>
                        </div>

                        {/* Show source order if multi-order return */}
                        {originalOrders.length > 1 && (
                            <p className="text-[10px] mt-0.5 text-muted-foreground">
                                From: {line.orderNumber}
                            </p>
                        )}
                    </div>
                );
            })}

            <Separator />

            {/* ── Summary totals (same as sales receipt) ── */}
            <div className="space-y-0.5 text-[11px]">
                {/* Calculate totals */}
                {(() => {
                    const subtotal = returnedLines.reduce((s, line) => {
                        const qty = line.returnQty;
                        const unitPrice = line.unitPrice ?? line.paidPerUnit;
                        const taxPct = line.taxPercent ?? 0;
                        const taxDivisor = 1 + (taxPct / 100);
                        const wostPerUnit = unitPrice / taxDivisor;
                        return s + (wostPerUnit * qty);
                    }, 0);
                    
                    const totalDiscount = returnedLines.reduce((s, line) => s + (line.discountAmount ?? 0), 0);
                    const valueForSales = subtotal - totalDiscount;
                    const totalTax = returnedLines.reduce((s, line) => s + (line.taxAmount ?? 0), 0);
                    const totalValueIncludingTax = valueForSales + totalTax;
                    
                    return (
                        <>
                            <Row label={`Total Value Excluding Sales Tax (${returnedLines.length})`} value={fmt(Math.round(subtotal))} />
                            <Row label="Total Discount" value={totalDiscount > 0 ? fmt(Math.round(totalDiscount)) : "—"} />
                            <Row label="Value for Sales" value={fmt(Math.round(valueForSales))} />
                            <Row label="Total Sales Tax" value={fmt(Math.round(totalTax))} />
                            <div
                                className="flex justify-between font-bold text-[11px] border-t pt-0.5 mt-0.5"
                                style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}
                            >
                                <span>Total Value Including Sales Tax</span>
                                <span>{fmt(Math.round(totalValueIncludingTax))}</span>
                            </div>
                        </>
                    );
                })()}
            </div>

            <Separator />

            {/* ── Refund details ── */}
            <div className="space-y-0.5 text-[11px]">
                <Row label="Items Returned" value={`${totalUnits} unit${totalUnits !== 1 ? "s" : ""}`} />
                {paymentMethod && (
                    <Row label="Refund Via" value={paymentMethod.replace(/_/g, " ")} />
                )}
                <div
                    className="font-black text-sm border-t pt-0.5 mt-0.5"
                    style={{ display: "flex", justifyContent: "space-between", fontWeight: "900" }}
                >
                    <span>Total Refund</span>
                    <span>Rs. {fmt(refundTotal)}</span>
                </div>
            </div>

            {/* ── Exchange Voucher ── */}
            {exchangeVoucher && (
                <>
                    <Separator />
                    <div className="text-center space-y-1 border-2 border-dashed border-primary rounded-lg px-3 py-3 bg-primary/5">
                        <p className="font-bold text-xs uppercase tracking-wide text-primary">Exchange Voucher Issued</p>
                        <div className="bg-white border-2 border-primary rounded px-2 py-2">
                            <p className="font-black text-2xl tracking-widest text-primary">{exchangeVoucher.code}</p>
                        </div>
                        <div className="text-[10px] space-y-0.5 pt-1">
                            <p className="font-semibold">Value: <span className="font-black text-base">Rs. {fmt(Number(exchangeVoucher.faceValue))}</span></p>
                            <p className="text-muted-foreground">
                                Expires: {new Date(exchangeVoucher.expiresAt).toLocaleDateString('en-PK', { 
                                    day: '2-digit', 
                                    month: 'short', 
                                    year: 'numeric' 
                                })}
                            </p>
                        </div>
                        <p className="text-[9px] text-muted-foreground pt-1 border-t border-dashed">
                            Present this voucher for your next purchase
                        </p>
                    </div>
                </>
            )}

            {/* ── Coupon / voucher restored ── */}
            {discountNotes && discountNotes.length > 0 && (
                <>
                    <Separator />
                    <div className="text-[10px] space-y-0.5 border border-dashed rounded px-2 py-1.5">
                        <p className="font-bold text-[11px]">Coupon / Voucher Returned:</p>
                        {discountNotes.map((note, i) => (
                            <p key={i} style={{ paddingLeft: "8px" }}>{note}</p>
                        ))}
                        <p style={{ color: "gray", marginTop: "2px" }}>
                            * Code restored and can be reused.
                        </p>
                    </div>
                </>
            )}

            {/* ── Notes ── */}
            {notes && (
                <>
                    <Separator />
                    <div className="text-[10px] space-y-0.5">
                        <p className="font-bold">Notes:</p>
                        <p style={{ paddingLeft: "8px" }}>{notes}</p>
                    </div>
                </>
            )}

            <Separator />

            {/* ── FBR Logo (no QR on return — no FBR invoice number) ── */}
            <div
                className="flex items-center gap-3"
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
                <div style={{ flexShrink: 0 }}>
                    <Image
                        src="/fbr_logo.png"
                        alt="FBR POS Invoicing System"
                        width={48}
                        height={48}
                        className="object-contain"
                        unoptimized
                    />
                </div>
                <p style={{ flex: 1, fontSize: "9pt", lineHeight: 1.3 }}>
                    This return is processed against an FBR verified Sales Tax Invoice.
                    Original invoice remains on record.
                </p>
            </div>

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
                <p>{settings.receiptFooter || "*** THANK YOU ***"}</p>
                <p className="tracking-widest font-bold">{returnRef}</p>
            </div>

        </div>
    );
}
