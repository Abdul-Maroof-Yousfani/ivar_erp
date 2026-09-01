"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getLocations, Location } from "@/lib/actions/location";
import {
  getClaimRegisterReport,
  queueClaimRegisterReportExport,
  getClaimRegisterReportExportStatus,
  ClaimRegisterReportData,
} from "@/lib/actions/claim-register";
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
  Search,
  Store,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Inbox,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Folder,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

export default function ClaimRegisterReportPage() {
  const { user } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const locationParam = useMemo(
    () => (selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined),
    [selectedLocationIds],
  );

  const activeSelectionNames = useMemo(() => {
    if (selectedLocationIds.length > 0)
      return locations
        .filter((l) => selectedLocationIds.includes(l.id))
        .map((l) => l.name)
        .join(", ");
    return "All Outlets";
  }, [selectedLocationIds, locations]);

  const locationOptions: MultiSelectOption[] = useMemo(
    () =>
      locations.map((loc) => ({
        value: loc.id,
        label: loc.name,
        description: loc.code ? `Code: ${loc.code}` : undefined,
      })),
    [locations],
  );

  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [reportData, setReportData] = useState<ClaimRegisterReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  // Excel Export Queue States
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
  const [exportProgress, setExportProgress] = useState<number>(0);

  // PDF Export Queue States
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
  const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

  // Fetch Locations on mount
  useEffect(() => {
    getLocations()
      .then((data: any) => {
        if (Array.isArray(data)) setLocations(data);
        else if (data?.status && Array.isArray(data?.data)) setLocations(data.data);
      })
      .catch(console.error);
  }, []);

  const fetchReport = useCallback(() => {
    if (!dateRange.from || !dateRange.to) return;
    startTransition(async () => {
      const result = await getClaimRegisterReport({
        locationId: locationParam ?? "",
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        search: searchQuery.trim() || undefined,
      });
      if (result && result.status && result.data) {
        setReportData(result.data);
      } else {
        toast.error("Failed to load claim register report");
      }
    });
  }, [locationParam, dateRange, searchQuery]);

  useEffect(() => {
    fetchReport();
  }, [locationParam, dateRange]);

  // Poll Excel Job Status
  useEffect(() => {
    if (exportState !== "queueing" && exportState !== "processing") return;
    if (!exportJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getClaimRegisterReportExportStatus(exportJobId);
        if (res && res.status && res.data) {
          const { state, progress } = res.data;
          setExportProgress(progress || 0);

          if (state === "completed") {
            setExportState("completed");
            toast.success("Excel Export processed successfully! Click to download.");
            clearInterval(interval);
          } else if (state === "failed") {
            setExportState("failed");
            toast.error("Excel export job failed.");
            clearInterval(interval);
          } else {
            setExportState("processing");
          }
        }
      } catch (err) {
        console.error("Error polling Excel job status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [exportState, exportJobId]);

  // Poll PDF Job Status
  useEffect(() => {
    if (pdfExportState !== "queueing" && pdfExportState !== "processing") return;
    if (!pdfJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getClaimRegisterReportExportStatus(pdfJobId);
        if (res && res.status && res.data) {
          const { state, progress } = res.data;
          setPdfExportProgress(progress || 0);

          if (state === "completed") {
            setPdfExportState("completed");
            toast.success("PDF document generated! Click to download.");
            clearInterval(interval);
          } else if (state === "failed") {
            setPdfExportState("failed");
            toast.error("PDF export job failed.");
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
      const downloadUrl = `${getApiBaseUrl()}/api/pos-claims/reports/claim-register/export-download/${exportJobId}`;
      window.open(downloadUrl, "_blank");
      return;
    }

    setExportState("queueing");
    setExportProgress(0);
    try {
      const res = await queueClaimRegisterReportExport({
        locationId: locationParam ?? "",
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        format: "xlsx",
        search: searchQuery.trim() || undefined,
      });

      if (res && res.status && res.data?.jobId) {
        setExportJobId(res.data.jobId);
        setExportState("processing");
        toast.info("Excel export added to server queue...");
      } else {
        setExportState("failed");
        toast.error(res?.message || "Failed to queue Excel export");
      }
    } catch (err) {
      setExportState("failed");
      toast.error("An error occurred while queueing Excel export");
    }
  };

  const handleExportPdfClick = async () => {
    if (!dateRange.from || !dateRange.to) return;

    if (pdfExportState === "completed" && pdfJobId) {
      const downloadUrl = `${getApiBaseUrl()}/api/pos-claims/reports/claim-register/export-download/${pdfJobId}`;
      window.open(downloadUrl, "_blank");
      return;
    }

    setPdfExportState("queueing");
    setPdfExportProgress(0);
    try {
      const res = await queueClaimRegisterReportExport({
        locationId: locationParam ?? "",
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        format: "pdf",
        search: searchQuery.trim() || undefined,
      });

      if (res && res.status && res.data?.jobId) {
        setPdfJobId(res.data.jobId);
        setPdfExportState("processing");
        toast.info("PDF generation added to server queue...");
      } else {
        setPdfExportState("failed");
        toast.error(res?.message || "Failed to queue PDF export");
      }
    } catch (err) {
      setPdfExportState("failed");
      toast.error("An error occurred while queueing PDF export");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Flatten clean report data into a flat array for virtualization
  const flatRows = useMemo(() => {
    if (!reportData || !reportData.outlets) return [];
    const rows: any[] = [];

    for (const outlet of reportData.outlets) {
      if (!outlet.claims || outlet.claims.length === 0) continue;

      rows.push({
        type: "outlet-header",
        id: `outlet-${outlet.locationId}`,
        locationName: outlet.locationName,
      });

      for (const claimGroup of outlet.claims) {
        for (const item of claimGroup.items) {
          rows.push({
            type: "item",
            id: `item-${item.id}`,
            data: item,
          });
        }
      }

      rows.push({
        type: "outlet-subtotal",
        id: `outlet-sub-${outlet.locationId}`,
        locationName: outlet.locationName,
        totals: outlet.totals,
      });
    }

    return rows;
  }, [reportData]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const formatNum = (val: number) => {
    if (val === undefined || val === null) return "-";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatQty = (val: number) => {
    if (val === undefined || val === null) return "-";
    return val.toLocaleString("en-US");
  };

  const getExcelButtonLabel = () => {
    if (exportState === "queueing") return "Queueing...";
    if (exportState === "processing") return `Generating ${exportProgress}%`;
    if (exportState === "completed") return "Download Excel";
    if (exportState === "failed") return "Retry Excel Export";
    return "Export Excel";
  };

  const getPdfButtonLabel = () => {
    if (pdfExportState === "queueing") return "Queueing...";
    if (pdfExportState === "processing") return `Generating ${pdfExportProgress}%`;
    if (pdfExportState === "completed") return "Download PDF";
    if (pdfExportState === "failed") return "Retry PDF Export";
    return "Export PDF";
  };

  return (
    <div className="space-y-6 p-1 sm:p-6 max-w-[1800px] mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Claim Register Report (ERP)
            </h1>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            Outlets: <span className="font-semibold text-foreground">{activeSelectionNames}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={isPending}
            className="h-9 font-bold text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            variant={exportState === "completed" ? "default" : "outline"}
            size="sm"
            onClick={handleExportExcelClick}
            disabled={exportState === "queueing" || exportState === "processing"}
            className={cn(
              "h-9 font-bold text-xs gap-1.5 transition-all shadow-xs",
              exportState === "completed" && "bg-emerald-600 hover:bg-emerald-700 text-white",
            )}
          >
            {(exportState === "queueing" || exportState === "processing") && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {exportState === "idle" && <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span>{getExcelButtonLabel()}</span>
          </Button>

          <Button
            variant={pdfExportState === "completed" ? "default" : "outline"}
            size="sm"
            onClick={handleExportPdfClick}
            disabled={pdfExportState === "queueing" || pdfExportState === "processing"}
            className={cn(
              "h-9 font-bold text-xs gap-1.5 transition-all shadow-xs",
              pdfExportState === "completed" && "bg-rose-600 hover:bg-rose-700 text-white",
            )}
          >
            {(pdfExportState === "queueing" || pdfExportState === "processing") && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {pdfExportState === "idle" && <FileText className="h-3.5 w-3.5" />}
            <span>{getPdfButtonLabel()}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 font-bold text-xs gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <h2 className="text-xl font-bold uppercase">{COMPANY_NAME}</h2>
        <h3 className="text-md font-semibold text-slate-700">Sales Return | Claim Register | Crystal</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Outlets: {activeSelectionNames} | Period:{" "}
          {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
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
              <Search className="h-3.5 w-3.5" />
              Search:
            </span>
            <input
              type="text"
              placeholder="CM #, Claim #, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background border rounded px-2.5 py-1.5 text-xs font-medium focus:ring-primary focus:border-primary outline-none min-w-[220px]"
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
          <span>Sales Return &bull; Claim Register &bull; Approved Exchange Claims</span>
        </div>
      </div>

      {/* KPI Cards */}
      {reportData && reportData.grandTotals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <Card className="shadow-xs border-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Approved Items</p>
                <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatQty(reportData.grandTotals.quantity)}</h3>
              </div>
              <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                <Inbox className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sub Total (WOT)</p>
                <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatNum(reportData.grandTotals.subTotal)}</h3>
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
                <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-450">{formatNum(reportData.grandTotals.discountAmount)}</h3>
              </div>
              <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                <ArrowDownRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Claim Amount</p>
                <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatNum(reportData.grandTotals.netTotal)}</h3>
              </div>
              <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Virtualized Scrolling Table */}
      <div ref={parentRef} className="overflow-x-auto max-h-[750px] border rounded-xl shadow-xs bg-background no-print">
        <table className="w-full text-left border-collapse min-w-[2000px] whitespace-nowrap">
          <thead>
            <tr className="bg-slate-800 text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-xs">
              <th className="p-3 w-[140px] border-r bg-slate-800">Base CM #</th>
              <th className="p-3 w-[110px] border-r bg-slate-800">Base Date</th>
              <th className="p-3 w-[150px] border-r bg-slate-800">Claim #</th>
              <th className="p-3 w-[110px] border-r bg-slate-800">Claim Date</th>
              <th className="p-3 w-[140px] border-r bg-slate-800">Settled Inv #</th>
              <th className="p-3 w-[110px] border-r bg-slate-800">Settled Date</th>
              <th className="p-3 w-[260px] border-r bg-slate-800">Product Description</th>
              <th className="p-3 w-[130px] border-r bg-slate-800">Product SKU</th>
              <th className="p-3 w-[80px] border-r text-center bg-slate-800">Size</th>
              <th className="p-3 w-[110px] border-r text-center bg-slate-800">HS Code</th>
              <th className="p-3 w-[80px] border-r text-right bg-slate-800">Qty</th>
              <th className="p-3 w-[120px] border-r text-right bg-slate-800">Unit Price</th>
              <th className="p-3 w-[90px] border-r text-right bg-slate-800">Tax %</th>
              <th className="p-3 w-[120px] border-r text-right bg-slate-800">Price WOT</th>
              <th className="p-3 w-[120px] border-r text-right bg-slate-800">Sub Total</th>
              <th className="p-3 w-[110px] border-r text-right bg-rose-900/10 text-rose-300">Discount</th>
              <th className="p-3 w-[110px] border-r text-right bg-slate-800">Tax Amt</th>
              <th className="p-3 w-[130px] border-r text-right bg-emerald-900/10 text-emerald-300 font-extrabold">Net Total</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs font-medium">
            {isPending ? (
              <tr>
                <td colSpan={18} className="p-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Loading approved claim register report data...
                  </div>
                </td>
              </tr>
            ) : flatRows.length === 0 ? (
              <tr>
                <td colSpan={18} className="p-8 text-center text-muted-foreground">
                  No approved return claims found for the selected criteria.
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

                  if (row.type === "outlet-header") {
                    return (
                      <tr key={row.id} className="bg-slate-100 dark:bg-slate-800/90 border-y border-slate-300 dark:border-slate-700">
                        <td colSpan={18} className="p-3 font-extrabold text-xs text-primary uppercase tracking-wider">
                          OUTLET: {row.locationName}
                        </td>
                      </tr>
                    );
                  }

                  if (row.type === "item") {
                    const item = row.data;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/35 transition-colors h-[40px] text-slate-800 dark:text-slate-200"
                      >
                        <td className="p-3 border-r font-bold text-slate-900 dark:text-white">{item.baseCmNumber}</td>
                        <td className="p-3 border-r">{item.baseCmDate}</td>
                        <td className="p-3 border-r font-bold text-primary">{item.claimNumber}</td>
                        <td className="p-3 border-r">{item.claimDate}</td>
                        <td className="p-3 border-r font-semibold text-slate-700 dark:text-slate-300">{item.settledInvNumber}</td>
                        <td className="p-3 border-r">{item.settledDate}</td>
                        <td className="p-3 border-r truncate max-w-[260px]" title={item.productDescription}>
                          {item.productDescription}
                        </td>
                        <td className="p-3 border-r font-mono text-xs text-indigo-600 dark:text-indigo-400">{item.productSku}</td>
                        <td className="p-3 border-r text-center font-bold">{item.size}</td>
                        <td className="p-3 border-r text-center font-mono text-xs text-muted-foreground">{item.hsCode}</td>
                        <td className="p-3 border-r text-right font-bold">{formatQty(item.quantity)}</td>
                        <td className="p-3 border-r text-right">{formatNum(item.unitPrice)}</td>
                        <td className="p-3 border-r text-right text-muted-foreground">{item.taxPercent.toFixed(2)}</td>
                        <td className="p-3 border-r text-right">{formatNum(item.unitPriceWot)}</td>
                        <td className="p-3 border-r text-right font-semibold">{formatNum(item.subTotal)}</td>
                        <td className="p-3 border-r text-right text-rose-600">{formatNum(item.discountAmount)}</td>
                        <td className="p-3 border-r text-right">{formatNum(item.taxAmount)}</td>
                        <td className="p-3 border-r text-right font-extrabold text-slate-900 dark:text-white bg-slate-500/5">{formatNum(item.netTotal)}</td>
                      </tr>
                    );
                  }

                  if (row.type === "outlet-subtotal") {
                    return (
                      <tr key={row.id} className="bg-slate-100/80 dark:bg-slate-800/80 border-t-2 border-b-2 border-slate-900 dark:border-slate-100 font-bold text-slate-900 dark:text-white">
                        <td colSpan={10} className="p-3 font-extrabold uppercase text-xs">
                          Total for {row.locationName}
                        </td>
                        <td className="p-3 border-r text-right font-extrabold">{formatQty(row.totals.quantity)}</td>
                        <td colSpan={3} className="p-3 border-r"></td>
                        <td className="p-3 border-r text-right font-extrabold">{formatNum(row.totals.subTotal)}</td>
                        <td className="p-3 border-r text-right text-rose-600 font-extrabold">{formatNum(row.totals.discountAmount)}</td>
                        <td className="p-3 border-r text-right font-extrabold">{formatNum(row.totals.taxAmount)}</td>
                        <td className="p-3 border-r text-right font-black text-emerald-600 dark:text-emerald-400 text-sm underline decoration-double">{formatNum(row.totals.netTotal)}</td>
                      </tr>
                    );
                  }

                  return null;
                })}

                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={18} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>

          {/* Grand Total Footer */}
          {reportData && reportData.grandTotals && (
            <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-bold border-t-2 border-slate-950 shadow-md">
              <tr>
                <td colSpan={10} className="p-3.5 uppercase tracking-wider font-black text-xs text-indigo-300">
                  GRAND TOTAL (ALL OUTLETS)
                </td>
                <td className="p-3.5 text-right font-black text-sm">{formatQty(reportData.grandTotals.quantity)}</td>
                <td colSpan={3} className="p-3.5"></td>
                <td className="p-3.5 text-right font-mono font-black">{formatNum(reportData.grandTotals.subTotal)}</td>
                <td className="p-3.5 text-right font-mono font-black text-rose-400">{formatNum(reportData.grandTotals.discountAmount)}</td>
                <td className="p-3.5 text-right font-mono font-black text-indigo-300">{formatNum(reportData.grandTotals.taxAmount)}</td>
                <td className="p-3.5 text-right font-mono font-black text-emerald-400 text-base underline decoration-double">{formatNum(reportData.grandTotals.netTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
