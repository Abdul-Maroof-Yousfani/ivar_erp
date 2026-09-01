"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { getLocations, Location } from "@/lib/actions/location";
import {
    getAllianceRegisterReport,
    queueAllianceRegisterReportExport,
    getAllianceRegisterReportExportStatus,
    getSalespersons
} from "@/lib/actions/pos-sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
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
    Folder,
    Users,
    CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

export default function ERPAllianceRegisterReportPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState<boolean>(true);

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [selectedCashierIds, setSelectedCashierIds] = useState<string[]>([]);
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
                toast.error("Failed to load outlets list");
            } finally {
                setIsLoadingLocations(false);
            }
        }
        fetchLocationsList();
    }, []);

    // Format location options for MultiSelect
    const locationOptions: MultiSelectOption[] = useMemo(() => {
        return locations.map((loc) => ({
            value: loc.id,
            label: loc.name,
            description: loc.code ? `Code: ${loc.code}` : undefined,
        }));
    }, [locations]);

    // Fetch cashiers when single location is selected
    useEffect(() => {
        if (selectedLocationIds.length !== 1) {
            setCashierList([]);
            setSelectedCashierIds([]);
            return;
        }
        const locationId = selectedLocationIds[0];
        async function fetchCashiers() {
            try {
                const res = await getSalespersons(locationId);
                if (res && res.status && Array.isArray(res.data)) {
                    setCashierList(res.data);
                } else {
                    setCashierList([]);
                }
            } catch (err) {
                console.error("Error fetching cashiers:", err);
                setCashierList([]);
            }
        }
        fetchCashiers();
    }, [selectedLocationIds]);

    // Format cashier options for MultiSelect
    const cashierOptions: MultiSelectOption[] = useMemo(() => {
        return cashierList.map((c: any) => ({
            value: c.userId,
            label: c.name,
            description: c.empCode ? `Emp Code: ${c.empCode}` : undefined,
        }));
    }, [cashierList]);

    const locationParam = useMemo(() => {
        return selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined;
    }, [selectedLocationIds]);

    const cashierParam = useMemo(() => {
        return selectedCashierIds.length > 0 ? selectedCashierIds.join(",") : undefined;
    }, [selectedCashierIds]);

    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getAllianceRegisterReport({
                locationId: locationParam,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                cashierUserId: cashierParam,
                search: searchQuery.trim() || undefined,
            });
            if (result && result.status !== false) {
                setReportData(result.data || []);
            } else {
                toast.error("Failed to load alliance report data");
            }
        });
    }, [locationParam, dateRange, cashierParam, searchQuery]);

    useEffect(() => {
        fetchReport();
    }, [locationParam, cashierParam]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getAllianceRegisterReportExportStatus(exportJobId);
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
                const res = await getAllianceRegisterReportExportStatus(pdfJobId);
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
                const downloadUrl = `${getApiBaseUrl()}/pos-sales/reports/alliance-register/export/${exportJobId}/download`;
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
            const res = await queueAllianceRegisterReportExport({
                locationId: locationParam,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierParam,
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
                const downloadUrl = `${getApiBaseUrl()}/pos-sales/reports/alliance-register/export/${pdfJobId}/download`;
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
            const res = await queueAllianceRegisterReportExport({
                locationId: locationParam,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                cashierUserId: cashierParam,
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

    const selectedLocationName = useMemo(() => {
        if (selectedLocationIds.length === 0) return "All Outlets";
        if (selectedLocationIds.length === 1) {
            const loc = locations.find((l) => l.id === selectedLocationIds[0]);
            return loc ? loc.name : "Store";
        }
        return `${selectedLocationIds.length} Outlets Selected`;
    }, [selectedLocationIds, locations]);

    // Calculate Grand Totals and KPIs
    const grandTotals = useMemo(() => {
        let count = 0;
        let retailPrice = 0;
        let retailWost = 0;
        let discount = 0;
        let sTax = 0;
        let netSale = 0;
        let cash = 0;
        let card = 0;
        let giftVoucherAmt = 0;
        let creditAmt = 0;
        let claimAmt = 0;
        let corporateAmt = 0;
        let exchangeAmt = 0;
        let creditVoucherIssuedAmt = 0;

        reportData.forEach((row) => {
            count++;
            retailPrice += Number(row.retailPrice || 0);
            retailWost += Number(row.retailWost || 0);
            discount += Number(row.discount || 0);
            sTax += Number(row.sTax || 0);
            netSale += Number(row.netSale || 0);
            cash += Number(row.cash || 0);
            card += Number(row.card || 0);
            giftVoucherAmt += Number(row.giftVoucherAmt || 0);
            creditAmt += Number(row.creditAmt || 0);
            claimAmt += Number(row.claimAmt || 0);
            corporateAmt += Number(row.corporateAmt || 0);
            exchangeAmt += Number(row.exchangeAmt || 0);
            creditVoucherIssuedAmt += Number(row.creditVoucherIssuedAmt || 0);
        });

        return {
            count,
            retailPrice,
            retailWost,
            discount,
            sTax,
            netSale,
            cash,
            card,
            giftVoucherAmt,
            creditAmt,
            claimAmt,
            corporateAmt,
            exchangeAmt,
            creditVoucherIssuedAmt
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
                        <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Alliance Register Report (ERP)
                        </h1>
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                            ERP POS Module
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Detailed listing of alliance sales and manual discounts across all outlets. Select outlets or view company-wide alliance transactions.
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
                <h3 className="text-md font-semibold text-slate-700">Alliance Register Report (ERP)</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Outlet: {selectedLocationName} | 
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Styled MultiSelect Outlet / Location Filter */}
                    <div className="flex items-center gap-2 min-w-[240px]">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
                            <Store className="h-3.5 w-3.5 text-indigo-600" />
                            Outlet:
                        </span>
                        <div className="flex-1 min-w-[180px]">
                            <MultiSelect
                                options={locationOptions}
                                value={selectedLocationIds}
                                onValueChange={setSelectedLocationIds}
                                placeholder="All Outlets"
                                searchPlaceholder="Search Outlets..."
                                emptyMessage="No outlets found"
                                disabled={isLoadingLocations}
                                icon={<Store className="h-3 w-3 mr-1" />}
                                className="bg-background text-xs"
                            />
                        </div>
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

                    {selectedLocationIds.length === 1 && cashierOptions.length > 0 && (
                        <div className="flex items-center gap-2 min-w-[220px]">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Users className="h-3.5 w-3.5" />
                                Salesperson:
                            </span>
                            <div className="flex-1 min-w-[160px]">
                                <MultiSelect
                                    options={cashierOptions}
                                    value={selectedCashierIds}
                                    onValueChange={setSelectedCashierIds}
                                    placeholder="All Salespersons"
                                    searchPlaceholder="Search Salespersons..."
                                    emptyMessage="No salespersons found"
                                    icon={<Users className="h-3 w-3 mr-1" />}
                                    className="bg-background text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Search className="h-3.5 w-3.5" />
                            Invoice #:
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
                    <Folder className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{COMPANY_NAME} &bull; ERP Alliance Sales</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Alliance Memos</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatQty(grandTotals.count)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Retail Value</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatVal(grandTotals.retailPrice)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Discount Availed</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-450">{formatVal(grandTotals.discount)}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Sales (Alliance)</p>
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
                <table className="w-full text-left border-collapse min-w-[3600px]">
                    <thead>
                        <tr className="bg-indigo-950 text-indigo-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                            <th className="p-3 w-[160px] border-r bg-indigo-950">Sales Tax Invoice</th>
                            <th className="p-3 w-[110px] border-r bg-indigo-950">Date</th>
                            <th className="p-3 w-[100px] border-r bg-indigo-950">Time</th>
                            <th className="p-3 w-[120px] border-r text-right bg-indigo-950">Retail Price</th>
                            <th className="p-3 w-[130px] border-r text-right bg-indigo-950">Retail Price WOST</th>
                            <th className="p-3 w-[110px] border-r text-right bg-rose-950/20 text-rose-350">Discount</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">S. Tax</th>
                            <th className="p-3 w-[130px] border-r text-right bg-emerald-950/20 text-emerald-350 font-extrabold">Net Sale</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Cash</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Card</th>
                            <th className="p-3 w-[140px] border-r bg-indigo-950">Prefix Card No.</th>
                            <th className="p-3 w-[100px] border-r text-center bg-indigo-950">Auth ID</th>
                            <th className="p-3 w-[100px] border-r text-center bg-indigo-950">Card No.</th>
                            <th className="p-3 w-[250px] border-r bg-indigo-950">Alliance Option</th>
                            <th className="p-3 w-[200px] border-r bg-indigo-950">Remarks</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Gift Voucher No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Amt</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Credit Voucher No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Amt</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Claim Voucher No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Amt</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Corp Voucher No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Amt</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Exch Voucher No.</th>
                            <th className="p-3 w-[110px] border-r text-right bg-indigo-950">Amt</th>
                            <th className="p-3 w-[150px] border-r bg-indigo-950">Credit Issued</th>
                            <th className="p-3 w-[110px] text-right bg-indigo-950">Amt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs font-medium">
                        {isPending ? (
                            <tr>
                                <td colSpan={27} className="p-8 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                        Loading alliance transactions register...
                                    </div>
                                </td>
                            </tr>
                        ) : reportData.length === 0 ? (
                            <tr>
                                <td colSpan={27} className="p-8 text-center text-muted-foreground">
                                    No alliance register records found for this criteria.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={27} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const row = reportData[virtualRow.index];

                                    return (
                                        <tr
                                            key={virtualRow.key}
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            className="hover:bg-indigo-50/15 dark:hover:bg-indigo-950/5 transition-colors h-[40px] text-slate-800 dark:text-slate-200"
                                        >
                                            <td className="p-3 border-r font-bold">{row.invoiceNo}</td>
                                            <td className="p-3 border-r">{row.date}</td>
                                            <td className="p-3 border-r">{row.time}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.retailPrice)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.retailWost)}</td>
                                            <td className="p-3 border-r text-right text-rose-600">{formatVal(row.discount)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.sTax)}</td>
                                            <td className="p-3 border-r text-right font-bold text-slate-900 dark:text-white bg-emerald-500/5">{formatVal(row.netSale)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.cash)}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.card)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.prefixCardNo || "-"}</td>
                                            <td className="p-3 border-r text-center font-mono text-[11px]">{row.authId || "-"}</td>
                                            <td className="p-3 border-r text-center font-mono text-[11px]">{row.cardNo ? `****${row.cardNo}` : "-"}</td>
                                            <td className="p-3 border-r text-indigo-900 dark:text-indigo-300 font-semibold">{row.allianceOption || "-"}</td>
                                            <td className="p-3 border-r text-xs text-muted-foreground">{row.remarks || "-"}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.giftVoucherCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.giftVoucherAmt)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.creditCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.creditAmt)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.claimCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.claimAmt)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.corporateCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.corporateAmt)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.exchangeCode || "-"}</td>
                                            <td className="p-3 border-r text-right">{formatVal(row.exchangeAmt)}</td>
                                            <td className="p-3 border-r font-mono text-[11px]">{row.creditVoucherIssued || "-"}</td>
                                            <td className="p-3 text-right">{formatVal(row.creditVoucherIssuedAmt)}</td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={27} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* Grand totals row */}
                    {reportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-10 shadow-md">
                            <tr className="bg-indigo-950 text-indigo-100 font-extrabold border-t-2 border-indigo-900 text-xs">
                                <td colSpan={3} className="p-3 border-r text-left uppercase tracking-wider font-black bg-indigo-950">
                                    GRAND TOTALS
                                </td>
                                <td className="p-3 border-r text-right font-black bg-indigo-950">{formatVal(grandTotals.retailPrice)}</td>
                                <td className="p-3 border-r text-right font-black bg-indigo-950">{formatVal(grandTotals.retailWost)}</td>
                                <td className="p-3 border-r text-right font-bold bg-rose-700/30 text-rose-250">{formatVal(grandTotals.discount)}</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.sTax)}</td>
                                <td className="p-3 border-r text-right font-black bg-emerald-700/30 text-emerald-200">{formatVal(grandTotals.netSale)}</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.cash)}</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.card)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.giftVoucherAmt)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.creditAmt)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.claimAmt)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.corporateAmt)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 border-r text-right font-bold bg-indigo-950">{formatVal(grandTotals.exchangeAmt)}</td>
                                <td className="p-3 border-r bg-indigo-950">-</td>
                                <td className="p-3 text-right font-bold bg-indigo-950">{formatVal(grandTotals.creditVoucherIssuedAmt)}</td>
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
                            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
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
