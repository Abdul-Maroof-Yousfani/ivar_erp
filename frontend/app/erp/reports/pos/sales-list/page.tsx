"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getSalesListReport,
    queueSalesListReportExport,
    getSalesListReportExportStatus
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
    Printer,
    Loader2,
    Calendar,
    Store,
    RefreshCw,
    Search,
    X,
    Coins,
    CreditCard,
    FileText,
    Percent,
    SlidersHorizontal,
    Inbox,
    PlusCircle,
    ArrowDownRight,
    TrendingUp,
    UserCheck,
    Filter,
    DollarSign,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl, formatCurrency } from "@/lib/utils";

export default function ErpSalesListReportPage() {
    const { user } = useAuth();

    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    
    // Cashier/User state
    const [cashiers, setCashiers] = useState<User[]>([]);
    const [selectedCashierId, setSelectedCashierId] = useState<string>("ALL");

    // Payment Mode Group state
    const [paymentModeGroup, setPaymentModeGroup] = useState<string>("ALL");

    // Amount Range state
    const [minAmount, setMinAmount] = useState<string>("");
    const [maxAmount, setMaxAmount] = useState<string>("");

    // FBR Only state
    const [fbrFilter, setFbrFilter] = useState<string>("ALL");

    const [searchQuery, setSearchQuery] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [reportData, setReportData] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

    // Excel Export Queue States
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState<number>(0);

    // PDF Export Queue States
    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    // Fetch Locations
    useEffect(() => {
        async function loadMetadata() {
            try {
                const locRes = await getLocations();
                if (locRes && locRes.status && Array.isArray(locRes.data)) {
                    setLocations(locRes.data);
                }
            } catch (err) {
                console.error("Failed to load filter metadata:", err);
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

    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getSalesListReport({
                locationId: locationParam ?? "",
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrFilter === "YES" ? true : undefined,
            });
            if (result && result.status !== false) {
                setReportData(result.data || []);
                if (selectedCashierId === "ALL" && Array.isArray(result.cashiers)) {
                    setCashiers(result.cashiers);
                }
            } else {
                toast.error("Failed to load Sales List Report data");
            }
        });
    }, [locationParam, dateRange, searchQuery, selectedCashierId, paymentModeGroup, minAmount, maxAmount, fbrFilter]);

    useEffect(() => {
        fetchReport();
    }, [locationParam, selectedCashierId, paymentModeGroup, fbrFilter, dateRange]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getSalesListReportExportStatus(exportJobId);
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
                const res = await getSalesListReportExportStatus(pdfJobId);
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
        if (!dateRange.from || !dateRange.to) return;

        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/pos-sales/reports/sales-list/export/${exportJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        setExportState("queueing");
        try {
            const res = await queueSalesListReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "xlsx",
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrFilter === "YES" ? true : undefined,
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
        if (!dateRange.from || !dateRange.to) return;

        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/pos-sales/reports/sales-list/export/${pdfJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        setPdfExportState("queueing");
        try {
            const res = await queueSalesListReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "pdf",
                search: searchQuery.trim() || undefined,
                cashierUserId: selectedCashierId === "ALL" ? undefined : selectedCashierId,
                paymentModeGroup: paymentModeGroup === "ALL" ? undefined : paymentModeGroup,
                minAmount: minAmount.trim() ? Number(minAmount) : undefined,
                maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
                fbrOnly: fbrFilter === "YES" ? true : undefined,
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

    // Client side filtering for additional flexibility (search input)
    const filteredReportData = useMemo(() => {
        if (!searchQuery.trim()) return reportData;
        const query = searchQuery.toLowerCase().trim();

        return reportData.filter((r) => {
            return (
                (r.invoiceNo && r.invoiceNo.toLowerCase().includes(query)) ||
                (r.tenderDocuments && r.tenderDocuments.toLowerCase().includes(query))
            );
        });
    }, [reportData, searchQuery]);

    // Calculate Grand Totals based on filtered rows
    const grandTotals = useMemo(() => {
        const t = {
            count: 0,
            netTotal: 0,
            balance: 0,
            tenderCash: 0,
            tenderCard: 0,
            tenderRewardVoucher: 0,
            tenderOnCredit: 0,
            tenderGiftVoucher: 0,
            tenderCreditVoucher: 0,
            tenderExchangeVoucher: 0,
            tenderClaimVoucher: 0,
            tenderCorporateVoucher: 0,
            issuedGiftVoucher: 0,
            issuedCreditVoucher: 0,
            returnAmount: 0,
            fbr: 0,
            netSale: 0,
        };

        for (const r of filteredReportData) {
            t.count++;
            t.netTotal += r.netTotal || 0;
            t.balance += r.balance || 0;
            t.tenderCash += r.tenderCash || 0;
            t.tenderCard += r.tenderCard || 0;
            t.tenderRewardVoucher += r.tenderRewardVoucher || 0;
            t.tenderOnCredit += r.tenderOnCredit || 0;
            t.tenderGiftVoucher += r.tenderGiftVoucher || 0;
            t.tenderCreditVoucher += r.tenderCreditVoucher || 0;
            t.tenderExchangeVoucher += r.tenderExchangeVoucher || 0;
            t.tenderClaimVoucher += r.tenderClaimVoucher || 0;
            t.tenderCorporateVoucher += r.tenderCorporateVoucher || 0;
            t.issuedGiftVoucher += r.issuedGiftVoucher || 0;
            t.issuedCreditVoucher += r.issuedCreditVoucher || 0;
            t.returnAmount += r.returnAmount || 0;
            t.fbr += r.fbr || 0;
            t.netSale += r.netSale || 0;
        }

        return t;
    }, [filteredReportData]);

    // Virtual list setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredReportData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 38,
        overscan: 15,
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
    const formatFbr = (val: number) => val === 0 ? "-" : val.toLocaleString();

    const handleClearFilters = () => {
        setSelectedCashierId("ALL");
        setPaymentModeGroup("ALL");
        setMinAmount("");
        setMaxAmount("");
        setFbrFilter("ALL");
        setSearchQuery("");
        toast.info("Filters cleared successfully.");
    };

    const hasActiveFilters = 
        selectedCashierId !== "ALL" ||
        paymentModeGroup !== "ALL" ||
        minAmount.trim() !== "" ||
        maxAmount.trim() !== "" ||
        fbrFilter !== "ALL" ||
        searchQuery.trim() !== "";

    return (
        <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Sales List Report (ERP)
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        Outlets: <span className="text-foreground font-semibold ml-1">{activeSelectionNames}</span>
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
                <h1 className="text-2xl font-bold text-center text-slate-900">Sales List Report (ERP)</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Outlets: {activeSelectionNames}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : ""} - {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : ""}
                </p>
            </div>

            {/* Filters Row */}
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

                    {/* Date period picker */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Period Range
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

                    {/* Cashier Selector */}
                    <div className="flex flex-col gap-1.5 min-w-[180px] flex-1 md:flex-none">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                            Cashier / Operator
                        </span>
                        <Select
                            value={selectedCashierId}
                            onValueChange={(val) => setSelectedCashierId(val)}
                        >
                            <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                <SelectValue placeholder="All Cashiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Cashiers & Operators</SelectItem>
                                {cashiers.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.firstName} {c.lastName} ({c.email || c.employeeId})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Mode Selector */}
                    <div className="flex flex-col gap-1.5 min-w-[180px] flex-1 md:flex-none">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Filter className="h-3.5 w-3.5 text-primary" />
                            Payment Method
                        </span>
                        <Select
                            value={paymentModeGroup}
                            onValueChange={(val) => setPaymentModeGroup(val)}
                        >
                            <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                <SelectValue placeholder="All Payment Modes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Payment Methods</SelectItem>
                                <SelectItem value="cash">Cash Collections Only</SelectItem>
                                <SelectItem value="card">Card Payments Only</SelectItem>
                                <SelectItem value="credit">On Credit Account Only</SelectItem>
                                <SelectItem value="voucher">Voucher Redemptions Only</SelectItem>
                                <SelectItem value="return">Refunds & Returns Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Advanced filter toggle */}
                    <Button
                        variant="outline"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={cn(
                            "h-10 px-4 text-xs font-bold gap-1.5 border-dashed transition-all",
                            showAdvanced && "bg-slate-100 dark:bg-slate-800 text-primary border-solid"
                        )}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {showAdvanced ? "Hide Advanced" : "Advanced Filters"}
                    </Button>

                    <div className="flex gap-2 ml-auto">
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                onClick={handleClearFilters}
                                className="h-10 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </Button>
                        )}
                        <Button
                            onClick={fetchReport}
                            disabled={isPending}
                            className="h-10 px-5 text-xs font-bold gap-1.5"
                        >
                            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                            Apply
                        </Button>
                    </div>
                </div>

                {/* Expandable Advanced Filters Drawer */}
                {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Search Input */}
                        <div className="flex flex-col gap-1.5 flex-1 col-span-1 md:col-span-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                                <Search className="h-3.5 w-3.5 text-primary" />
                                Custom Search
                            </span>
                            <div className="relative">
                                <Input
                                    placeholder="Filter list by Invoice #, AUTH ID, Card digits..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10 pl-9 text-xs bg-background border-slate-200"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        {/* Amount Range Filter */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                                <DollarSign className="h-3.5 w-3.5 text-primary" />
                                Total Net Amount Range
                            </span>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    placeholder="Min PKR"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                    className="h-10 text-xs bg-background border-slate-200 flex-1"
                                />
                                <span className="text-muted-foreground text-xs font-bold">-</span>
                                <Input
                                    type="number"
                                    placeholder="Max PKR"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                    className="h-10 text-xs bg-background border-slate-200 flex-1"
                                />
                            </div>
                        </div>

                        {/* FBR Filter */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                FBR Invoice Integration
                            </span>
                            <Select
                                value={fbrFilter}
                                onValueChange={(val) => setFbrFilter(val)}
                            >
                                <SelectTrigger className="h-10 text-xs font-semibold bg-background border-slate-200">
                                    <SelectValue placeholder="All Invoices" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Invoices</SelectItem>
                                    <SelectItem value="YES">Integrated with FBR Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Invoices</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{grandTotals.count}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600">
                            <FileText className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Sales (Net)</p>
                            <h3 className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{formatCurrency(grandTotals.netTotal)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Cash Collections</p>
                            <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotals.tenderCash)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Card Payments</p>
                            <h3 className="text-xl font-bold mt-1 text-sky-600 dark:text-sky-400">{formatCurrency(grandTotals.tenderCard)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-sky-50 dark:bg-sky-950/20 text-sky-600">
                            <CreditCard className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">On Credit Account</p>
                            <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-500">{formatCurrency(grandTotals.tenderOnCredit)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                            <SlidersHorizontal className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Issued Vouchers</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatCurrency(grandTotals.issuedGiftVoucher + grandTotals.issuedCreditVoucher)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                            <PlusCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Virtualized Scrolling Table */}
            <div ref={parentRef} className="overflow-auto max-h-[650px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[2100px]">
                    <thead>
                        {/* Upper Group Headers */}
                        <tr className="bg-[#0f172a] text-slate-100 text-[10px] font-black uppercase text-center border-b border-slate-800 sticky top-0 z-10">
                            <th colSpan={4} className="p-2.5 border-r border-slate-800 bg-[#0f172a] text-white">Sale</th>
                            <th colSpan={9} className="p-2.5 border-r border-slate-800 bg-[#0f172a] text-indigo-200">Tender</th>
                            <th colSpan={2} className="p-2.5 border-r border-slate-800 bg-[#0f172a] text-rose-200">Issued</th>
                            <th colSpan={4} className="p-2.5 bg-[#0f172a]">&nbsp;</th>
                        </tr>
                        {/* Lower Column Headers */}
                        <tr className="bg-[#1e293b] text-slate-200 text-[9px] uppercase font-bold sticky top-[33px] z-10 shadow-xs border-b border-slate-700">
                            <th className="p-2.5 w-[160px] border-r border-slate-700 text-center">Date & Time</th>
                            <th className="p-2.5 w-[110px] border-r border-slate-700">Invoice #</th>
                            <th className="p-2.5 w-[110px] border-r border-slate-700 text-right bg-[#0f172a] text-white font-extrabold">NetTotal</th>
                            <th className="p-2.5 w-[110px] border-r border-slate-700 text-right text-amber-300">Balance</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Cash</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Card</th>
                            <th className="p-2.5 w-[110px] border-r border-slate-700 text-right">Reward Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">On Credit</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Gift Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Credit Voucher</th>
                            <th className="p-2.5 w-[115px] border-r border-slate-700 text-right">Exchange Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Claim Voucher</th>
                            <th className="p-2.5 w-[115px] border-r border-slate-700 text-right">Corporate Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right text-rose-300">Gift Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right text-rose-300">Credit Voucher</th>
                            <th className="p-2.5 w-[100px] border-r border-slate-700 text-right">Return</th>
                            <th className="p-2.5 w-[65px] border-r border-slate-700 text-center">FBR</th>
                            <th className="p-2.5 w-[110px] border-r border-slate-700 text-right bg-[#0f172a] text-emerald-300 font-extrabold">Net Sale</th>
                            <th className="p-2.5 w-[220px] text-left">Tender Documents</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {isPending ? (
                            <tr>
                                <td colSpan={19} className="p-8 text-center text-muted-foreground font-medium bg-slate-50/50">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Fetching sales records and parsing tender documents...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredReportData.length === 0 ? (
                            <tr>
                                <td colSpan={19} className="p-8 text-center text-muted-foreground font-medium">
                                    No transaction records found matching the filters.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={19} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const r = filteredReportData[virtualRow.index];
                                    const isReturn = r.returnAmount !== 0;

                                    return (
                                        <tr
                                            key={virtualRow.key}
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            className={cn(
                                                "h-[38px] hover:bg-slate-50/50 transition-colors font-medium text-slate-700 dark:text-slate-300",
                                                isReturn && "bg-rose-50/40 dark:bg-rose-950/15 text-rose-800 dark:text-rose-400"
                                            )}
                                        >
                                            <td className="p-2.5 border-r text-center font-normal">{new Date(r.date).toLocaleString()}</td>
                                            <td className="p-2.5 border-r font-bold text-slate-800 dark:text-slate-100">{r.invoiceNo}</td>
                                            <td className="p-2.5 border-r text-right bg-slate-500/5 font-bold text-slate-900 dark:text-white">{formatVal(r.netTotal)}</td>
                                            <td className="p-2.5 border-r text-right text-amber-600 font-semibold">{formatVal(r.balance)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderCash)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderCard)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderRewardVoucher)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderOnCredit)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderGiftVoucher)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderCreditVoucher)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderExchangeVoucher)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderClaimVoucher)}</td>
                                            <td className="p-2.5 border-r text-right">{formatVal(r.tenderCorporateVoucher)}</td>
                                            <td className="p-2.5 border-r text-right text-rose-600 dark:text-rose-450">{formatVal(r.issuedGiftVoucher)}</td>
                                            <td className="p-2.5 border-r text-right text-rose-600 dark:text-rose-450">{formatVal(r.issuedCreditVoucher)}</td>
                                            <td className="p-2.5 border-r text-right font-semibold">{formatVal(r.returnAmount)}</td>
                                            <td className="p-2.5 border-r text-center">{formatFbr(r.fbr)}</td>
                                            <td className="p-2.5 border-r text-right bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">{formatVal(r.netSale)}</td>
                                            <td className="p-2.5 font-mono text-[10px] text-slate-600 dark:text-slate-400 select-all truncate max-w-[200px]" title={r.tenderDocuments}>
                                                {r.tenderDocuments || "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={19} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* GRAND TOTALS ROW */}
                    {filteredReportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 shadow-md">
                            <tr className="bg-[#1e293b] text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                                <td colSpan={2} className="p-3 border-r text-left uppercase tracking-wider font-black bg-[#1e293b]">
                                    GRAND TOTALS
                                </td>
                                <td className="p-3 border-r text-right font-black bg-[#0f172a] text-white">{formatVal(grandTotals.netTotal)}</td>
                                <td className="p-3 border-r text-right font-black bg-[#1e293b] text-amber-300">{formatVal(grandTotals.balance)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderCash)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderCard)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderRewardVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderOnCredit)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderGiftVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderCreditVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderExchangeVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderClaimVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-white">{formatVal(grandTotals.tenderCorporateVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-rose-300">{formatVal(grandTotals.issuedGiftVoucher)}</td>
                                <td className="p-3 border-r text-right font-bold bg-[#1e293b] text-rose-300">{formatVal(grandTotals.issuedCreditVoucher)}</td>
                                <td className="p-3 border-r text-right font-black bg-[#1e293b] text-white">{formatVal(grandTotals.returnAmount)}</td>
                                <td className="p-3 border-r text-center font-bold bg-[#1e293b] text-white">{formatFbr(grandTotals.fbr)}</td>
                                <td className="p-3 border-r text-right font-black bg-[#0f172a] text-[#4ade80]">{formatVal(grandTotals.netSale)}</td>
                                <td className="p-3 bg-[#1e293b]">&nbsp;</td>
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

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
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
                        padding: 5px 3px !important;
                        font-size: 7px !important;
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
