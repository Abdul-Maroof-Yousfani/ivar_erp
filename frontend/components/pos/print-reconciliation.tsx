"use client";

import { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authFetch } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
    Printer, Receipt, CreditCard, Wallet, Banknote, Clock, User, MapPin,
    AlertTriangle, CheckCircle2, FileText, ChevronRight, FileSpreadsheet, Loader2,
    TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PrintReconciliationProps {
    sessionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PrintReconciliation({ sessionId, open, onOpenChange }: PrintReconciliationProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [layout, setLayout] = useState<"thermal" | "desktop">("desktop");

    useEffect(() => {
        if (!sessionId || !open) return;

        const fetchDetails = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/pos-session/${sessionId}/reconciliation`);
                if (res.ok) {
                    setData(res.data);
                } else {
                    toast.error(res.data?.message || "Failed to load reconciliation details");
                }
            } catch (err) {
                toast.error("Failed to fetch reconciliation report details.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [sessionId, open]);

    const handlePrint = () => {
        if (!data) return;
        window.print();
    };

    if (!sessionId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 font-inter">
                <DialogHeader className="border-b border-border pb-4 mb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
                                <FileText className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">Shift Reconciliation Report</DialogTitle>
                                <p className="text-sm text-muted-foreground">Preview and print detailed session logs and drawer metrics.</p>
                            </div>
                        </div>

                        {/* Format Switcher */}
                        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-full self-start md:self-auto border border-border">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout("desktop")}
                                className={cn(
                                    "rounded-full h-8 px-4 text-xs font-semibold gap-1.5 transition-all",
                                    layout === "desktop" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                                )}
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                A4 Desktop Ledger
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout("thermal")}
                                className={cn(
                                    "rounded-full h-8 px-4 text-xs font-semibold gap-1.5 transition-all",
                                    layout === "thermal" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                                )}
                            >
                                <Receipt className="w-3.5 h-3.5" />
                                80mm Thermal Receipt
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Aggregating shift data & financial metrics...</p>
                    </div>
                ) : !data ? (
                    <div className="text-center py-16">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
                        <p className="font-semibold">Failed to Load Report</p>
                        <p className="text-sm text-muted-foreground">Please try again or contact administrator.</p>
                    </div>
                ) : (
                    <>
                        {/* SCREEN PREVIEW CONTAINER */}
                        <div className="bg-muted/30 border border-border rounded-2xl p-4 md:p-6 overflow-x-auto max-h-[50vh] overflow-y-auto mb-6 flex justify-center shadow-inner">
                            {layout === "thermal" ? (
                                /* Thermal Preview */
                                <div className="w-[300px] bg-white border border-border text-black p-4 font-mono text-[11px] shadow-lg leading-relaxed rounded-md">
                                    <div className="text-center space-y-1 mb-4 uppercase">
                                        <p className="text-sm font-bold tracking-tight">{data.session.terminal.locationName}</p>
                                        <p className="text-[10px] text-muted-foreground">{data.session.terminal.locationCode}</p>
                                        <Separator className="bg-black/25 my-2 border-dashed" />
                                        <p className="font-bold">Reconciliation Report</p>
                                        <p className="text-[9px]">Status: {data.session.status}</p>
                                    </div>

                                    <div className="space-y-1 text-[10px]">
                                        <p><strong>Terminal:</strong> {data.session.terminal.terminalCode} ({data.session.terminal.name})</p>
                                        <p><strong>Cashier:</strong> {data.session.cashier.fullName}</p>
                                        <p><strong>Opened:</strong> {new Date(data.session.openedAt).toLocaleString()}</p>
                                        {data.session.closedAt && (
                                            <p><strong>Closed:</strong> {new Date(data.session.closedAt).toLocaleString()}</p>
                                        )}
                                    </div>

                                    <Separator className="bg-black/25 my-3 border-dashed" />

                                    <div className="space-y-1 font-bold uppercase text-[10px] tracking-wide">
                                        <div className="flex justify-between">
                                            <span>Opening Float:</span>
                                            <span>{formatCurrency(data.session.openingFloat)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Cash Sales:</span>
                                            <span>{formatCurrency(data.paymentBreakdown.cash.amount)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-black/20 pt-1">
                                            <span>Expected Cash:</span>
                                            <span>{formatCurrency(data.session.expectedCash)}</span>
                                        </div>
                                        {data.session.actualCash !== null && (
                                            <div className="flex justify-between">
                                                <span>Actual Cash:</span>
                                                <span>{formatCurrency(data.session.actualCash)}</span>
                                            </div>
                                        )}
                                        {data.session.difference !== null && (
                                            <div className="flex justify-between border-t border-black/20 pt-1 font-black">
                                                <span>Variance:</span>
                                                <span>
                                                    {data.session.difference > 0 ? "+" : ""}
                                                    {formatCurrency(data.session.difference)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <Separator className="bg-black/25 my-3 border-dashed" />

                                    <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Payment Method Breakdowns</p>
                                    <div className="space-y-1 text-[10px]">
                                        <div className="flex justify-between">
                                            <span>CASH ({data.paymentBreakdown.cash.count} orders):</span>
                                            <span>{formatCurrency(data.paymentBreakdown.cash.amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>CARD ({data.paymentBreakdown.card.count} orders):</span>
                                            <span>{formatCurrency(data.paymentBreakdown.card.amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>VOUCHER ({data.paymentBreakdown.voucher.count} orders):</span>
                                            <span>{formatCurrency(data.paymentBreakdown.voucher.amount)}</span>
                                        </div>
                                    </div>

                                    <Separator className="bg-black/25 my-3 border-dashed" />

                                    <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Financial Aggregates</p>
                                    <div className="space-y-1 text-[10px]">
                                        <div className="flex justify-between">
                                            <span>Gross Sales:</span>
                                            <span>{formatCurrency(data.metrics.grossSales)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Discounts:</span>
                                            <span>{formatCurrency(data.metrics.totalDiscounts)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Taxes:</span>
                                            <span>{formatCurrency(data.metrics.totalTaxes)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-black/20 pt-1 font-bold">
                                            <span>Net Sales:</span>
                                            <span>{formatCurrency(data.metrics.netSales)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Orders:</span>
                                            <span>{data.metrics.orderCount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>AOV:</span>
                                            <span>{formatCurrency(data.metrics.averageOrderValue)}</span>
                                        </div>
                                    </div>

                                    <Separator className="bg-black/25 my-4 border-dashed" />

                                    <div className="text-center font-bold space-y-8 mt-4 uppercase">
                                        <div className="border-t border-black/40 pt-1 w-3/4 mx-auto text-[9px]">
                                            Cashier Signature
                                        </div>
                                        <div className="border-t border-black/40 pt-1 w-3/4 mx-auto text-[9px]">
                                            Manager Signature
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Desktop Preview */
                                <div className="w-[720px] bg-white border border-border text-black p-8 font-sans shadow-lg space-y-6 rounded-2xl">
                                    {/* Brand Header */}
                                    <div className="flex items-start justify-between border-b border-gray-100 pb-5">
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black tracking-tight text-primary uppercase">SPEED LIMIT</h2>
                                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">
                                                {data.session.terminal.locationName} · Code: {data.session.terminal.locationCode}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs">
                                            <p className="font-bold text-gray-800 text-sm">RECONCILIATION SUMMARY</p>
                                            <p className="text-muted-foreground font-medium">Session ID: {data.session.id.substring(0, 8)}...</p>
                                            <p className={cn(
                                                "mt-1.5 inline-block px-2 py-0.5 rounded-full font-bold text-[10px] border capitalize",
                                                data.session.status === "open"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                            )}>
                                                {data.session.status} Session
                                            </p>
                                        </div>
                                    </div>

                                    {/* Meta grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-gray-50/50 p-4 rounded-xl border">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Terminal</p>
                                            <p className="font-semibold text-gray-800">{data.session.terminal.terminalCode} ({data.session.terminal.name})</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cashier</p>
                                            <p className="font-semibold text-gray-800">{data.session.cashier.fullName}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Opened</p>
                                            <p className="font-semibold text-gray-800">{new Date(data.session.openedAt).toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Closed</p>
                                            <p className="font-semibold text-gray-800">
                                                {data.session.closedAt ? new Date(data.session.closedAt).toLocaleString() : "Ongoing"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Visual Drawer Cards */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="bg-gray-50/30 rounded-2xl p-4 border text-center space-y-1">
                                            <Wallet className="w-4 h-4 text-muted-foreground mx-auto" />
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Starting Float</p>
                                            <p className="text-lg font-bold text-gray-800">{formatCurrency(data.session.openingFloat)}</p>
                                        </div>
                                        <div className="bg-gray-50/30 rounded-2xl p-4 border text-center space-y-1">
                                            <Banknote className="w-4 h-4 text-muted-foreground mx-auto" />
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Expected Cash</p>
                                            <p className="text-lg font-bold text-gray-800">{formatCurrency(data.session.expectedCash)}</p>
                                        </div>
                                        <div className="bg-gray-50/30 rounded-2xl p-4 border text-center space-y-1">
                                            <Clock className="w-4 h-4 text-muted-foreground mx-auto" />
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Counted Cash</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {data.session.actualCash !== null ? formatCurrency(data.session.actualCash) : "—"}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "rounded-2xl p-4 border text-center space-y-1",
                                            data.session.difference === null ? "bg-gray-50/30 text-gray-800" :
                                                data.session.difference < 0 ? "bg-red-50/40 text-destructive border-red-200" :
                                                    data.session.difference > 0 ? "bg-emerald-50/40 text-emerald-700 border-emerald-200" :
                                                        "bg-gray-50/30 text-muted-foreground"
                                        )}>
                                            <AlertTriangle className="w-4 h-4 mx-auto" />
                                            <p className="text-[10px] font-bold uppercase">Cash Variance</p>
                                            <p className="text-lg font-bold">
                                                {data.session.difference === null ? "—" :
                                                    `${data.session.difference > 0 ? "+" : ""}${formatCurrency(data.session.difference)}`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Breakdown Tables */}
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Payments */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                                                <CreditCard className="w-3.5 h-3.5 text-primary" />
                                                Sales By Payment Method
                                            </h3>
                                            <table className="w-full text-xs text-left">
                                                <thead>
                                                    <tr className="text-muted-foreground font-semibold border-b">
                                                        <th className="py-1">Method</th>
                                                        <th className="py-1 text-center">Orders</th>
                                                        <th className="py-1 text-right">Total Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    <tr>
                                                        <td className="py-2 font-medium">Cash Sales</td>
                                                        <td className="py-2 text-center text-muted-foreground">{data.paymentBreakdown.cash.count}</td>
                                                        <td className="py-2 text-right font-bold text-gray-800">{formatCurrency(data.paymentBreakdown.cash.amount)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-2 font-medium">Credit Card</td>
                                                        <td className="py-2 text-center text-muted-foreground">{data.paymentBreakdown.card.count}</td>
                                                        <td className="py-2 text-right font-bold text-gray-800">{formatCurrency(data.paymentBreakdown.card.amount)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-2 font-medium">Gift Vouchers</td>
                                                        <td className="py-2 text-center text-muted-foreground">{data.paymentBreakdown.voucher.count}</td>
                                                        <td className="py-2 text-right font-bold text-gray-800">{formatCurrency(data.paymentBreakdown.voucher.amount)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Financial Summary */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                                                Financial Summary
                                            </h3>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Gross Sales (Subtotal)</span>
                                                    <span className="font-semibold text-gray-800">{formatCurrency(data.metrics.grossSales)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Total Discounts Applied</span>
                                                    <span className="font-semibold text-gray-800">{formatCurrency(data.metrics.totalDiscounts)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Total Taxes Collected</span>
                                                    <span className="font-semibold text-gray-800">{formatCurrency(data.metrics.totalTaxes)}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-dashed pt-2 font-bold text-gray-900 text-sm">
                                                    <span>Net Sales (Grand Total)</span>
                                                    <span>{formatCurrency(data.metrics.netSales)}</span>
                                                </div>
                                                <div className="flex justify-between border-t pt-2 text-[11px] text-muted-foreground">
                                                    <span>Total Orders Completed: <strong>{data.metrics.orderCount}</strong></span>
                                                    <span>Average Order Value: <strong>{formatCurrency(data.metrics.averageOrderValue)}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {data.session.closingNote && (
                                        <div className="bg-gray-50 border p-3 rounded-lg text-xs space-y-1">
                                            <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Closing Remarks / Notes</p>
                                            <p className="text-muted-foreground italic font-medium">"{data.session.closingNote}"</p>
                                        </div>
                                    )}

                                    {/* Signature blocks */}
                                    <div className="grid grid-cols-2 gap-12 pt-10 text-xs">
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-400 w-full h-8" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">Cashier Signature</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">{data.session.cashier.fullName}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-400 w-full h-8" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">Manager Signature</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">Authorized Approver</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PRINT HARDWARE OUTPUT TEMPLATE (HIDDEN FROM SCREEN, TARGETED BY WINDOW.PRINT) */}
                        <div id="reconciliation-print-container" className="hidden">
                            {/* Layout classes determined here will trigger correctly on print */}
                            <div className="print-layout-thermal font-mono text-[11px]">
                                <div className="text-center space-y-1 mb-4 uppercase">
                                    <h3 className="text-sm font-black tracking-tight">{data.session.terminal.locationName}</h3>
                                    <p className="text-[9px]">{data.session.terminal.locationCode}</p>
                                    <p className="text-[10px] border-y border-dashed py-1 my-1">*** RECONCILIATION ***</p>
                                </div>

                                <div className="space-y-0.5 text-[9px] mb-3 leading-relaxed">
                                    <p>TERMINAL: {data.session.terminal.terminalCode} ({data.session.terminal.name})</p>
                                    <p>CASHIER: {data.session.cashier.fullName}</p>
                                    <p>OPENED: {new Date(data.session.openedAt).toLocaleString()}</p>
                                    {data.session.closedAt && (
                                        <p>CLOSED: {new Date(data.session.closedAt).toLocaleString()}</p>
                                    )}
                                </div>

                                <p className="border-t border-dashed my-2" />

                                <div className="space-y-1 font-bold uppercase text-[10px]">
                                    <div className="flex justify-between">
                                        <span>Opening Float:</span>
                                        <span>{formatCurrency(data.session.openingFloat)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Cash Sales:</span>
                                        <span>{formatCurrency(data.paymentBreakdown.cash.amount)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed pt-1">
                                        <span>Expected Cash:</span>
                                        <span>{formatCurrency(data.session.expectedCash)}</span>
                                    </div>
                                    {data.session.actualCash !== null && (
                                        <div className="flex justify-between">
                                            <span>Actual Cash:</span>
                                            <span>{formatCurrency(data.session.actualCash)}</span>
                                        </div>
                                    )}
                                    {data.session.difference !== null && (
                                        <div className="flex justify-between border-t border-dashed pt-1 font-black">
                                            <span>Variance:</span>
                                            <span>
                                                {data.session.difference > 0 ? "+" : ""}
                                                {formatCurrency(data.session.difference)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <p className="border-t border-dashed my-3" />

                                <p className="font-bold uppercase text-[9px] mb-1">PAYMENT SUMMARY</p>
                                <div className="space-y-0.5 text-[9px]">
                                    <div className="flex justify-between">
                                        <span>CASH ({data.paymentBreakdown.cash.count} orders):</span>
                                        <span>{formatCurrency(data.paymentBreakdown.cash.amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>CARD ({data.paymentBreakdown.card.count} orders):</span>
                                        <span>{formatCurrency(data.paymentBreakdown.card.amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>VOUCHER ({data.paymentBreakdown.voucher.count} orders):</span>
                                        <span>{formatCurrency(data.paymentBreakdown.voucher.amount)}</span>
                                    </div>
                                </div>

                                <p className="border-t border-dashed my-3" />

                                <p className="font-bold uppercase text-[9px] mb-1">FINANCIAL SALES AGGREGATES</p>
                                <div className="space-y-0.5 text-[9px]">
                                    <div className="flex justify-between">
                                        <span>Gross Sales:</span>
                                        <span>{formatCurrency(data.metrics.grossSales)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Discounts:</span>
                                        <span>{formatCurrency(data.metrics.totalDiscounts)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Taxes:</span>
                                        <span>{formatCurrency(data.metrics.totalTaxes)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed pt-1 font-bold text-[10px]">
                                        <span>Net Sales:</span>
                                        <span>{formatCurrency(data.metrics.netSales)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Orders:</span>
                                        <span>{data.metrics.orderCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>AOV:</span>
                                        <span>{formatCurrency(data.metrics.averageOrderValue)}</span>
                                    </div>
                                </div>

                                <p className="border-t border-dashed my-4" />

                                <div className="text-center font-bold space-y-8 mt-6 uppercase">
                                    <div className="border-t border-black pt-1 w-3/4 mx-auto text-[8px]">
                                        Cashier Signature
                                    </div>
                                    <div className="border-t border-black pt-1 w-3/4 mx-auto text-[8px]">
                                        Manager Signature
                                    </div>
                                </div>
                            </div>

                            <div className="print-layout-desktop font-sans text-xs text-black">
                                <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-4">
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight uppercase">SPEED LIMIT</h2>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">
                                            {data.session.terminal.locationName} · {data.session.terminal.locationCode}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="font-bold text-sm">DAY-END SHIFT RECONCILIATION</h3>
                                        <p className="text-[10px] text-gray-500">Session ID: {data.session.id}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4 border p-3 rounded-lg bg-gray-50 text-[10px] mb-4">
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase">Terminal</p>
                                        <p className="font-semibold">{data.session.terminal.terminalCode} ({data.session.terminal.name})</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase">Cashier</p>
                                        <p className="font-semibold">{data.session.cashier.fullName}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase">Opened</p>
                                        <p className="font-semibold">{new Date(data.session.openedAt).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase">Closed</p>
                                        <p className="font-semibold">
                                            {data.session.closedAt ? new Date(data.session.closedAt).toLocaleString() : "Ongoing"}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4 text-center mb-6">
                                    <div className="border rounded-lg p-2.5 space-y-0.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Starting Float</p>
                                        <p className="text-sm font-bold">{formatCurrency(data.session.openingFloat)}</p>
                                    </div>
                                    <div className="border rounded-lg p-2.5 space-y-0.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Expected Cash</p>
                                        <p className="text-sm font-bold">{formatCurrency(data.session.expectedCash)}</p>
                                    </div>
                                    <div className="border rounded-lg p-2.5 space-y-0.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Counted Cash</p>
                                        <p className="text-sm font-bold">
                                            {data.session.actualCash !== null ? formatCurrency(data.session.actualCash) : "—"}
                                        </p>
                                    </div>
                                    <div className={cn(
                                        "border rounded-lg p-2.5 space-y-0.5 font-bold",
                                        data.session.difference === null ? "" :
                                            data.session.difference < 0 ? "bg-red-50 text-red-700" :
                                                data.session.difference > 0 ? "bg-green-50 text-green-700" : "bg-gray-50"
                                    )}>
                                        <p className="text-[9px] uppercase">Cash Variance</p>
                                        <p className="text-sm">
                                            {data.session.difference === null ? "—" :
                                                `${data.session.difference > 0 ? "+" : ""}${formatCurrency(data.session.difference)}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 text-[10px]">
                                    <div className="space-y-2">
                                        <h4 className="font-bold border-b pb-1 text-gray-700 uppercase">Payments Method Breakdown</h4>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-gray-400 border-b">
                                                    <th className="py-1">Method</th>
                                                    <th className="py-1 text-center">Orders</th>
                                                    <th className="py-1 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                <tr>
                                                    <td className="py-1.5 font-semibold">Cash Sales</td>
                                                    <td className="py-1.5 text-center">{data.paymentBreakdown.cash.count}</td>
                                                    <td className="py-1.5 text-right font-bold">{formatCurrency(data.paymentBreakdown.cash.amount)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-1.5 font-semibold">Credit Cards</td>
                                                    <td className="py-1.5 text-center">{data.paymentBreakdown.card.count}</td>
                                                    <td className="py-1.5 text-right font-bold">{formatCurrency(data.paymentBreakdown.card.amount)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-1.5 font-semibold">Vouchers</td>
                                                    <td className="py-1.5 text-center">{data.paymentBreakdown.voucher.count}</td>
                                                    <td className="py-1.5 text-right font-bold">{formatCurrency(data.paymentBreakdown.voucher.amount)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-bold border-b pb-1 text-gray-700 uppercase">Sales Metrics Aggregate</h4>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between">
                                                <span>Gross Sales (Subtotal)</span>
                                                <span className="font-semibold">{formatCurrency(data.metrics.grossSales)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Total Discounts Applied</span>
                                                <span className="font-semibold">{formatCurrency(data.metrics.totalDiscounts)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Taxes Collected</span>
                                                <span className="font-semibold">{formatCurrency(data.metrics.totalTaxes)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-dashed pt-2 font-bold text-sm">
                                                <span>Net Sales (Total Revenue)</span>
                                                <span>{formatCurrency(data.metrics.netSales)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-1.5 text-[9px] text-gray-500">
                                                <span>Count: {data.metrics.orderCount} orders</span>
                                                <span>AOV: {formatCurrency(data.metrics.averageOrderValue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {data.session.closingNote && (
                                    <div className="mt-4 p-2 bg-gray-50 border rounded text-[9px] text-gray-600 italic">
                                        <strong>Note:</strong> "{data.session.closingNote}"
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-10 pt-10 text-[10px]">
                                    <div className="space-y-3">
                                        <div className="border-b border-gray-400 w-full h-8" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-700">Cashier Signature</span>
                                            <span className="text-[9px] text-gray-500">{data.session.cashier.fullName}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="border-b border-gray-400 w-full h-8" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-700">Manager Signature</span>
                                            <span className="text-[9px] text-gray-500">Authorized Approver</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Injected custom CSS rules for high-fidelity printing */}
                        <style jsx global>{`
                            @media print {
                                body > * {
                                    display: none !important;
                                }
                                #reconciliation-print-container {
                                    display: block !important;
                                    position: absolute;
                                    left: 0;
                                    top: 0;
                                    width: 100% !important;
                                    background: white !important;
                                    color: black !important;
                                }
                                .print-layout-thermal {
                                    display: ${layout === "thermal" ? "block" : "none"} !important;
                                    width: 80mm !important;
                                    padding: 2mm !important;
                                    margin: 0 auto !important;
                                }
                                .print-layout-desktop {
                                    display: ${layout === "desktop" ? "block" : "none"} !important;
                                    width: 100% !important;
                                    max-width: 210mm !important; /* A4 size */
                                    padding: 10mm !important;
                                    margin: 0 auto !important;
                                }
                            }
                        `}</style>
                    </>
                )}

                <DialogFooter className="border-t border-border pt-4 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
                        Close Preview
                    </Button>
                    <Button onClick={handlePrint} disabled={loading || !data} className="rounded-full gap-1.5 px-6">
                        <Printer className="w-4 h-4" />
                        Print Reconciliation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
