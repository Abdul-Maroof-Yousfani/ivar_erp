"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getNetSalesSummaryReport,
    queueNetSalesSummaryReportExport,
    getNetSalesSummaryReportExportStatus,
    getSalespersons
} from "@/lib/actions/pos-sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    Download,
    Printer,
    Loader2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Store,
    Layers,
    ShoppingCart,
    Inbox,
    RefreshCw,
    Folder,
    Settings,
    Users,
    Percent
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

export default function NetSalesSummaryReportPage() {
    const { user } = useAuth();
    const locationId = user?.terminal?.location?.id || user?.locationId;
    const locationName = user?.terminal?.location?.name || "Store";

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [groupingLevels, setGroupingLevels] = useState({
        salesperson: true,
        year: false,
        month: false,
        day: false,
        document: false,
        brand: false,
        division: false,
        salesTax: false,
        category: false,
        gender: false,
        silhouette: false,
        article: false,
        variant: false,
    });

    const [cashierUserId, setCashierUserId] = useState<string>("all");
    const [cashierList, setCashierList] = useState<any[]>([]);

    const [reportData, setReportData] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

    // Excel Export Background Queue States
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState<number>(0);

    // PDF Export Background Queue States
    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    const summaryOnly = !groupingLevels.variant;

    // Fetch cashiers for location
    useEffect(() => {
        if (!locationId) return;
        async function fetchCashiers() {
            try {
                const res = await getSalespersons(locationId);
                if (res && res.status && Array.isArray(res.data)) {
                    setCashierList(res.data);
                }
            } catch (err) {
                console.error("Error fetching cashiers:", err);
            }
        }
        fetchCashiers();
    }, [locationId]);

    const fetchReport = useCallback(() => {
        if (!locationId || !dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getNetSalesSummaryReport({
                locationId,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                summaryOnly,
                showSalesperson: groupingLevels.salesperson,
                showYear: groupingLevels.year,
                showMonth: groupingLevels.month,
                showDay: groupingLevels.day,
                showDocument: groupingLevels.document,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showSalesTax: groupingLevels.salesTax,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });
            if (result && result.status !== false) {
                setReportData(result.data || result);
            } else {
                toast.error("Failed to load report data");
            }
        });
    }, [locationId, dateRange, cashierUserId, groupingLevels, summaryOnly]);

    useEffect(() => {
        fetchReport();
    }, [locationId, groupingLevels, cashierUserId]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getNetSalesSummaryReportExportStatus(exportJobId);
                if (res && res.status) {
                    const { state, progress } = res.data || {};
                    setExportProgress(progress || 0);

                    if (state === "completed") {
                        setExportState("completed");
                        toast.success("Excel Export processed successfully! Ready to download.");
                        clearInterval(interval);
                    } else if (state === "failed") {
                        setExportState("failed");
                        toast.error("Background Excel export processing failed.");
                        clearInterval(interval);
                    } else {
                        setExportState("processing");
                    }
                }
            } catch (err) {
                console.error("Error polling job status:", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [exportState, exportJobId]);

    // Poll PDF Export Job Status
    useEffect(() => {
        if (pdfExportState !== "queueing" && pdfExportState !== "processing") return;
        if (!pdfJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getNetSalesSummaryReportExportStatus(pdfJobId);
                if (res && res.status) {
                    const { state, progress } = res.data || {};
                    setPdfExportProgress(progress || 0);

                    if (state === "completed") {
                        setPdfExportState("completed");
                        toast.success("PDF Report generated successfully! Ready to download.");
                        clearInterval(interval);
                    } else if (state === "failed") {
                        setPdfExportState("failed");
                        toast.error("Background PDF generation failed.");
                        clearInterval(interval);
                    } else {
                        setPdfExportState("processing");
                    }
                }
            } catch (err) {
                console.error("Error polling PDF job status:", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [pdfExportState, pdfJobId]);

    const handleExportExcelClick = async () => {
        if (!locationId || !dateRange.from || !dateRange.to) return;

        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/pos-sales/reports/net-sales-summary/export/${exportJobId}/download`;
            window.open(url, "_blank");
            
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        setExportState("queueing");
        try {
            const res = await queueNetSalesSummaryReportExport({
                locationId,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                format: "xlsx",
                summaryOnly,
                showSalesperson: groupingLevels.salesperson,
                showYear: groupingLevels.year,
                showMonth: groupingLevels.month,
                showDay: groupingLevels.day,
                showDocument: groupingLevels.document,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showSalesTax: groupingLevels.salesTax,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });

            if (res && res.status && res.data?.jobId) {
                setExportJobId(res.data.jobId);
                setExportState("processing");
                setExportProgress(5);
                toast.info("Background Excel generation queued.");
            } else {
                setExportState("failed");
                toast.error(res.message || "Failed to queue export job.");
            }
        } catch (err) {
            setExportState("failed");
            console.error(err);
            toast.error("Failed to queue export job.");
        }
    };

    const handleExportPdfClick = async () => {
        if (!locationId || !dateRange.from || !dateRange.to) return;

        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/pos-sales/reports/net-sales-summary/export/${pdfJobId}/download`;
            window.open(url, "_blank");
            
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        setPdfExportState("queueing");
        try {
            const res = await queueNetSalesSummaryReportExport({
                locationId,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                format: "pdf",
                summaryOnly,
                showSalesperson: groupingLevels.salesperson,
                showYear: groupingLevels.year,
                showMonth: groupingLevels.month,
                showDay: groupingLevels.day,
                showDocument: groupingLevels.document,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showSalesTax: groupingLevels.salesTax,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });

            if (res && res.status && res.data?.jobId) {
                setPdfJobId(res.data.jobId);
                setPdfExportState("processing");
                setPdfExportProgress(5);
                toast.info("Background PDF generation queued.");
            } else {
                setPdfExportState("failed");
                toast.error(res.message || "Failed to queue export job.");
            }
        } catch (err) {
            setPdfExportState("failed");
            console.error(err);
            toast.error("Failed to queue export job.");
        }
    };

    const grandTotals = useMemo(() => {
        const t = {
            totalArticles: 0,
            qty: 0,
            totalRetailValue: 0,
            totalPriceWost: 0,
            discountAmount: 0,
            valueExclTax: 0,
            salesTaxAmount: 0,
            additionalSalesTaxAmount: 0,
            totalTax: 0,
            valueInclTax: 0,
        };

        for (const node of reportData) {
            if (!node || !node.totals) continue;
            t.qty += node.totals.qty;
            t.totalRetailValue += node.totals.totalRetailValue;
            t.totalPriceWost += node.totals.totalPriceWost;
            t.discountAmount += node.totals.discountAmount;
            t.valueExclTax += node.totals.valueExclTax;
            t.salesTaxAmount += node.totals.salesTaxAmount;
            t.additionalSalesTaxAmount += node.totals.additionalSalesTaxAmount;
            t.totalTax += node.totals.totalTax;
            t.valueInclTax += node.totals.valueInclTax;
        }

        const countArticles = (node: any) => {
            if (!node) return;
            if (node.level === 'article') {
                t.totalArticles += 1;
            }
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    countArticles(child);
                }
            }
        };

        for (const node of reportData) {
            countArticles(node);
        }

        return t;
    }, [reportData]);

    const flatRows = useMemo(() => {
        const rows: any[] = [];
        
        const visit = (node: any, path: string = "") => {
            if (!node) return;
            const currentPath = path ? `${path}-${node.level}-${node.value}` : `${node.level}-${node.value}`;
            
            if (node.level === 'article') {
                rows.push({
                    id: `art-${node.sku}`,
                    type: 'article',
                    label: node.articleName,
                    sku: node.sku,
                    totals: node.totals,
                });
            } else if (node.level === 'variant') {
                rows.push({
                    id: `var-${currentPath}`,
                    type: 'variant',
                    color: node.color,
                    size: node.size,
                    totals: node.totals,
                });
            } else {
                rows.push({
                    id: `${node.level}-${currentPath}`,
                    type: node.level,
                    label: `${node.value.toUpperCase()}`,
                    totals: node.totals,
                });
            }
            
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    visit(child, currentPath);
                }
            }
        };

        for (const rootNode of reportData) {
            visit(rootNode);
        }
        
        return rows;
    }, [reportData]);

    const handleToggleLevel = (level: keyof typeof groupingLevels, checked: boolean) => {
        setGroupingLevels(prev => {
            return { ...prev, [level]: checked };
        });
    };

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: flatRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 12,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

    const getExportButtonText = () => {
        switch (exportState) {
            case "queueing": return "Queueing...";
            case "processing": return `Generating ${exportProgress}%`;
            case "completed": return "Download Excel";
            case "failed": return "Retry Excel Export";
            case "idle":
            default: return "Export Excel";
        }
    };

    const getPdfButtonText = () => {
        switch (pdfExportState) {
            case "queueing": return "Queueing...";
            case "processing": return `Generating ${pdfExportProgress}%`;
            case "completed": return "Download PDF";
            case "failed": return "Retry PDF Export";
            case "idle":
            default: return "Export PDF";
        }
    };

    const formatVal = (val: number) => val === 0 ? "-" : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatQty = (val: number) => val === 0 ? "-" : val.toLocaleString();

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Net Sales Summary Report
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        POS Net Sales & Tax Summary for <span className="text-foreground font-semibold">{locationName}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={pdfExportState === "completed" ? "default" : "outline"}
                        onClick={handleExportPdfClick}
                        disabled={(pdfExportState === "queueing" || pdfExportState === "processing") || reportData.length === 0}
                        className={cn(
                            "gap-2 font-semibold transition-all",
                            pdfExportState === "completed"
                                ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 border-none"
                                : "border-red-500/40 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        )}
                    >
                        {pdfExportState === "queueing" || pdfExportState === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                        ) : (
                            <Printer className="h-4 w-4" />
                        )}
                        {getPdfButtonText()}
                    </Button>
                    <Button
                        variant={exportState === "completed" ? "default" : "outline"}
                        onClick={handleExportExcelClick}
                        disabled={(exportState === "queueing" || exportState === "processing") || reportData.length === 0}
                        className={cn(
                            "gap-2 font-semibold transition-all",
                            exportState === "completed"
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 border-none"
                                : "border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        )}
                    >
                        {exportState === "queueing" || exportState === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {getExportButtonText()}
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Net Sales Summary Report</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Outlet: {locationName}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Date Period:
                        </span>
                        <DateRangePicker
                            initialDateFrom={dateRange.from}
                            initialDateTo={dateRange.to}
                            onUpdate={({ range }: { range: DateRange }) => {
                                if (range) {
                                    setDateRange(range);
                                }
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Salesperson:
                        </span>
                        <select
                            value={cashierUserId}
                            onChange={(e) => setCashierUserId(e.target.value)}
                            className="bg-background border rounded px-2.5 py-1.5 text-xs font-medium focus:ring-primary focus:border-primary cursor-pointer outline-none min-w-[180px]"
                        >
                            <option value="all">All Salespersons</option>
                            {cashierList.map((cashier: any) => (
                                <option key={cashier.userId} value={cashier.userId}>
                                    {cashier.name} ({cashier.empCode || "No Emp Code"})
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchReport}
                        disabled={isPending}
                        className="text-primary hover:text-primary/95 text-xs font-bold"
                    >
                        Apply / Refresh
                    </Button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <Folder className="h-4 w-4 text-primary" />
                    <span>{COMPANY_NAME} &bull; High-Performance Scroll</span>
                </div>
            </div>

            {/* Report Hierarchy Configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-primary" />
                            Report Hierarchy Configuration
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Customize the nesting structure. Check the levels you want to group and report by.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 pt-2">
                    {/* Salesperson Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-salesperson"
                            checked={groupingLevels.salesperson}
                            onChange={(e) => handleToggleLevel('salesperson', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-salesperson" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-indigo-500" />
                            Salesperson
                        </label>
                    </div>

                    {/* Year Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-year"
                            checked={groupingLevels.year}
                            onChange={(e) => handleToggleLevel('year', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-year" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            Year
                        </label>
                    </div>

                    {/* Month Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-month"
                            checked={groupingLevels.month}
                            onChange={(e) => handleToggleLevel('month', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-month" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                            Month
                        </label>
                    </div>

                    {/* Day Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-day"
                            checked={groupingLevels.day}
                            onChange={(e) => handleToggleLevel('day', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-day" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-rose-500" />
                            Day
                        </label>
                    </div>

                    {/* Document Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-document"
                            checked={groupingLevels.document}
                            onChange={(e) => handleToggleLevel('document', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-document" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Inbox className="h-3.5 w-3.5 text-amber-500" />
                            Document Info
                        </label>
                    </div>

                    {/* Brand Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-brand"
                            checked={groupingLevels.brand}
                            onChange={(e) => handleToggleLevel('brand', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-brand" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-500" />
                            Brand
                        </label>
                    </div>

                    {/* Division Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-division"
                            checked={groupingLevels.division}
                            onChange={(e) => handleToggleLevel('division', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-division" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Folder className="h-3.5 w-3.5 text-blue-500" />
                            Division
                        </label>
                    </div>

                    {/* Sales Tax Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-salesTax"
                            checked={groupingLevels.salesTax}
                            onChange={(e) => handleToggleLevel('salesTax', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-salesTax" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Percent className="h-3.5 w-3.5 text-indigo-500" />
                            Sales Tax
                        </label>
                    </div>

                    {/* Category Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-category"
                            checked={groupingLevels.category}
                            onChange={(e) => handleToggleLevel('category', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-category" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
                            Category
                        </label>
                    </div>

                    {/* Gender Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-gender"
                            checked={groupingLevels.gender}
                            onChange={(e) => handleToggleLevel('gender', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-gender" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-rose-500" />
                            Gender
                        </label>
                    </div>

                    {/* Silhouette Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-silhouette"
                            checked={groupingLevels.silhouette}
                            onChange={(e) => handleToggleLevel('silhouette', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-silhouette" className="text-xs font-bold text-slate-755 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                            Silhouette
                        </label>
                    </div>

                    {/* Article Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-article"
                            checked={groupingLevels.article}
                            onChange={(e) => handleToggleLevel('article', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-article" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Inbox className="h-3.5 w-3.5 text-cyan-500" />
                            Article
                        </label>
                    </div>

                    {/* Variant Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-variant"
                            checked={groupingLevels.variant}
                            onChange={(e) => handleToggleLevel('variant', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-variant" className="text-xs font-bold text-slate-755 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-fuchsia-500" />
                            Variant (Sizes)
                        </label>
                    </div>
                </div>
            </div>


            {/* Warning banner for large data sets */}
            {grandTotals.totalArticles > 500 && !summaryOnly && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-xl flex items-start gap-3 no-print">
                    <span className="text-lg">⚠️</span>
                    <div className="space-y-1">
                        <h4 className="font-bold text-xs">Large Report Detected ({grandTotals.totalArticles} Articles)</h4>
                        <p className="text-[11px] leading-relaxed opacity-90">
                            Exporting this volume as a detailed PDF (with all sizes) requires rendering hundreds of pages, which puts heavy load on the server. 
                            We **highly recommend** downloading as **Excel (XLSX)** (which downloads instantly) or checking the **"Summary Only (Hide Sizes)"** filter before exporting to PDF.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Qty Sold</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatQty(grandTotals.qty)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Value (WOST)</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">Rs. {formatVal(grandTotals.totalPriceWost)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Discount</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-455">Rs. {formatVal(grandTotals.discountAmount)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-955/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Value (Incl. Tax)</p>
                            <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">Rs. {formatVal(grandTotals.valueInclTax)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tree-structured Scrolling Table with react-virtual virtualization */}
            <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead>
                        <tr className="bg-slate-800 text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <th className="p-3 w-[300px] border-r bg-slate-800">Year | Month | Day | Document Type & # / Product</th>
                            <th className="p-3 w-[100px] border-r text-center bg-slate-800">Size</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Qty</th>
                            <th className="p-3 w-[130px] border-r text-right bg-slate-800">Retail Price</th>
                            <th className="p-3 w-[140px] text-right bg-emerald-900/10">Total WOST</th>
                            <th className="p-3 w-[130px] text-right bg-rose-900/10">Discount</th>
                            <th className="p-3 w-[160px] border-r text-right bg-slate-800 font-extrabold text-blue-300">Val Excl Tax</th>
                            <th className="p-3 w-[130px] text-right bg-slate-800">Sales Tax</th>
                            <th className="p-3 w-[130px] text-right bg-slate-800">Add Tax</th>
                            <th className="p-3 w-[130px] border-r text-right bg-emerald-900/25 font-extrabold text-emerald-300">Total Tax</th>
                            <th className="p-3 w-[170px] text-right bg-slate-900 font-extrabold text-slate-105">Val Incl Tax</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {isPending ? (
                            <tr>
                                <td colSpan={11} className="p-8 text-center text-muted-foreground font-medium">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Re-arranging hierarchical sales data and computing summaries...
                                    </div>
                                </td>
                            </tr>
                        ) : flatRows.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="p-8 text-center text-muted-foreground font-medium">
                                    No sales transactions found for this period.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={11} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                 {virtualItems.map((virtualRow) => {
                                    const row = flatRows[virtualRow.index];
                                    
                                    const LEVEL_UI_STYLES: Record<string, { className: string; indentClass: string }> = {
                                        salesperson: { className: "bg-[#1a2f4c] text-white font-black border-b h-[40px]", indentClass: "pl-3 text-white" },
                                        year: { className: "bg-[#1e3a5f] text-white font-extrabold border-b h-[40px]", indentClass: "pl-6 text-white" },
                                        month: { className: "bg-[#2a4d7c] text-white font-extrabold border-b h-[40px]", indentClass: "pl-9 text-white" },
                                        day: { className: "bg-[#365f97] text-white font-bold border-b h-[40px]", indentClass: "pl-12 text-white" },
                                        document: { className: "bg-[#4271b0] text-white font-bold border-b h-[40px]", indentClass: "pl-16 text-white" },
                                        brand: { className: "bg-[#4a5568] text-white font-semibold border-b h-[40px]", indentClass: "pl-20 text-white" },
                                        division: { className: "bg-[#718096] text-white font-semibold border-b h-[40px]", indentClass: "pl-24 text-white" },
                                        salesTax: { className: "bg-[#319795] text-white font-bold border-b h-[40px]", indentClass: "pl-28 text-white" },
                                        category: { className: "bg-[#a0aec0] text-slate-900 font-medium border-b h-[40px]", indentClass: "pl-32 text-slate-900" },
                                        gender: { className: "bg-[#cbd5e0] text-slate-900 font-medium border-b h-[40px]", indentClass: "pl-36 text-slate-900" },
                                        silhouette: { className: "bg-[#e2e8f0] text-slate-800 font-medium border-b h-[40px]", indentClass: "pl-40 text-slate-800" },
                                        article: { className: "bg-slate-100/25 dark:bg-slate-900/15 font-semibold text-slate-800 dark:text-slate-200 border-b h-[45px]", indentClass: "pl-44" },
                                        variant: { className: "hover:bg-slate-50 dark:hover:bg-slate-900/35 text-slate-600 dark:text-slate-400 bg-background transition-colors h-[36px]", indentClass: "pl-48" },
                                    };

                                    const style = LEVEL_UI_STYLES[row.type] || LEVEL_UI_STYLES.brand;
                                    
                                    const isArticle = row.type === 'article';
                                    const isVariant = row.type === 'variant';
                                    const totals = row.totals;
                                    
                                    const avgRetail = totals.qty > 0 ? (totals.totalRetailValue / totals.qty) : 0;

                                    return (
                                        <tr key={row.id} className={style.className}>
                                            {isArticle ? (
                                                <td className={cn("p-3 border-r flex flex-col font-bold justify-center", style.indentClass)}>
                                                    <span className="text-[10px] text-primary font-bold">SKU: {row.sku}</span>
                                                    <span className="text-slate-700 dark:text-slate-350">{row.label}</span>
                                                </td>
                                            ) : isVariant ? (
                                                <td className={cn("p-3 border-r text-muted-foreground italic", style.indentClass)}>
                                                    &mdash; Variant Size
                                                </td>
                                            ) : (
                                                <td colSpan={2} className={cn("p-3 border-r text-xs font-bold", style.indentClass)}>
                                                    {row.label}
                                                </td>
                                            )}

                                            {isArticle && (
                                                <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase bg-slate-50/20">All Sizes</td>
                                            )}

                                            {isVariant && (
                                                <td className="p-3 border-r text-center font-semibold text-slate-700 dark:text-slate-350">{row.size}</td>
                                            )}

                                            {/* Numeric Cells */}
                                            {(() => {
                                                const isDetailRow = isArticle || isVariant;
                                                return (
                                                    <>
                                                        <td className="p-3 border-r text-right font-medium">{formatQty(totals.qty)}</td>
                                                        <td className="p-3 border-r text-right font-medium">Rs. {formatVal(avgRetail)}</td>
                                                        <td className={cn("p-3 text-right bg-emerald-500/5 font-medium", isDetailRow ? "text-slate-800 dark:text-slate-200" : "")}>Rs. {formatVal(totals.totalPriceWost)}</td>
                                                        <td className={cn("p-3 text-right bg-rose-500/5 font-medium", isDetailRow ? "text-rose-600 dark:text-rose-400" : "")}>Rs. {formatVal(totals.discountAmount)}</td>
                                                        <td className={cn("p-3 border-r text-right font-semibold bg-blue-500/5", isDetailRow ? "text-blue-600 dark:text-blue-400" : "")}>Rs. {formatVal(totals.valueExclTax)}</td>
                                                        <td className="p-3 text-right">Rs. {formatVal(totals.salesTaxAmount)}</td>
                                                        <td className="p-3 text-right">Rs. {formatVal(totals.additionalSalesTaxAmount)}</td>
                                                        <td className={cn("p-3 border-r text-right bg-emerald-500/5 font-semibold", isDetailRow ? "text-emerald-600 dark:text-emerald-400" : "")}>Rs. {formatVal(totals.totalTax)}</td>
                                                        <td className={cn("p-3 text-right bg-slate-500/5 font-bold", isDetailRow ? "text-slate-800 dark:text-slate-100" : "")}>Rs. {formatVal(totals.valueInclTax)}</td>
                                                    </>
                                                );
                                            })()}
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={11} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* GRAND TOTALS FOOTER ROW */}
                    {reportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 shadow-md">
                            <tr className="bg-slate-800 text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                                <td colSpan={2} className="p-3 border-r text-left uppercase tracking-wider font-black bg-slate-800">
                                    GRAND TOTALS
                                </td>
                                <td className="p-3 border-r text-right font-black bg-slate-800">{formatQty(grandTotals.qty)}</td>
                                <td className="p-3 border-r text-right font-black bg-slate-800">Rs. {formatVal(grandTotals.qty > 0 ? (grandTotals.totalRetailValue / grandTotals.qty) : 0)}</td>
                                <td className="p-3 text-right font-bold bg-emerald-700/30 text-emerald-200">Rs. {formatVal(grandTotals.totalPriceWost)}</td>
                                <td className="p-3 text-right font-bold bg-rose-700/30 text-rose-200">Rs. {formatVal(grandTotals.discountAmount)}</td>
                                <td className="p-3 border-r text-right font-black bg-blue-600/35 text-blue-300">Rs. {formatVal(grandTotals.valueExclTax)}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">Rs. {formatVal(grandTotals.salesTaxAmount)}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">Rs. {formatVal(grandTotals.additionalSalesTaxAmount)}</td>
                                <td className="p-3 border-r text-right font-black bg-emerald-600/35 text-emerald-400">Rs. {formatVal(grandTotals.totalTax)}</td>
                                <td className="p-3 text-right font-black bg-slate-900 text-white">Rs. {formatVal(grandTotals.valueInclTax)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Downloader Fixed Overlay Screen */}
            {downloadingFile && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center pointer-events-auto">
                    <div className="bg-background border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl flex flex-col items-center gap-4 text-center">
                        <div className="relative h-12 w-12 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm text-foreground">Preparing Download</h4>
                            <p className="text-xs text-muted-foreground break-all max-w-[280px]">
                                Downloading {downloadingFile}... Please wait.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                        font-size: 10px !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 6px 4px !important;
                        font-size: 8px !important;
                        color: black !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                }
            `}</style>
        </div>
    );
}
