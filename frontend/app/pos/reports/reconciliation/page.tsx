"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { authFetch } from "@/lib/auth";
import { formatCurrency, getApiBaseUrl } from "@/lib/utils";
import {
    Printer, Receipt, CreditCard, Wallet, Banknote, Clock, User, FileText,
    FileSpreadsheet, Loader2, Check, Download, Calendar
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { cn } from "@/lib/utils";
import { printThermal } from "@/lib/utils/print";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";

// Exact static figures for reference fallback
const SAMPLE_DATA = {
    companyName: "Speed (Private) Limited",
    locationName: "Nike-Dolmen Clifton",
    reportTitle: "Sales Reconciliation",
    dateRange: "",
    documentNumber: "",
    
    cardPayments: [] as any[],
    cardGiftVouchers: [] as any[],
    receivedVouchers: [] as any[],
    receivables: [] as any[],
    issuedVouchers: {
        exchangeAndClaims: [] as any[],
        creditVouchers: [] as any[],
        giftVouchers: [] as any[],
        refundVouchers: [] as any[]
    },
    fbrCharges: [] as any[],
    financials: {
        sale: 0,
        salesReturn: 0,
        netSales: 0
    },
    cashBreakdown: {
        sale: 0,
        giftVouchers: 0,
        refundVouchers: 0,
        total: 0
    },
    cardBreakdown: {
        sale: 0,
        giftVouchers: 0,
        total: 0
    }
};

export default function ReconciliationReportPage() {
    const { settings } = usePosSettings();
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [layout, setLayout] = useState<"thermal" | "desktop">("desktop");
    const [isDownloading, setIsDownloading] = useState(false);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState(0);
    const reportRef = useRef<HTMLDivElement>(null);

    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState<string>(getTodayString());

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchDetails = async (date: string) => {
        setLoading(true);
        try {
            const url = `/pos-session/reconciliation/daywise?date=${date}`;
            const res = await authFetch(url);
            if (res.ok) {
                setData(res.data);
            } else {
                toast.error(res.data?.message || "Failed to load reconciliation details");
                setData(null);
            }
        } catch (err) {
            toast.error("Failed to fetch reconciliation report details.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedDate) return;
        fetchDetails(selectedDate);
    }, [selectedDate]);

    const handlePrint = () => {
        if (!data) return;
        
        const isElectron = typeof window !== "undefined" && !!window.posDesktop;
        if (layout === "thermal" && isElectron && settings?.receiptPrinterName) {
            printThermal("reconciliation-print-container", settings);
        } else {
            window.print();
        }
    };

    const handleDownloadPdf = async () => {
        if (!data) return;
        setIsDownloading(true);
        const toastId = toast.loading("Generating Reconciliation PDF...");

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
                    format: [pdfWidth, pdfHeight]
                });

                pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
                const docName = activeReport?.documentNumber || `reconciliation-${selectedDate}`;
                pdf.save(`${docName}.pdf`);
                toast.success("PDF downloaded successfully", { id: toastId });
            } else {
                toast.error("Failed to capture report content", { id: toastId });
            }
        } catch (error) {
            console.error("PDF download error:", error);
            toast.error("An error occurred while downloading the PDF", { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (!selectedDate) return;
        setExportState("queueing");
        setExportProgress(0);
        const toastId = toast.loading("Queueing Excel export job...");
        try {
            const apiBase = getApiBaseUrl();
            const queueRes = await fetch(`${apiBase}/pos-session/reconciliation/daywise/export/queue?date=${selectedDate}`, {
                method: "POST",
                credentials: "include"
            });
            
            if (!queueRes.ok) {
                const text = await queueRes.text();
                let msg = "Failed to queue export job";
                try {
                    const json = JSON.parse(text);
                    msg = json.message || msg;
                } catch {}
                throw new Error(msg);
            }

            const queueData = await queueRes.json();
            const jobId = queueData?.data?.jobId;
            if (!jobId) {
                throw new Error("No job ID returned from server");
            }

            setExportState("processing");
            toast.loading("Processing export: 0% completed", { id: toastId });

            const interval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${apiBase}/pos-session/reconciliation/daywise/export/${jobId}/status`, {
                        credentials: "include"
                    });
                    if (!statusRes.ok) return;

                    const statusData = await statusRes.json();
                    const { state, progress } = statusData?.data || {};

                    setExportProgress(progress || 0);
                    toast.loading(`Processing export: ${progress || 0}% completed`, { id: toastId });

                    if (state === "completed") {
                        clearInterval(interval);
                        setExportState("completed");
                        toast.loading("Downloading Excel sheet...", { id: toastId });

                        const anchor = document.createElement("a");
                        anchor.href = `${apiBase}/pos-session/reconciliation/daywise/export/${jobId}/download`;
                        document.body.appendChild(anchor);
                        anchor.click();
                        document.body.removeChild(anchor);

                        toast.success("Excel Reconciliation Report exported successfully!", { id: toastId });
                        setTimeout(() => setExportState("idle"), 2000);
                    } else if (state === "failed") {
                        clearInterval(interval);
                        setExportState("failed");
                        toast.error("Background export processor failed", { id: toastId });
                        setTimeout(() => setExportState("idle"), 3000);
                    }
                } catch (err) {
                    console.error("Error polling export status:", err);
                }
            }, 2000);

        } catch (error: any) {
            console.error("Excel background export error:", error);
            setExportState("failed");
            toast.error(error.message || "An error occurred during Excel export", { id: toastId });
            setTimeout(() => setExportState("idle"), 3000);
        }
    };

    const activeReport = data || SAMPLE_DATA;

    // Dynamic aggregations for totals
    const cardPaymentsAmountSum = activeReport.cardPayments?.reduce((acc: number, c: any) => acc + c.amount, 0) || 0;
    const cardPaymentsCommSum = activeReport.cardPayments?.reduce((acc: number, c: any) => acc + c.commission, 0) || 0;
    
    const cardGiftVouchersAmountSum = activeReport.cardGiftVouchers?.reduce((acc: number, c: any) => acc + c.amount, 0) || 0;
    const cardGiftVouchersCommSum = activeReport.cardGiftVouchers?.reduce((acc: number, c: any) => acc + c.commission, 0) || 0;

    const totalCardsAmount = cardPaymentsAmountSum + cardGiftVouchersAmountSum;
    const totalCardsComm = cardPaymentsCommSum + cardGiftVouchersCommSum;

    const receivedSubtotal = activeReport.receivedVouchers?.reduce((acc: number, v: any) => acc + v.amount, 0) || 0;
    const receivablesSubtotal = activeReport.receivables?.reduce((acc: number, r: any) => acc + r.amount, 0) || 0;

    const totalGiftVoucherDiscount = activeReport.issuedVouchers?.totalGiftVoucherDiscount || 0;
    const issuedExchangeSubtotal = activeReport.issuedVouchers?.exchangeAndClaims?.reduce((acc: number, v: any) => acc + v.amount, 0) || 0;
    const issuedCreditSubtotal = activeReport.issuedVouchers?.creditVouchers?.reduce((acc: number, v: any) => acc + v.amount, 0) || 0;
    const issuedGiftSubtotal = activeReport.issuedVouchers?.giftVouchers?.reduce((acc: number, v: any) => acc + v.amount, 0) || 0;
    const issuedRefundSubtotal = activeReport.issuedVouchers?.refundVouchers?.reduce((acc: number, v: any) => acc + v.amount, 0) || 0;

    const totalIssuedSubtotal = issuedExchangeSubtotal + issuedGiftSubtotal + issuedRefundSubtotal;

    const fbrSubtotal = activeReport.fbrCharges?.reduce((acc: number, f: any) => acc + f.amount, 0) || 0;

    const formatVal = (val: number | string | null | undefined, isRate: boolean = false) => {
        if (val === null || val === undefined || val === "") return "";
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) return val.toString();
        if (num === 0) return "-";
        if (isRate) return num.toFixed(3);
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const renderThermalContent = (isPrint: boolean = false) => {
        const textSizeClass = isPrint ? "text-[8px]" : "text-[9px]";
        const headerTitleSize = isPrint ? "text-[10px]" : "text-[11px]";
        const documentTitleSize = isPrint ? "text-[11px]" : "text-[12px]";

        return (
            <div className={cn("text-black uppercase leading-relaxed", "font-mono")}>
                {/* Header */}
                <div className="text-center space-y-1 mb-4">
                    <h3 className="text-xs font-bold tracking-tight">{activeReport.companyName}</h3>
                    <p className={textSizeClass}>{activeReport.locationName}</p>
                    <div className="border-y border-dashed border-black/40 py-1 my-1">
                        <p className={cn("font-bold tracking-widest", documentTitleSize)}>DAILY RECONCILIATION</p>
                        <p className={textSizeClass}>{activeReport.dateRange}</p>
                    </div>
                    <div className="flex justify-between text-[7.5px] font-bold tracking-tight">
                        <span>DOC ID: #{activeReport.documentNumber}</span>
                        <span>DATE: {new Date(selectedDate).toLocaleDateString('en-GB')}</span>
                    </div>
                </div>

                {/* Section: Credit | Debit Cards */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        CREDIT | DEBIT CARDS
                    </div>
                    <div className={cn("flex font-bold border-b border-dashed border-black/10 pb-0.5 mb-1", textSizeClass)}>
                        <span className="w-[45%] text-left">BANK</span>
                        <span className="w-[22%] text-right">AMOUNT</span>
                        <span className="w-[13%] text-right">RATE%</span>
                        <span className="w-[20%] text-right">COMM</span>
                    </div>
                    <div className={cn("space-y-0.5", textSizeClass)}>
                        {activeReport.cardPayments?.map((p: any, i: number) => (
                            <div key={`c-pay-${i}`} className="flex justify-between">
                                <span className="w-[45%] truncate text-left">{p.bank}</span>
                                <span className="w-[22%] text-right">{formatVal(p.amount)}</span>
                                <span className="w-[13%] text-right">{formatVal(p.rate, true)}</span>
                                <span className="w-[20%] text-right">{formatVal(p.commission)}</span>
                            </div>
                        ))}
                    </div>
                    <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1 font-bold", textSizeClass)}>
                        <span className="w-[45%] text-left">SUBTOTAL:</span>
                        <span className="w-[22%] text-right">{formatVal(cardPaymentsAmountSum)}</span>
                        <span className="w-[13%] text-right"></span>
                        <span className="w-[20%] text-right">{formatVal(cardPaymentsCommSum)}</span>
                    </div>
                </div>

                {/* Section: Credit Card - Gift Vouchers Issued */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        CARDS - GIFT VOUCHERS
                    </div>
                    {activeReport.cardGiftVouchers && activeReport.cardGiftVouchers.length > 0 ? (
                        <>
                            <div className={cn("flex font-bold border-b border-dashed border-black/10 pb-0.5 mb-1", textSizeClass)}>
                                <span className="w-[45%] text-left">BANK</span>
                                <span className="w-[22%] text-right">AMOUNT</span>
                                <span className="w-[13%] text-right">RATE%</span>
                                <span className="w-[20%] text-right">COMM</span>
                            </div>
                            <div className={cn("space-y-0.5", textSizeClass)}>
                                {activeReport.cardGiftVouchers.map((p: any, i: number) => (
                                    <div key={`c-gv-${i}`} className="flex justify-between">
                                        <span className="w-[45%] truncate text-left">{p.bank}</span>
                                        <span className="w-[22%] text-right">{formatVal(p.amount)}</span>
                                        <span className="w-[13%] text-right">{formatVal(p.rate, true)}</span>
                                        <span className="w-[20%] text-right">{formatVal(p.commission)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1 font-bold", textSizeClass)}>
                                <span className="w-[45%] text-left">SUBTOTAL:</span>
                                <span className="w-[22%] text-right">{formatVal(cardGiftVouchersAmountSum)}</span>
                                <span className="w-[13%] text-right"></span>
                                <span className="w-[20%] text-right">{formatVal(cardGiftVouchersCommSum)}</span>
                            </div>
                        </>
                    ) : (
                        <div className={cn("italic text-gray-500", textSizeClass)}>NO VOUCHERS ISSUED ON CARDS</div>
                    )}
                </div>

                {/* Total Cards Section Row */}
                <div className={cn("flex justify-between font-black border-y border-black py-1 my-2", headerTitleSize)}>
                    <span>TOTAL CARDS:</span>
                    <span>{formatVal(totalCardsAmount)}</span>
                </div>

                {/* Section: Received */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        RECEIVED PAYMENTS
                    </div>
                    <div className={cn("space-y-1.5", textSizeClass)}>
                        {activeReport.receivedVouchers?.map((v: any, i: number) => (
                            <div key={`rec-v-${i}`} className="flex justify-between items-start">
                                <div className="flex flex-col w-[65%]">
                                    <span className="font-semibold">{v.type}</span>
                                    {v.from && v.from !== "-" && <span className="text-[7.5px] text-gray-600 font-mono font-bold">FROM: {v.from}</span>}
                                </div>
                                <span className="w-[35%] text-right font-bold">{formatVal(v.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1.5 font-bold", textSizeClass)}>
                        <span>RECEIVED SUBTOTAL:</span>
                        <span>{formatVal(receivedSubtotal)}</span>
                    </div>
                </div>

                {/* Section: Receivable */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        RECEIVABLES
                    </div>
                    <div className={cn("space-y-1.5", textSizeClass)}>
                        {activeReport.receivables?.map((r: any, i: number) => (
                            <div key={`receiv-${i}`} className="flex justify-between items-start">
                                <span className="font-semibold">{r.description}</span>
                                <span className="font-bold">{formatVal(r.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1.5 font-bold", textSizeClass)}>
                        <span>RECEIVABLE SUBTOTAL:</span>
                        <span>{formatVal(receivablesSubtotal)}</span>
                    </div>
                </div>

                {/* Section: Issued */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        ISSUED VOUCHERS
                    </div>
                    {(totalIssuedSubtotal + issuedCreditSubtotal) > 0 ? (
                        <>
                            <div className={cn("space-y-1.5", textSizeClass)}>
                                {/* Exchange & Claims */}
                                {activeReport.issuedVouchers?.exchangeAndClaims?.map((v: any, i: number) => (
                                    <div key={`iss-ec-${i}`} className="flex justify-between items-start">
                                        <div className="flex flex-col w-[65%]">
                                            <span>{v.type}</span>
                                            {v.from && <span className="text-[7.5px] text-gray-600 font-mono font-bold">FROM: {v.from}</span>}
                                        </div>
                                        <span className="w-[35%] text-right font-bold">{formatVal(v.amount)}</span>
                                    </div>
                                ))}
                                {/* Credit Vouchers */}
                                {activeReport.issuedVouchers?.creditVouchers?.map((v: any, i: number) => (
                                    <div key={`iss-cv-${i}`} className="flex justify-between items-start">
                                        <div className="flex flex-col w-[65%]">
                                            <span>{v.type}</span>
                                            <span className="text-[7.5px] text-gray-600 font-mono font-bold">FROM: {v.from || "-"} / TO: {v.to || "-"}</span>
                                        </div>
                                        <span className="w-[35%] text-right font-bold">{formatVal(v.amount)}</span>
                                    </div>
                                ))}
                                {activeReport.issuedVouchers?.creditVouchers?.length > 0 && (
                                    <div className="flex justify-between border-t border-dashed border-black/10 pt-0.5 mt-0.5 font-bold text-gray-700">
                                        <span className="pl-2">CREDIT SUBTOTAL:</span>
                                        <span>{formatVal(issuedCreditSubtotal)}</span>
                                    </div>
                                )}
                                {/* Gift Vouchers */}
                                {activeReport.issuedVouchers?.giftVouchers?.map((v: any, i: number) => (
                                    <div key={`iss-gv-${i}`} className="flex justify-between items-start">
                                        <div className="flex flex-col w-[65%]">
                                            <span>{v.type}</span>
                                            <span className="text-[7.5px] text-gray-600 font-mono font-bold">FROM: {v.from || "-"} / TO: {v.to || "-"}</span>
                                        </div>
                                        <span className="w-[35%] text-right font-bold">{formatVal(v.amount)}</span>
                                    </div>
                                ))}
                                {totalGiftVoucherDiscount > 0 && (
                                    <div className="flex justify-between items-start text-gray-600 italic">
                                        <div className="flex flex-col w-[65%]">
                                            <span className="pl-2">GIFT VOUCHERS DISCOUNT</span>
                                        </div>
                                        <span className="w-[35%] text-right font-bold">{formatVal(totalGiftVoucherDiscount)}</span>
                                    </div>
                                )}
                                {/* Refund Vouchers */}
                                {activeReport.issuedVouchers?.refundVouchers?.map((v: any, i: number) => (
                                    <div key={`iss-rv-${i}`} className="flex justify-between items-start">
                                        <div className="flex flex-col w-[65%]">
                                            <span>{v.type}</span>
                                            {v.from && <span className="text-[7.5px] text-gray-600 font-mono font-bold">FROM: {v.from}</span>}
                                        </div>
                                        <span className="w-[35%] text-right font-bold">{formatVal(v.amount)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1.5 font-bold", textSizeClass)}>
                                <span>ISSUED SUBTOTAL:</span>
                                <span>{formatVal(totalIssuedSubtotal)}</span>
                            </div>
                        </>
                    ) : (
                        <div className={cn("italic text-gray-500", textSizeClass)}>NO VOUCHERS ISSUED</div>
                    )}
                </div>

                {/* Section: FBR POS Service Charges */}
                <div className="mb-3">
                    <div className={cn("font-bold border-b border-dashed border-black/30 pb-0.5 mb-1", headerTitleSize)}>
                        FBR POS SERVICE CHARGES
                    </div>
                    <div className={cn("space-y-0.5", textSizeClass)}>
                        {activeReport.fbrCharges?.map((f: any, i: number) => (
                            <div key={`fbr-ch-${i}`} className="flex justify-between">
                                <span>{f.type}</span>
                                <span className="font-semibold">{formatVal(f.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className={cn("flex justify-between border-t border-dashed border-black/20 pt-1 mt-1 font-bold", textSizeClass)}>
                        <span>FBR SUBTOTAL:</span>
                        <span>{formatVal(fbrSubtotal)}</span>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="border-t border-dashed border-black/30 my-3" />
                <div className="space-y-1">
                    <div className={cn("flex justify-between font-bold", textSizeClass)}>
                        <span>GROSS REVENUE:</span>
                        <span>{formatVal(activeReport.financials?.sale)}</span>
                    </div>
                    <div className={cn("flex justify-between text-red-600 font-bold", textSizeClass)}>
                        <span>RETURNS / CLAIMS:</span>
                        <span>-{formatVal(activeReport.financials?.salesReturn)}</span>
                    </div>
                    <div className={cn("flex justify-between font-extrabold border-y border-dashed border-black/50 py-1 text-black", headerTitleSize)}>
                        <span>NET SALES:</span>
                        <span>{formatVal(activeReport.financials?.netSales)}</span>
                    </div>
                </div>

                {/* Cash & Card Flow summaries (Excluding expected/variance) */}
                <div className="border-t border-dashed border-black/30 my-3" />
                <div className="space-y-1">
                    <div className={cn("font-bold mb-1", headerTitleSize)}>CASH FLOW DETAILS</div>
                    <div className={cn("flex justify-between pl-2", textSizeClass)}>
                        <span>NET CASH SALES:</span>
                        <span>{formatVal(activeReport.cashBreakdown?.sale)}</span>
                    </div>
                    <div className={cn("flex justify-between pl-2", textSizeClass)}>
                        <span>CASH GIFT VOUCHERS:</span>
                        <span>{formatVal(activeReport.cashBreakdown?.giftVouchers)}</span>
                    </div>
                    <div className={cn("flex justify-between pl-2 text-red-600", textSizeClass)}>
                        <span>REFUND VOUCHERS:</span>
                        <span>-{formatVal(activeReport.cashBreakdown?.refundVouchers)}</span>
                    </div>
                    <div className={cn("flex justify-between pl-2 font-bold border-t border-dashed border-black/10 pt-0.5", textSizeClass)}>
                        <span>TOTAL CASH FLOW:</span>
                        <span>{formatVal(activeReport.cashBreakdown?.total)}</span>
                    </div>
                </div>

                <div className="border-t border-dashed border-black/30 my-3" />
                <div className="space-y-1">
                    <div className={cn("font-bold mb-1", headerTitleSize)}>CARD SALES DETAILS</div>
                    <div className={cn("flex justify-between pl-2", textSizeClass)}>
                        <span>NET CARD SALES:</span>
                        <span>{formatVal(activeReport.cardBreakdown?.sale)}</span>
                    </div>
                    <div className={cn("flex justify-between pl-2", textSizeClass)}>
                        <span>CARD GIFT VOUCHERS:</span>
                        <span>{formatVal(activeReport.cardBreakdown?.giftVouchers)}</span>
                    </div>
                    <div className={cn("flex justify-between pl-2 font-bold border-t border-dashed border-black/10 pt-0.5", textSizeClass)}>
                        <span>TOTAL CARD PAYMENTS:</span>
                        <span>{formatVal(activeReport.cardBreakdown?.total)}</span>
                    </div>
                </div>

                {/* Sign-off signatures */}
                <div className="border-t border-dashed border-black/30 my-4" />
                <div className="text-center font-bold space-y-6 mt-4">
                    <div className="border-t border-black/30 pt-1 w-3/4 mx-auto text-[8px]">
                        AUDITOR SIGNATURE
                    </div>
                    <div className="border-t border-black/30 pt-1 w-3/4 mx-auto text-[8px]">
                        MANAGER SIGNATURE
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 min-h-screen">
            {/* Modern Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20 shadow-sm">
                        <FileText className="w-5.5 h-5.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Daily Sales Reconciliation Report</h1>
                        <p className="text-xs text-muted-foreground">Select a date to view full-day location reconciliation summaries.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <DatePicker
                            value={selectedDate}
                            onChange={(val) => {
                                if (val) setSelectedDate(val);
                            }}
                            className="w-[180px] h-9 text-xs"
                        />
                    </div>

                    {/* Format Switcher */}
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-full border border-border">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLayout("desktop")}
                            className={cn(
                                "rounded-full h-7 px-3 text-xs font-semibold gap-1 transition-all",
                                layout === "desktop" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                            )}
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            A4 Ledger
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLayout("thermal")}
                            className={cn(
                                "rounded-full h-7 px-3 text-xs font-semibold gap-1 transition-all",
                                layout === "thermal" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                            )}
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            80mm Tape
                        </Button>
                    </div>

                    {/* Action buttons */}
                    <Button 
                        onClick={handleDownloadPdf} 
                        disabled={loading || !data || isDownloading} 
                        variant="secondary"
                        size="sm"
                        className="rounded-full gap-1.5 px-4 text-xs font-bold shadow-sm"
                    >
                        {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        Download PDF
                    </Button>
                    <Button 
                        onClick={handleDownloadExcel} 
                        disabled={loading || !data || exportState !== "idle"} 
                        variant="secondary"
                        size="sm"
                        className="rounded-full gap-1.5 px-4 text-xs font-bold shadow-sm"
                    >
                        {exportState !== "idle" ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {exportState === "queueing" ? "Queueing..." : `Exporting ${exportProgress}%`}
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Export Excel
                            </>
                        )}
                    </Button>
                    <Button 
                        onClick={handlePrint} 
                        disabled={loading || !data} 
                        size="sm"
                        className="rounded-full gap-1.5 px-4 text-xs font-bold shadow-md"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print Report
                    </Button>
                </div>
            </div>

            {/* Preview Sheet Container */}
            <div className="flex-1 flex flex-col items-center justify-start bg-muted/20 rounded-2xl border border-border/60 p-6 md:p-10 shadow-inner min-h-[60vh] relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center bg-background/50 backdrop-blur-xs rounded-2xl">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Aggregating location sales ledgers...</p>
                    </div>
                ) : !data ? (
                    <div className="text-center py-20 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4 border border-destructive/20">
                            <Clock className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-foreground text-sm">No Report Data Loaded</p>
                        <p className="text-xs text-muted-foreground mt-1">Please select a valid date or check network connection.</p>
                    </div>
                ) : (
                    /* A4 / Thermal Sheet Display */
                    <div className={cn(
                        "transition-all duration-300",
                        layout === "thermal" ? "w-[320px]" : "w-full max-w-[210mm]"
                    )}>
                        {layout === "thermal" ? (
                            <div className="shadow-2xl border border-gray-200/60 rounded-md overflow-hidden bg-white">
                                <div 
                                    ref={reportRef} 
                                    className="bg-white text-black p-5 font-mono text-[10px] leading-relaxed select-none"
                                >
                                    {renderThermalContent(false)}
                                </div>
                            </div>
                        ) : (
                            <div className="shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-200/70 rounded-sm overflow-hidden w-full bg-white">
                                <div 
                                    ref={reportRef} 
                                    className="bg-white text-black p-10 md:p-12 relative font-sans text-xs flex flex-col justify-between min-h-[297mm]"
                                >
                                    {/* Brand Header */}
                                    <div className="text-center space-y-1 border-b-2 border-black/80 pb-4 mb-4 relative">
                                        <h1 className="text-base font-extrabold tracking-wide uppercase">{activeReport.companyName}</h1>
                                        <h2 className="text-sm font-semibold uppercase">{activeReport.locationName}</h2>
                                        <h3 className="text-sm font-black tracking-widest text-gray-800 uppercase border-y border-black py-0.5 my-1.5">
                                            {activeReport.reportTitle}
                                        </h3>
                                        <p className="text-xs font-bold">{activeReport.dateRange}</p>
                                        <div className="absolute right-0 bottom-1.5 text-right font-bold text-[10px] text-gray-700">
                                            Document # {activeReport.documentNumber}
                                        </div>
                                    </div>

                                    {/* Financial Ledger Table */}
                                    <div className="flex-1">
                                        <table className="w-full text-[10.5px] leading-tight border-collapse">
                                            <thead>
                                                <tr className="border-b-2 border-black font-extrabold text-gray-800">
                                                    <th className="py-2 px-1 text-left w-[35%]">Description</th>
                                                    <th className="py-2 px-1 text-right w-[15%]">Amount (Rs.)</th>
                                                    <th className="py-2 px-1 text-right w-[12%]">Rate %</th>
                                                    <th className="py-2 px-1 text-right w-[15%]">Bank Comm.</th>
                                                    <th className="py-2 px-1 text-center w-[13%]">From</th>
                                                    <th className="py-2 px-1 text-center w-[10%]">To</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Section: Credit | Debit Cards */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Credit | Debit Cards</td>
                                                </tr>
                                                {activeReport.cardPayments?.map((p: any, i: number) => (
                                                    <tr key={`card-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{p.bank}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(p.amount)}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(p.rate, true)}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(p.commission)}</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold border-b border-gray-200">
                                                    <td className="py-1 px-1 text-left pl-4"></td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(cardPaymentsAmountSum)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(cardPaymentsCommSum)}</td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>

                                                {/* Section: Cards - Gift Vouchers */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Credit Card - Gift Vouchers Issued</td>
                                                </tr>
                                                {activeReport.cardGiftVouchers && activeReport.cardGiftVouchers.length > 0 ? (
                                                    activeReport.cardGiftVouchers.map((p: any, i: number) => (
                                                        <tr key={`card-gv-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                            <td className="py-1 px-1 text-left pl-4 font-medium">{p.bank}</td>
                                                            <td className="py-1 px-1 text-right">{formatVal(p.amount)}</td>
                                                            <td className="py-1 px-1 text-right">{formatVal(p.rate, true)}</td>
                                                            <td className="py-1 px-1 text-right">{formatVal(p.commission)}</td>
                                                            <td className="py-1 px-1 text-center">-</td>
                                                            <td className="py-1 px-1 text-center">-</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr className="text-gray-400 italic"><td colSpan={6} className="py-1 px-4">No vouchers issued on card payments on this date</td></tr>
                                                )}
                                                {activeReport.cardGiftVouchers && activeReport.cardGiftVouchers.length > 0 && (
                                                    <tr className="font-bold border-b border-gray-200">
                                                        <td className="py-1 px-1 text-left pl-4"></td>
                                                        <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(cardGiftVouchersAmountSum)}</td>
                                                        <td className="py-1 px-1 text-right"></td>
                                                        <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(cardGiftVouchersCommSum)}</td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                    </tr>
                                                )}

                                                {/* Total Cards Section */}
                                                <tr className="font-black border-y-2 border-black text-gray-900 bg-gray-50">
                                                    <td className="py-1.5 px-1 text-left">Total Credit/Debit Cards</td>
                                                    <td className="py-1.5 px-1 text-right">{formatVal(totalCardsAmount)}</td>
                                                    <td className="py-1.5 px-1 text-right"></td>
                                                    <td className="py-1.5 px-1 text-right">{formatVal(totalCardsComm)}</td>
                                                    <td className="py-1.5 px-1 text-center"></td>
                                                    <td className="py-1.5 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Section: Received */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Received</td>
                                                </tr>
                                                {activeReport.receivedVouchers?.map((v: any, i: number) => (
                                                    <tr key={`rec-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{v.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(v.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.from && v.from !== "-" ? v.from : "-"}</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold border-b border-gray-200">
                                                    <td className="py-1 px-1 text-left pl-4"></td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(receivedSubtotal)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Section: Receivable */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Receivable</td>
                                                </tr>
                                                {activeReport.receivables?.map((r: any, i: number) => (
                                                    <tr key={`receivable-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{r.description}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(r.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold border-b border-gray-200">
                                                    <td className="py-1 px-1 text-left pl-4"></td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(receivablesSubtotal)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Section: Issued */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Issued</td>
                                                </tr>
                                                {activeReport.issuedVouchers?.exchangeAndClaims?.map((v: any, i: number) => (
                                                    <tr key={`iss-ec-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{v.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(v.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.from || "-"}</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}
                                                {activeReport.issuedVouchers?.creditVouchers?.map((v: any, i: number) => (
                                                    <tr key={`iss-cv-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{v.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(v.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.from || "-"}</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.to || "-"}</td>
                                                    </tr>
                                                ))}
                                                {activeReport.issuedVouchers?.creditVouchers?.length > 0 && (
                                                    <tr className="font-bold border-b border-gray-200">
                                                        <td className="py-1 px-1 text-left pl-4"></td>
                                                        <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(issuedCreditSubtotal)}</td>
                                                        <td className="py-1 px-1 text-right"></td>
                                                        <td className="py-1 px-1 text-right"></td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                    </tr>
                                                )}
                                                {activeReport.issuedVouchers?.giftVouchers?.map((v: any, i: number) => (
                                                    <tr key={`iss-gv-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{v.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(v.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.from || "-"}</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.to || "-"}</td>
                                                    </tr>
                                                ))}
                                                {totalGiftVoucherDiscount > 0 && (
                                                    <tr className="border-b border-gray-100 text-gray-500 hover:bg-gray-50/50 italic">
                                                        <td className="py-1 px-1 text-left pl-8 font-medium">Gift Vouchers Discount</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(totalGiftVoucherDiscount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">-</td>
                                                    </tr>
                                                )}
                                                {activeReport.issuedVouchers?.giftVouchers?.length > 0 && (
                                                    <tr className="font-bold border-b border-gray-200">
                                                        <td className="py-1 px-1 text-left pl-4"></td>
                                                        <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(issuedGiftSubtotal)}</td>
                                                        <td className="py-1 px-1 text-right"></td>
                                                        <td className="py-1 px-1 text-right"></td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                        <td className="py-1 px-1 text-center"></td>
                                                    </tr>
                                                )}
                                                {activeReport.issuedVouchers?.refundVouchers?.map((v: any, i: number) => (
                                                    <tr key={`iss-rv-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{v.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(v.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center font-mono">{v.from || "-"}</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}

                                                {/* Total Issued */}
                                                <tr className="font-black border-y-2 border-black text-gray-900 bg-gray-50">
                                                    <td className="py-1.5 px-1 text-left">Total Issued</td>
                                                    <td className="py-1.5 px-1 text-right">{formatVal(totalIssuedSubtotal)}</td>
                                                    <td className="py-1.5 px-1 text-right"></td>
                                                    <td className="py-1.5 px-1 text-right"></td>
                                                    <td className="py-1.5 px-1 text-center"></td>
                                                    <td className="py-1.5 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Section: FBR POS Charges */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>FBR POS Service Charges</td>
                                                </tr>
                                                {activeReport.fbrCharges?.map((f: any, i: number) => (
                                                    <tr key={`fbr-${i}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                        <td className="py-1 px-1 text-left pl-4 font-medium">{f.type}</td>
                                                        <td className="py-1 px-1 text-right">{formatVal(f.amount)}</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-right">-</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                        <td className="py-1 px-1 text-center">-</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold border-b border-gray-200">
                                                    <td className="py-1 px-1 text-left pl-4"></td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(fbrSubtotal)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Financial Section */}
                                                <tr className="font-semibold text-gray-900 border-t border-black">
                                                    <td className="py-1 px-1 text-left">Sale</td>
                                                    <td className="py-1 px-1 text-right">{formatVal(activeReport.financials?.sale)}</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>
                                                <tr className="font-semibold text-gray-900">
                                                    <td className="py-1 px-1 text-left">Sales Return</td>
                                                    <td className="py-1 px-1 text-right text-red-600 font-bold">({formatVal(activeReport.financials?.salesReturn)})</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>
                                                <tr className="font-black text-black border-y-2 border-black bg-gray-50 text-xs">
                                                    <td className="py-2 px-1 text-left uppercase text-primary">Net Sales</td>
                                                    <td className="py-2 px-1 text-right text-primary">{formatVal(activeReport.financials?.netSales)}</td>
                                                    <td className="py-2 px-1 text-right">-</td>
                                                    <td className="py-2 px-1 text-right">-</td>
                                                    <td className="py-2 px-1 text-center"></td>
                                                    <td className="py-2 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Cash Breakdown */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Cash</td>
                                                </tr>
                                                <tr className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                    <td className="py-1 px-1 text-left pl-4 font-medium">Sale</td>
                                                    <td className="py-1 px-1 text-right">{formatVal(activeReport.cashBreakdown?.sale)}</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                </tr>
                                                <tr className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                    <td className="py-1 px-1 text-left pl-4 font-medium">Sales | Gift Vouchers</td>
                                                    <td className="py-1 px-1 text-right">{formatVal(activeReport.cashBreakdown?.giftVouchers)}</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                </tr>
                                                <tr className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                    <td className="py-1 px-1 text-left pl-4 font-medium">Refund Vouchers</td>
                                                    <td className="py-1 px-1 text-right text-red-600 font-bold">({formatVal(activeReport.cashBreakdown?.refundVouchers)})</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                </tr>
                                                <tr className="font-bold border-b border-gray-200">
                                                    <td className="py-1 px-1 text-left pl-4 uppercase">Total Cash</td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(activeReport.cashBreakdown?.total)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>

                                                <tr className="h-2"></tr>

                                                {/* Card Breakdown */}
                                                <tr className="font-extrabold text-black bg-gray-100/60 border-b border-black/40">
                                                    <td className="py-1.5 px-1 text-left" colSpan={6}>Card(s)</td>
                                                </tr>
                                                <tr className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                    <td className="py-1 px-1 text-left pl-4 font-medium">Sale</td>
                                                    <td className="py-1 px-1 text-right">{formatVal(activeReport.cardBreakdown?.sale)}</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                </tr>
                                                <tr className="border-b border-gray-100 text-gray-700 hover:bg-gray-50/50">
                                                    <td className="py-1 px-1 text-left pl-4 font-medium">Sales | Gift Vouchers</td>
                                                    <td className="py-1 px-1 text-right">{formatVal(activeReport.cardBreakdown?.giftVouchers)}</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-right">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                    <td className="py-1 px-1 text-center">-</td>
                                                </tr>
                                                <tr className="font-bold border-b-2 border-black">
                                                    <td className="py-1 px-1 text-left pl-4 uppercase">Total Cards</td>
                                                    <td className="py-1 px-1 text-right border-t border-dashed border-black/60">{formatVal(activeReport.cardBreakdown?.total)}</td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-right"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                    <td className="py-1 px-1 text-center"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Sign-off Blocks */}
                                    <div className="grid grid-cols-2 gap-16 pt-12 text-[10.5px]">
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-400 w-full h-8" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">Prepared By (Auditor Signature)</span>
                                                <span className="text-[9.5px] text-gray-500 font-medium">Store Operations Auditor</span>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-400 w-full h-8" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">Checked By (Manager Signature)</span>
                                                <span className="text-[9.5px] text-gray-500 font-medium">Authorized Operations Supervisor</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Print Stylesheet injection */}
            <style jsx global>{`
                @media print {
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }

                    body > *:not(#reconciliation-print-container) {
                        display: none !important;
                    }
                    
                    #reconciliation-print-container,
                    #reconciliation-print-container * {
                        visibility: visible !important;
                    }
                    
                    #reconciliation-print-container {
                        display: block !important;
                        position: relative !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .print-layout-thermal {
                        width: 72.1mm !important;
                        margin: 0 auto !important;
                        padding: 2mm 1mm !important;
                    }

                    .print-layout-desktop {
                        width: 100% !important;
                        max-width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 12mm !important;
                    }

                    .print-layout-desktop > div {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    @page {
                        size: ${layout === "thermal" ? "80mm auto" : "A4"};
                        margin: ${layout === "thermal" ? "0" : "15mm"};
                    }

                    tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
            `}</style>

            {mounted && createPortal(
                <div
                    id="reconciliation-print-container"
                    style={{
                        position: "fixed",
                        left: "-9999px",
                        top: 0,
                        pointerEvents: "none",
                    }}
                    aria-hidden="true"
                >
                    {layout === "thermal" ? (
                        <div className="print-layout-thermal font-mono text-[9px] text-black">
                            {renderThermalContent(true)}
                        </div>
                    ) : (
                        <div className="print-layout-desktop text-black bg-white font-sans text-[10px] leading-tight">
                            {/* Header */}
                            <div className="text-center space-y-0.5 border-b-2 border-black pb-3 mb-4 relative">
                                <h1 className="text-sm font-extrabold tracking-wide uppercase">{activeReport.companyName}</h1>
                                <h2 className="text-xs font-semibold uppercase">{activeReport.locationName}</h2>
                                <h3 className="text-xs font-black tracking-widest text-black uppercase border-y border-black py-0.5 my-1">
                                    {activeReport.reportTitle}
                                </h3>
                                <p className="text-[10px] font-bold">{activeReport.dateRange}</p>
                                <div className="absolute right-0 bottom-1 text-right font-bold text-[9px]">
                                    Document # {activeReport.documentNumber}
                                </div>
                            </div>

                            {/* Table */}
                            <table className="w-full text-[9.5px] border-collapse">
                                <thead>
                                    <tr className="border-b border-black font-bold">
                                        <th className="py-1 px-0.5 text-left w-[35%]">Description</th>
                                        <th className="py-1 px-0.5 text-right w-[15%]">Amount (Rs.)</th>
                                        <th className="py-1 px-0.5 text-right w-[12%]">Rate %</th>
                                        <th className="py-1 px-0.5 text-right w-[15%]">Bank Comm.</th>
                                        <th className="py-1 px-0.5 text-center w-[13%]">From</th>
                                        <th className="py-1 px-0.5 text-center w-[10%]">To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Credit | Debit Cards</td>
                                    </tr>
                                    {activeReport.cardPayments?.map((p: any, i: number) => (
                                        <tr key={`print-card-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{p.bank}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.rate, true)}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.commission)}</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(cardPaymentsAmountSum)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(cardPaymentsCommSum)}</td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Credit Card - Gift Vouchers Issued</td>
                                    </tr>
                                    {activeReport.cardGiftVouchers?.map((p: any, i: number) => (
                                        <tr key={`print-card-gv-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{p.bank}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.rate, true)}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(p.commission)}</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(cardGiftVouchersAmountSum)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(cardGiftVouchersCommSum)}</td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="font-extrabold border-y border-black bg-gray-50">
                                        <td className="py-1 px-0.5 text-left">Total Credit/Debit Cards</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(totalCardsAmount)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(totalCardsComm)}</td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Received</td>
                                    </tr>
                                    {activeReport.receivedVouchers?.map((v: any, i: number) => (
                                        <tr key={`print-rec-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{v.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(v.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.from && v.from !== "-" ? v.from : "-"}</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(receivedSubtotal)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Receivable</td>
                                    </tr>
                                    {activeReport.receivables?.map((r: any, i: number) => (
                                        <tr key={`print-receivable-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{r.description}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(r.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(receivablesSubtotal)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Issued</td>
                                    </tr>
                                    {activeReport.issuedVouchers?.exchangeAndClaims?.map((v: any, i: number) => (
                                        <tr key={`print-iss-ec-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{v.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(v.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.from || "-"}</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    {activeReport.issuedVouchers?.exchangeAndClaims?.length > 0 && (
                                        <tr className="font-bold border-b border-gray-200">
                                            <td className="py-1 px-0.5 text-left pl-3"></td>
                                            <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(issuedExchangeSubtotal)}</td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                        </tr>
                                    )}

                                    {activeReport.issuedVouchers?.creditVouchers?.map((v: any, i: number) => (
                                        <tr key={`print-iss-cv-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{v.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(v.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.from || "-"}</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.to || "-"}</td>
                                        </tr>
                                    ))}
                                    {activeReport.issuedVouchers?.creditVouchers?.length > 0 && (
                                        <tr className="font-bold border-b border-gray-200">
                                            <td className="py-1 px-0.5 text-left pl-3"></td>
                                            <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(issuedCreditSubtotal)}</td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                        </tr>
                                    )}

                                    {activeReport.issuedVouchers?.giftVouchers?.map((v: any, i: number) => (
                                        <tr key={`print-iss-gv-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{v.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(v.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.from || "-"}</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.to || "-"}</td>
                                        </tr>
                                    ))}
                                    {totalGiftVoucherDiscount > 0 && (
                                        <tr className="border-b border-gray-300 italic text-gray-500">
                                            <td className="py-1 px-0.5 text-left pl-6">Gift Vouchers Discount</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(totalGiftVoucherDiscount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    )}
                                    {activeReport.issuedVouchers?.giftVouchers?.length > 0 && (
                                        <tr className="font-bold border-b border-gray-200">
                                            <td className="py-1 px-0.5 text-left pl-3"></td>
                                            <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(issuedGiftSubtotal)}</td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-right"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                            <td className="py-1 px-0.5 text-center"></td>
                                        </tr>
                                    )}
                                    {activeReport.issuedVouchers?.refundVouchers?.map((v: any, i: number) => (
                                        <tr key={`print-iss-rv-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{v.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(v.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center font-mono">{v.from || "-"}</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}

                                    <tr className="font-extrabold border-y border-black bg-gray-50">
                                        <td className="py-1 px-0.5 text-left">Total Issued</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(totalIssuedSubtotal)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>FBR POS Service Charges</td>
                                    </tr>
                                    {activeReport.fbrCharges?.map((f: any, i: number) => (
                                        <tr key={`print-fbr-${i}`} className="border-b border-gray-300">
                                            <td className="py-1 px-0.5 text-left pl-3">{f.type}</td>
                                            <td className="py-1 px-0.5 text-right">{formatVal(f.amount)}</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-right">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                            <td className="py-1 px-0.5 text-center">-</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3"></td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(fbrSubtotal)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-semibold text-black border-t border-black">
                                        <td className="py-1 px-0.5 text-left">Sale</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(activeReport.financials?.sale)}</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>
                                    <tr className="font-semibold text-black">
                                        <td className="py-1 px-0.5 text-left">Sales Return</td>
                                        <td className="py-1 px-0.5 text-right font-bold">({formatVal(activeReport.financials?.salesReturn)})</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>
                                    <tr className="font-bold text-black border-y border-black bg-gray-50">
                                        <td className="py-1.5 px-0.5 text-left uppercase">Net Sales</td>
                                        <td className="py-1.5 px-0.5 text-right">{formatVal(activeReport.financials?.netSales)}</td>
                                        <td className="py-1.5 px-0.5 text-right">-</td>
                                        <td className="py-1.5 px-0.5 text-right">-</td>
                                        <td className="py-1.5 px-0.5 text-center"></td>
                                        <td className="py-1.5 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Cash</td>
                                    </tr>
                                    <tr className="border-b border-gray-300 text-gray-700">
                                        <td className="py-1 px-0.5 text-left pl-3">Sale</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(activeReport.cashBreakdown?.sale)}</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                    </tr>
                                    <tr className="border-b border-gray-300 text-gray-700">
                                        <td className="py-1 px-0.5 text-left pl-3">Sales | Gift Vouchers</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(activeReport.cashBreakdown?.giftVouchers)}</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                    </tr>
                                    <tr className="border-b border-gray-300 text-gray-700">
                                        <td className="py-1 px-0.5 text-left pl-3">Refund Vouchers</td>
                                        <td className="py-1 px-0.5 text-right text-red-600 font-bold">({formatVal(activeReport.cashBreakdown?.refundVouchers)})</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                    </tr>
                                    <tr className="font-bold border-b border-gray-200">
                                        <td className="py-1 px-0.5 text-left pl-3 uppercase">Total Cash</td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(activeReport.cashBreakdown?.total)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>

                                    <tr className="h-1"></tr>

                                    <tr className="font-bold bg-gray-100 border-b border-black/30">
                                        <td className="py-1 px-0.5 text-left" colSpan={6}>Card(s)</td>
                                    </tr>
                                    <tr className="border-b border-gray-300 text-gray-700">
                                        <td className="py-1 px-0.5 text-left pl-3">Sale</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(activeReport.cardBreakdown?.sale)}</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                    </tr>
                                    <tr className="border-b border-gray-300 text-gray-700">
                                        <td className="py-1 px-0.5 text-left pl-3">Sales | Gift Vouchers</td>
                                        <td className="py-1 px-0.5 text-right">{formatVal(activeReport.cardBreakdown?.giftVouchers)}</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-right">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                        <td className="py-1 px-0.5 text-center">-</td>
                                    </tr>
                                    <tr className="font-bold border-b-2 border-black">
                                        <td className="py-1 px-0.5 text-left pl-3 uppercase">Total Cards</td>
                                        <td className="py-1 px-0.5 text-right border-t border-dashed border-black/50">{formatVal(activeReport.cardBreakdown?.total)}</td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-right"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                        <td className="py-1 px-0.5 text-center"></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Sign-off Blocks */}
                            <div className="grid grid-cols-2 gap-10 pt-10 text-[9.5px]">
                                <div className="space-y-3">
                                    <div className="border-b border-gray-400 w-full h-6" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">Prepared By (Auditor Signature)</span>
                                        <span className="text-[8.5px] text-gray-500">Store Operations Auditor</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="border-b border-gray-400 w-full h-6" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">Checked By (Manager Signature)</span>
                                        <span className="text-[8.5px] text-gray-500">Authorized Operations Supervisor</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
