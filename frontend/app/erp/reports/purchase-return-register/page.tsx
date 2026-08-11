"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeft,
  Box,
  Coins,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Folder,
  Layers,
  Loader2,
  Package,
  Undo2,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { cn, getApiBaseUrl } from "@/lib/utils";

export interface PurchaseReturnRegisterVariantRow {
  color: string;
  size: string;
  barCode: string;
  returnQty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseReturnRegisterArticleGroup {
  sku: string;
  description: string;
  variants: PurchaseReturnRegisterVariantRow[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterSilhouetteGroup {
  silhouetteName: string;
  articles: PurchaseReturnRegisterArticleGroup[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterGenderGroup {
  genderName: string;
  silhouettes: PurchaseReturnRegisterSilhouetteGroup[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterCategoryGroup {
  categoryName: string;
  subCategoryName: string;
  genders: PurchaseReturnRegisterGenderGroup[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterDivisionGroup {
  divisionName: string;
  categories: PurchaseReturnRegisterCategoryGroup[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterDocumentGroup {
  returnId: string;
  returnNumber: string;
  returnDate: string;
  supplierName: string;
  supplierLocation: string;
  brandsDisplay: string;
  sourceType: string;
  returnType: string;
  status: string;
  grnNumber?: string;
  divisions: PurchaseReturnRegisterDivisionGroup[];
  totalQuantity: number;
  totalLineTotal: number;
}

export interface PurchaseReturnRegisterReportResult {
  documents: PurchaseReturnRegisterDocumentGroup[];
  grandTotals: {
    quantity: number;
    lineTotal: number;
    totalDocuments: number;
  };
  startDate: string;
  endDate: string;
  appliedFilters: {
    brandId?: string;
    supplierId?: string;
    status?: string;
    returnType?: string;
    sourceType?: string;
    search?: string;
  };
}

export default function PurchaseReturnRegisterPage() {
  const { user } = useAuth();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed; July = 6
  const fyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  const defaultStartDate = new Date(fyStartYear, 6, 1).toISOString().slice(0, 10);
  const defaultEndDate = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedBrand, setSelectedBrand] = useState("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [returnType, setReturnType] = useState("ALL");
  const [sourceType, setSourceType] = useState("ALL");
  const [search, setSearch] = useState("");

  // Report Hierarchy Configuration State
  const [hierarchyLevels, setHierarchyLevels] = useState({
    brand: true,
    division: true,
    category: true,
    gender: true,
    silhouette: true,
    article: true,
    variant: true,
  });

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  const [reportData, setReportData] = useState<PurchaseReturnRegisterReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Excel Export Background Queue States
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
  const [exportProgress, setExportProgress] = useState<number>(0);

  // PDF Export Background Queue States
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
  const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

  useEffect(() => {
    fetchOptions();
    fetchReport();
  }, []);

  const fetchOptions = async () => {
    try {
      const [brandRes, supplierRes] = await Promise.all([
        authFetch(`/master/brand`),
        authFetch(`/vendors`),
      ]);

      if (brandRes.ok && brandRes.data) {
        const bList = Array.isArray(brandRes.data) ? brandRes.data : brandRes.data.data || [];
        setBrands(bList);
      }
      if (supplierRes.ok && supplierRes.data) {
        const vList = Array.isArray(supplierRes.data) ? supplierRes.data : supplierRes.data.data || [];
        setSuppliers(vList);
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedBrand && selectedBrand !== "ALL") params.append("brandId", selectedBrand);
      if (selectedSupplier && selectedSupplier !== "ALL") params.append("supplierId", selectedSupplier);
      if (status && status !== "ALL") params.append("status", status);
      if (returnType && returnType !== "ALL") params.append("returnType", returnType);
      if (sourceType && sourceType !== "ALL") params.append("sourceType", sourceType);
      if (search) params.append("search", search);

      const res = await authFetch(`/purchase/purchase-returns/register-report/data?${params.toString()}`);
      if (res.ok && res.data) {
        setReportData(res.data);
      } else {
        toast.error("Failed to load Purchase Return Register report data");
      }
    } catch (err) {
      console.error("Error fetching Purchase Return Register report data:", err);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  // Poll Excel Export Job Status
  useEffect(() => {
    if (exportState !== "queueing" && exportState !== "processing") return;
    if (!exportJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/purchase/purchase-returns/register-report/export/${exportJobId}/status`);
        if (res.ok && res.data) {
          const { state, progress } = res.data;
          setExportProgress(progress || 0);

          if (state === "completed") {
            setExportState("completed");
            toast.success("Excel Export generated successfully! Ready to download.");
            clearInterval(interval);
          } else if (state === "failed") {
            setExportState("failed");
            toast.error("Excel export generation failed.");
            clearInterval(interval);
          } else {
            setExportState("processing");
          }
        }
      } catch (err) {
        console.error("Error checking job status:", err);
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
        const res = await authFetch(`/purchase/purchase-returns/register-report/export/${pdfJobId}/status`);
        if (res.ok && res.data) {
          const { state, progress } = res.data;
          setPdfExportProgress(progress || 0);

          if (state === "completed") {
            setPdfExportState("completed");
            toast.success("PDF Report generated successfully! Ready to download.");
            clearInterval(interval);
          } else if (state === "failed") {
            setPdfExportState("failed");
            toast.error("PDF generation failed.");
            clearInterval(interval);
          } else {
            setPdfExportState("processing");
          }
        }
      } catch (err) {
        console.error("Error checking PDF job status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pdfExportState, pdfJobId]);

  const handleExportExcelClick = async () => {
    if (exportState === "completed" && exportJobId) {
      const baseUrl = getApiBaseUrl();
      window.open(`${baseUrl}/purchase/purchase-returns/register-report/export/${exportJobId}/download`, "_blank");
      setExportState("idle");
      setExportJobId(null);
      setExportProgress(0);
      return;
    }

    setExportState("queueing");
    setExportProgress(0);
    try {
      const res = await authFetch(`/purchase/purchase-returns/register-report/export`, {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          brandId: selectedBrand !== "ALL" ? selectedBrand : undefined,
          supplierId: selectedSupplier !== "ALL" ? selectedSupplier : undefined,
          status: status !== "ALL" ? status : undefined,
          returnType: returnType !== "ALL" ? returnType : undefined,
          sourceType: sourceType !== "ALL" ? sourceType : undefined,
          format: "xlsx",
          search: search || undefined,
        }),
      });

      if (res.ok && res.data?.jobId) {
        setExportJobId(res.data.jobId);
        setExportState("processing");
        toast.info("Excel export queued in background...");
      } else {
        setExportState("failed");
        toast.error("Failed to queue Excel export");
      }
    } catch (err) {
      setExportState("failed");
      toast.error("Error queueing Excel export");
    }
  };

  const handleExportPdfClick = async () => {
    if (pdfExportState === "completed" && pdfJobId) {
      const baseUrl = getApiBaseUrl();
      window.open(`${baseUrl}/purchase/purchase-returns/register-report/export/${pdfJobId}/download`, "_blank");
      setPdfExportState("idle");
      setPdfJobId(null);
      setPdfExportProgress(0);
      return;
    }

    setPdfExportState("queueing");
    setPdfExportProgress(0);
    try {
      const res = await authFetch(`/purchase/purchase-returns/register-report/export`, {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          brandId: selectedBrand !== "ALL" ? selectedBrand : undefined,
          supplierId: selectedSupplier !== "ALL" ? selectedSupplier : undefined,
          status: status !== "ALL" ? status : undefined,
          returnType: returnType !== "ALL" ? returnType : undefined,
          sourceType: sourceType !== "ALL" ? sourceType : undefined,
          format: "pdf",
          search: search || undefined,
        }),
      });

      if (res.ok && res.data?.jobId) {
        setPdfJobId(res.data.jobId);
        setPdfExportState("processing");
        toast.info("PDF generation queued headlessly...");
      } else {
        setPdfExportState("failed");
        toast.error("Failed to queue PDF export");
      }
    } catch (err) {
      setPdfExportState("failed");
      toast.error("Error queueing PDF export");
    }
  };

  const toggleHierarchy = (key: keyof typeof hierarchyLevels) => {
    if (key === "brand") return;
    setHierarchyLevels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatVal = (val: number) => {
    if (val === 0 || val === null || val === undefined) return "-";
    return val.toLocaleString();
  };

  const formatPriceVal = (val: number) => {
    if (val === 0 || val === null || val === undefined) return "-";
    return `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Flatten nested tree for TanStack virtualization
  const flatRows = useMemo(() => {
    const rows: any[] = [];
    if (!reportData || !Array.isArray(reportData.documents)) return rows;

    for (const doc of reportData.documents) {
      rows.push({
        id: `doc-${doc.returnId}`,
        type: "doc-header",
        doc,
      });

      for (const div of doc.divisions) {
        if (hierarchyLevels.division && div.divisionName) {
          rows.push({
            id: `div-${doc.returnId}-${div.divisionName}`,
            type: "division",
            label: div.divisionName,
            totals: { quantity: div.totalQuantity, amount: div.totalLineTotal },
          });
        }

        for (const cat of div.categories) {
          if (hierarchyLevels.category) {
            rows.push({
              id: `cat-${doc.returnId}-${cat.categoryName}`,
              type: "category",
              label: cat.categoryName,
              subCategoryName: cat.subCategoryName,
              totals: { quantity: cat.totalQuantity, amount: cat.totalLineTotal },
            });
          }

          for (const gen of cat.genders) {
            if (hierarchyLevels.gender && gen.genderName && gen.genderName !== "UNASSIGNED") {
              rows.push({
                id: `gen-${doc.returnId}-${gen.genderName}`,
                type: "gender",
                label: gen.genderName,
                totals: { quantity: gen.totalQuantity, amount: gen.totalLineTotal },
              });
            }

            for (const sil of gen.silhouettes) {
              if (hierarchyLevels.silhouette && sil.silhouetteName && sil.silhouetteName !== "GENERAL") {
                rows.push({
                  id: `sil-${doc.returnId}-${sil.silhouetteName}`,
                  type: "silhouette",
                  label: sil.silhouetteName,
                  totals: { quantity: sil.totalQuantity, amount: sil.totalLineTotal },
                });
              }

              for (const art of sil.articles) {
                if (hierarchyLevels.article) {
                  rows.push({
                    id: `art-${doc.returnId}-${art.sku}`,
                    type: "article",
                    sku: art.sku,
                    description: art.description,
                    totals: { quantity: art.totalQuantity, amount: art.totalLineTotal },
                  });
                }

                if (hierarchyLevels.variant) {
                  for (const v of art.variants) {
                    rows.push({
                      id: `var-${doc.returnId}-${art.sku}-${v.color}-${v.size}-${v.barCode}`,
                      type: "variant",
                      color: v.color,
                      size: v.size,
                      barCode: v.barCode,
                      unitPrice: v.unitPrice,
                      totals: { quantity: v.returnQty, amount: v.lineTotal },
                    });
                  }
                }
              }
            }
          }
        }
      }

      rows.push({
        id: `doc-total-${doc.returnId}`,
        type: "doc-total",
        returnNumber: doc.returnNumber,
        totals: { quantity: doc.totalQuantity, amount: doc.totalLineTotal },
      });
    }

    return rows;
  }, [reportData, hierarchyLevels]);

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  // Active distinct brands count
  const distinctBrandsCount = useMemo(() => {
    if (!reportData || !reportData.documents) return 0;
    const bSet = new Set<string>();
    reportData.documents.forEach((d) => {
      if (d.brandsDisplay) {
        d.brandsDisplay.split("|").forEach((b) => bSet.add(b.trim()));
      }
    });
    return bSet.size;
  }, [reportData]);

  return (
    <PermissionGuard permissions="erp.procurement.pr.read">
      <div className="space-y-6 p-1 sm:p-6 max-w-[1600px] mx-auto">
        {/* Top Bar Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div className="flex items-center gap-3">
            <Link href="/erp/procurement/purchase-returns">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Purchase Return Register Report
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Virtualized Purchase Return ledger grouped by Division &rarr; Category &rarr; Gender &rarr; Silhouette &rarr; SKU &rarr; Variant.
              </p>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2">
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
              {exportState === "idle" && <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
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
              {pdfExportState === "idle" && <FileText className="h-3.5 w-3.5 text-rose-600" />}
              {pdfExportState === "queueing" && "Queueing..."}
              {pdfExportState === "processing" && `Generating ${pdfExportProgress}%`}
              {pdfExportState === "completed" && "Download PDF"}
              {pdfExportState === "failed" && "Retry PDF Export"}
              {pdfExportState === "idle" && "Export PDF"}
            </Button>
          </div>
        </div>

        {/* Top KPI Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Returns</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {reportData?.grandTotals?.totalDocuments || 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Undo2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Returned Qty</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {formatVal(reportData?.grandTotals?.quantity || 0)}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Package className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Return Value</p>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {formatPriceVal(reportData?.grandTotals?.lineTotal || 0)}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Coins className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Brands</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {distinctBrandsCount}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Hierarchy Configuration Bar */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-950">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
              <SlidersHorizontal className="h-4 w-4 text-purple-600" />
              <span>Report Hierarchy Configuration</span>
            </div>
            <p className="text-xs text-slate-500">
              Customize the nesting structure. Check the levels you want to group and report by.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div
                onClick={() => toggleHierarchy("brand")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-not-allowed select-none transition-all",
                  hierarchyLevels.brand
                    ? "bg-slate-100 border-slate-300 text-slate-700 opacity-80 dark:bg-slate-800 dark:text-slate-300"
                    : "bg-white border-slate-200 text-slate-400"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.brand} readOnly className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>Brand</span>
              </div>

              <div
                onClick={() => toggleHierarchy("division")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.division
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.division} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <Folder className="h-3.5 w-3.5 text-purple-600" />
                <span>Division</span>
              </div>

              <div
                onClick={() => toggleHierarchy("category")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.category
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.category} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <ShoppingCart className="h-3.5 w-3.5 text-purple-600" />
                <span>Category</span>
              </div>

              <div
                onClick={() => toggleHierarchy("gender")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.gender
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.gender} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <Store className="h-3.5 w-3.5 text-purple-600" />
                <span>Gender</span>
              </div>

              <div
                onClick={() => toggleHierarchy("silhouette")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.silhouette
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.silhouette} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <TrendingUp className="h-3.5 w-3.5 text-purple-600" />
                <span>Silhouette</span>
              </div>

              <div
                onClick={() => toggleHierarchy("article")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.article
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.article} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <ShoppingBag className="h-3.5 w-3.5 text-purple-600" />
                <span>Article</span>
              </div>

              <div
                onClick={() => toggleHierarchy("variant")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none transition-all",
                  hierarchyLevels.variant
                    ? "bg-purple-50 border-purple-300 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                )}
              >
                <input type="checkbox" checked={hierarchyLevels.variant} onChange={() => {}} className="rounded border-slate-300 text-purple-600 accent-purple-600 h-3.5 w-3.5" />
                <Box className="h-3.5 w-3.5 text-purple-600" />
                <span>Variant (Sizes)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters Card */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Report Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Start Date (Financial Year Start)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 mt-1" />
              </div>

              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 mt-1" />
              </div>

              <div>
                <Label className="text-xs">Brand</Label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
                >
                  <option value="ALL">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Supplier / Vendor</Label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Return Type</Label>
                <select
                  value={returnType}
                  onChange={(e) => setReturnType(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
                >
                  <option value="ALL">All Return Types</option>
                  <option value="DEFECTIVE">DEFECTIVE</option>
                  <option value="EXCESS">EXCESS</option>
                  <option value="WRONG_ITEM">WRONG ITEM</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="SHORTAGE">SHORTAGE</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Source Type</Label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
                >
                  <option value="ALL">All Source Types</option>
                  <option value="GRN">GRN</option>
                  <option value="LANDED_COST">LANDED COST</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Quick Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search Return #, Supplier, SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={fetchReport} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* TanStack Virtualized Table Preview Card */}
        <Card className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
          <CardHeader className="border-b bg-slate-50/60 dark:bg-slate-900/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Purchase Return Register Preview ({reportData?.grandTotals?.totalDocuments || 0} Documents)
              </CardTitle>
              <div className="text-xs font-bold text-red-600 underline">
                {startDate} - {endDate}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center h-56">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : !reportData || flatRows.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm font-medium">
                No purchase return records match the selected filter criteria.
              </div>
            ) : (
              <div ref={parentRef} className="overflow-auto max-h-[750px] relative">
                <table className="w-full text-xs border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "42%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-slate-900 text-slate-100 border-b border-slate-800 text-left font-bold shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3">GPC / Category / Product Description</th>
                      <th className="py-2.5 px-3 text-center">Color</th>
                      <th className="py-2.5 px-3 text-center">Size</th>
                      <th className="py-2.5 px-3 text-center">Barcode</th>
                      <th className="py-2.5 px-3 text-right">Return Qty</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paddingTop > 0 && (
                      <tr>
                        <td colSpan={6} style={{ height: `${paddingTop}px` }} />
                      </tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                      const row = flatRows[virtualRow.index];
                      if (!row) return null;

                      if (row.type === "doc-header") {
                        const { doc } = row;
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-900 text-slate-100 font-bold border-b border-slate-800 border-t-2 border-t-slate-700"
                          >
                            <td colSpan={6} className="p-3">
                              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex flex-wrap items-center gap-6">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Return Number</span>
                                    <span className="text-rose-400 font-black text-sm underline">{doc.returnNumber}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Brands</span>
                                    <span className="font-bold text-indigo-300 text-sm uppercase tracking-wide">{doc.brandsDisplay}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date</span>
                                    <span className="font-semibold text-slate-200">{doc.returnDate}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Supplier</span>
                                    <span className="font-semibold text-slate-100">{doc.supplierName}</span>
                                    <span className="text-slate-400 ml-1.5">({doc.supplierLocation})</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Return Type</span>
                                    <span className="font-semibold text-amber-300">{doc.returnType}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] font-semibold border-slate-700 text-slate-300">{doc.sourceType}</Badge>
                                  <Badge className="text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">{doc.status}</Badge>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (row.type === "division") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-800 text-slate-100 font-bold text-[11px] border-b border-slate-700"
                          >
                            <td colSpan={4} className="p-2 pl-4 text-blue-300">
                              DIVISION: {row.label}
                            </td>
                            <td className="p-2 text-right">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right text-emerald-400 font-bold">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "category") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-700 text-slate-100 font-semibold text-[11px] border-b border-slate-600"
                          >
                            <td colSpan={4} className="p-2 pl-8 text-emerald-300">
                              CATEGORY: {row.label}
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-300">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "gender") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-600 text-slate-100 font-medium text-[11px] border-b border-slate-500"
                          >
                            <td colSpan={4} className="p-2 pl-12 text-rose-200">
                              GENDER: {row.label}
                            </td>
                            <td className="p-2 text-right font-semibold text-rose-200">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right font-semibold text-rose-200">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "silhouette") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-500 text-slate-100 font-medium text-[11px] border-b border-slate-400"
                          >
                            <td colSpan={4} className="p-2 pl-16 text-amber-200">
                              SILHOUETTE: {row.label}
                            </td>
                            <td className="p-2 text-right font-semibold text-amber-200">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right font-semibold text-amber-200">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "article") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                          >
                            <td className="p-2 pl-20 font-mono text-xs" colSpan={4}>
                              SKU: <span className="text-primary font-bold">{row.sku}</span> ({row.description})
                            </td>
                            <td className="p-2 text-right text-primary font-bold">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "variant") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-background hover:bg-slate-50 dark:hover:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <td className="p-2 pl-24 italic text-muted-foreground">
                              &mdash; Variant Detail
                            </td>
                            <td className="p-2 text-center font-semibold text-foreground">{row.color}</td>
                            <td className="p-2 text-center font-bold text-foreground">{row.size}</td>
                            <td className="p-2 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px]">{row.barCode}</td>
                            <td className="p-2 text-right font-bold text-foreground">{formatVal(row.totals.quantity)}</td>
                            <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatPriceVal(row.totals.amount)}</td>
                          </tr>
                        );
                      }

                      if (row.type === "doc-total") {
                        return (
                          <tr
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="bg-slate-900 text-slate-100 font-black border-b border-slate-800 text-right"
                          >
                            <td colSpan={4} className="p-2.5 text-right text-rose-400 uppercase tracking-wide">
                              TOTAL FOR RETURN #{row.returnNumber}
                            </td>
                            <td className="p-2.5 text-right text-rose-400 text-sm font-black">
                              {formatVal(row.totals.quantity)}
                            </td>
                            <td className="p-2.5 text-right text-emerald-400 text-sm font-black">
                              {formatPriceVal(row.totals.amount)}
                            </td>
                          </tr>
                        );
                      }

                      return null;
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td colSpan={6} style={{ height: `${paddingBottom}px` }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
