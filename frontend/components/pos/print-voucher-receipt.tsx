"use client";

import { useEffect } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Printer, Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { printThermal } from "@/lib/utils/print";

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

interface PrintVoucherReceiptProps {
    voucher?: {
        code: string;
        voucherType: string;
        faceValue: number;
        discount?: number;
        description?: string;
        companyName?: string;
        expiresAt?: string | null;
        createdAt?: string;
        locations?: Array<{ location: { name: string; code: string } }>;
        sourceOrder?: {
            orderNumber: string;
            returnNumber?: string | null;
            refundNumber?: string | null;
        } | null;
    };
    vouchers?: Array<{
        code: string;
        voucherType: string;
        faceValue: number;
        discount?: number;
        description?: string;
        companyName?: string;
        expiresAt?: string | null;
        createdAt?: string;
        locations?: Array<{ location: { name: string; code: string } }>;
        sourceOrder?: {
            orderNumber: string;
            returnNumber?: string | null;
            refundNumber?: string | null;
        } | null;
    }>;
    isLoading?: boolean;
    autoPrint?: boolean;
    onClose: () => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function VoucherSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 select-none">
            {/* Animated gift illustration */}
            <div className="relative flex flex-col items-center">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150 animate-pulse" />

                {/* Gift icon with pulse */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
                    <Gift className="h-9 w-9 text-primary animate-pulse" />
                </div>
            </div>

            {/* Text */}
            <div className="text-center space-y-1.5">
                <p className="text-base font-bold tracking-tight">Generating Voucher Receipt</p>
                <p className="text-sm text-muted-foreground">Preparing voucher details…</p>
            </div>

            {/* Skeleton lines */}
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
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PrintVoucherReceipt({
    voucher,
    vouchers,
    isLoading = false,
    autoPrint = false,
    onClose,
}: PrintVoucherReceiptProps) {
    const { user } = useAuth();
    const { settings } = usePosSettings();

    const isBulk = vouchers !== undefined && vouchers.length > 0;
    const voucherList = isBulk ? vouchers! : voucher ? [voucher] : [];

    useEffect(() => {
        if (!isLoading && autoPrint && voucherList.length > 0) {
            const timer = setTimeout(() => printThermal("voucher-receipt-print-root", settings), 400);
            return () => clearTimeout(timer);
        }
    }, [isLoading, autoPrint, settings, voucherList.length]);

    // ── Store info ────────────────────────────────────────────────────
    const storeName =
        (typeof user?.terminal?.location?.fbrSellerName === "string" ? user.terminal.location.fbrSellerName : "") ||
        (typeof user?.terminal?.location?.name === "string" ? user.terminal.location.name : "") ||
        getCookie("companyName") ||
        "Store";

    const storeAddress = (typeof user?.terminal?.location?.address === "string" ? user.terminal.location.address : "") || "";
    const storePhone   = (typeof user?.terminal?.location?.phone   === "string" ? user.terminal.location.phone   : "") || "";
    const terminalName = (typeof user?.terminal?.name === "string" ? user.terminal.name : "") || (typeof user?.terminal?.code === "string" ? user.terminal.code : "") || "";

    const title = isBulk 
        ? `Print Vouchers (${voucherList.length})` 
        : `${(voucherList[0]?.voucherType ? `${voucherList[0].voucherType.replace(/_/g, ' ')} Voucher` : 'Gift Voucher')} Receipt`;

    return (
        <>
            <style>{`
                /* Ensure print root and its descendants are rendered in solid black and white for standard/PDF rendering */
                #voucher-receipt-print-root,
                #voucher-receipt-print-root * {
                    color: #000 !important;
                    border-color: #000 !important;
                    background-color: transparent !important;
                    background: none !important;
                }

                #voucher-receipt-print-root [role="separator"],
                #voucher-receipt-print-root hr {
                    background-color: #000 !important;
                    height: 1px !important;
                }

                @media print {
                    body *:not(#voucher-receipt-print-root):not(#voucher-receipt-print-root *) {
                        visibility: hidden !important;
                        height: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                    }
                    #voucher-receipt-print-root,
                    #voucher-receipt-print-root * {
                        visibility: visible !important;
                        color: #000 !important;
                        border-color: #000 !important;
                        background-color: transparent !important;
                        background: none !important;
                    }
                    #voucher-receipt-print-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 72.1mm !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-size: 9pt !important;
                        line-height: 1.35 !important;
                    }
                    /* Each voucher wrapper — page-break triggers thermal cutter */
                    #voucher-receipt-print-root .voucher-print-page {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        padding: 2mm 1mm !important;
                    }
                    #voucher-receipt-print-root .voucher-print-page.voucher-cut {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    @page { margin: 0; size: 80mm auto; }
                }
            `}</style>

            {/* ── Screen: dialog preview ────────────────────────────────── */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            <span className="capitalize">{title.toLowerCase()}</span>
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? "Loading voucher data…" : "Review before printing."}
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-3 bg-muted/10">
                        {isLoading ? (
                            <VoucherSkeleton />
                        ) : isBulk ? (
                            <div className="space-y-6 max-w-[420px] mx-auto py-2">
                                {voucherList.map((v, idx) => (
                                    <div key={v.code} className="bg-background border rounded-xl p-6 shadow-sm relative">
                                        <div className="absolute top-3 left-3 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded">
                                            #{idx + 1} of {voucherList.length}
                                        </div>
                                        <div className="pt-2">
                                            <VoucherReceiptBody
                                                storeName={storeName}
                                                storeAddress={storeAddress}
                                                storePhone={storePhone}
                                                terminalName={terminalName}
                                                voucher={v}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : voucherList.length > 0 ? (
                            <div className="bg-background border rounded-xl p-6 shadow-sm max-w-[420px] mx-auto my-2">
                                <VoucherReceiptBody
                                    storeName={storeName}
                                    storeAddress={storeAddress}
                                    storePhone={storePhone}
                                    terminalName={terminalName}
                                    voucher={voucherList[0]}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">No voucher details available.</div>
                        )}
                    </div>

                    <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                        <Button
                            onClick={() => printThermal("voucher-receipt-print-root", settings)}
                            className="flex-1 gap-2"
                            disabled={isLoading || voucherList.length === 0}
                        >
                            {isLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                                : <><Printer className="h-4 w-4" /> {isBulk ? `Print ${voucherList.length} Vouchers` : "Print Voucher"}</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Print target — off-screen but rendered, visible only on print ── */}
            {!isLoading && voucherList.length > 0 && (
                <div
                    id="voucher-receipt-print-root"
                    style={{ position: "fixed", left: "-9999px", top: 0, width: "72.1mm", pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    {voucherList.map((v, index) => {
                        const isLast = index === voucherList.length - 1;
                        return (
                            <div
                                key={v.code}
                                className={`voucher-print-page${!isLast ? " voucher-cut" : ""}`}
                                style={{
                                    // Inline styles as a fallback for Electron / silent print paths
                                    pageBreakAfter: !isLast ? "always" : "auto",
                                    breakAfter: !isLast ? "page" : "auto",
                                    pageBreakInside: "avoid",
                                    breakInside: "avoid",
                                    padding: "2mm 1mm",
                                }}
                            >
                                <VoucherReceiptBody
                                    storeName={storeName}
                                    storeAddress={storeAddress}
                                    storePhone={storePhone}
                                    terminalName={terminalName}
                                    voucher={v}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

interface VoucherReceiptBodyProps {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    terminalName: string;
    voucher: {
        code: string;
        voucherType: string;
        faceValue: number;
        discount?: number;
        description?: string;
        companyName?: string;
        expiresAt?: string | null;
        createdAt?: string;
        locations?: Array<{ location: { name: string; code: string } }>;
        sourceOrder?: {
            orderNumber: string;
            returnNumber?: string | null;
            refundNumber?: string | null;
        } | null;
    };
}

function VoucherReceiptBody({
    storeName,
    storeAddress,
    storePhone,
    terminalName,
    voucher,
}: VoucherReceiptBodyProps) {

    const Row = ({ label, value, bold = false }: {
        label: string; value: string; bold?: boolean;
    }) => (
        <div
            className="rpt-flex flex justify-between text-[11px]"
            style={{ fontWeight: bold ? "bold" : undefined }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    const voucherTypeLabel = voucher.voucherType.replace(/_/g, " ");

    const locationList = voucher.locations ?? [];
    const isUnrestricted = locationList.length === 0;
    const locationNames  = locationList.map(l => l.location.name);

    return (
        <div className="font-mono text-xs w-full max-w-[72.1mm] mx-auto space-y-1.5">

            {/* ── Store Header ── */}
            <div className="text-center space-y-0.5">
                <p className="font-black text-xs leading-tight uppercase tracking-wide">{storeName}</p>
                {(storeAddress || storePhone) && (
                    <p className="text-[10px] leading-tight opacity-80">
                        {storeAddress}{storeAddress && storePhone ? " | " : ""}{storePhone}
                    </p>
                )}
            </div>

            <Separator />

            {/* ── Voucher Title ── */}
            <div className="text-center py-0.5">
                <div className="flex items-center justify-center gap-1.5">
                    <Gift className="h-4 w-4 text-zinc-950" />
                    <p className="font-bold text-sm tracking-wider uppercase">{voucherTypeLabel} Voucher</p>
                </div>
            </div>

            <Separator />

            {/* ── Voucher Code (Large & Prominent) ── */}
            <div className="text-center space-y-2 py-3 border border-dashed border-zinc-950 rounded bg-zinc-50">
                <p className="text-[9px] text-zinc-800 uppercase tracking-wide">Voucher Code</p>
                <p className="font-black text-xl tracking-widest text-zinc-955">{voucher.code}</p>
                
                {/* QR Code for easy scanning */}
                <div className="flex justify-center pt-0.5">
                    <QRCodeSVG
                        value={voucher.code}
                        size={100}
                        level="M"
                        includeMargin={false}
                    />
                </div>
            </div>

            <Separator />

            {/* ── Voucher Value ── */}
            <div className="text-center py-2 bg-zinc-100 rounded border border-zinc-200">
                <p className="text-[9px] text-zinc-800 uppercase tracking-wide">Voucher Value</p>
                <p className="font-black text-2xl tracking-wider text-zinc-955">Rs. {fmt(Number(voucher.faceValue))}</p>
            </div>

            <Separator />

            {/* ── Voucher Details ── */}
            <div className="space-y-0.5 text-[11px]">
                <Row label="Issued On" value={fmtDate(voucher.createdAt)} />
                <Row label="Expires On" value={voucher.expiresAt ? fmtDate(voucher.expiresAt) : "No Expiry"} />
                
                {/* Source return / sales invoice details */}
                {voucher.sourceOrder?.orderNumber && (
                    <Row label="Against Invoice" value={voucher.sourceOrder.orderNumber} />
                )}
                {voucher.sourceOrder?.returnNumber && (
                    <Row label="Against Return" value={voucher.sourceOrder.returnNumber} />
                )}
                {voucher.sourceOrder?.refundNumber && (
                    <Row label="Against Refund" value={voucher.sourceOrder.refundNumber} />
                )}

                {terminalName && <Row label="Terminal" value={terminalName} />}
                {voucher.companyName && <Row label="Company" value={voucher.companyName} />}
                {voucher.description && (
                    <div className="pt-0.5">
                        <p className="text-[10px] text-zinc-800">Note:</p>
                        <p className="text-[11px] leading-snug">{voucher.description}</p>
                    </div>
                )}
            </div>

            <Separator />

            {/* ── Redemption Locations ── */}
            <div className="space-y-0.5">
                <p className="text-[10px] text-zinc-800 uppercase tracking-wide">
                    Valid At {!isUnrestricted && <span className="normal-case">({locationNames.length} outlets)</span>}
                </p>
                {isUnrestricted ? (
                    <p className="text-[11px] font-semibold">All Locations</p>
                ) : (
                    <ul className="space-y-0" style={{ columns: locationNames.length > 5 ? 2 : 1, columnGap: "4px" }}>
                        {locationNames.map(name => (
                            <li
                                key={name}
                                className="font-semibold leading-snug break-inside-avoid"
                                style={{ fontSize: "9px" }}
                            >
                                • {name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Separator />

            {/* ── Footer Message ── */}
            <div className="text-center space-y-0.5 pt-1">
                <p className="text-[10px] font-semibold">Thank you for choosing us!</p>
                <p className="text-[9px] text-zinc-800">
                    For assistance, please contact the store
                </p>
                <p className="text-[9px] text-zinc-500 pt-0.5">Software by Innovative Network</p>
            </div>

            {/* ── Decorative border ── */}
            <div className="text-center text-[10px] text-zinc-800 pt-1">
                ═══════════════════════════════
            </div>
        </div>
    );
}
