"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { getLocations, Location } from "@/lib/actions/location";
import { getWarehouses, Warehouse } from "@/lib/actions/warehouse";
import {
    getAvailableStockSummaryReport,
    queueAvailableStockSummaryReportExport,
    getAvailableStockSummaryReportExportStatus
} from "@/lib/actions/stock-ledger";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    Download,
    Printer,
    Loader2,
    Calendar,
    TrendingUp,
    Store,
    Layers,
    ShoppingCart,
    Inbox,
    RefreshCw,
    Folder,
    Coins,
    Truck,
    Search,
    X,
    SlidersHorizontal,
    Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn, getApiBaseUrl, formatCurrency } from "@/lib/utils";

export default function ERPAvailableStockSummaryReportPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState<boolean>(true);

    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);

    const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

    const [searchQuery, setSearchQuery] = useState("");

    const [groupingLevels, setGroupingLevels] = useState({
        brand: true,
        division: true,
        category: true,
        gender: true,
        silhouette: true,
        article: true,
        variant: true,
    });

    const [reportData, setReportData] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();

    // Excel Export Queue States
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState<number>(0);

    // PDF Export Queue States
    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    const summaryOnly = !groupingLevels.variant;

    // Fetch Outlets/Locations on mount
    useEffect(() => {
        async function fetchLocationsList() {
            setIsLoadingLocations(true);
            try {
                const res = await getLocations();
                if (res && res.status && Array.isArray(res.data)) {
                    setLocations(res.data);
                }
            } catch (err) {
                console.error("Error fetching locations:", err);
                toast.error("Failed to load locations list");
            } finally {
                setIsLoadingLocations(false);
            }
        }
        fetchLocationsList();
    }, []);

    // Fetch Warehouses on mount
    useEffect(() => {
        async function fetchWarehousesList() {
            try {
                const data = await getWarehouses();
                if (Array.isArray(data)) {
                    setWarehouses(data);
                }
            } catch (err) {
                console.error("Error fetching warehouses:", err);
            }
        }
        fetchWarehousesList();
    }, []);

    // Format location options for MultiSelect
    const locationOptions: MultiSelectOption[] = useMemo(() => {
        return locations.map((loc) => ({
            value: loc.id,
            label: loc.name,
            description: loc.code ? `Code: ${loc.code}` : undefined,
        }));
    }, [locations]);

    // Format warehouse options for MultiSelect
    const warehouseOptions: MultiSelectOption[] = useMemo(() => {
        return warehouses.map((wh) => ({
            value: wh.id,
            label: wh.name,
            description: wh.code ? `Code: ${wh.code}` : undefined,
        }));
    }, [warehouses]);

    const locationParam = useMemo(() => {
        return selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined;
    }, [selectedLocationIds]);

    const warehouseParam = useMemo(() => {
        return selectedWarehouseIds.length > 0 ? selectedWarehouseIds.join(",") : undefined;
    }, [selectedWarehouseIds]);

    const fetchReport = useCallback(() => {
        startTransition(async () => {
            const result = await getAvailableStockSummaryReport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                asOfDate,
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
                const rootData = Array.isArray(result?.data?.root)
                    ? result.data.root
                    : (Array.isArray(result?.data)
                        ? result.data
                        : (Array.isArray(result) ? result : []));
                setReportData(rootData);
            } else {
                setReportData([]);
                toast.error("Failed to load available stock summary report data");
            }
        });
    }, [locationParam, warehouseParam, asOfDate, groupingLevels, summaryOnly]);

    useEffect(() => {
        fetchReport();
    }, [locationParam, warehouseParam, asOfDate, groupingLevels]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getAvailableStockSummaryReportExportStatus(exportJobId);
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
                const res = await getAvailableStockSummaryReportExportStatus(pdfJobId);
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
        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/available-stock-summary/export/${exportJobId}/download`;
            window.open(url, "_blank");

            // Reset
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        setExportState("queueing");
        try {
            const res = await queueAvailableStockSummaryReportExport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                asOfDate,
                format: "xlsx",
                exportType: "flat",
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
        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/available-stock-summary/export/${pdfJobId}/download`;
            window.open(url, "_blank");

            // Reset
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        setPdfExportState("queueing");
        try {
            const res = await queueAvailableStockSummaryReportExport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                asOfDate,
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

    // Advanced Hierarchical Client-Side Search
    const filteredReportData = useMemo(() => {
        if (!Array.isArray(reportData)) return [];
        if (!searchQuery.trim()) return reportData;
        const query = searchQuery.toLowerCase().trim();

        const filterNode = (node: any): any => {
            if (!node) return null;
            const nodeMatches =
                (node.value && String(node.value).toLowerCase().includes(query)) ||
                (node.sku && String(node.sku).toLowerCase().includes(query)) ||
                (node.articleName && String(node.articleName).toLowerCase().includes(query)) ||
                (node.color && String(node.color).toLowerCase().includes(query)) ||
                (node.size && String(node.size).toLowerCase().includes(query)) ||
                (node.barcode && String(node.barcode).toLowerCase().includes(query)) ||
                (node.barCode && String(node.barCode).toLowerCase().includes(query)) ||
                (Array.isArray(node.barcodes) && node.barcodes.some((b: string) => String(b).toLowerCase().includes(query)));

            if (nodeMatches) {
                return node;
            }

            if (Array.isArray(node.children) && node.children.length > 0) {
                const filteredChildren = node.children
                    .map(filterNode)
                    .filter(Boolean);

                if (filteredChildren.length > 0) {
                    return {
                        ...node,
                        children: filteredChildren,
                    };
                }
            }

            return null;
        };

        return reportData.map(filterNode).filter(Boolean);
    }, [reportData, searchQuery]);

    // Calculate Grand Totals (based on filtered data!)
    const grandTotals = useMemo(() => {
        const t = {
            totalArticles: 0,
            quantity: 0,
            transit: 0,
            reserved: 0,
            total: 0,
            value: 0,
        };

        if (!Array.isArray(filteredReportData)) return t;

        for (const node of filteredReportData) {
            if (!node || !node.totals) continue;
            t.quantity += node.totals.quantity || 0;
            t.transit += node.totals.transit || 0;
            t.reserved += node.totals.reserved || 0;
            t.total += node.totals.total || 0;
            t.value += node.totals.value || 0;
        }

        const countArticles = (node: any) => {
            if (!node) return;
            if (node.level === 'article') {
                t.totalArticles += 1;
            }
            if (Array.isArray(node.children) && node.children.length > 0) {
                for (const child of node.children) {
                    countArticles(child);
                }
            }
        };

        for (const node of filteredReportData) {
            countArticles(node);
        }

        return t;
    }, [filteredReportData]);

    // Flatten nested tree for virtualization (based on filtered data!)
    const flatRows = useMemo(() => {
        const rows: any[] = [];
        if (!Array.isArray(filteredReportData)) return rows;

        const visit = (node: any, path: string = "") => {
            if (!node) return;
            const currentPath = path ? `${path}-${node.level}-${node.value}` : `${node.level}-${node.value}`;

            if (node.level === 'article') {
                const barcodes: string[] = Array.isArray(node.barcodes) ? node.barcodes : (node.barcode ? [node.barcode] : []);
                rows.push({
                    id: `art-${node.sku}`,
                    type: 'article',
                    label: node.articleName,
                    sku: node.sku,
                    barcodes,
                    barcode: node.barcode || node.barCode || (barcodes.length === 1 ? barcodes[0] : ''),
                    totals: node.totals,
                });
            } else if (node.level === 'variant') {
                rows.push({
                    id: `var-${currentPath}`,
                    type: 'variant',
                    color: node.color,
                    size: node.size,
                    barcode: node.barcode || node.barCode || '',
                    totals: node.totals,
                });
            } else {
                rows.push({
                    id: `${node.level}-${currentPath}`,
                    type: node.level,
                    label: `${node.value ? String(node.value).toUpperCase() : ''}`,
                    totals: node.totals,
                });
            }

            if (Array.isArray(node.children) && node.children.length > 0) {
                for (const child of node.children) {
                    visit(child, currentPath);
                }
            }
        };

        for (const rootNode of filteredReportData) {
            visit(rootNode);
        }

        return rows;
    }, [filteredReportData]);

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

    // Virtual list setup
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

    const formatVal = (val: number) => val === 0 ? "-" : val.toLocaleString();
    const formatPriceVal = (val: number) => val === 0 ? "-" : formatCurrency(val);

    const getSelectedLocationText = () => {
        const parts: string[] = [];
        if (selectedWarehouseIds.length === 1) {
            const match = warehouses.find(w => w.id === selectedWarehouseIds[0]);
            parts.push(match ? match.name : "1 Warehouse");
        } else if (selectedWarehouseIds.length > 1) {
            parts.push(`${selectedWarehouseIds.length} Warehouses`);
        }
        if (selectedLocationIds.length === 1) {
            const match = locations.find(l => l.id === selectedLocationIds[0]);
            parts.push(match ? match.name : "1 Outlet");
        } else if (selectedLocationIds.length > 1) {
            parts.push(`${selectedLocationIds.length} Outlets`);
        }
        return parts.length > 0 ? parts.join(" | ") : "All Warehouses & Outlets";
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        ERP Available Stock Summary
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        Stock Balance & Valuation report for <span className="text-foreground font-semibold">{getSelectedLocationText()}</span>
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
                <h1 className="text-2xl font-bold text-center text-slate-900">Available Stock Summary</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Locations: {getSelectedLocationText()}</p>
                <p className="text-xs text-center text-slate-500">
                    As of: {asOfDate ? format(new Date(asOfDate + "T00:00:00"), "dd MMM yyyy") : "Today"}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-end justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-end gap-4 flex-1">
                    {/* Warehouse selector (MultiSelect in ERP) */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            Select Warehouses
                        </span>
                        <MultiSelect
                            options={warehouseOptions}
                            value={selectedWarehouseIds}
                            onValueChange={setSelectedWarehouseIds}
                            placeholder="All Warehouses"
                            className="bg-background"
                        />
                    </div>

                    {/* Location selector (MultiSelect in ERP) */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Store className="h-3.5 w-3.5 text-primary" />
                            Select Outlets / Stores
                        </span>
                        <MultiSelect
                            options={locationOptions}
                            value={selectedLocationIds}
                            onValueChange={setSelectedLocationIds}
                            placeholder="All Outlets"
                            className="bg-background"
                        />
                    </div>

                    {/* Date picker */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            As of Date
                        </span>
                        <DatePicker
                            value={asOfDate}
                            onChange={(dateStr) => setAsOfDate(dateStr)}
                            placeholder="Select Cut-off Date"
                        />
                    </div>

                    {/* Search Bar */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[260px]">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Search className="h-3.5 w-3.5 text-primary" />
                            Quick Search
                        </span>
                        <div className="relative">
                            <Input
                                placeholder="Search by SKU, Product Name, Barcode, Size, Color, Category..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-10 pl-9 pr-9 text-sm bg-background border-slate-200"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                <Search className="h-4 w-4" />
                            </div>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={fetchReport}
                        disabled={isPending}
                        className="h-10 px-5 font-bold gap-1.5"
                    >
                        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                        Refresh Report
                    </Button>
                </div>
            </div>

            {/* Hierarchy Configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            Report Hierarchy Configuration
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Customize the nesting structure. Check the levels you want to group and report by.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2">
                    {/* Brand */}
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

                    {/* Division */}
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

                    {/* Category */}
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

                    {/* Gender */}
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

                    {/* Silhouette */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-silhouette"
                            checked={groupingLevels.silhouette}
                            onChange={(e) => handleToggleLevel('silhouette', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-silhouette" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                            Silhouette
                        </label>
                    </div>

                    {/* Article */}
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

                    {/* Variant */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-variant"
                            checked={groupingLevels.variant}
                            onChange={(e) => handleToggleLevel('variant', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-variant" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-fuchsia-500" />
                            Variant (Sizes & Barcodes)
                        </label>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Products</p>
                            <h3 className="text-lg font-bold mt-0.5 text-slate-800 dark:text-slate-100">{grandTotals.totalArticles}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                            <Layers className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Available Qty</p>
                            <h3 className="text-lg font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{formatVal(grandTotals.quantity)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <Inbox className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">In Transit</p>
                            <h3 className="text-lg font-bold mt-0.5 text-amber-600 dark:text-amber-500">{formatVal(grandTotals.transit)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                            <Truck className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Stock Reserved</p>
                            <h3 className="text-lg font-bold mt-0.5 text-purple-600 dark:text-purple-400">{formatVal(grandTotals.reserved)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400">
                            <Folder className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Qty</p>
                            <h3 className="text-lg font-bold mt-0.5 text-slate-800 dark:text-slate-100">{formatVal(grandTotals.total)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <ShoppingCart className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Valuation</p>
                            <h3 className="text-lg font-bold mt-0.5 text-indigo-600 dark:text-indigo-400">{formatPriceVal(grandTotals.value)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                            <Coins className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Virtualized Report Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-card overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center no-print">
                    <div className="text-xs font-semibold text-muted-foreground">
                        Showing <span className="font-bold text-foreground">{flatRows.length}</span> aggregated rows
                    </div>
                </div>

                <div ref={parentRef} className="h-[600px] overflow-auto relative">
                    <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                        <thead className="bg-slate-800 text-slate-100 sticky top-0 z-10 shadow-xs">
                            <tr>
                                <th className="p-2.5 font-bold uppercase tracking-wider w-[24%]">GPC / Category / Product</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-center w-[6%]">Size</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-center w-[8%]">Color</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-center w-[11%]">Barcode</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[9%]">Quantity</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[8%]">In Transit</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[9%] text-purple-300">Stock Reserved</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[9%]">Total</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[8%]">Selling Price</th>
                                <th className="p-2.5 font-bold uppercase tracking-wider text-right w-[10%]">Value (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isPending ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span>Loading Available Stock Summary Report...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : flatRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-muted-foreground font-medium">
                                        No available stock records found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paddingTop > 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ height: `${paddingTop}px` }} />
                                        </tr>
                                    )}
                                    {virtualItems.map((virtualRow) => {
                                        const row = flatRows[virtualRow.index];
                                        const val = row.totals || {};

                                        if (row.type === 'brand') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-900 text-slate-100 font-extrabold text-[12px] border-b border-slate-800">
                                                    <td colSpan={4} className="p-2.5 pl-3 text-indigo-300">
                                                        BRAND: {row.label}
                                                    </td>
                                                    <td className="p-2.5 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2.5 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2.5 text-right text-purple-300">{formatVal(val.reserved)}</td>
                                                    <td className="p-2.5 text-right text-emerald-400 font-black">{formatVal(val.total)}</td>
                                                    <td className="p-2.5 text-right text-slate-400">-</td>
                                                    <td className="p-2.5 text-right text-indigo-300 font-black">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'division') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-800 text-slate-100 font-bold text-[11px] border-b border-slate-700">
                                                    <td colSpan={4} className="p-2 pl-6 text-blue-300">
                                                        DIVISION: {row.label}
                                                    </td>
                                                    <td className="p-2 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-300">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right font-extrabold">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-slate-400">-</td>
                                                    <td className="p-2 text-right font-extrabold">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'category') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-700 text-slate-100 font-semibold text-[11px] border-b border-slate-600">
                                                    <td colSpan={4} className="p-2 pl-9 text-emerald-300">
                                                        CATEGORY: {row.label}
                                                    </td>
                                                    <td className="p-2 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-300">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right font-bold">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-slate-400">-</td>
                                                    <td className="p-2 text-right font-bold">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'gender') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-600 text-slate-100 font-medium text-[11px] border-b border-slate-500">
                                                    <td colSpan={4} className="p-2 pl-12 text-rose-200">
                                                        GENDER: {row.label}
                                                    </td>
                                                    <td className="p-2 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-300">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right font-bold">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-slate-400">-</td>
                                                    <td className="p-2 text-right font-bold">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'silhouette') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-500 text-slate-100 font-medium text-[11px] border-b border-slate-400">
                                                    <td colSpan={4} className="p-2 pl-16 text-amber-200">
                                                        SILHOUETTE: {row.label}
                                                    </td>
                                                    <td className="p-2 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-300">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right font-bold">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-slate-400">-</td>
                                                    <td className="p-2 text-right font-bold">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'article') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60">
                                                    <td className="p-2 pl-20 font-mono text-xs">
                                                        SKU: <span className="text-primary">{row.sku}</span> ({row.label})
                                                    </td>
                                                    <td className="p-2 text-center text-muted-foreground font-normal">ALL SIZES</td>
                                                    <td className="p-2 text-center text-muted-foreground font-normal">ALL COLORS</td>
                                                    <td className="p-2 text-center font-mono text-[11px]">
                                                        {row.barcode ? (
                                                            <span className="text-slate-800 dark:text-slate-200 font-semibold select-all">{row.barcode}</span>
                                                        ) : row.barcodes && row.barcodes.length > 1 ? (
                                                            <span className="text-[10px] text-muted-foreground italic font-sans font-medium px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 cursor-help inline-block" title={row.barcodes.join(', ')}>
                                                                {row.barcodes.length} Barcodes
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground font-mono">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-600 dark:text-purple-400">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right text-primary font-bold">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-slate-700 dark:text-slate-350 font-medium">{formatPriceVal(val.unitPrice)}</td>
                                                    <td className="p-2 text-right font-extrabold text-indigo-600 dark:text-indigo-400">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'variant') {
                                            return (
                                                <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-background hover:bg-slate-50 dark:hover:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                                    <td className="p-2 pl-24 italic text-muted-foreground">
                                                        &mdash; Variant Detail
                                                    </td>
                                                    <td className="p-2 text-center font-bold text-foreground">{row.size}</td>
                                                    <td className="p-2 text-center font-medium">{row.color}</td>
                                                    <td className="p-2 text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold select-all">
                                                        {row.barcode || "-"}
                                                    </td>
                                                    <td className="p-2 text-right text-foreground">{formatVal(val.quantity)}</td>
                                                    <td className="p-2 text-right text-amber-600 dark:text-amber-500 font-medium">{formatVal(val.transit)}</td>
                                                    <td className="p-2 text-right text-purple-600 dark:text-purple-400 font-medium">{formatVal(val.reserved)}</td>
                                                    <td className="p-2 text-right font-bold text-foreground">{formatVal(val.total)}</td>
                                                    <td className="p-2 text-right text-muted-foreground">-</td>
                                                    <td className="p-2 text-right font-semibold text-foreground">{formatPriceVal(val.value)}</td>
                                                </tr>
                                            );
                                        }

                                        return null;
                                    })}
                                    {paddingBottom > 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ height: `${paddingBottom}px` }} />
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                        {flatRows.length > 0 && (
                            <tfoot className="bg-slate-900 text-slate-100 font-extrabold text-xs sticky bottom-0 z-10 border-t-2 border-slate-900 shadow-md">
                                <tr>
                                    <td colSpan={4} className="p-3 pl-4 text-emerald-400 uppercase tracking-wide">GRAND TOTALS</td>
                                    <td className="p-3 text-right text-emerald-400 text-sm">{formatVal(grandTotals.quantity)}</td>
                                    <td className="p-3 text-right text-amber-400 text-sm">{formatVal(grandTotals.transit)}</td>
                                    <td className="p-3 text-right text-purple-300 text-sm">{formatVal(grandTotals.reserved)}</td>
                                    <td className="p-3 text-right text-white text-sm font-black">{formatVal(grandTotals.total)}</td>
                                    <td className="p-3 text-right text-slate-400">-</td>
                                    <td className="p-3 text-right text-indigo-300 text-sm font-black">{formatPriceVal(grandTotals.value)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
