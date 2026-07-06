"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getStockActivityReport,
    queueStockActivityReportExport,
    getStockActivityReportExportStatus
} from "@/lib/actions/stock-ledger";
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
    Settings
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

export default function PosStockActivityReportPage() {
    const { user } = useAuth();
    const locationId = user?.terminal?.location?.id || user?.locationId;
    const locationName = user?.terminal?.location?.name || "Store";

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [groupingLevels, setGroupingLevels] = useState({
        brand: true,
        division: true,
        category: true,
        gender: true,
        silhouette: true,
        article: true,
        variant: false,
    });

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

    const fetchReport = useCallback(() => {
        if (!locationId || !dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getStockActivityReport({
                locationId,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                summaryOnly,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
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
    }, [locationId, dateRange, groupingLevels, summaryOnly]);

    useEffect(() => {
        fetchReport();
    }, [locationId, groupingLevels]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getStockActivityReportExportStatus(exportJobId);
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
                const res = await getStockActivityReportExportStatus(pdfJobId);
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

        // If completed, trigger download
        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/activity-report/export/${exportJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        // Queue Excel job
        setExportState("queueing");
        try {
            const res = await queueStockActivityReportExport({
                locationId,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "xlsx",
                summaryOnly,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
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

        // If completed, trigger download
        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/activity-report/export/${pdfJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        // Queue PDF job
        setPdfExportState("queueing");
        try {
            const res = await queueStockActivityReportExport({
                locationId,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "pdf",
                summaryOnly,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
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

    // Calculate High Level & Grand Totals Metrics
    const grandTotals = useMemo(() => {
        const t = {
            totalArticles: 0,
            bf: 0,
            fromWarehouse: 0,
            fromOutlet: 0,
            totalTrfIn: 0,
            toWarehouse: 0,
            toOutlet: 0,
            totalTrfOut: 0,
            exchg: 0,
            refund: 0,
            claim: 0,
            sales: 0,
            adj: 0,
            availableStock: 0,
            transit: 0,
            balance: 0,
        };

        for (const node of reportData) {
            if (!node || !node.totals) continue;
            t.bf += node.totals.bf;
            t.fromWarehouse += node.totals.fromWarehouse;
            t.fromOutlet += node.totals.fromOutlet;
            t.totalTrfIn += node.totals.totalTrfIn;
            t.toWarehouse += node.totals.toWarehouse;
            t.toOutlet += node.totals.toOutlet;
            t.totalTrfOut += node.totals.totalTrfOut;
            t.exchg += node.totals.exchg;
            t.refund += node.totals.refund;
            t.claim += node.totals.claim;
            t.sales += node.totals.sales;
            t.adj += node.totals.adj;
            t.availableStock += node.totals.availableStock;
            t.transit += node.totals.transit;
            t.balance += node.totals.balance;
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

    // Flatten nested tree for TanStack Virtual list virtualization
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
                    bf: node.totals.bf,
                    fromWarehouse: node.totals.fromWarehouse,
                    fromOutlet: node.totals.fromOutlet,
                    totalTrfIn: node.totals.totalTrfIn,
                    toWarehouse: node.totals.toWarehouse,
                    toOutlet: node.totals.toOutlet,
                    totalTrfOut: node.totals.totalTrfOut,
                    exchg: node.totals.exchg,
                    refund: node.totals.refund,
                    claim: node.totals.claim,
                    sales: node.totals.sales,
                    adj: node.totals.adj,
                    availableStock: node.totals.availableStock,
                    transit: node.totals.transit,
                    balance: node.totals.balance,
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
            const next = { ...prev, [level]: checked };
            if (level === 'division' && checked) {
                next.brand = true;
            }
            if (level === 'brand' && !checked) {
                next.division = false;
            }
            return next;
        });
    };

    // Setup TanStack Virtualizer
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
            case "queueing":
                return "Queueing...";
            case "processing":
                return `Generating ${exportProgress}%`;
            case "completed":
                return "Download Excel";
            case "failed":
                return "Retry Excel Export";
            case "idle":
            default:
                return "Export Excel";
        }
    };

    const getPdfButtonText = () => {
        switch (pdfExportState) {
            case "queueing":
                return "Queueing...";
            case "processing":
                return `Generating ${pdfExportProgress}%`;
            case "completed":
                return "Download PDF";
            case "failed":
                return "Retry PDF Export";
            case "idle":
            default:
                return "Export PDF";
        }
    };

    const formatVal = (val: number) => val === 0 ? "-" : val.toLocaleString();

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Stock Activity Report
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        POS Level Report for <span className="text-foreground font-semibold">{locationName}</span>
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

            {/* Print Header (Visible only when printed) */}
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Stock Activity Report</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Outlet: {locationName}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-center gap-3">
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
                    <span>{COMPANY_NAME} &bull; Virtualized High-Performance Scroll</span>
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
                            Customize the nesting structure. Check the levels you want to group and report by (Brand and Division are root levels).
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2">
                    {/* Brand Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-brand"
                            checked={groupingLevels.brand}
                            onChange={(e) => handleToggleLevel('brand', e.target.checked)}
                            disabled={groupingLevels.division}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer disabled:opacity-50"
                        />
                        <label htmlFor="group-brand" className={cn("text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5", groupingLevels.division && "opacity-60 cursor-not-allowed")}>
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
                        <label htmlFor="group-silhouette" className="text-xs font-bold text-slate-750 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
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
                        <label htmlFor="group-variant" className="text-xs font-bold text-slate-750 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
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
                            Exporting this volume as a detailed PDF (with all sizes/colors) requires rendering hundreds of pages, which puts heavy load on the server and may take a few minutes. 
                            We **highly recommend** downloading as **Excel (XLSX)** (which downloads instantly) or checking the **"Summary Only (Hide Sizes)"** filter before exporting to PDF.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Articles</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{grandTotals.totalArticles}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Opening Balance</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{grandTotals.bf}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transfers IN (Net)</p>
                            <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">+{grandTotals.totalTrfIn}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transfers OUT (Net)</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">-{grandTotals.totalTrfOut}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Sales</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{grandTotals.sales}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">In Transit</p>
                            <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-500">{grandTotals.transit}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                            <RefreshCw className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tree-structured Scrolling Table with react-virtual virtualization */}
            <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-slate-800 text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <th className="p-3 w-[280px] border-r bg-slate-800">Article / Variant Info</th>
                            <th className="p-3 w-[100px] border-r text-center bg-slate-800">Color</th>
                            <th className="p-3 w-[80px] border-r text-center bg-slate-800">Size</th>
                            <th className="p-3 w-[90px] border-r text-right bg-slate-800">Opening</th>
                            <th className="p-3 w-[90px] text-right bg-emerald-900/10">Wh IN</th>
                            <th className="p-3 w-[90px] text-right bg-emerald-900/10">Outlet IN</th>
                            <th className="p-3 w-[90px] border-r text-right bg-emerald-900/25 font-extrabold text-emerald-300">Trf IN</th>
                            <th className="p-3 w-[90px] text-right bg-rose-900/10">Wh OUT</th>
                            <th className="p-3 w-[90px] text-right bg-rose-900/10">Outlet OUT</th>
                            <th className="p-3 w-[90px] border-r text-right bg-rose-900/25 font-extrabold text-rose-300">Trf OUT</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Exchg</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Refund</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Claim</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Sales</th>
                            <th className="p-3 w-[80px] border-r text-right bg-slate-800">Adj</th>
                            <th className="p-3 w-[100px] border-r text-right bg-blue-900/10 font-extrabold text-blue-300">Available</th>
                            <th className="p-3 w-[80px] border-r text-right text-amber-300 font-extrabold bg-slate-800">Transit</th>
                            <th className="p-3 w-[110px] text-right bg-slate-900 font-extrabold text-slate-100">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {isPending ? (
                            <tr>
                                <td colSpan={18} className="p-8 text-center text-muted-foreground font-medium">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Re-arranging hierarchical data and computing stock metrics...
                                    </div>
                                </td>
                            </tr>
                        ) : flatRows.length === 0 ? (
                            <tr>
                                <td colSpan={18} className="p-8 text-center text-muted-foreground font-medium">
                                    No stock ledger movements or inventory balances found for this period.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={18} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                 {virtualItems.map((virtualRow) => {
                                    const row = flatRows[virtualRow.index];
                                    
                                    const LEVEL_UI_STYLES: Record<string, { className: string; indentClass: string }> = {
                                        brand: { className: "bg-slate-900 text-slate-100 font-black border-b h-[40px]", indentClass: "pl-3 text-slate-100" },
                                        division: { className: "bg-slate-800 text-white font-extrabold border-b h-[40px]", indentClass: "pl-6 text-white" },
                                        category: { className: "bg-slate-700 text-white font-bold border-b h-[40px]", indentClass: "pl-9 text-white" },
                                        gender: { className: "bg-slate-600 text-white font-semibold border-b h-[40px]", indentClass: "pl-12 text-white" },
                                        silhouette: { className: "bg-slate-500 text-slate-100 font-medium border-b h-[40px]", indentClass: "pl-16 text-slate-105" },
                                        article: { className: "bg-slate-100/25 dark:bg-slate-900/15 font-semibold text-slate-800 dark:text-slate-200 border-b h-[45px]", indentClass: "pl-20" },
                                        variant: { className: "hover:bg-slate-50 dark:hover:bg-slate-900/35 text-slate-600 dark:text-slate-400 bg-background transition-colors h-[36px]", indentClass: "pl-24" },
                                    };

                                    const style = LEVEL_UI_STYLES[row.type] || LEVEL_UI_STYLES.brand;
                                    
                                    const isArticle = row.type === 'article';
                                    const isVariant = row.type === 'variant';
                                    const totals = row.totals || {
                                        bf: row.bf, fromWarehouse: row.fromWarehouse, fromOutlet: row.fromOutlet, totalTrfIn: row.totalTrfIn,
                                        toWarehouse: row.toWarehouse, toOutlet: row.toOutlet, totalTrfOut: row.totalTrfOut, exchg: row.exchg,
                                        refund: row.refund, claim: row.claim, sales: row.sales, adj: row.adj, availableStock: row.availableStock,
                                        transit: row.transit, balance: row.balance
                                    };

                                    return (
                                        <tr key={row.id} className={style.className}>
                                            {isArticle ? (
                                                <td className={cn("p-3 border-r flex flex-col font-bold justify-center", style.indentClass)}>
                                                    <span className="text-[10px] text-primary">SKU: {row.sku}</span>
                                                    <span className="text-slate-700 dark:text-slate-350">{row.label}</span>
                                                </td>
                                            ) : isVariant ? (
                                                <td className={cn("p-3 border-r text-muted-foreground italic", style.indentClass)}>
                                                    &mdash; Variant Item
                                                </td>
                                            ) : (
                                                <td colSpan={3} className={cn("p-3 border-r text-xs font-bold", style.indentClass)}>
                                                    {row.label}
                                                </td>
                                            )}

                                            {isArticle && (
                                                <>
                                                    <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase bg-slate-50/20">All Colors</td>
                                                    <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase bg-slate-50/20">All Sizes</td>
                                                </>
                                            )}

                                            {isVariant && (
                                                <>
                                                    <td className="p-3 border-r text-center font-semibold text-slate-700 dark:text-slate-300">{row.color}</td>
                                                    <td className="p-3 border-r text-center font-semibold text-slate-700 dark:text-slate-350">{row.size}</td>
                                                </>
                                            )}

                                            <td className="p-3 border-r text-right font-medium">{formatVal(totals.bf)}</td>
                                            <td className="p-3 text-right">{formatVal(totals.fromWarehouse)}</td>
                                            <td className="p-3 text-right">{formatVal(totals.fromOutlet)}</td>
                                            <td className="p-3 border-r text-right bg-emerald-500/5 font-semibold text-emerald-600">{formatVal(totals.totalTrfIn)}</td>
                                            <td className="p-3 text-right">{formatVal(totals.toWarehouse)}</td>
                                            <td className="p-3 text-right">{formatVal(totals.toOutlet)}</td>
                                            <td className="p-3 border-r text-right bg-rose-500/5 font-semibold text-rose-600">{formatVal(totals.totalTrfOut)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(totals.exchg)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(totals.refund)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(totals.claim)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(totals.sales)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(totals.adj)}</td>
                                            <td className="p-3 border-r text-right bg-blue-500/5 font-medium text-blue-600">{formatVal(totals.availableStock)}</td>
                                            <td className="p-3 border-r text-right font-medium text-amber-600">{formatVal(totals.transit)}</td>
                                            <td className="p-3 text-right bg-slate-500/5 font-medium text-slate-700 dark:text-slate-300">{formatVal(totals.balance)}</td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={18} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* GRAND TOTALS FOOTER ROW */}
                    {reportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 shadow-md">
                            <tr className="bg-slate-800 text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                                <td colSpan={3} className="p-3 border-r text-left uppercase tracking-wider font-black bg-slate-800">
                                    GRAND TOTALS
                                </td>
                                <td className="p-3 border-r text-right font-black bg-slate-800">{grandTotals.bf}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">{grandTotals.fromWarehouse}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">{grandTotals.fromOutlet}</td>
                                <td className="p-3 border-r text-right font-black bg-emerald-600/35 text-emerald-400">{grandTotals.totalTrfIn}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">{grandTotals.toWarehouse}</td>
                                <td className="p-3 text-right font-bold bg-slate-700/30">{grandTotals.toOutlet}</td>
                                <td className="p-3 border-r text-right font-black bg-rose-600/35 text-rose-400">{grandTotals.totalTrfOut}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{grandTotals.exchg}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{grandTotals.refund}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{grandTotals.claim}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{grandTotals.sales}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{grandTotals.adj}</td>
                                <td className="p-3 border-r text-right font-black bg-blue-600/35 text-blue-400">{grandTotals.availableStock}</td>
                                <td className="p-3 border-r text-right font-black text-amber-400 bg-slate-800">{grandTotals.transit}</td>
                                <td className="p-3 text-right font-black bg-slate-900 text-white">{grandTotals.balance}</td>
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
                .bg-slate-750 {
                    background-color: #2a3342;
                }
            `}</style>
        </div>
    );
}
