"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getSalesRegisterReport,
    queueSalesRegisterReportExport,
    getSalesRegisterReportExportStatus,
    getSalespersons
} from "@/lib/actions/pos-sales";
import { getLocations, Location } from "@/lib/actions/location";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
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
    Search,
    Store,
    Layers,
    Inbox,
    RefreshCw,
    Folder,
    Users,
    CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

export default function ErpSalesRegisterReportPage() {
    const { user } = useAuth();

    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

    const locationParam = useMemo(() =>
        selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined, [selectedLocationIds]);

    const activeSelectionNames = useMemo(() => {
        if (selectedLocationIds.length > 0) return locations.filter(l => selectedLocationIds.includes(l.id)).map(l => l.name).join(", ");
        return "All Outlets";
    }, [selectedLocationIds, locations]);

    const locationOptions: MultiSelectOption[] = useMemo(() =>
        locations.map((loc) => ({ value: loc.id, label: loc.name, description: loc.code ? `Code: ${loc.code}` : undefined })),
        [locations]);

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [cashierUserId, setCashierUserId] = useState<string>("all");
    const [cashierList, setCashierList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

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

    // Fetch locations on mount
    useEffect(() => {
        getLocations().then((data: any) => {
            if (Array.isArray(data)) setLocations(data);
            else if (data?.status && Array.isArray(data?.data)) setLocations(data.data);
        }).catch(console.error);
    }, []);

    // Fetch cashiers when location selection changes
    useEffect(() => {
        async function fetchCashiers() {
            try {
                const res = await getSalespersons(locationParam || "");
                if (res && res.status && Array.isArray(res.data)) setCashierList(res.data);
            } catch (err) { console.error("Error fetching cashiers:", err); }
        }
        fetchCashiers();
    }, [locationParam]);

    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getSalesRegisterReport({
                locationId: locationParam ?? "",
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                search: searchQuery.trim() || undefined,
            });
            if (result && result.status !== false) {
                setReportData(result.data || []);
            } else {
                toast.error("Failed to load report data");
            }
        });
    }, [locationParam, dateRange, cashierUserId, searchQuery]);

    useEffect(() => {
        fetchReport();
    }, [locationParam, cashierUserId, dateRange]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getSalesRegisterReportExportStatus(exportJobId);
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
                const res = await getSalesRegisterReportExportStatus(pdfJobId);
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
            setDownloadingFile("Excel Sheet");
            try {
                const downloadUrl = `${getApiBaseUrl()}/pos-sales/reports/sales-register/export/${exportJobId}/download`;
                window.open(downloadUrl, "_blank");
                setDownloadingFile(null);
            } catch (err) {
                toast.error("Failed to trigger file download");
                setDownloadingFile(null);
            }
            return;
        }

        setExportState("queueing");
        setExportProgress(0);
        try {
            const res = await queueSalesRegisterReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                format: "xlsx",
                search: searchQuery.trim() || undefined,
            });

            if (res && res.status && res.data?.jobId) {
                setExportJobId(res.data.jobId);
                setExportState("processing");
                toast.info("Excel export added to server queue. Processing in background...");
            } else {
                setExportState("failed");
                toast.error(res?.message || "Failed to queue background Excel export");
            }
        } catch (err) {
            setExportState("failed");
            toast.error("An error occurred while queueing Excel export");
        }
    };

    const handleExportPdfClick = async () => {
        if (!dateRange.from || !dateRange.to) return;

        if (pdfExportState === "completed" && pdfJobId) {
            setDownloadingFile("PDF Document");
            try {
                const downloadUrl = `${getApiBaseUrl()}/pos-sales/reports/sales-register/export/${pdfJobId}/download`;
                window.open(downloadUrl, "_blank");
                setDownloadingFile(null);
            } catch (err) {
                toast.error("Failed to trigger PDF download");
                setDownloadingFile(null);
            }
            return;
        }

        setPdfExportState("queueing");
        setPdfExportProgress(0);
        try {
            const res = await queueSalesRegisterReportExport({
                locationId: locationParam ?? "",
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierUserId === "all" ? undefined : cashierUserId,
                format: "pdf",
                search: searchQuery.trim() || undefined,
            });

            if (res && res.status && res.data?.jobId) {
                setPdfJobId(res.data.jobId);
                setPdfExportState("processing");
                toast.info("PDF document generation queued. Generating pages headlessly...");
            } else {
                setPdfExportState("failed");
                toast.error(res?.message || "Failed to queue PDF generation");
            }
        } catch (err) {
            setPdfExportState("failed");
            toast.error("An error occurred while queueing PDF generation");
        }
    };

    const formatVal = (val: number) => {
        if (val === 0 || val === null || val === undefined) return "-";
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatQty = (val: number) => {
        if (val === 0 || val === null || val === undefined) return "-";
        return val.toString();
    };

    // Calculate Grand Totals and KPIs
    const grandTotals = useMemo(() => {
        let count = 0;
        let grossSale = 0;
        let grossSaleWost = 0;
        let disc = 0;
        let sTax = 0;
        let netSale = 0;
        let cash = 0;
        let postex = 0;
        let leopard = 0;
        let cardAmount = 0;
        let giftVoucherAmt = 0;
        let creditAmt = 0;
        let claimAmt = 0;
        let corporateAmt = 0;
        let exchangeAmt = 0;
        let manualDiscAmt = 0;

        reportData.forEach((row) => {
            count++;
            grossSale += Number(row.grossSale || 0);
            grossSaleWost += Number(row.grossSaleWost || 0);
            disc += Number(row.disc || 0);
            sTax += Number(row.sTax || 0);
            netSale += Number(row.netSale || 0);
            cash += Number(row.cash || 0);
            postex += Number(row.postex || 0);
            leopard += Number(row.leopard || 0);
            cardAmount += Number(row.cardAmount || 0);
            giftVoucherAmt += Number(row.giftVoucherAmt || 0);
            creditAmt += Number(row.creditAmt || 0);
            claimAmt += Number(row.claimAmt || 0);
            corporateAmt += Number(row.corporateAmt || 0);
            exchangeAmt += Number(row.exchangeAmt || 0);
            manualDiscAmt += Number(row.manualDiscAmt || 0);
        });

        return {
            count,
            grossSale,
            grossSaleWost,
            disc,
            sTax,
            netSale,
            cash,
            postex,
            leopard,
            cardAmount,
            giftVoucherAmt,
            creditAmt,
            claimAmt,
            corporateAmt,
            exchangeAmt,
            manualDiscAmt
        };
    }, [reportData]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: reportData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 44,
        overscan: 15,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

    return (
        <div className="space-y-6 p-1 sm:p-6 max-w-[1600px] mx-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Store className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Sales Register Report (ERP)
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Outlets: <span className="font-semibold text-foreground">{activeSelectionNames}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 no-print">
                    <Button
                        variant={exportState === "completed" ? "default" : "outline"}
                        size="sm"
                        onClick={handleExportExcelClick}
                        disabled={exportState === "queueing" || exportState === "processing"}
                        className={cn(
                            "h-9 font-bold text-xs gap-1.5 transition-all shadow-xs",
                            exportState === "completed" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                    >
                        {exportState === "queueing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {exportState === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {exportState === "idle" && <Download className="h-3.5 w-3.5" />}
                        {exportState === "queueing" && "Queueing..."}
                        {exportState === "processing" && `Generating ${exportProgress}%`}
                        {exportState === "completed" && "Download Excel"}
                        {exportState === "failed" && "Retry Excel Export"}
                        {exportState === "idle" && "Export Excel"}
                    </Button>

                    <Button
                        variant={pdfExportState === "completed" ? "default" : "outline"}
                        size="sm"
                        onClick={handleExportPdfClick}
                        disabled={pdfExportState === "queueing" || pdfExportState === "processing"}
                        className={cn(
                            "h-9 font-bold text-xs gap-1.5 transition-all shadow-xs",
                            pdfExportState === "completed" && "bg-rose-600 hover:bg-rose-700 text-white"
                        )}
                    >
                        {pdfExportState === "queueing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {pdfExportState === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {pdfExportState === "idle" && <Printer className="h-3.5 w-3.5" />}
                        {pdfExportState === "queueing" && "Queueing..."}
                        {pdfExportState === "processing" && `Generating ${pdfExportProgress}%`}
                        {pdfExportState === "completed" && "Download PDF"}
                        {pdfExportState === "failed" && "Retry PDF Export"}
                        {pdfExportState === "idle" && "Export PDF"}
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
                <h2 className="text-xl font-bold uppercase">{COMPANY_NAME}</h2>
                <h3 className="text-md font-semibold text-slate-700">Sales Register Report</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Outlets: {activeSelectionNames} | 
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
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
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Period:
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

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Search className="h-3.5 w-3.5" />
                            CM #:
                        </span>
                        <input
                            type="text"
                            placeholder="Search Order Number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-background border rounded px-2.5 py-1.5 text-xs font-medium focus:ring-primary focus:border-primary outline-none max-w-[200px]"
                        />
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
                    <span>{COMPANY_NAME} &bull; Sales Register</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Memos</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatQty(grandTotals.count)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Gross Sale</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatVal(grandTotals.grossSale)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Discount</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-455">{formatVal(grandTotals.disc)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-955/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Sales (Incl. Tax)</p>
                            <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatVal(grandTotals.netSale)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Virtualized Scrolling Table */}
            <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[2200px]">
                    <thead>
                        <tr className="bg-slate-800 text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <th className="p-3 w-[150px] border-r bg-slate-800">CM #</th>
                            <th className="p-3 w-[110px] border-r bg-slate-800">Date</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Gross Sale</th>
                            <th className="p-3 w-[120px] border-r text-right bg-slate-800">Gross WOST</th>
                            <th className="p-3 w-[100px] border-r text-right bg-rose-900/10">Disc</th>
                            <th className="p-3 w-[100px] border-r text-right bg-slate-800">S. Tax</th>
                            <th className="p-3 w-[120px] border-r text-right bg-emerald-900/10 text-emerald-300 font-extrabold">Net Sale</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Cash</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">PostEx</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Leopard</th>
                            <th className="p-3 w-[90px] border-r text-center bg-slate-800">Card No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Card Amt</th>
                            <th className="p-3 w-[250px] border-r bg-slate-800">Alliance Detail / Remarks</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Gift Amt</th>
                            <th className="p-3 w-[130px] border-r bg-slate-800">Gift Voucher</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Credit Amt</th>
                            <th className="p-3 w-[130px] border-r bg-slate-800">Credit Code</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Claim Amt</th>
                            <th className="p-3 w-[130px] border-r bg-slate-800">Claim Code</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Corp Amt</th>
                            <th className="p-3 w-[130px] border-r bg-slate-800">Corp Code</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Exch Amt</th>
                            <th className="p-3 w-[130px] border-r bg-slate-800">Exch Code</th>
                            <th className="p-3 w-[90px] border-r text-center bg-slate-800">Man %</th>
                            <th className="p-3 w-[110px] border-r text-right bg-slate-800">Man Amt</th>
                            <th className="p-3 w-[200px] border-r bg-slate-800">Man Note</th>
                            <th className="p-3 w-[90px] border-r text-center bg-slate-800">Ovr %</th>
                            <th className="p-3 w-[250px] bg-slate-800">Ovr Note</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs font-medium">
                        {isPending ? (
                            <tr>
                                <td colSpan={28} className="p-8 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Loading detailed sales transactions and payments...
                                    </div>
                                </td>
                            </tr>
                        ) : reportData.length === 0 ? (
                            <tr>
                                <td colSpan={28} className="p-8 text-center text-muted-foreground">
                                    No sales memos or returns found for this criteria.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={28} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const row = reportData[virtualRow.index];
                                    const isReturn = !row.cmNo.startsWith("SI-");

                                    return (
                                        <tr
                                            key={virtualRow.key}
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            className={cn(
                                                "hover:bg-slate-50 dark:hover:bg-slate-900/35 transition-colors h-[40px] text-slate-800 dark:text-slate-200",
                                                isReturn && "bg-rose-50/40 dark:bg-rose-950/10 text-rose-700 dark:text-rose-300 font-bold"
                                            )}
                                        >
                                            <td className="p-3 border-r font-bold">{row.cmNo}</td>
                                            <td className="p-3 border-r">{format(new Date(row.date), "dd-MM-yyyy")}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.grossSale)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.grossSaleWost)}</td>
                                            <td className="p-3 border-r text-right text-rose-600">{formatVal(row.disc)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.sTax)}</td>
                                            <td className="p-3 border-r text-right font-bold text-slate-900 dark:text-white bg-slate-500/5">{formatVal(row.netSale)}</td>
                                            
                                            {/* Payments Breakdown */}
                                            <td className="p-3 border-r text-right">{formatVal(row.cash)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.postex)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.leopard)}</td>
                                            <td className="p-3 border-r text-center font-bold text-[10px] text-slate-500">{row.cardNo || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.cardAmount)}</td>
                                            <td className="p-3 border-r text-slate-500 text-xs italic">{row.allianceDetails || "-"}</td>
                                            
                                            {/* Vouchers */}
                                            <td className="p-3 border-r text-right">{formatVal(row.giftVoucherAmt)}</td>
                                            <td className="p-3 border-r font-bold text-[10px] text-slate-500">{row.giftVoucherCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.creditAmt)}</td>
                                            <td className="p-3 border-r font-bold text-[10px] text-slate-500">{row.creditCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.claimAmt)}</td>
                                            <td className="p-3 border-r font-bold text-[10px] text-slate-500">{row.claimCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.corporateAmt)}</td>
                                            <td className="p-3 border-r font-bold text-[10px] text-slate-500">{row.corporateCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.exchangeAmt)}</td>
                                            <td className="p-3 border-r font-bold text-[10px] text-slate-500">{row.exchangeCode || "-"}</td>

                                            {/* Discounts info */}
                                            <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground">{row.manualDiscPct || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.manualDiscAmt)}</td>
                                            <td className="p-3 border-r text-slate-500 text-xs max-w-[150px] truncate" title={row.manualDiscNote}>{row.manualDiscNote || "-"}</td>
                                            <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground">{row.overrideDiscPct || "-"}</td>
                                            <td className="p-3 text-slate-500 text-xs max-w-[200px] truncate" title={row.overrideDiscNote}>{row.overrideDiscNote || "-"}</td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={28} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* Grand totals row */}
                    {reportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 shadow-md">
                            <tr className="bg-slate-800 text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                                <td colSpan={2} className="p-3 border-r text-left uppercase tracking-wider font-black bg-slate-800">
                                    GRAND TOTALS
                                </td>
                                <td className="p-3 border-r text-right font-black bg-slate-800">{formatVal(grandTotals.grossSale)}</td>
                                <td className="p-3 border-r text-right font-black bg-slate-800">{formatVal(grandTotals.grossSaleWost)}</td>
                                <td className="p-3 border-r text-right font-bold bg-rose-700/30 text-rose-250">{formatVal(grandTotals.disc)}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.sTax)}</td>
                                <td className="p-3 border-r text-right font-black bg-emerald-700/30 text-emerald-200">{formatVal(grandTotals.netSale)}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.cash)}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.postex)}</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.leopard)}</td>
                                <td className="p-3 border-r text-center font-bold bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.cardAmount)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.giftVoucherAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.creditAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.claimAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.corporateAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.exchangeAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-center bg-slate-800">-</td>
                                <td className="p-3 border-r text-right font-bold bg-slate-800">{formatVal(grandTotals.manualDiscAmt)}</td>
                                <td className="p-3 border-r bg-slate-800">-</td>
                                <td className="p-3 border-r text-center bg-slate-800">-</td>
                                <td className="p-3 bg-slate-800">-</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Preparing download overlay screen */}
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
        </div>
    );
}
