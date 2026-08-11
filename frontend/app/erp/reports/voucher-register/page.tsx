"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getLocations, Location } from "@/lib/actions/location";
import {
  getVoucherRegisterReport,
  queueVoucherRegisterExport,
  getVoucherRegisterExportStatus,
  VoucherRegisterReportData,
} from "@/lib/actions/voucher-register";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Download,
  Printer,
  Loader2,
  Calendar,
  Store,
  RefreshCw,
  Coins,
  Search,
  X,
  Ticket,
  Percent,
  CheckCircle2,
  Building2,
  CreditCard,
  Layers,
  FileText,
  Gift,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl, formatCurrency } from "@/lib/utils";

const VOUCHER_TYPE_TABS = [
  { id: "ALL", label: "All Vouchers", icon: Layers },
  { id: "GIFT", label: "Gift Vouchers", icon: Gift },
  { id: "CORPORATE", label: "Corporate Vouchers", icon: Building2 },
  { id: "CREDIT", label: "Credit Vouchers", icon: CreditCard },
  { id: "EXCHANGE", label: "Exchange Vouchers", icon: ArrowLeftRight },
  { id: "REFUND", label: "Refund Vouchers", icon: Ticket },
];

export default function UnifiedVoucherRegisterPage() {
  const { user } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  const [reportData, setReportData] = useState<VoucherRegisterReportData | null>(null);
  const [isPending, startTransition] = useTransition();

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
    async function fetchLocs() {
      try {
        const res = await getLocations();
        if (Array.isArray(res)) setLocations(res);
        else if (res?.status && Array.isArray(res.data)) setLocations(res.data);
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    }
    fetchLocs();
  }, []);

  const fetchReport = useCallback(() => {
    if (!dateRange.from || !dateRange.to) return;

    startTransition(async () => {
      const result = await getVoucherRegisterReport({
        voucherType: activeTab,
        status: statusFilter,
        locationId: locationParam ?? "",
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        search: searchQuery.trim() || undefined,
      });
      if (result && result.status && result.data) {
        setReportData(result.data);
      } else {
        setReportData(null);
        toast.error("Failed to load Voucher Register report data");
      }
    });
  }, [activeTab, statusFilter, locationParam, dateRange, searchQuery]);

  useEffect(() => {
    fetchReport();
  }, [activeTab, statusFilter, locationParam, dateRange]);

  // Poll Excel Export Job Status
  useEffect(() => {
    if (exportState !== "queueing" && exportState !== "processing") return;
    if (!exportJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getVoucherRegisterExportStatus(exportJobId);
        if (res && res.status && res.data) {
          const { state, progress } = res.data;
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
        const res = await getVoucherRegisterExportStatus(pdfJobId);
        if (res && res.status && res.data) {
          const { state, progress } = res.data;
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
      const url = `${base}/api/pos-sales/reports/voucher-register/export-download/${exportJobId}`;
      window.open(url, "_blank");

      setExportState("idle");
      setExportJobId(null);
      setExportProgress(0);
      return;
    }

    setExportState("queueing");
    try {
      const res = await queueVoucherRegisterExport({
        voucherType: activeTab,
        status: statusFilter,
        locationId: locationParam ?? "",
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        format: "xlsx",
        search: searchQuery.trim() || undefined,
      });

      if (res && res.status && res.data?.jobId) {
        setExportJobId(res.data.jobId);
        setExportState("processing");
        setExportProgress(5);
        toast.info("Background Excel generation queued.");
      } else {
        setExportState("failed");
        toast.error(res?.message || "Failed to queue export job.");
      }
    } catch (err) {
      setExportState("failed");
      toast.error("Failed to queue export job.");
    }
  };

  const handleExportPdfClick = async () => {
    if (!dateRange.from || !dateRange.to) return;

    if (pdfExportState === "completed" && pdfJobId) {
      const base = getApiBaseUrl();
      const url = `${base}/api/pos-sales/reports/voucher-register/export-download/${pdfJobId}`;
      window.open(url, "_blank");

      setPdfExportState("idle");
      setPdfJobId(null);
      setPdfExportProgress(0);
      return;
    }

    setPdfExportState("queueing");
    try {
      const res = await queueVoucherRegisterExport({
        voucherType: activeTab,
        status: statusFilter,
        locationId: locationParam ?? "",
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        format: "pdf",
        search: searchQuery.trim() || undefined,
      });

      if (res && res.status && res.data?.jobId) {
        setPdfJobId(res.data.jobId);
        setPdfExportState("processing");
        setPdfExportProgress(5);
        toast.info("Background PDF generation queued.");
      } else {
        setPdfExportState("failed");
        toast.error(res?.message || "Failed to queue export job.");
      }
    } catch (err) {
      setPdfExportState("failed");
      toast.error("Failed to queue export job.");
    }
  };

  // Client-Side Search Filtering
  const filteredItems = useMemo(() => {
    if (!reportData || !reportData.items) return [];
    if (!searchQuery.trim()) return reportData.items;
    const query = searchQuery.toLowerCase().trim();

    return reportData.items.filter((item) => {
      return (
        item.voucherNumber.toLowerCase().includes(query) ||
        item.voucherType.toLowerCase().includes(query) ||
        item.companyName.toLowerCase().includes(query) ||
        item.companyGlCode.toLowerCase().includes(query) ||
        item.customerDetail.toLowerCase().includes(query) ||
        item.outletName.toLowerCase().includes(query) ||
        item.baseCashMemo.toLowerCase().includes(query) ||
        item.settledInCashMemo.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
      );
    });
  }, [reportData, searchQuery]);

  // Virtual list setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

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

  const formatPriceVal = (val: number) => (val === 0 ? "-" : formatCurrency(val));

  const kpis = reportData?.kpis || {
    totalVouchers: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalSettledAmount: 0,
    typeBreakdown: {},
  };

  const getTypeBadgeClass = (vType: string) => {
    switch (vType.toUpperCase()) {
      case "GIFT":
      case "OUTLET_GIFT":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300";
      case "CORPORATE":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300";
      case "CREDIT":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300";
      case "EXCHANGE":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300";
      case "REFUND":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1650px] mx-auto">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Ticket className="h-8 w-8 text-indigo-600" />
            Voucher Register Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            <Store className="h-4 w-4 text-indigo-600/70" />
            Unified Master Register for Gift, Corporate, Credit, Exchange & Refund Vouchers for{" "}
            <span className="text-foreground font-semibold">{activeSelectionNames}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={pdfExportState === "completed" ? "default" : "outline"}
            onClick={handleExportPdfClick}
            disabled={pdfExportState === "queueing" || pdfExportState === "processing"}
            className={cn(
              "gap-2 font-semibold transition-all",
              pdfExportState === "completed"
                ? "bg-red-600 text-white hover:bg-red-700 border-none"
                : "border-red-500/40 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30",
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
            disabled={exportState === "queueing" || exportState === "processing"}
            className={cn(
              "gap-2 font-semibold transition-all",
              exportState === "completed"
                ? "bg-emerald-600 text-white hover:bg-emerald-700 border-none"
                : "border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30",
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
        <h1 className="text-2xl font-bold text-center text-slate-900">{COMPANY_NAME}</h1>
        <h2 className="text-lg font-bold text-center text-slate-700">Unified Voucher Register Report</h2>
        <p className="text-sm text-center text-slate-600 mt-1">Outlets: {activeSelectionNames}</p>
        <p className="text-xs text-center text-slate-500">
          Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
          {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
        </p>
      </div>

      {/* Navigation Quick Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 no-print overflow-x-auto">
        {VOUCHER_TYPE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tab.id === "ALL" ? kpis.totalVouchers : kpis.typeBreakdown?.[tab.id] || 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-indigo-500")} />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-extrabold ml-1",
                  isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Control Bar & Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
        <div className="flex flex-wrap items-end gap-4 flex-1">
          {/* Status Filter */}
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              Voucher Status
            </span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 bg-background border-slate-200">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="REDEEMED">REDEEMED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location Multi-Select */}
          <div className="flex flex-col gap-1.5 min-w-[260px]">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <Store className="h-3.5 w-3.5 text-indigo-600" />
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

          {/* Date Period Picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
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

          {/* Quick Search Bar */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[260px]">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <Search className="h-3.5 w-3.5 text-indigo-600" />
              Quick Search
            </span>
            <div className="relative">
              <Input
                placeholder="Search Voucher #, Company Name, GL Code, Customer, Invoice #..."
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
          <Button onClick={fetchReport} disabled={isPending} className="h-10 px-5 font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            Refresh Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 no-print">
        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Vouchers</p>
              <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{kpis.totalVouchers}</h3>
            </div>
            <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600">
              <Ticket className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Face Value</p>
              <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatPriceVal(kpis.totalAmount)}</h3>
            </div>
            <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600">
              <Coins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Discount</p>
              <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatPriceVal(kpis.totalDiscount)}</h3>
            </div>
            <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
              <Percent className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Settled Value</p>
              <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatPriceVal(kpis.totalSettledAmount)}</h3>
            </div>
            <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Virtualized Master Table Container with Horizontal Scrollbar */}
      <div className="border rounded-xl shadow-sm bg-background overflow-x-auto no-print">
        <div ref={parentRef} className="overflow-auto max-h-[700px] min-w-[2000px]">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[2000px]">
            <thead>
              <tr className="bg-[#0f172a] text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                <th className="p-3.5 w-[180px] border-r bg-[#0f172a]">Voucher #</th>
                <th className="p-3.5 w-[120px] border-r text-center bg-[#0f172a]">Type</th>
                <th className="p-3.5 w-[170px] border-r bg-[#0f172a]">Date Time</th>
                <th className="p-3.5 w-[200px] border-r bg-[#0f172a]">Company / GL Code</th>
                <th className="p-3.5 w-[220px] border-r bg-[#0f172a]">Customer / Beneficiary</th>
                <th className="p-3.5 w-[190px] border-r bg-[#0f172a]">Issued Outlet</th>
                <th className="p-3.5 w-[200px] border-r bg-[#0f172a]">Base / Source Inv #</th>
                <th className="p-3.5 w-[130px] border-r bg-[#0f172a]">Valid Till</th>
                <th className="p-3.5 w-[160px] border-r text-right bg-[#0f172a]">Discount Amount (Rs.)</th>
                <th className="p-3.5 w-[160px] border-r text-right bg-[#0f172a] font-extrabold text-emerald-300">Amount (Rs.)</th>
                <th className="p-3.5 w-[200px] border-r bg-[#0f172a]">Settled In Inv #</th>
                <th className="p-3.5 w-[170px] border-r bg-[#0f172a]">Settled Date Time</th>
                <th className="p-3.5 w-[110px] text-center bg-[#0f172a]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {isPending ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                      Loading Master Voucher Register...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-muted-foreground font-medium">
                    No vouchers match the selected tab, filters, or search query.
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={13} style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const item = filteredItems[virtualRow.index];
                    const isSettled = item.settledInCashMemo !== "Pending / Unsettled";

                    return (
                      <tr
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors h-[48px]"
                      >
                        {/* Voucher # */}
                        <td className="p-3.5 border-r font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.voucherNumber}
                        </td>

                        {/* Type Badge */}
                        <td className="p-3.5 border-r text-center">
                          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-extrabold border uppercase", getTypeBadgeClass(item.voucherType))}>
                            {item.voucherType}
                          </span>
                        </td>

                        {/* Date Time */}
                        <td className="p-3.5 border-r text-slate-700 dark:text-slate-300">{item.dateTime}</td>

                        {/* Company / GL Code */}
                        <td className="p-3.5 border-r">
                          {item.companyName !== "-" ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{item.companyName}</span>
                              {item.companyGlCode !== "-" && (
                                <span className="text-[10px] font-mono text-muted-foreground">GL: {item.companyGlCode}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Customer / Beneficiary */}
                        <td className="p-3.5 border-r font-medium text-slate-900 dark:text-slate-100">
                          {item.customerDetail}
                        </td>

                        {/* Issued Outlet */}
                        <td className="p-3.5 border-r text-slate-800 dark:text-slate-200 font-medium">{item.outletName}</td>

                        {/* Base Cash Memo / Source Inv # */}
                        <td className="p-3.5 border-r font-mono text-sky-700 dark:text-sky-300">
                          {item.baseCashMemo !== "-" ? (
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              {item.baseCashMemo}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Valid Till */}
                        <td className="p-3.5 border-r text-slate-600 dark:text-slate-400">{item.validTill}</td>

                        {/* Discount Amount */}
                        <td className="p-3.5 border-r text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {formatPriceVal(item.discountAmount)}
                        </td>

                        {/* Amount / Face Value */}
                        <td className="p-3.5 border-r text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                          {formatPriceVal(item.faceValue)}
                        </td>

                        {/* Settled In Cash Memo # */}
                        <td className="p-3.5 border-r font-mono">
                          {isSettled ? (
                            <span className="font-semibold text-sky-600 dark:text-sky-400">{item.settledInCashMemo}</span>
                          ) : (
                            <span className="text-muted-foreground italic">{item.settledInCashMemo}</span>
                          )}
                        </td>

                        {/* Settled Date Time */}
                        <td className="p-3.5 border-r text-slate-600 dark:text-slate-400">{item.settledDateTime}</td>

                        {/* Status */}
                        <td className="p-3.5 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide",
                              item.status === "REDEEMED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300",
                            )}
                          >
                            {item.status}
                          </span>
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

            {/* GRAND TOTALS FOOTER ROW */}
            {reportData && (
              <tfoot className="sticky bottom-0 z-10 shadow-md">
                <tr className="bg-[#0f172a] text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                  <td colSpan={8} className="p-3.5 border-r text-left uppercase tracking-wider font-black bg-[#0f172a]">
                    GRAND TOTALS ({filteredItems.length} VOUCHERS)
                  </td>
                  <td className="p-3.5 border-r text-right font-black bg-[#0f172a] text-amber-300 font-mono">
                    {formatPriceVal(kpis.totalDiscount)}
                  </td>
                  <td className="p-3.5 border-r text-right font-black bg-[#0f172a] text-[#4ade80] font-mono text-sm">
                    {formatPriceVal(kpis.totalAmount)}
                  </td>
                  <td colSpan={3} className="p-3.5 bg-[#0f172a] text-sky-300 font-mono text-xs">
                    Total Settled Value: {formatPriceVal(kpis.totalSettledAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Downloader Overlay */}
      {(exportState === "queueing" || pdfExportState === "queueing") && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center pointer-events-auto">
          <div className="bg-background border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl flex flex-col items-center gap-4 text-center">
            <div className="relative h-12 w-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-foreground">Preparing Download</h4>
              <p className="text-xs text-muted-foreground">Queueing background export job... Please wait.</p>
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
          th,
          td {
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
