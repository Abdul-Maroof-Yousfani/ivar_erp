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
    voucher: {
        code: string;
        voucherType: string;
        faceValue: number;
        description?: string;
        companyName?: string;
        expiresAt?: string | null;
        createdAt?: string;
        locations?: Array<{ location: { name: string; code: string } }>;
    };
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
    isLoading = false,
    autoPrint = false,
    onClose,
}: PrintVoucherReceiptProps) {
    const { user } = useAuth();

    useEffect(() => {
        if (!isLoading && autoPrint) {
            const timer = setTimeout(() => window.print(), 400);
            return () => clearTimeout(timer);
        }
    }, [isLoading, autoPrint]);

    // ── Store info ────────────────────────────────────────────────────
    const storeName =
        (typeof user?.terminal?.location?.fbrSellerName === "string" ? user.terminal.location.fbrSellerName : "") ||
        (typeof user?.terminal?.location?.name === "string" ? user.terminal.location.name : "") ||
        getCookie("companyName") ||
        "Store";

    const storeAddress = (typeof user?.terminal?.location?.address === "string" ? user.terminal.location.address : "") || "";
    const storePhone   = (typeof user?.terminal?.location?.phone   === "string" ? user.terminal.location.phone   : "") || "";
    const terminalName = (typeof user?.terminal?.name === "string" ? user.terminal.name : "") || (typeof user?.terminal?.code === "string" ? user.terminal.code : "") || "";

    const bodyProps: VoucherReceiptBodyProps = {
        storeName,
        storeAddress,
        storePhone,
        terminalName,
        voucher,
    };

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #voucher-receipt-print-root,
                    #voucher-receipt-print-root * { visibility: visible !important; }
                    #voucher-receipt-print-root {
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
                    #voucher-receipt-print-root > div > * { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>

            {/* ── Screen: dialog preview ────────────────────────────────── */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            Gift Voucher Receipt
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? "Loading voucher data…" : "Review before printing."}
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isLoading ? <VoucherSkeleton /> : <VoucherReceiptBody {...bodyProps} />}
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
                                : <><Printer className="h-4 w-4" /> Print Voucher</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Print target — off-screen but rendered, visible only on print ── */}
            {!isLoading && (
                <div
                    id="voucher-receipt-print-root"
                    style={{ position: "fixed", left: "-9999px", top: 0, width: "80mm", pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <VoucherReceiptBody {...bodyProps} />
                </div>
            )}
        </>
    );
}

// ── VoucherReceiptBody ────────────────────────────────────────────────────────

interface VoucherReceiptBodyProps {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    terminalName: string;
    voucher: {
        code: string;
        voucherType: string;
        faceValue: number;
        description?: string;
        companyName?: string;
        expiresAt?: string | null;
        createdAt?: string;
        locations?: Array<{ location: { name: string; code: string } }>;
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
    const locationNames = voucher.locations && voucher.locations.length > 0
        ? voucher.locations.map(l => l.location.name).join(", ")
        : "All Locations";

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

            {/* ── Voucher Title ── */}
            <div className="text-center space-y-2 py-2">
                <div className="flex items-center justify-center gap-2">
                    <Gift className="h-6 w-6 text-primary" />
                    <p className="font-bold text-base tracking-widest uppercase">Gift Voucher</p>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{voucherTypeLabel}</p>
            </div>

            <Separator />

            {/* ── Voucher Code (Large & Prominent) ── */}
            <div className="text-center space-y-3 py-4 border-2 border-dashed border-primary rounded-lg bg-primary/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Voucher Code</p>
                <p className="font-black text-3xl tracking-widest">{voucher.code}</p>
                
                {/* QR Code for easy scanning */}
                <div className="flex justify-center pt-2">
                    <QRCodeSVG
                        value={voucher.code}
                        size={120}
                        level="M"
                        includeMargin={false}
                    />
                </div>
                <p className="text-[9px] text-muted-foreground">Scan or enter code at checkout</p>
            </div>

            <Separator />

            {/* ── Voucher Value ── */}
            <div className="text-center space-y-1 py-3 bg-muted/20 rounded-lg">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Voucher Value</p>
                <p className="font-black text-4xl tracking-wider">Rs. {fmt(Number(voucher.faceValue))}</p>
            </div>

            <Separator />

            {/* ── Voucher Details ── */}
            <div className="space-y-0.5 text-[11px]">
                <Row label="Issued On" value={fmtDate(voucher.createdAt)} />
                <Row label="Expires On" value={voucher.expiresAt ? fmtDate(voucher.expiresAt) : "No Expiry"} />
                {terminalName && <Row label="Terminal" value={terminalName} />}
                {voucher.companyName && <Row label="Company" value={voucher.companyName} />}
                {voucher.description && (
                    <div className="pt-1">
                        <p className="text-[10px] text-muted-foreground">Note:</p>
                        <p className="text-[11px] leading-snug">{voucher.description}</p>
                    </div>
                )}
            </div>

            <Separator />

            {/* ── Redemption Locations ── */}
            <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valid At</p>
                <p className="text-[11px] font-semibold">{locationNames}</p>
            </div>

            <Separator />

            {/* ── Terms & Conditions ── */}
            <div className="space-y-1 text-[9px] text-muted-foreground leading-snug">
                <p className="font-bold text-[10px] text-foreground uppercase tracking-wide">Terms & Conditions</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {voucher.voucherType === "REFUND" ? (
                        <>
                            <li>This is a RECORD-ONLY voucher for cash refund</li>
                            <li>Cash has already been refunded to customer</li>
                            <li>This voucher CANNOT be redeemed or used</li>
                            <li>Keep for your records only</li>
                        </>
                    ) : (
                        <>
                            <li>This voucher can be redeemed for merchandise only</li>
                            <li>Cannot be exchanged for cash</li>
                            {voucher.voucherType === "EXCHANGE" ? (
                                <>
                                    <li>Valid only at the issuing location</li>
                                    <li>No credit voucher will be issued for unused balance</li>
                                </>
                            ) : (
                                <li>Unused balance will be issued as a credit voucher</li>
                            )}
                            <li>Not valid with other promotions unless specified</li>
                            {voucher.expiresAt && <li>Must be used before expiry date</li>}
                            <li>Lost or stolen vouchers cannot be replaced</li>
                        </>
                    )}
                </ul>
            </div>

            <Separator />

            {/* ── Footer Message ── */}
            <div className="text-center space-y-1 pt-2">
                <p className="text-[11px] font-semibold">Thank you for choosing us!</p>
                <p className="text-[9px] text-muted-foreground">
                    For assistance, please contact the store
                </p>
            </div>

            {/* ── Decorative border ── */}
            <div className="text-center text-[10px] text-muted-foreground pt-2">
                ═══════════════════════════════
            </div>
        </div>
    );
}
