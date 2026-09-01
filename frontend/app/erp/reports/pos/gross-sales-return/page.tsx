"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getGrossSalesReturnReport,
    queueGrossSalesReturnReportExport,
    getGrossSalesExportStatus
} from "@/lib/actions/pos-sales";
import { getLocations, Location } from "@/lib/actions/location";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { User } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    Search,
    Store,
    Calendar,
    UserCircle,
    SlidersHorizontal,
    ShoppingBag,
    Coins,
    Percent,
    Tag,
    ChevronDown,
    ChevronRight,
    TrendingDown,
    Layers,
    Folder,
    ShoppingCart,
    Inbox,
    Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

export default function ErpGrossSalesReturnReport() {
    const { user } = useAuth();

    const [isPending, startTransition] = useTransition();

    // Filters & Queries
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCashierId, setSelectedCashierId] = useState<string>("ALL");
    const [paymentModeGroup, setPaymentModeGroup] = useState<string>("ALL");
    const [minAmount, setMinAmount] = useState<string>("");
    const [maxAmount, setMaxAmount] = useState<string>("");
    const [fbrOnly, setFbrOnly] = useState<string>("ALL");

    // Metadata
    const [locations, setLocations] = useState<Location[]>([]);
    const [cashiers, setCashiers] = useState<User[]>([]);

    // Tree Expansion state (tracks labels/keys that are collapsed)
    const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

    // Report Hierarchy Configuration State
    const [groupingLevels, setGroupingLevels] = useState({
        brand: true,
        division: true,
        category: true,
        gender: true,
        silhouette: true,
        article: true,
        variant: true,
        invoices: false,
    });

    const handleToggleLevel = (level: string, checked: boolean) => {
        setGroupingLevels(prev => ({
            ...prev,
            [level]: checked,
        }));
    };

    // Raw report data from backend
    const [rawReportData, setRawReportData] = useState<any[]>([]);

    // Background Exports
    const [xlsxJobId, setXlsxJobId] = useState<string | null>(null);
    const [xlsxExportState, setXlsxExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [xlsxExportProgress, setXlsxExportProgress] = useState<number>(0);

    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    // Fetch Locations on mount
    useEffect(() => {
        async function loadMetadata() {
            try {
                const locRes = await getLocations();
                if (locRes && locRes.status && Array.isArray(locRes.data)) {
                    setLocations(locRes.data);
                }
            } catch (err) {
                console.error("Failed to load locations:", err);
            }
        }
        loadMetadata();
    }, []);

    const locationOptions: MultiSelectOption[] = useMemo(() =>
        locations.map((loc) => ({ value: loc.id, label: loc.name, description: loc.code ? `Code: ${loc.code}` : undefined })),
        [locations]);

    const locationParam = useMemo(() =>
        selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined, [selectedLocationIds]);

    const activeSelectionNames = useMemo(() => {
        if (selectedLocationIds.length > 0) return locations.filter(l => selectedLocationIds.includes(l.id)).map(l => l.name).join(", ");
        return "All Outlets";
    }, [selectedLocationIds, locations]);

    // Query Data from API
    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;

        startTransition(async () => {
            const result = await getGrossSalesReturnReport({
                locationId: locationParam ?? "",
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrOnly === "YES" ? true : undefined,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
                showInvoices: groupingLevels.invoices,
            });

            if (result && result.status !== false) {
                setRawReportData(result.data || []);
                if (selectedCashierId === "ALL" && Array.isArray(result.cashiers)) {
                    setCashiers(result.cashiers);
                }
            } else {
                toast.error("Failed to load Gross Sales Return report");
            }
        });
    }, [
        locationParam,
        dateRange,
        searchQuery,
        selectedCashierId,
        paymentModeGroup,
        minAmount,
        maxAmount,
        fbrOnly,
        groupingLevels,
    ]);

    useEffect(() => {
        fetchReport();
    }, [
        locationParam,
        dateRange,
        selectedCashierId,
        paymentModeGroup,
        fbrOnly,
        groupingLevels,
        fetchReport,
    ]);

    // Build hierarchical filtered/expanded row list client-side
    // This allows collapse/expansion of nodes dynamically!
    const flatRows = useMemo(() => {
        const result: any[] = [];
        let skipUntilDepth = 99;

        for (const row of rawReportData) {
            // If we are currently skipping children of a collapsed parent node
            if (row.depth > skipUntilDepth) {
                continue;
            } else {
                skipUntilDepth = 99; // reset
            }

            // Determine if parent node is collapsed
            const nodeKey = `${row.type}-${row.label}-${row.depth}`;
            const isCollapsed = collapsedNodes[nodeKey];

            result.push({
                ...row,
                isCollapsed,
            });

            if (isCollapsed) {
                skipUntilDepth = row.depth;
            }
        }
        return result;
    }, [rawReportData, collapsedNodes]);

    // Calculate dynamic grand totals of visible items
    const grandTotals = useMemo(() => {
        const totals = {
            qty: 0,
            totalPriceWost: 0,
            discountAmount: 0,
            excludingSalesTax: 0,
            salesTaxAmount: 0,
            totalTax: 0,
            includingSalesTax: 0,
            invoicesCount: 0,
        };

        const uniqueInvoices = new Set<string>();

        // Calculate only from the raw leaf rows to prevent double-counting groups
        for (const r of rawReportData) {
            if (r.depth === 1) {
                totals.qty += r.qty || 0;
                totals.totalPriceWost += r.totalPriceWost || 0;
                totals.discountAmount += r.discountAmount || 0;
                totals.excludingSalesTax += r.excludingSalesTax || 0;
                totals.salesTaxAmount += r.salesTaxAmount || 0;
                totals.totalTax += r.totalTax || 0;
                totals.includingSalesTax += r.includingSalesTax || 0;
            }
            if (r.invoiceNo) {
                uniqueInvoices.add(r.invoiceNo);
            }
        }
        totals.invoicesCount = uniqueInvoices.size;
        return totals;
    }, [rawReportData]);

    const toggleNode = (type: string, label: string, depth: number) => {
        const nodeKey = `${type}-${label}-${depth}`;
        setCollapsedNodes(prev => ({
            ...prev,
            [nodeKey]: !prev[nodeKey],
        }));
    };

    // Virtualization scroll container
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: flatRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const r = flatRows[index];
            if (r.type === "variant" || r.type === "invoice") return 36;
            return 40;
        },
        overscan: 25,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;

    // Background XLSX Export Queue
    const handleQueueXlsxExport = async () => {
        setXlsxExportState("queueing");
        setXlsxExportProgress(0);

        try {
            const res = await queueGrossSalesReturnReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrOnly === "YES" ? true : undefined,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
                showInvoices: groupingLevels.invoices,
                format: "xlsx",
            });

            if (res && res.status && res.data?.jobId) {
                setXlsxJobId(res.data.jobId);
                setXlsxExportState("processing");
                toast.success("Gross Sales Returns XLSX compilation queued!");
            } else {
                setXlsxExportState("failed");
                toast.error(res?.message || "Failed to queue export");
            }
        } catch (err) {
            setXlsxExportState("failed");
            toast.error("An error occurred starting the export");
        }
    };

    // Background PDF Export Queue
    const handleQueuePdfExport = async () => {
        setPdfExportState("queueing");
        setPdfExportProgress(0);

        try {
            const res = await queueGrossSalesReturnReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrOnly === "YES" ? true : undefined,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
                showInvoices: groupingLevels.invoices,
                format: "pdf",
            });

            if (res && res.status && res.data?.jobId) {
                setPdfJobId(res.data.jobId);
                setPdfExportState("processing");
                toast.success("Sales Return PDF printing queued!");
            } else {
                setPdfExportState("failed");
                toast.error(res?.message || "Failed to queue export");
            }
        } catch (err) {
            setPdfExportState("failed");
            toast.error("An error occurred starting the export");
        }
    };

    // Poll status for XLSX export
    useEffect(() => {
        if (!xlsxJobId || xlsxExportState !== "processing") return;
        const interval = setInterval(async () => {
            const res = await getGrossSalesExportStatus(xlsxJobId);
            if (res && res.status) {
                const { state, progress } = res.data;
                setXlsxExportProgress(progress || 0);
                if (state === "completed") {
                    setXlsxExportState("completed");
                    setXlsxJobId(null);
                    clearInterval(interval);
                    toast.success("Sales Return XLSX Export Ready!");
                    window.open(`/api/pos-sales/reports/gross-sales-export/${xlsxJobId}/download`, "_blank");
                } else if (state === "failed") {
                    setXlsxExportState("failed");
                    setXlsxJobId(null);
                    clearInterval(interval);
                    toast.error("Sales Return XLSX Export failed on compiler");
                }
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [xlsxJobId, xlsxExportState]);

    // Poll status for PDF export
    useEffect(() => {
        if (!pdfJobId || pdfExportState !== "processing") return;
        const interval = setInterval(async () => {
            const res = await getGrossSalesExportStatus(pdfJobId);
            if (res && res.status) {
                const { state, progress } = res.data;
                setPdfExportProgress(progress || 0);
                if (state === "completed") {
                    setPdfExportState("completed");
                    setPdfJobId(null);
                    clearInterval(interval);
                    toast.success("Sales Return PDF Export Ready!");
                    window.open(`/api/pos-sales/reports/gross-sales-export/${pdfJobId}/download`, "_blank");
                } else if (state === "failed") {
                    setPdfExportState("failed");
                    setPdfJobId(null);
                    clearInterval(interval);
                    toast.error("Sales Return PDF compilation failed");
                }
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [pdfJobId, pdfExportState]);

    // Formatting utilities
    const formatVal = (val: number) => {
        if (val === 0 || val === undefined) return "-";
        return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const formatPriceVal = (val: number) => {
        if (val === 0 || val === undefined) return "-";
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Page Header */}
            <div className="flex items-center justify-between space-y-2 no-print">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-950 to-red-700 dark:from-white dark:to-red-400 bg-clip-text text-transparent">
                        Gross Sales Return Report (ERP)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Outlets: <span className="font-semibold text-foreground">{activeSelectionNames}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        id="btn-export-xlsx-return"
                        variant="outline"
                        size="sm"
                        disabled={isPending || xlsxExportState === "queueing" || xlsxExportState === "processing"}
                        onClick={handleQueueXlsxExport}
                        className="h-10 text-xs font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center gap-2"
                    >
                        {xlsxExportState === "processing" ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                <span>Generating {xlsxExportProgress}%</span>
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                <span>Export Excel</span>
                            </>
                        )}
                    </Button>

                    <Button
                        id="btn-export-pdf-return"
                        variant="outline"
                        size="sm"
                        disabled={isPending || pdfExportState === "queueing" || pdfExportState === "processing"}
                        onClick={handleQueuePdfExport}
                        className="h-10 text-xs font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center gap-2"
                    >
                        {pdfExportState === "processing" ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                <span>Generating {pdfExportProgress}%</span>
                            </>
                        ) : (
                            <>
                                <FileText className="h-4 w-4 text-red-500" />
                                <span>Export PDF</span>
                            </>
                        )}
                    </Button>

                    <Button
                        id="btn-print-report-return"
                        onClick={() => window.print()}
                        className="h-10 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-95 flex items-center gap-2"
                    >
                        <span>Print Preview</span>
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Gross Sales Return Report (ERP)</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Outlets: {activeSelectionNames}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : ""} - {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : ""}
                </p>
            </div>

            {/* Advanced Filters Row */}
            <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Outlets Multi-Select */}
                    <div className="flex flex-col gap-1.5 min-w-[280px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
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
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Return Period
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

                    {/* Cashier filter */}
                    <div className="flex flex-col gap-1.5 min-w-[160px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <UserCircle className="h-3.5 w-3.5 text-primary" />
                            Salesperson
                        </span>
                        <Select value={selectedCashierId} onValueChange={setSelectedCashierId}>
                            <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                <SelectValue placeholder="All Staff" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs">All Salespersons</SelectItem>
                                {cashiers.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                        {c.firstName} {c.lastName} ({c.employeeId || "Staff"})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Mode */}
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                            Payment Method
                        </span>
                        <Select value={paymentModeGroup} onValueChange={setPaymentModeGroup}>
                            <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                <SelectValue placeholder="All Modes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs">All Methods</SelectItem>
                                <SelectItem value="cash" className="text-xs">Cash Transactions</SelectItem>
                                <SelectItem value="card" className="text-xs">Credit/Debit Card</SelectItem>
                                <SelectItem value="credit" className="text-xs">Credit Account</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* FBR Sync Status */}
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Percent className="h-3.5 w-3.5 text-primary" />
                            FBR Sync Only
                        </span>
                        <Select value={fbrOnly} onValueChange={setFbrOnly}>
                            <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                <SelectValue placeholder="All Invoices" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs">All Orders</SelectItem>
                                <SelectItem value="YES" className="text-xs">FBR Synced Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t pt-4 border-slate-200/60 dark:border-slate-800/60">
                    {/* Live Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by Return/Claim number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-9 text-xs bg-background border-slate-200 focus-visible:ring-primary"
                        />
                    </div>

                    {/* Amount Filters */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Net Amount:</span>
                        <Input
                            type="number"
                            placeholder="Min Price"
                            value={minAmount}
                            onChange={(e) => setMinAmount(e.target.value)}
                            className="h-10 w-24 text-xs bg-background border-slate-200"
                        />
                        <span className="text-muted-foreground text-xs font-semibold">to</span>
                        <Input
                            type="number"
                            placeholder="Max Price"
                            value={maxAmount}
                            onChange={(e) => setMaxAmount(e.target.value)}
                            className="h-10 w-24 text-xs bg-background border-slate-200"
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedCashierId("ALL");
                            setPaymentModeGroup("ALL");
                            setMinAmount("");
                            setMaxAmount("");
                            setFbrOnly("ALL");
                            setGroupingLevels({
                                brand: true,
                                division: true,
                                category: true,
                                gender: true,
                                silhouette: true,
                                article: true,
                                variant: true,
                                invoices: false,
                            });
                            toast.info("Filters cleared");
                        }}
                        className="text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        Reset Filters
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

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-4 pt-2">
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
                            <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
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
                            Variant (Sizes)
                        </label>
                    </div>

                    {/* Invoices */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-invoices"
                            checked={groupingLevels.invoices}
                            onChange={(e) => handleToggleLevel('invoices', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-invoices" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-violet-500" />
                            Invoice Details
                        </label>
                    </div>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Return Records</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                                {formatVal(grandTotals.invoicesCount)}
                            </h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <ShoppingBag className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Qty Returned</p>
                            <h3 className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">
                                {formatVal(grandTotals.qty)}
                            </h3>
                        </div>
                        <div className="rounded-lg p-2 bg-red-50 dark:bg-red-950/20 text-red-600">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Price WOST</p>
                            <h3 className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                                {formatPriceVal(grandTotals.totalPriceWost)}
                            </h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Discount</p>
                            <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-500">
                                {formatPriceVal(grandTotals.discountAmount)}
                            </h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                            <Tag className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Returned Value</p>
                            <h3 className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">
                                {formatPriceVal(grandTotals.includingSalesTax)}
                            </h3>
                        </div>
                        <div className="rounded-lg p-2 bg-red-50 dark:bg-red-950/20 text-red-600">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Virtualized Hierarchical Table */}
            <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[1600px]">
                    <thead>
                        <tr className="bg-slate-900 text-slate-100 border-b text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <th className="p-3 w-[340px] border-r bg-slate-900 text-slate-100">GPC / Category / Product</th>
                            <th className="p-3 w-[80px] border-r text-center bg-slate-900 text-slate-100">Size</th>
                            <th className="p-3 w-[100px] border-r text-center bg-slate-900 text-slate-100">Color</th>
                            <th className="p-3 w-[70px] border-r text-right bg-slate-900 text-slate-100">Qty</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-900 text-slate-100">Retail Price</th>
                            <th className="p-3 w-[120px] border-r text-right bg-slate-900 text-slate-100">Total Price WOST</th>
                            <th className="p-3 w-[120px] border-r text-right bg-slate-900 text-slate-100">Discount Amount</th>
                            <th className="p-3 w-[120px] border-r text-right bg-slate-800 text-white font-extrabold">Excluding Tax</th>
                            <th className="p-3 w-[80px] border-r text-center bg-slate-900 text-slate-100">Sales Tax %</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-900 text-slate-100">Sales Tax</th>
                            <th className="p-3 w-[100px] border-r text-right bg-slate-900 text-slate-100">Total Tax</th>
                            <th className="p-3 w-[130px] border-r text-right bg-slate-800 text-red-300 font-extrabold">Including Tax</th>
                            <th className="p-3 w-[150px] bg-slate-900 text-slate-100">Sales Person</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {isPending ? (
                            <tr>
                                <td colSpan={13} className="p-8 text-center text-muted-foreground font-medium">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Compiling Sales Return hierarchical nodes...
                                    </div>
                                </td>
                            </tr>
                        ) : flatRows.length === 0 ? (
                            <tr>
                                <td colSpan={13} className="p-8 text-center text-muted-foreground font-medium">
                                    No return records found matching search or period filters.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={14} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const row = flatRows[virtualRow.index];
                                    const isGroup = row.type !== "variant" && row.type !== "invoice";

                                    const LEVEL_UI_STYLES: Record<string, { className: string; indentClass: string }> = {
                                        brand: { className: "bg-slate-900 text-white font-black border-b h-[40px] sticky left-0 z-2", indentClass: "pl-3 text-white uppercase tracking-wider" },
                                        division: { className: "bg-slate-800 text-white font-extrabold border-b h-[40px] sticky left-0 z-2", indentClass: "pl-6 text-white" },
                                        gender: { className: "bg-slate-700 text-white font-bold border-b h-[40px]", indentClass: "pl-9 text-white" },
                                        silhouette: { className: "bg-slate-600 text-slate-100 font-semibold border-b h-[40px]", indentClass: "pl-12 text-slate-100" },
                                        product: { className: "bg-slate-100 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 font-bold border-b h-[42px]", indentClass: "pl-16 font-semibold" },
                                        variant: { className: "hover:bg-slate-50 dark:hover:bg-slate-900/35 text-slate-600 dark:text-slate-400 bg-background transition-colors h-[36px]", indentClass: "pl-20 font-mono text-[11px]" },
                                        invoice: { className: "hover:bg-slate-100/20 dark:hover:bg-slate-900/20 text-slate-500 dark:text-slate-500 bg-background transition-colors h-[34px] border-b border-dotted", indentClass: "pl-24 font-mono text-[10px] text-muted-foreground" },
                                    };

                                    const styles = LEVEL_UI_STYLES[row.type] || LEVEL_UI_STYLES.variant;

                                    return (
                                        <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className={cn("align-middle", styles.className)}>
                                            {/* GPC / Label */}
                                            <td className={cn("p-2 border-r select-none", styles.indentClass)}>
                                                <div className="flex items-center gap-1.5">
                                                    {isGroup && (
                                                        <button
                                                            onClick={() => toggleNode(row.type, row.label, row.depth)}
                                                            className="p-0.5 hover:bg-slate-200/20 rounded transition-colors"
                                                        >
                                                            {row.isCollapsed ? (
                                                                <ChevronRight className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                    {row.type === "invoice" && (
                                                        <FileText className="h-3 w-3 text-muted-foreground/65 shrink-0" />
                                                    )}
                                                    <span>{row.label}</span>
                                                </div>
                                            </td>

                                            {/* Size */}
                                            <td className="p-2 border-r text-center font-semibold">
                                                {(row.type === "variant" || row.type === "invoice") ? row.size : "-"}
                                            </td>

                                            {/* Color */}
                                            <td className="p-2 border-r text-center">
                                                {(row.type === "variant" || row.type === "invoice") ? row.color : "-"}
                                            </td>

                                            {/* Qty */}
                                            <td className="p-2 border-r text-right font-bold text-slate-900 dark:text-slate-50">
                                                {formatVal(row.qty)}
                                            </td>

                                            {/* Retail Price */}
                                            <td className="p-2 border-r text-right">
                                                {(row.type === "variant" || row.type === "invoice") ? formatPriceVal(row.retailPrice) : "-"}
                                            </td>

                                            {/* Price WOST */}
                                            <td className="p-2 border-r text-right">
                                                {formatPriceVal(row.totalPriceWost)}
                                            </td>

                                            {/* Discount */}
                                            <td className="p-2 border-r text-right text-amber-600 dark:text-amber-500">
                                                {formatPriceVal(row.discountAmount)}
                                            </td>

                                            {/* Value Excluding Tax */}
                                            <td className="p-2 border-r text-right font-extrabold text-slate-900 dark:text-slate-50 bg-slate-100/50 dark:bg-slate-800/30">
                                                {formatPriceVal(row.excludingSalesTax)}
                                            </td>

                                            {/* Tax Rate % */}
                                            <td className="p-2 border-r text-center">
                                                {(row.type === "variant" || row.type === "invoice") && row.salesTaxPercent != null ? `${row.salesTaxPercent}%` : "-"}
                                            </td>

                                            {/* Tax Amt */}
                                            <td className="p-2 border-r text-right">
                                                {formatPriceVal(row.salesTaxAmount)}
                                            </td>


                                            {/* Total Tax */}
                                            <td className="p-2 border-r text-right">
                                                {formatPriceVal(row.totalTax)}
                                            </td>

                                            {/* Value Including Tax */}
                                            <td className="p-2 border-r text-right font-bold text-sky-700 dark:text-sky-400 bg-sky-50/20 dark:bg-sky-950/10">
                                                {formatPriceVal(row.includingSalesTax)}
                                            </td>

                                            {/* Sales Person */}
                                            <td className="p-2 font-semibold bg-slate-50/50 dark:bg-slate-900/30">
                                                {(row.type === "variant" || row.type === "invoice") ? row.salesPerson : ""}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={13} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Print Layout (Simple flat list when printing) */}
            <div className="hidden print:block">
                <table className="w-full text-[7px] border">
                    <thead>
                        <tr className="bg-slate-200 border-b">
                            <th className="p-1 border text-left">GPC / Category / Product</th>
                            <th className="p-1 border text-center">Size</th>
                            <th className="p-1 border text-center">Color</th>
                            <th className="p-1 border text-right">Qty</th>
                            <th className="p-1 border text-right">Retail</th>
                            <th className="p-1 border text-right">Total WOST</th>
                            <th className="p-1 border text-right">Discount</th>
                            <th className="p-1 border text-right">Excluding Tax</th>
                            <th className="p-1 border text-center">Tax %</th>
                            <th className="p-1 border text-right">Sales Tax</th>
                            <th className="p-1 border text-right">Including Tax</th>
                            <th className="p-1 border text-left">Salesperson</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rawReportData.map((row, idx) => {
                            const isGroup = row.type !== "variant";
                            return (
                                <tr key={idx} className={cn(isGroup ? "font-bold bg-slate-100" : "")}>
                                    <td className="p-1 border">{"  ".repeat(row.depth || 0) + row.label}</td>
                                    <td className="p-1 border text-center">{row.type === "variant" ? row.size : "-"}</td>
                                    <td className="p-1 border text-center">{row.type === "variant" ? row.color : "-"}</td>
                                    <td className="p-1 border text-right">{row.qty}</td>
                                    <td className="p-1 border text-right">{row.type === "variant" ? formatPriceVal(row.retailPrice) : "-"}</td>
                                    <td className="p-1 border text-right">{formatPriceVal(row.totalPriceWost)}</td>
                                    <td className="p-1 border text-right">{formatPriceVal(row.discountAmount)}</td>
                                    <td className="p-1 border text-right">{formatPriceVal(row.excludingSalesTax)}</td>
                                    <td className="p-1 border text-center">{row.type === "variant" ? `${row.salesTaxPercent}%` : "-"}</td>
                                    <td className="p-1 border text-right">{formatPriceVal(row.salesTaxAmount)}</td>
                                    <td className="p-1 border text-right">{formatPriceVal(row.includingSalesTax)}</td>
                                    <td className="p-1 border text-left">{row.type === "variant" ? row.salesPerson : ""}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
