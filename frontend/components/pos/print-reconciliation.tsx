"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authFetch } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
    Printer, Receipt, Clock, User, FileText,
    FileSpreadsheet, Download
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { cn } from "@/lib/utils";
import { printThermal } from "@/lib/utils/print";
import { usePosSettings } from "@/hooks/use-pos-settings";

interface PrintReconciliationProps {
    sessionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function fmtDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function fmtTime(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDuration(openedAt?: string, closedAt?: string | null) {
    if (!openedAt) return "-";
    const start = new Date(openedAt).getTime();
    const end = closedAt ? new Date(closedAt).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function PrintReconciliation({ sessionId, open, onOpenChange }: PrintReconciliationProps) {
    const { settings } = usePosSettings();
    const [mounted, setMounted] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [layout, setLayout] = useState<"thermal" | "desktop">("desktop");
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) {
            setSummary(null);
        }
    }, [open]);

    useEffect(() => {
        if (!sessionId || !open) return;

        const fetchCloseSummary = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/pos-session/${sessionId}/close-summary`);
                if (res.ok && res.data) {
                    setSummary(res.data);
                } else {
                    toast.error(res.data?.message || "Failed to load session summary");
                }
            } catch (err) {
                toast.error("Failed to fetch shift summary report details.");
            } finally {
                setLoading(false);
            }
        };

        fetchCloseSummary();
    }, [sessionId, open]);

    const handlePrint = () => {
        if (!summary) return;
        const isElectron = typeof window !== "undefined" && !!(window as any).posDesktop;
        if (layout === "thermal" && isElectron && settings?.receiptPrinterName) {
            printThermal("reconciliation-print-container", settings);
        } else {
            window.print();
        }
    };

    const handleDownloadPdf = async () => {
        if (!summary) return;
        setIsDownloading(true);
        const toastId = toast.loading("Generating Session Summary PDF...");

        try {
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (reportRef.current) {
                const dataUrl = await htmlToImage.toPng(reportRef.current, {
                    backgroundColor: "#ffffff",
                    pixelRatio: 2,
                });

                const imgProps = new jsPDF().getImageProperties(dataUrl);
                const pdfWidth = layout === "thermal" ? 80 : 210;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                const pdf = new jsPDF({
                    orientation: "portrait",
                    unit: "mm",
                    format: [pdfWidth, pdfHeight],
                });

                pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
                pdf.save(`shift-summary-${sessionId?.slice(0, 8)}.pdf`);
                toast.success("PDF downloaded successfully", { id: toastId });
            }
        } catch (error) {
            console.error("PDF download error:", error);
            toast.error("An error occurred while downloading PDF", { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    if (!sessionId) return null;

    const sess = summary?.session || {};
    const cashier = summary?.cashier || {};
    const metrics = summary?.metrics || {};

    const cashierName = cashier.firstName
        ? `${cashier.firstName || ""} ${cashier.lastName || ""}`.trim()
        : "Cashier";

    const variance = sess.variance ?? 0;
    const isShortage = variance < 0;
    const isSurplus = variance > 0;

    const renderThermalContent = () => (
        <div className="text-black uppercase leading-relaxed font-mono text-[10px]">
            {/* Header */}
            <div className="text-center space-y-1 mb-3">
                <h3 className="text-xs font-bold tracking-tight">IVAR</h3>
                <p className="text-[9px] font-medium">{sess.locationName || "Store Outlet"}</p>
                <div className="border-y border-dashed border-black/40 py-1 my-1">
                    <p className="font-bold tracking-widest text-[11px]">SHIFT Z-REPORT</p>
                    <p className="text-[8.5px]">{fmtDate(sess.openedAt)}</p>
                </div>
                <div className="flex justify-between text-[8px] font-bold">
                    <span>SESSION: #{sess.id?.substring(0, 8).toUpperCase()}</span>
                    <span>POS: {sess.posCode || "-"}</span>
                </div>
            </div>

            {/* Session Info */}
            <div className="space-y-0.5 border-b border-dashed border-black/30 pb-2 mb-2 text-[9px]">
                <p><strong>CASHIER:</strong> {cashierName}</p>
                <p><strong>OPENED:</strong> {fmtTime(sess.openedAt)}</p>
                <p><strong>CLOSED:</strong> {sess.closedAt ? fmtTime(sess.closedAt) : "ONGOING"}</p>
                <p><strong>DURATION:</strong> {getDuration(sess.openedAt, sess.closedAt)}</p>
            </div>

            {/* Sales Breakdown */}
            <div className="mb-3 space-y-1">
                <div className="font-bold border-b border-dashed border-black/30 pb-0.5 mb-1 text-[9.5px]">
                    SALES SUMMARY
                </div>
                <div className="flex justify-between">
                    <span>ORDERS COUNT:</span>
                    <span>{metrics.orderCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                    <span>GROSS SALES:</span>
                    <span>{formatCurrency(metrics.grossSales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TOTAL DISCOUNTS:</span>
                    <span>-{formatCurrency(metrics.totalDiscounts ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TOTAL TAXES:</span>
                    <span>+{formatCurrency(metrics.totalTaxes ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-black/20 pt-1">
                    <span>NET SALES:</span>
                    <span>{formatCurrency(metrics.netSales ?? 0)}</span>
                </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="mb-3 space-y-1">
                <div className="font-bold border-b border-dashed border-black/30 pb-0.5 mb-1 text-[9.5px]">
                    PAYMENT METHODS
                </div>
                <div className="flex justify-between">
                    <span>CASH RECEIVED:</span>
                    <span>{formatCurrency(metrics.cashSales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>CARD PAYMENTS:</span>
                    <span>{formatCurrency(metrics.cardSales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>VOUCHERS:</span>
                    <span>{formatCurrency(metrics.voucherSales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>CREDIT SALES:</span>
                    <span>{formatCurrency(metrics.creditSales ?? 0)}</span>
                </div>
            </div>

            {/* Cash Drawer Reconciliation */}
            <div className="mb-3 space-y-1 border-t border-b border-dashed border-black/30 py-2">
                <div className="font-bold text-[9.5px] mb-1">CASH RECONCILIATION</div>
                <div className="flex justify-between">
                    <span>OPENING FLOAT:</span>
                    <span>{formatCurrency(sess.openingFloat ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>CASH SALES:</span>
                    <span>+{formatCurrency(metrics.cashSales ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-dashed border-black/20">
                    <span>EXPECTED DRAWER CASH:</span>
                    <span>{formatCurrency(sess.expectedCash ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>ACTUAL COUNTED CASH:</span>
                    <span>{sess.actualCash !== null ? formatCurrency(sess.actualCash) : "-"}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px] pt-1">
                    <span>VARIANCE ({isShortage ? "DEFICIT" : isSurplus ? "EXCESS" : "BALANCED"}):</span>
                    <span>{isSurplus ? "+" : ""}{formatCurrency(variance)}</span>
                </div>
            </div>

            {/* Notes */}
            {(sess.openingNote || sess.closingNote) && (
                <div className="mb-3 space-y-1 text-[8.5px]">
                    {sess.openingNote && <p><strong>OPEN NOTE:</strong> {sess.openingNote}</p>}
                    {sess.closingNote && <p><strong>CLOSE NOTE:</strong> {sess.closingNote}</p>}
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 text-center pt-6 mt-4">
                <div className="border-t border-black/40 pt-1 text-[8px] font-bold">CASHIER SIGNATURE</div>
                <div className="border-t border-black/40 pt-1 text-[8px] font-bold">MANAGER SIGNATURE</div>
            </div>
        </div>
    );

    const renderDesktopContent = () => (
        <div className="space-y-6 text-foreground text-sm font-inter">
            {/* Document Header */}
            <div className="flex justify-between items-start border-b border-border pb-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">IVAR</h2>
                    <p className="text-sm font-medium text-primary">{sess.locationName || "Outlet"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Terminal: {sess.posCode || "-"} · Session #{sess.id?.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-xs uppercase tracking-wider mb-1">
                        Shift Z-Report
                    </span>
                    <p className="text-xs text-muted-foreground">{fmtDate(sess.openedAt)}</p>
                </div>
            </div>

            {/* Cashier & Session Timings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
                <div>
                    <span className="text-xs text-muted-foreground">Cashier Name</span>
                    <p className="font-semibold text-sm">{cashierName}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">Opened At</span>
                    <p className="font-semibold text-sm">{fmtTime(sess.openedAt)}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">Closed At</span>
                    <p className="font-semibold text-sm">{sess.closedAt ? fmtTime(sess.closedAt) : "Ongoing"}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">Shift Duration</span>
                    <p className="font-semibold text-sm">{getDuration(sess.openedAt, sess.closedAt)}</p>
                </div>
            </div>

            {/* Sales & Payment Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sales Summary */}
                <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                        Sales Performance
                    </h3>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Orders</span>
                        <span className="font-semibold">{metrics.orderCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Sales</span>
                        <span className="font-semibold">{formatCurrency(metrics.grossSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Discounts</span>
                        <span className="font-semibold text-destructive">-{formatCurrency(metrics.totalDiscounts ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxes</span>
                        <span className="font-semibold">+{formatCurrency(metrics.totalTaxes ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
                        <span>Net Sales</span>
                        <span className="text-primary">{formatCurrency(metrics.netSales ?? 0)}</span>
                    </div>
                </div>

                {/* Payment Breakdown */}
                <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                        Payment Breakdown
                    </h3>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Cash Sales</span>
                        <span className="font-semibold">{formatCurrency(metrics.cashSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Card Payments</span>
                        <span className="font-semibold">{formatCurrency(metrics.cardSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Gift Vouchers</span>
                        <span className="font-semibold">{formatCurrency(metrics.voucherSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Sales</span>
                        <span className="font-semibold">{formatCurrency(metrics.creditSales ?? 0)}</span>
                    </div>
                </div>
            </div>

            {/* Cash Drawer Reconciliation */}
            <div className="bg-muted/30 rounded-2xl p-5 border border-border space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                    Drawer Cash Reconciliation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                    <div className="bg-background rounded-xl p-3 border border-border">
                        <span className="text-xs text-muted-foreground">Opening Float</span>
                        <p className="text-lg font-bold">{formatCurrency(sess.openingFloat ?? 0)}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                        <span className="text-xs text-muted-foreground">Expected Cash</span>
                        <p className="text-lg font-bold">{formatCurrency(sess.expectedCash ?? 0)}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                        <span className="text-xs text-muted-foreground">Actual Cash Counted</span>
                        <p className="text-lg font-bold">{sess.actualCash !== null ? formatCurrency(sess.actualCash) : "-"}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                        <span className="text-xs text-muted-foreground">Variance</span>
                        <p className={cn("text-lg font-bold", isShortage ? "text-destructive" : isSurplus ? "text-emerald-600" : "text-muted-foreground")}>
                            {isSurplus ? "+" : ""}{formatCurrency(variance)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Remarks */}
            {(sess.openingNote || sess.closingNote) && (
                <div className="bg-card rounded-2xl p-4 border border-border space-y-1 text-xs">
                    {sess.openingNote && <p><span className="font-semibold text-foreground">Opening Note:</span> {sess.openingNote}</p>}
                    {sess.closingNote && <p><span className="font-semibold text-foreground">Closing Note:</span> {sess.closingNote}</p>}
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 text-center pt-10 mt-6 border-t border-border">
                <div>
                    <div className="border-b border-foreground/30 mb-2 w-3/4 mx-auto" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cashier Signature ({cashierName})</p>
                </div>
                <div>
                    <div className="border-b border-foreground/30 mb-2 w-3/4 mx-auto" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manager Approval</p>
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!w-full !max-w-4xl h-[92vh] flex flex-col p-0 overflow-hidden bg-background rounded-3xl">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/20">
                    <div>
                        <DialogTitle className="text-lg font-bold tracking-tight">Shift Reconciliation Report</DialogTitle>
                        <p className="text-xs text-muted-foreground">Session-wise drawer close & sales ledger report</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-full border border-border">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout("desktop")}
                                className={cn(
                                    "rounded-full h-7 px-3 text-xs font-semibold transition-all",
                                    layout === "desktop" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                                )}
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                                A4 Sheet
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout("thermal")}
                                className={cn(
                                    "rounded-full h-7 px-3 text-xs font-semibold transition-all",
                                    layout === "thermal" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                                )}
                            >
                                <Receipt className="w-3.5 h-3.5 mr-1" />
                                Thermal Slip
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {loading ? (
                        <div className="py-20 text-center text-muted-foreground space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                            <p>Loading session report...</p>
                        </div>
                    ) : !summary ? (
                        <div className="py-20 text-center text-muted-foreground">No session summary found.</div>
                    ) : (
                        <div className="max-w-3xl mx-auto bg-background rounded-2xl border border-border p-6 shadow-sm" ref={reportRef}>
                            <div id="reconciliation-print-container">
                                {layout === "thermal" ? renderThermalContent() : renderDesktopContent()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
                        Close
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleDownloadPdf}
                            disabled={isDownloading || !summary}
                            className="rounded-full gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </Button>

                        <Button
                            onClick={handlePrint}
                            disabled={!summary}
                            className="rounded-full bg-primary hover:bg-primary/90 text-white gap-2 px-6"
                        >
                            <Printer className="w-4 h-4" />
                            Print Report
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}