"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Printer, FileText, Loader2 } from "lucide-react";
import type { PosSettings } from "@/hooks/use-pos-settings";
import { POS_SETTINGS_DEFAULTS } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";
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

function fmtTime(dateStr?: string | null): string {
    const d = dateStr ? new Date(dateStr) : new Date();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClaimReceiptLine {
    name: string;
    sku: string;
    claimedQty: number;
    approvedQty?: number;
    unitPaidPrice: number;
    claimedAmount: number;
    approvedAmount?: number;
    itemStatus?: string;
}

export interface PrintClaimReceiptProps {
    claim?: any;
    claimNumber?: string;
    orderNumber?: string;
    claimType?: string;
    status?: string;
    reasonCode?: string;
    reasonNotes?: string;
    reviewNotes?: string;
    claimedLines?: ClaimReceiptLine[];
    claimedAmount?: number;
    approvedAmount?: number;
    submittedAt?: string;
    reviewedAt?: string;
    settings?: Partial<PosSettings>;
    isLoading?: boolean;
    onClose: () => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ClaimReceiptSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 select-none">
            <div className="relative flex flex-col items-center">
                <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-2xl scale-150 animate-pulse" />
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                    <FileText className="h-9 w-9 text-amber-600 animate-pulse" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
                    <div
                        className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md shadow-amber-500/40"
                        style={{
                            top: "50%", left: "50%",
                            transformOrigin: "0 0",
                            animation: "orbit-claim 1.4s linear infinite",
                            marginTop: "-5px", marginLeft: "-5px",
                        }}
                    />
                </div>
            </div>
            <div className="text-center space-y-1.5">
                <p className="text-base font-bold tracking-tight">Generating Claim Receipt</p>
                <p className="text-sm text-muted-foreground">Fetching claim details, please wait…</p>
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
                @keyframes orbit-claim {
                    from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
                    to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
                }
            `}</style>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PrintClaimReceipt({
    claim,
    claimNumber: claimNumberProp,
    orderNumber: orderNumberProp,
    claimType: claimTypeProp,
    status: statusProp,
    reasonCode: reasonCodeProp,
    reasonNotes: reasonNotesProp,
    reviewNotes: reviewNotesProp,
    claimedLines: claimedLinesProp,
    claimedAmount: claimedAmountProp,
    approvedAmount: approvedAmountProp,
    submittedAt: submittedAtProp,
    reviewedAt: reviewedAtProp,
    settings: settingsOverride,
    isLoading = false,
    onClose,
}: PrintClaimReceiptProps) {
    const settings: PosSettings = { ...POS_SETTINGS_DEFAULTS, ...settingsOverride };
    const { user } = useAuth();

    // Extract data from claim object if provided, otherwise use individual props
    const claimNumber = claim?.claimNumber || claimNumberProp || "";
    const orderNumber = claim?.salesOrder?.orderNumber || orderNumberProp || "";
    const claimType = claim?.claimType || claimTypeProp || "";
    const status = claim?.status || statusProp || "";
    const reasonCode = claim?.reasonCode || reasonCodeProp;
    const reasonNotes = claim?.reasonNotes || reasonNotesProp;
    const reviewNotes = claim?.reviewNotes || reviewNotesProp;
    const submittedAt = claim?.createdAt || submittedAtProp;
    const reviewedAt = claim?.reviewedAt || reviewedAtProp;
    const claimedAmount = claim?.claimedAmount ? Number(claim.claimedAmount) : (claimedAmountProp || 0);
    const approvedAmount = claim?.approvedAmount ? Number(claim.approvedAmount) : approvedAmountProp;

    // Transform claim items to claimedLines format
    const claimedLines: ClaimReceiptLine[] = claim?.items
        ? claim.items.map((item: any) => ({
            name: item.item?.description || "Unknown Item",
            sku: item.item?.sku || item.item?.barCode || "N/A",
            claimedQty: Number(item.claimedQty || 0),
            approvedQty: item.approvedQty ? Number(item.approvedQty) : undefined,
            unitPaidPrice: Number(item.unitPaidPrice || 0),
            claimedAmount: Number(item.claimedAmount || 0),
            approvedAmount: item.approvedAmount ? Number(item.approvedAmount) : undefined,
            itemStatus: item.itemStatus,
        }))
        : (claimedLinesProp || []);

    // Extract voucher details if claim is approved
    const voucher = claim?.voucher;

    useEffect(() => {
        if (!isLoading && settings.receiptAutoPrint) {
            const timer = setTimeout(() => printThermal("claim-print-root", settings), 400);
            return () => clearTimeout(timer);
        }
    }, [isLoading, settings.receiptAutoPrint, settings]);

    // ── Store info ───────────────────────
    const storeName =
        settings.receiptStoreName ||
        (typeof user?.terminal?.location?.fbrSellerName === "string" ? user.terminal.location.fbrSellerName : "") ||
        (typeof user?.terminal?.location?.name === "string" ? user.terminal.location.name : "") ||
        getCookie("companyName") ||
        "Store";

    const storeAddress = settings.receiptAddress || (typeof user?.terminal?.location?.address === "string" ? user.terminal.location.address : "") || "";
    const storePhone   = settings.receiptPhone   || (typeof user?.terminal?.location?.phone   === "string" ? user.terminal.location.phone   : "") || "";

    const bodyProps: ClaimBodyProps = {
        storeName, storeAddress, storePhone,
        claimNumber, orderNumber, claimType, status,
        reasonCode, reasonNotes, reviewNotes,
        claimedLines, claimedAmount, approvedAmount,
        submittedAt, reviewedAt, settings,
        voucher, // Pass voucher data
    };

    return (
        <>
            {/* ── Print styles ── */}
            <style>{`
                /* Ensure print root and its descendants are rendered in solid black and white for standard/PDF rendering */
                #claim-print-root,
                #claim-print-root * {
                    color: #000 !important;
                    border-color: #000 !important;
                    background-color: transparent !important;
                    background: none !important;
                }

                #claim-print-root [role="separator"],
                #claim-print-root hr {
                    background-color: #000 !important;
                    height: 1px !important;
                }

                /* Badges/statuses: instead of colored background, show black text with a black border */
                #claim-print-root [style*="background-color"] {
                    background-color: transparent !important;
                    color: #000 !important;
                    border: 1px solid #000 !important;
                }

                @media print {
                    body *:not(#claim-print-root):not(#claim-print-root *) {
                        visibility: hidden !important;
                        height: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                    }

                    #claim-print-root,
                    #claim-print-root * {
                        visibility: visible !important;
                        color: #000 !important;
                        border-color: #000 !important;
                        background-color: transparent !important;
                        background: none !important;
                    }

                    #claim-print-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 72.1mm !important;
                        padding: 2mm 1mm !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-size: 9pt !important;
                        line-height: 1.35 !important;
                    }

                    @page { margin: 0; size: 80mm auto; }
                    #claim-print-root > div > * { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>

            {/* ── Screen: dialog preview ── */}
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            {isLoading
                                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                : <FileText className="h-4 w-4 text-amber-600" />
                            }
                            Claim Receipt
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {isLoading ? "Loading claim details…" : "Review before printing."}
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isLoading ? <ClaimReceiptSkeleton /> : <ClaimBody {...bodyProps} />}
                    </div>

                    <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                        <Button onClick={() => printThermal("claim-print-root", settings)} className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700" disabled={isLoading}>
                            {isLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                                : <><Printer className="h-4 w-4" /> Print Claim Receipt</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Print target ── */}
            {!isLoading && (
                <div
                    id="claim-print-root"
                    style={{ position: "fixed", left: "-9999px", top: 0, width: "72.1mm", pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <ClaimBody {...bodyProps} />
                </div>
            )}
        </>
    );
}

// ── ClaimBody ─────────────────────────────────────────────────────────────────

interface ClaimBodyProps {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    claimNumber: string;
    orderNumber: string;
    claimType: string;
    status: string;
    reasonCode?: string;
    reasonNotes?: string;
    reviewNotes?: string;
    claimedLines: ClaimReceiptLine[];
    claimedAmount: number;
    approvedAmount?: number;
    submittedAt?: string;
    reviewedAt?: string;
    settings: PosSettings;
    voucher?: any; // Voucher details
}

function ClaimBody({
    storeName, storeAddress, storePhone,
    claimNumber, orderNumber, claimType, status,
    reasonCode, reasonNotes, reviewNotes,
    claimedLines, claimedAmount, approvedAmount,
    submittedAt, reviewedAt, settings,
    voucher, // Voucher data
}: ClaimBodyProps) {

    const Row = ({ label, value, bold = false }: {
        label: string; value: string; bold?: boolean;
    }) => (
        <div
            className="flex justify-between text-[11px]"
            style={{ fontWeight: bold ? "bold" : undefined, display: "flex", justifyContent: "space-between" }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    const totalUnits = claimedLines.reduce((s, l) => s + l.claimedQty, 0);
    const isApproved = status === "APPROVED" || status === "PARTIALLY_APPROVED";
    const isRejected = status === "REJECTED";
    const isPending = status === "SUBMITTED" || status === "UNDER_REVIEW";

    // Status badge styling
    const statusColor = isApproved ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b";
    const statusText = status.replace(/_/g, " ");

    return (
        <div className="font-mono text-[10px] w-full max-w-[72.1mm] mx-auto" style={{ lineHeight: 1.25 }}>

            {/* ── Store Header ── */}
            <div className="text-center pb-1 border-b border-zinc-400">
                <p className="font-black text-[13px] leading-tight uppercase tracking-wide">{storeName}</p>
                {(storeAddress || storePhone) && (
                    <p className="text-[9px] leading-snug">
                        {storeAddress}{storeAddress && storePhone ? " | " : ""}{storePhone}
                    </p>
                )}
            </div>

            {/* ── Claim Title + Meta ── */}
            <div className="py-1 border-b border-dashed border-zinc-400">
                <p className="text-center font-bold text-[10px] uppercase tracking-widest">CLAIM RECEIPT</p>
                <div className="mt-0.5 space-y-0 text-[9px]">
                    <Row label="Claim #" value={claimNumber} bold />
                    <Row label="Order #" value={orderNumber} bold />
                    <Row label="Type" value={claimType.replace(/_/g, " ")} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Status:</span>
                        <span style={{
                            backgroundColor: statusColor, color: "white",
                            padding: "1px 6px", borderRadius: "3px",
                            fontSize: "9px", fontWeight: "bold", textTransform: "uppercase"
                        }}>{statusText}</span>
                    </div>
                    <Row label="Submitted" value={`${fmtDate(submittedAt)}, ${fmtTime(submittedAt)}`} />
                    {reviewedAt && <Row label="Reviewed" value={`${fmtDate(reviewedAt)}, ${fmtTime(reviewedAt)}`} />}
                </div>
            </div>

            {reasonCode && (
                <div className="py-0.5 border-b border-dashed border-zinc-400 space-y-0 text-[9px]">
                    <p className="font-bold">Reason: {reasonCode.replace(/_/g, " ")}</p>
                    {reasonNotes && <p style={{ paddingLeft: "8px", fontSize: "9px" }}>{reasonNotes}</p>}
                </div>
            )}

            {/* ── Column headers ── */}
            <div
                className="text-[9px] font-bold border-b border-zinc-400 py-0.5"
                style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 1fr", gap: "0 3px" }}
            >
                <span>Item</span>
                <span style={{ textAlign: "center" }}>Qty</span>
                <span style={{ textAlign: "center" }}>Appr</span>
                <span style={{ textAlign: "right" }}>Amount</span>
            </div>

            {/* ── Claimed item lines ── */}
            {claimedLines.map((line, idx) => {
                const displayAmount = line.approvedAmount ?? line.claimedAmount;
                const displayQty = line.approvedQty ?? line.claimedQty;
                return (
                    <div key={idx} className="border-b border-dashed border-zinc-300 py-0.5">
                        <p className="font-bold text-[10px] leading-tight">{line.name}</p>
                        <div
                            className="text-[9px]"
                            style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 1fr", gap: "0 3px" }}
                        >
                            <span className="truncate text-zinc-600">SKU: {line.sku}</span>
                            <span style={{ textAlign: "center", fontWeight: "bold" }}>{line.claimedQty}</span>
                            <span style={{ textAlign: "center", fontWeight: "bold", color: statusColor }}>{displayQty}</span>
                            <span style={{ textAlign: "right", fontWeight: "bold" }}>Rs. {fmt(displayAmount)}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-tight">
                            Unit: Rs. {fmt(line.unitPaidPrice)}
                            {line.itemStatus && ` | ${line.itemStatus.replace(/_/g, " ")}`}
                        </p>
                    </div>
                );
            })}

            {/* ── Totals ── */}
            <div className="py-1 border-b border-zinc-400 space-y-0 text-[9px]">
                <Row label="Items Claimed" value={`${totalUnits} unit${totalUnits !== 1 ? "s" : ""}`} />
                <Row label="Claimed Amount" value={`Rs. ${fmt(claimedAmount)}`} bold />
                {approvedAmount !== undefined && approvedAmount !== claimedAmount && (
                    <Row label="TOTAL APPROVED" value={`Rs. ${fmt(approvedAmount)}`} bold />
                )}
            </div>

            {/* ── Status message ── */}
            <div className="py-1 border-b border-dashed border-zinc-400 text-[9px] space-y-0.5">
                {isApproved && (
                    <>
                        <p className="font-bold text-center" style={{ color: statusColor }}>✓ CLAIM APPROVED ✓</p>
                        <p className="text-center text-[8px]">Present this receipt to collect your refund.</p>
                        {voucher && voucher.voucherType === 'EXCHANGE' && (
                            <div className="mt-1 pt-1 border-t border-dashed space-y-0.5" style={{ borderColor: statusColor }}>
                                <p className="font-bold text-center" style={{ color: "#10b981" }}>🎫 EXCHANGE VOUCHER 🎫</p>
                                <Row label="Code" value={voucher.code} bold />
                                <Row label="Amount" value={`Rs. ${fmt(Number(voucher.faceValue))}`} bold />
                                <Row label="Valid Until" value={fmtDate(voucher.expiresAt)} />
                                <p className="text-center text-[8px]">Use this voucher for your next purchase!</p>
                            </div>
                        )}
                    </>
                )}
                {isRejected && (
                    <>
                        <p className="font-bold text-center" style={{ color: statusColor }}>✗ CLAIM REJECTED ✗</p>
                        <p className="text-center text-[8px]">This claim has been reviewed and rejected.</p>
                        {reviewNotes && (
                            <p className="text-center text-[8px] mt-0.5">Reason: {reviewNotes}</p>
                        )}
                        <p className="text-center text-[8px] mt-0.5">📦 Product ready for pickup. Collect within 7 days.</p>
                    </>
                )}
                {isPending && (
                    <>
                        <p className="font-bold text-center" style={{ color: statusColor }}>⏳ UNDER PROCESS ⏳</p>
                        <p className="text-center text-[8px]">Your claim is being reviewed. Check back later.</p>
                        <p className="text-center text-[8px] mt-0.5">⚠️ This does NOT guarantee acceptance. Final decision rests with Product Line.</p>
                    </>
                )}
            </div>

            {/* ── Review notes ── */}
            {reviewNotes && (
                <div className="py-0.5 border-b border-dashed border-zinc-400 text-[9px] space-y-0">
                    <p className="font-bold">Review Notes:</p>
                    <p style={{ paddingLeft: "8px" }}>{reviewNotes}</p>
                </div>
            )}

            {/* ── Footer ── */}
            <div className="text-center text-[9px] pt-1 pb-1 space-y-0">
                <p>Thank you for your patience</p>
                <p>For queries: {storePhone || "+92-XXX-XXXXXXX"}</p>
                <p className="tracking-widest font-bold">{claimNumber}</p>
            </div>

        </div>
    );
}
