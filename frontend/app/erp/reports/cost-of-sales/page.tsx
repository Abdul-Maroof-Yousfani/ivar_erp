"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getLocations, Location } from "@/lib/actions/location";
import {
  getCostOfSalesReport,
  queueCostOfSalesExport,
  getCostOfSalesExportStatus,
  CostOfSalesReportData,
} from "@/lib/actions/cost-of-sales";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Download,
  Printer,
  Loader2,
  Calendar,
  Store,
  Layers,
  ShoppingCart,
  Inbox,
  RefreshCw,
  Folder,
  Coins,
  Search,
  X,
  SlidersHorizontal,
  DollarSign,
  Tag,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl, formatCurrency } from "@/lib/utils";

export default function CostOfSalesReportPage() {
  const { user } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
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

  const [groupingLevels, setGroupingLevels] = useState({
    brand: true,
    division: true,
    category: true,
    gender: true,
    article: true,
    variant: true,
  });

  const [reportData, setReportData] = useState<CostOfSalesReportData | null>(null);
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
      const result = await getCostOfSalesReport({
        locationId: locationParam ?? "",
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        search: searchQuery.trim() || undefined,
      });
      if (result && result.status && result.data) {
        setReportData(result.data);
      } else {
        setReportData(null);
        toast.error("Failed to load Cost of Sales report data");
      }
    });
  }, [locationParam, dateRange, searchQuery]);

  useEffect(() => {
    fetchReport();
  }, [locationParam, dateRange]);

  // Poll Excel Export Job Status
  useEffect(() => {
    if (exportState !== "queueing" && exportState !== "processing") return;
    if (!exportJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getCostOfSalesExportStatus(exportJobId);
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
        const res = await getCostOfSalesExportStatus(pdfJobId);
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
      const url = `${base}/api/pos-sales/reports/cost-of-sales/export-download/${exportJobId}`;
      window.open(url, "_blank");

      setExportState("idle");
      setExportJobId(null);
      setExportProgress(0);
      return;
    }

    setExportState("queueing");
    try {
      const res = await queueCostOfSalesExport({
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
      const url = `${base}/api/pos-sales/reports/cost-of-sales/export-download/${pdfJobId}`;
      window.open(url, "_blank");

      setPdfExportState("idle");
      setPdfJobId(null);
      setPdfExportProgress(0);
      return;
    }

    setPdfExportState("queueing");
    try {
      const res = await queueCostOfSalesExport({
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

  // Client-Side Search & Hierarchy Filtering (Brand -> Division -> Gender -> Category -> Product SKU)
  const filteredBrands = useMemo(() => {
    if (!reportData || !reportData.brands) return [];
    if (!searchQuery.trim()) return reportData.brands;
    const query = searchQuery.toLowerCase().trim();

    return reportData.brands
      .map((brand) => {
        const filteredDivisions = brand.divisions
          .map((div) => {
            const filteredGenders = div.genders
              .map((gender) => {
                const filteredCategories = gender.categories
                  .map((cat) => {
                    const filteredProducts = cat.products.filter((prod) => {
                      const matchesProd =
                        prod.sku.toLowerCase().includes(query) ||
                        prod.description.toLowerCase().includes(query) ||
                        prod.productLabel.toLowerCase().includes(query);
                      const matchesSizeOrColor = prod.sizes.some(
                        (s) => s.size.toLowerCase().includes(query) || (s.color && s.color.toLowerCase().includes(query)),
                      );
                      return matchesProd || matchesSizeOrColor;
                    });

                    if (
                      filteredProducts.length > 0 ||
                      cat.categoryName.toLowerCase().includes(query)
                    ) {
                      return { ...cat, products: filteredProducts.length > 0 ? filteredProducts : cat.products };
                    }
                    return null;
                  })
                  .filter(Boolean) as any[];

                if (
                  filteredCategories.length > 0 ||
                  gender.genderName.toLowerCase().includes(query)
                ) {
                  return { ...gender, categories: filteredCategories };
                }
                return null;
              })
              .filter(Boolean) as any[];

            if (
              filteredGenders.length > 0 ||
              div.divisionName.toLowerCase().includes(query)
            ) {
              return { ...div, genders: filteredGenders };
            }
            return null;
          })
          .filter(Boolean) as any[];

        if (filteredDivisions.length > 0 || brand.brandName.toLowerCase().includes(query)) {
          return { ...brand, divisions: filteredDivisions };
        }
        return null;
      })
      .filter(Boolean) as typeof reportData.brands;
  }, [reportData, searchQuery]);

  // Grand Totals Calculation
  const grandTotals = useMemo(() => {
    const totals = {
      totalProducts: 0,
      quantity: 0,
      totalCost: 0,
      avgUnitCost: 0,
    };

    if (!filteredBrands) return totals;

    for (const brand of filteredBrands) {
      for (const div of brand.divisions) {
        for (const gender of div.genders) {
          for (const cat of gender.categories) {
            totals.totalProducts += cat.products.length;
            for (const prod of cat.products) {
              totals.quantity += prod.totals.quantity;
              totals.totalCost += prod.totals.totalCost;
            }
          }
        }
      }
    }

    if (totals.quantity > 0) {
      totals.avgUnitCost = Math.round((totals.totalCost / totals.quantity) * 100) / 100;
    }

    return totals;
  }, [filteredBrands]);

  // Flatten tree directly starting at Brand (Brand -> Division -> Gender -> Category -> Product SKU -> Variant)
  const flatRows = useMemo(() => {
    const rows: any[] = [];
    if (!filteredBrands) return rows;

    for (const brand of filteredBrands) {
      if (groupingLevels.brand) {
        rows.push({
          type: "brand",
          id: `brand-${brand.brandId}`,
          label: `BRAND: ${brand.brandName.toUpperCase()}`,
          totals: brand.totals,
        });
      }

      for (const div of brand.divisions) {
        if (groupingLevels.division) {
          rows.push({
            type: "division",
            id: `div-${div.divisionId}`,
            label: `DIVISION: ${div.divisionName.toUpperCase()}`,
            totals: div.totals,
          });
        }

        for (const gender of div.genders) {
          if (groupingLevels.gender) {
            rows.push({
              type: "gender",
              id: `gender-${gender.genderId}`,
              label: `GENDER: ${gender.genderName.toUpperCase()}`,
              totals: gender.totals,
            });
          }

          for (const cat of gender.categories) {
            if (groupingLevels.category) {
              rows.push({
                type: "category",
                id: `cat-${cat.categoryId}`,
                label: `CATEGORY: ${cat.categoryName.toUpperCase()}`,
                totals: cat.totals,
              });
            }

            for (const prod of cat.products) {
              if (groupingLevels.article) {
                rows.push({
                  type: "article",
                  id: `prod-${prod.sku}`,
                  sku: prod.sku,
                  label: prod.description || prod.sku,
                  totals: prod.totals,
                });
              }

              if (groupingLevels.variant) {
                for (const item of prod.sizes) {
                  rows.push({
                    type: "variant",
                    id: `item-${item.id}`,
                    sku: prod.sku,
                    size: item.size,
                    color: item.color,
                    quantity: item.quantity,
                    costPrice: item.costPrice,
                    totalCost: item.totalCost,
                  });
                }
              }
            }
          }
        }
      }
    }

    return rows;
  }, [filteredBrands, groupingLevels]);

  const handleToggleLevel = (level: keyof typeof groupingLevels, checked: boolean) => {
    setGroupingLevels((prev) => {
      const next = { ...prev, [level]: checked };
      if (level === "brand" && checked) next.division = true;
      if (level === "division" && !checked) next.brand = false;
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

  const formatVal = (val: number) => (val === 0 ? "-" : val.toLocaleString());
  const formatPriceVal = (val: number) => (val === 0 ? "-" : formatCurrency(val));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            Cost of Sales Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            <Store className="h-4 w-4 text-emerald-600/70" />
            Cost of Goods Sold (COGS) & Article Valuation for{" "}
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
        <h2 className="text-lg font-bold text-center text-slate-700">Cost of Sales Report</h2>
        <p className="text-sm text-center text-slate-600 mt-1">Outlets: {activeSelectionNames}</p>
        <p className="text-xs text-center text-slate-500">
          Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
          {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
        <div className="flex flex-wrap items-end gap-4 flex-1">
          {/* Location Multi-Select */}
          <div className="flex flex-col gap-1.5 min-w-[280px]">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <Store className="h-3.5 w-3.5 text-emerald-600" />
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
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
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
              <Search className="h-3.5 w-3.5 text-emerald-600" />
              Quick Search
            </span>
            <div className="relative">
              <Input
                placeholder="Search by SKU, Product Description, Size, Color, Category, Brand..."
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
          <Button onClick={fetchReport} disabled={isPending} className="h-10 px-5 font-bold gap-1.5">
            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            Refresh Report
          </Button>
        </div>
      </div>

      {/* Hierarchy Configuration Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
              Report Hierarchy Configuration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize the nesting structure. Check the levels you want to group and report by (Brand &rarr; Division &rarr; Gender &rarr; Category &rarr; Product SKU &rarr; Variant).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-2">
          {/* Brand (Root Level) */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="checkbox"
              id="group-brand"
              checked={groupingLevels.brand}
              onChange={(e) => handleToggleLevel("brand", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="group-brand" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              Brand
            </label>
          </div>

          {/* Division (Inside Brand) */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="checkbox"
              id="group-division"
              checked={groupingLevels.division}
              onChange={(e) => handleToggleLevel("division", e.target.checked)}
              disabled={groupingLevels.brand}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer disabled:opacity-50"
            />
            <label
              htmlFor="group-division"
              className={cn(
                "text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5",
                groupingLevels.brand && "opacity-60 cursor-not-allowed",
              )}
            >
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
              onChange={(e) => handleToggleLevel("category", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="group-category" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-teal-500" />
              Category
            </label>
          </div>

          {/* Gender */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="checkbox"
              id="group-gender"
              checked={groupingLevels.gender}
              onChange={(e) => handleToggleLevel("gender", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="group-gender" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-rose-500" />
              Gender
            </label>
          </div>

          {/* Product SKU */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="checkbox"
              id="group-article"
              checked={groupingLevels.article}
              onChange={(e) => handleToggleLevel("article", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="group-article" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5 text-cyan-500" />
              Product SKU
            </label>
          </div>

          {/* Variant (Sizes & Colors) */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="checkbox"
              id="group-variant"
              checked={groupingLevels.variant}
              onChange={(e) => handleToggleLevel("variant", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="group-variant" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-amber-500" />
              Variant Details
            </label>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sold Products</p>
              <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{grandTotals.totalProducts}</h3>
            </div>
            <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sold Quantity</p>
              <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatVal(grandTotals.quantity)}</h3>
            </div>
            <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
              <Inbox className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Cost of Sales (COGS)</p>
              <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatPriceVal(grandTotals.totalCost)}</h3>
            </div>
            <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Virtualized Scrolling Table */}
      <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-[#1e293b] text-slate-100 border-b border-border/80 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-sm">
              <th className="p-3 w-[300px] border-r bg-[#1e293b]">GPC / Category / Product</th>
              <th className="p-3 w-[120px] border-r bg-[#1e293b]">SKU</th>
              <th className="p-3 w-[80px] border-r text-center bg-[#1e293b]">Size</th>
              <th className="p-3 w-[100px] border-r text-center bg-[#1e293b]">Color</th>
              <th className="p-3 w-[100px] border-r text-right bg-[#1e293b]">Quantity</th>
              <th className="p-3 w-[130px] border-r text-right bg-[#1e293b]">Cost Price (Rs.)</th>
              <th className="p-3 w-[150px] text-right bg-[#0f172a] font-extrabold text-emerald-300">Total Cost (Rs.)</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {isPending ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    Aggregating cost of sales and sold product metrics...
                  </div>
                </td>
              </tr>
            ) : flatRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                  No sold products match the selected outlets, period, or search query.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const row = flatRows[virtualRow.index];

                  const LEVEL_UI_STYLES: Record<string, { className: string; indentClass: string }> = {
                    brand: { className: "bg-[#0f172a] text-white font-black border-b h-[40px]", indentClass: "pl-3 text-white" },
                    division: { className: "bg-[#1e293b] text-white font-extrabold border-b h-[40px]", indentClass: "pl-6 text-white" },
                    gender: { className: "bg-[#334155] text-white font-semibold border-b h-[40px]", indentClass: "pl-9 text-white" },
                    category: { className: "bg-[#475569] text-slate-100 font-medium border-b h-[40px]", indentClass: "pl-12 text-slate-100" },
                    article: { className: "bg-[#f1f5f9] dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 font-bold border-b h-[45px]", indentClass: "pl-16" },
                    variant: { className: "hover:bg-slate-50 dark:hover:bg-slate-900/35 text-slate-600 dark:text-slate-400 bg-background transition-colors h-[36px]", indentClass: "pl-20" },
                  };

                  const style = LEVEL_UI_STYLES[row.type] || LEVEL_UI_STYLES.brand;
                  const isArticle = row.type === "article";
                  const isVariant = row.type === "variant";
                  const isHeaderRow = ["brand", "division", "gender", "category"].includes(row.type);

                  const totals = row.totals || { quantity: 0, totalCost: 0, avgUnitCost: 0 };
                  const qty = isVariant ? row.quantity || 0 : totals.quantity || 0;
                  const totalCost = isVariant ? row.totalCost || 0 : totals.totalCost || 0;
                  const avgUnitCost = isVariant
                    ? row.costPrice || 0
                    : totals.avgUnitCost || (qty > 0 ? Math.round((totalCost / qty) * 100) / 100 : 0);

                  const cellTextClass = isHeaderRow
                    ? "text-white font-bold"
                    : isArticle
                      ? "text-slate-800 dark:text-slate-200 font-semibold"
                      : "text-slate-700 dark:text-slate-350 font-medium";

                  const valueCellClass = isHeaderRow
                    ? "text-[#4ade80] dark:text-emerald-400 font-black bg-emerald-500/15"
                    : isArticle
                      ? "text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/5"
                      : "text-emerald-600 dark:text-emerald-450 font-semibold bg-emerald-500/5";

                  return (
                    <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className={style.className}>
                      {isArticle ? (
                        <td className={cn("p-3 border-r font-bold text-slate-900 dark:text-slate-100", style.indentClass)}>
                          {row.label}
                        </td>
                      ) : isVariant ? (
                        <td className={cn("p-3 border-r text-muted-foreground italic", style.indentClass)}>
                          &mdash; Variant Item
                        </td>
                      ) : (
                        <td className={cn("p-3 border-r text-xs font-bold", style.indentClass)}>
                          {row.label}
                        </td>
                      )}

                      {/* Separate SKU Column */}
                      {isArticle ? (
                        <td className="p-3 border-r font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-slate-50/20">
                          {row.sku}
                        </td>
                      ) : isVariant ? (
                        <td className="p-3 border-r font-mono text-xs text-muted-foreground">
                          {row.sku}
                        </td>
                      ) : (
                        <td className="p-3 border-r text-center text-muted-foreground font-mono">&mdash;</td>
                      )}

                      {/* Size Column */}
                      {isArticle && (
                        <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase bg-slate-50/20">All Sizes</td>
                      )}
                      {isVariant && (
                        <td className="p-3 border-r text-center font-bold text-slate-800 dark:text-slate-200">{row.size}</td>
                      )}
                      {!isArticle && !isVariant && (
                        <td className="p-3 border-r text-center text-muted-foreground font-mono">&mdash;</td>
                      )}

                      {/* Color Column */}
                      {isArticle && (
                        <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase bg-slate-50/20">All Colors</td>
                      )}
                      {isVariant && (
                        <td className="p-3 border-r text-center font-semibold text-slate-700 dark:text-slate-300">{row.color || "N/A"}</td>
                      )}
                      {!isArticle && !isVariant && (
                        <td className="p-3 border-r text-center text-muted-foreground font-mono">&mdash;</td>
                      )}

                      {/* Quantity */}
                      <td className={cn("p-3 border-r text-right font-mono", cellTextClass)}>{formatVal(qty)}</td>

                      {/* Cost Price (Rs.) Column */}
                      <td className={cn("p-3 border-r text-right font-mono font-semibold", cellTextClass)}>
                        {formatPriceVal(avgUnitCost)}
                      </td>

                      {/* Total Cost (Rs.) */}
                      <td className={cn("p-3 text-right font-mono", valueCellClass)}>
                        {formatPriceVal(totalCost)}
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>

          {/* GRAND TOTALS FOOTER ROW */}
          {reportData && (
            <tfoot className="sticky bottom-0 z-10 shadow-md">
              <tr className="bg-[#1e293b] text-slate-100 font-extrabold border-t-2 border-slate-900 text-xs">
                <td colSpan={4} className="p-3 border-r text-left uppercase tracking-wider font-black bg-[#1e293b]">
                  GRAND TOTALS (ALL OUTLETS)
                </td>
                <td className="p-3 border-r text-right font-black bg-[#1e293b] text-white font-mono">{formatVal(grandTotals.quantity)}</td>
                <td className="p-3 border-r text-right font-black bg-[#1e293b] text-emerald-300 font-mono">
                  {formatPriceVal(grandTotals.avgUnitCost)}
                </td>
                <td className="p-3 text-right font-black bg-[#0f172a] text-[#4ade80] font-mono text-sm">{formatPriceVal(grandTotals.totalCost)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Downloader Overlay */}
      {(exportState === "queueing" || pdfExportState === "queueing") && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center pointer-events-auto">
          <div className="bg-background border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl flex flex-col items-center gap-4 text-center">
            <div className="relative h-12 w-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
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
