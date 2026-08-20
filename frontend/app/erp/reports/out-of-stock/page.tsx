"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  PackageX,
  RefreshCw,
  Download,
  Printer,
  Search,
  SlidersHorizontal,
  Store,
  Warehouse as WarehouseIcon,
  Truck,
  TrendingDown,
  Coins,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Building2,
  Tag,
  Boxes,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOutOfStockReport,
  queueOutOfStockReportExport,
} from "@/lib/actions/stock-ledger";
import { getLocations } from "@/lib/actions/location";
import { getWarehouses } from "@/lib/actions/warehouse";
import { getBrands } from "@/lib/actions/brand";
import { getCategories } from "@/lib/actions/category";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";

export default function OutOfStockReportPage() {
  const router = useRouter();

  // Filters State
  const [locationId, setLocationId] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [threshold, setThreshold] = useState<"zero" | "negative" | "low_stock" | "all">("zero");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("salesLast30Days");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch Master Data
  const { data: locationsData } = useQuery({
    queryKey: ["oos-locations"],
    queryFn: () => getLocations(),
    staleTime: 60_000,
  });
  const locationsList = locationsData?.data ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ["oos-warehouses"],
    queryFn: () => getWarehouses(),
    staleTime: 60_000,
  });
  const warehousesList = warehousesData?.data ?? [];

  const { data: brandsData } = useQuery({
    queryKey: ["oos-brands"],
    queryFn: () => getBrands(),
    staleTime: 60_000,
  });
  const brandsList = brandsData?.data ?? [];

  const { data: categoriesData } = useQuery({
    queryKey: ["oos-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });
  const categoriesList = categoriesData?.data ?? [];

  // Query Out-of-Stock Report Data
  const {
    data: reportResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      "out-of-stock-report",
      locationId,
      warehouseId,
      selectedBrand,
      selectedCategory,
      threshold,
      search,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ],
    queryFn: () =>
      getOutOfStockReport({
        locationId: locationId === "all" ? undefined : locationId,
        warehouseId: warehouseId === "all" ? undefined : warehouseId,
        brandIds: selectedBrand === "all" ? undefined : [selectedBrand],
        categoryIds: selectedCategory === "all" ? undefined : [selectedCategory],
        threshold,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize,
      }),
    staleTime: 10_000,
  });

  const records = reportResponse?.data?.data ?? [];
  const summary = reportResponse?.data?.summary ?? {
    totalOutOfStockItems: 0,
    totalNegativeStockItems: 0,
    totalLowStockItems: 0,
    replenishableFromWarehouseCount: 0,
    interStoreTransferableCount: 0,
    companyWideDepletedCount: 0,
    totalPotentialLostSalesValue: 0,
  };
  const meta = reportResponse?.data?.meta ?? { total: 0, page: 1, limit: pageSize, totalPages: 0 };

  // Export Handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await queueOutOfStockReportExport({
        locationId: locationId === "all" ? undefined : locationId,
        warehouseId: warehouseId === "all" ? undefined : warehouseId,
        brandIds: selectedBrand === "all" ? undefined : [selectedBrand],
        categoryIds: selectedCategory === "all" ? undefined : [selectedCategory],
        threshold,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        format: "xlsx",
      });

      if (res?.status) {
        toast.success(res.message || "Out-of-Stock report export queued. Check notifications when ready.");
      } else {
        toast.error(res?.message || "Failed to queue export");
      }
    } catch {
      toast.error("Failed to connect to export service");
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setLocationId("all");
    setWarehouseId("all");
    setSelectedBrand("all");
    setSelectedCategory("all");
    setThreshold("zero");
    setSearch("");
    setSortBy("salesLast30Days");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReplenish = (sku: string, targetLocationId?: string | null) => {
    const query = new URLSearchParams();
    query.set("sku", sku);
    if (targetLocationId) query.set("toLocationId", targetLocationId);
    router.push(`/erp/inventory/transactions/stock-transfer?${query.toString()}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
              <PackageX className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Out-of-Stock Items Report
                <Badge variant="outline" className="text-xs uppercase bg-rose-500/10 text-rose-600 border-rose-500/20 font-mono font-bold">
                  {meta.total} Depleted SKUs
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Monitor depleted items, sales velocity, and identify warehouse replenishment opportunities across retail stores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (isLoading || isRefetching) && "animate-spin")} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="h-9 gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? "Queuing..." : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Depleted SKUs
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {summary.totalOutOfStockItems.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Available Stock &le; 0
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                WH Replenishable
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {summary.replenishableFromWarehouseCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600/90 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Available in Central WH
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Inter-Store Transferable
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {summary.interStoreTransferableCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-blue-600/90 font-medium">
                Stock in other outlets
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
              <Store className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Fully Depleted
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {summary.companyWideDepletedCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-600/90 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                0 stock in whole enterprise
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Lost Sales Demand
              </div>
              <div className="text-2xl font-bold font-mono text-violet-600 dark:text-violet-400">
                Rs. {formatCurrency(summary.totalPotentialLostSalesValue)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                30-day demand value
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center border border-violet-500/20">
              <Coins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters Section ── */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter & Segmentation Criteria
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Search Product</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="SKU, Barcode, Name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Location Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Outlet Location</label>
              <Select
                value={locationId}
                onValueChange={(val) => {
                  setLocationId(val);
                  if (val !== "all") setWarehouseId("all");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets (Enterprise)</SelectItem>
                  {locationsList.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Central Warehouse</label>
              <Select
                value={warehouseId}
                onValueChange={(val) => {
                  setWarehouseId(val);
                  if (val !== "all") setLocationId("all");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehousesList.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Brand</label>
              <Select
                value={selectedBrand}
                onValueChange={(val) => {
                  setSelectedBrand(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brandsList.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoriesList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Threshold Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Threshold:</span>
              <Button
                variant={threshold === "zero" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setThreshold("zero");
                  setCurrentPage(1);
                }}
                className="h-7 text-xs rounded-full px-3"
              >
                Out of Stock (Available &le; 0)
              </Button>
              <Button
                variant={threshold === "negative" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setThreshold("negative");
                  setCurrentPage(1);
                }}
                className="h-7 text-xs rounded-full px-3"
              >
                Negative Stock (&lt; 0)
              </Button>
              <Button
                variant={threshold === "low_stock" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setThreshold("low_stock");
                  setCurrentPage(1);
                }}
                className="h-7 text-xs rounded-full px-3"
              >
                Low Stock Alert (&le; 5)
              </Button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort By:</span>
              <Select
                value={sortBy}
                onValueChange={(val) => {
                  setSortBy(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salesLast30Days">Highest 30-Day Sales</SelectItem>
                  <SelectItem value="sku">SKU Code</SelectItem>
                  <SelectItem value="description">Product Name</SelectItem>
                  <SelectItem value="unitPrice">Retail Price</SelectItem>
                  <SelectItem value="availableQty">Available Stock</SelectItem>
                  <SelectItem value="lastSaleDate">Last Sale Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="h-7 w-7 text-xs"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Data Table ── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <th className="p-3">Product / SKU</th>
                <th className="p-3">Brand & Category</th>
                <th className="p-3">Variant (Size / Color)</th>
                <th className="p-3">Location / Scope</th>
                <th className="p-3 text-right">Retail Price</th>
                <th className="p-3 text-center">Available Stock</th>
                <th className="p-3 text-center">In-Transit</th>
                <th className="p-3 text-center">Central WH Stock</th>
                <th className="p-3 text-center">Other Outlets</th>
                <th className="p-3 text-center">30d Demand</th>
                <th className="p-3 text-center">Replenishment Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span>Loading out-of-stock data & inventory metrics...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <span className="text-sm font-semibold text-foreground">No Out-of-Stock Items Found</span>
                      <span className="text-xs">All items match the selected stock threshold criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((item: any, idx: number) => {
                  const isNegative = item.availableQty < 0;
                  const isZero = item.availableQty === 0;

                  return (
                    <tr key={`${item.itemId}_${item.locationId || idx}`} className="hover:bg-muted/30 transition-colors">
                      {/* Product */}
                      <td className="p-3 font-medium">
                        <div className="font-mono font-bold text-foreground text-sm">{item.sku}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                        {item.barCode && (
                          <div className="text-[10px] font-mono text-muted-foreground/80">
                            Barcode: {item.barCode}
                          </div>
                        )}
                      </td>

                      {/* Brand & Category */}
                      <td className="p-3">
                        <div className="font-medium text-foreground">{item.brand}</div>
                        <div className="text-[11px] text-muted-foreground">{item.category}</div>
                      </td>

                      {/* Variant */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {item.size && item.size !== "N/A" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Size: {item.size}
                            </Badge>
                          )}
                          {item.color && item.color !== "N/A" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {item.color}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-3">
                        <div className="font-medium text-foreground">{item.locationName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">Code: {item.locationCode}</div>
                      </td>

                      {/* Price */}
                      <td className="p-3 text-right font-mono font-semibold text-foreground">
                        Rs. {formatCurrency(item.unitPrice)}
                      </td>

                      {/* Available Stock */}
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono font-bold text-xs px-2.5 py-0.5",
                            isNegative
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : isZero
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          )}
                        >
                          {item.availableQty}
                        </Badge>
                      </td>

                      {/* In-Transit */}
                      <td className="p-3 text-center font-mono">
                        {item.inTransitQty > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            +{item.inTransitQty}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Central Warehouse */}
                      <td className="p-3 text-center">
                        {item.centralWarehouseQty > 0 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono font-semibold">
                            {item.centralWarehouseQty} in WH
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">0</span>
                        )}
                      </td>

                      {/* Other Outlets */}
                      <td className="p-3 text-center">
                        {item.otherOutletsQty > 0 ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono font-semibold">
                            {item.otherOutletsQty} in stores
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">0</span>
                        )}
                      </td>

                      {/* 30-Day Demand */}
                      <td className="p-3 text-center">
                        <div className="font-mono font-bold text-foreground">{item.salesLast30Days} pcs</div>
                        {item.lastSaleDate && (
                          <div className="text-[10px] text-muted-foreground">
                            Last: {format(new Date(item.lastSaleDate), "dd MMM yyyy")}
                          </div>
                        )}
                      </td>

                      {/* Replenishment Status */}
                      <td className="p-3 text-center">
                        {item.replenishmentStatus === "WAREHOUSE_AVAILABLE" ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-medium">
                            WH Replenishment Ready
                          </Badge>
                        ) : item.replenishmentStatus === "INTER_STORE_AVAILABLE" ? (
                          <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-[10px] font-medium">
                            Inter-Store Transfer
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground text-[10px]">
                            Enterprise Depleted
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReplenish(item.sku, item.locationId)}
                          className="h-7 text-[11px] gap-1 hover:bg-primary hover:text-primary-foreground font-medium"
                          title="Create Stock Transfer Request for this item"
                        >
                          Replenish
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t bg-card text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Showing</span>
            <span className="font-mono font-semibold text-foreground">{records.length}</span>
            <span>of</span>
            <span className="font-mono font-semibold text-foreground">{meta.total}</span>
            <span>depleted items</span>

            <div className="ml-4 flex items-center gap-1.5">
              <span>Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <span className="text-xs font-mono px-2">
              Page {currentPage} of {meta.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= meta.totalPages}
              onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
