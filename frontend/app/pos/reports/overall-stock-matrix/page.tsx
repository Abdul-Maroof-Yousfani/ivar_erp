"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import { getPosStockMatrix } from "@/lib/actions/stock-ledger";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from "@/components/ui/pagination";
import { getPageNumbers } from "@/components/common/data-table";
import {
    Download,
    Loader2,
    Store,
    Layers,
    Search,
    X,
    Package,
    Truck,
    Clock,
    DollarSign,
    RefreshCw,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronFirst,
    ChevronLast,
    CheckCircle2,
    Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn, getApiBaseUrl, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

interface PosStore {
    id: string;
    name: string;
    code: string;
    shortCode?: string;
    phone?: string;
    address?: string;
}

interface PosMatrixItem {
    id: string;
    brand: string;
    division: string;
    category: string;
    gender: string;
    silhouette: string;
    sku: string;
    articleName: string;
    size: string;
    color: string;
    barcode: string;
    availableQty: number;
    inTransit: number;
    stockReserved: number;
    pendingInvoice: number;
    totalBalance: number;
    sellingPrice: number;
    sellingValue: number;
    storeStocks: Record<string, number>;
    warehouseStocks: Record<string, number>;
    currentStoreQty?: number;
    storesWithStock: Array<{
        locationId: string;
        locationName: string;
        shortCode?: string;
        phone?: string;
        address?: string;
        qty: number;
    }>;
}

export default function PosOverallStockMatrixReportPage() {
    const { user } = useAuth();

    // Current store info from POS user session
    const currentLocationId = (user as any)?.terminal?.location?.id || (user as any)?.locationId;
    const currentLocationName = (user as any)?.terminal?.location?.name || "Current Store";

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [inStockOnly, setInStockOnly] = useState(false);
    const [outOfStockHereOnly, setOutOfStockHereOnly] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Data states
    const [items, setItems] = useState<PosMatrixItem[]>([]);
    const [stores, setStores] = useState<PosStore[]>([]);
    const [totals, setTotals] = useState({
        totalVariants: 0,
        totalAvailable: 0,
        totalTransit: 0,
        totalReserved: 0,
        totalBalance: 0,
        totalSellingValue: 0,
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
    });

    const [isPending, startTransition] = useTransition();
    const [isExporting, setIsExporting] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle Toggles (mutual exclusivity for clear UX)
    const handleInStockToggle = (checked: boolean) => {
        setInStockOnly(checked);
        if (checked) {
            setOutOfStockHereOnly(false); // Can't be both
        }
        setPage(1);
    };

    const handleOutOfStockHereToggle = (checked: boolean) => {
        setOutOfStockHereOnly(checked);
        if (checked) {
            setInStockOnly(false); // Can't be both
        }
        setPage(1);
    };

    // Fetch report data
    const fetchMatrixData = useCallback(() => {
        startTransition(async () => {
            try {
                const res = await getPosStockMatrix({
                    search: debouncedSearch,
                    inStockOnly,
                    outOfStockHereOnly,
                    currentLocationId,
                    page,
                    limit,
                });

                const matrixPayload = res?.data?.items ? res.data : (res?.items ? res : (res?.data || null));
                if (matrixPayload && Array.isArray(matrixPayload.items)) {
                    setItems(matrixPayload.items);
                    setStores(matrixPayload.stores || []);
                    if (matrixPayload.totals) setTotals(matrixPayload.totals);
                    if (matrixPayload.pagination) setPagination(matrixPayload.pagination);
                } else {
                    setItems([]);
                    toast.error(res?.message || "Failed to load stock matrix");
                }
            } catch (err) {
                console.error(err);
                toast.error("Error fetching stock matrix");
            }
        });
    }, [debouncedSearch, inStockOnly, outOfStockHereOnly, currentLocationId, page, limit]);

    useEffect(() => {
        fetchMatrixData();
    }, [fetchMatrixData]);

    // Handle Direct Excel File Export (.xlsx)
    const handleExportExcel = async () => {
        try {
            setIsExporting(true);
            const base = getApiBaseUrl();
            const params = new URLSearchParams();
            if (debouncedSearch) params.set("search", debouncedSearch);
            if (inStockOnly) params.set("inStockOnly", "true");

            const cleanBase = base.replace(/\/+$/, "");
            const apiPrefix = cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
            const exportUrl = `${apiPrefix}/stock-ledger/pos-stock-matrix/export?${params.toString()}`;

            toast.info("Preparing Excel export file...");

            const res = await fetch(exportUrl, {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.message || "Failed to export Excel file");
                return;
            }

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `pos-overall-stock-matrix-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            toast.success("Excel report downloaded successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export Excel report");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1750px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    Overall Stock Matrix
                                </h1>
                                <Badge variant="outline" className="text-xs font-semibold border-primary/30 text-primary">
                                    Store-Wise Breakdown
                                </Badge>
                            </div>
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                                <Store className="h-3.5 w-3.5 text-primary/70" />
                                Current Outlet: <span className="font-semibold text-foreground">{currentLocationName}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span>Check stock across all branches for customer inquiries</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Top Action Buttons (Single Export Excel Button) */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchMatrixData}
                        disabled={isPending}
                        className="gap-1.5 text-xs font-medium h-9"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
                        Refresh
                    </Button>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={isExporting || isPending}
                        className="gap-1.5 text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Download className="h-3.5 w-3.5" />
                        )}
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total SKUs</p>
                            <Package className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                            {totals.totalVariants.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Available Qty</p>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-xl font-black mt-1 text-emerald-700 dark:text-emerald-300">
                            {totals.totalAvailable.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">In Transit</p>
                            <Truck className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                            {totals.totalTransit.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reserved</p>
                            <Clock className="h-4 w-4 text-purple-500" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                            {totals.totalReserved.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Balance</p>
                            <Layers className="h-4 w-4 text-indigo-500" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                            {totals.totalBalance.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                    <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Selling Value</p>
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100 truncate" title={formatCurrency(totals.totalSellingValue)}>
                            {formatCurrency(totals.totalSellingValue)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar (Single Clean Row: Search + Toggles + Reset) */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Barcode, SKU, Article Name, Brand, Size, Color..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-9 h-10 text-xs sm:text-sm font-medium bg-slate-50/50 dark:bg-slate-900/50 border-input w-full"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                                    title="Clear search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Toggles & Reset Controls */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            {/* In-Stock Only Toggle */}
                            <label
                                htmlFor="in-stock-switch"
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-semibold select-none whitespace-nowrap",
                                    inStockOnly
                                        ? "bg-emerald-50 border-emerald-500/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs"
                                        : "bg-background border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-700"
                                )}
                            >
                                <Switch
                                    id="in-stock-switch"
                                    checked={inStockOnly}
                                    onCheckedChange={handleInStockToggle}
                                />
                                <span>In-Stock Only</span>
                            </label>

                            {/* 0 Here, but Available Elsewhere Toggle */}
                            {currentLocationId && (
                                <label
                                    htmlFor="out-of-stock-here-switch"
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-semibold select-none whitespace-nowrap",
                                        outOfStockHereOnly
                                            ? "bg-rose-50 border-rose-500/50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs"
                                            : "bg-background border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-700"
                                    )}
                                    title="Show items out of stock at this store, but available at other branches"
                                >
                                    <Switch
                                        id="out-of-stock-here-switch"
                                        checked={outOfStockHereOnly}
                                        onCheckedChange={handleOutOfStockHereToggle}
                                    />
                                    <span>0 Here, but Available Elsewhere</span>
                                </label>
                            )}

                            {/* Reset Button */}
                            {(searchQuery || inStockOnly || outOfStockHereOnly) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setInStockOnly(false);
                                        setOutOfStockHereOnly(false);
                                        setPage(1);
                                    }}
                                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matrix Data Table */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto max-h-[68vh]">
                    <table className="w-full text-xs text-left border-collapse">
                        {/* Table Header */}
                        <thead className="bg-slate-900 text-slate-100 sticky top-0 z-20 shadow-xs select-none">
                            <tr>
                                <th className="p-3 font-bold uppercase min-w-[90px] border-b border-slate-800 sticky left-0 z-30 bg-slate-900">
                                    Brand
                                </th>
                                <th className="p-3 font-bold uppercase min-w-[110px] border-b border-slate-800 sticky left-[90px] z-30 bg-slate-900">
                                    SKU
                                </th>
                                <th className="p-3 font-bold uppercase min-w-[180px] border-b border-slate-800">
                                    Article Name
                                </th>
                                <th className="p-3 font-bold uppercase text-center w-16 border-b border-slate-800">
                                    Size
                                </th>
                                <th className="p-3 font-bold uppercase text-center min-w-[90px] border-b border-slate-800">
                                    Color
                                </th>
                                <th className="p-3 font-bold uppercase min-w-[120px] border-b border-slate-800">
                                    Barcode
                                </th>

                                {/* Quick Stock Summary Pill */}
                                <th className="p-3 font-bold uppercase min-w-[200px] border-b border-slate-800 text-emerald-300 bg-slate-950">
                                    Stock Available At
                                </th>

                                <th className="p-3 font-bold text-right uppercase border-b border-slate-800 text-emerald-400">
                                    Available
                                </th>
                                <th className="p-3 font-bold text-right uppercase border-b border-slate-800 text-amber-300">
                                    Transit
                                </th>
                                <th className="p-3 font-bold text-right uppercase border-b border-slate-800 text-purple-300">
                                    Reserved
                                </th>
                                <th className="p-3 font-bold text-right uppercase border-b border-slate-800">
                                    Total
                                </th>
                                <th className="p-3 font-bold text-right uppercase border-b border-slate-800 min-w-[85px]">
                                    Price (Rs.)
                                </th>

                                {/* Store Columns */}
                                {stores.map((store) => {
                                    const isCurrent = store.id === currentLocationId;
                                    return (
                                        <th
                                            key={store.id}
                                            className={cn(
                                                "p-2.5 font-bold text-center uppercase min-w-[80px] border-b border-slate-800 whitespace-nowrap",
                                                isCurrent
                                                    ? "bg-rose-950/90 text-rose-200 border-x-2 border-rose-500 shadow-inner"
                                                    : "bg-slate-950 text-slate-300"
                                            )}
                                            title={store.name}
                                        >
                                            <div className="flex flex-col items-center">
                                                <span className="text-[11px] font-bold">{store.shortCode || store.code || store.name}</span>
                                                {isCurrent && (
                                                    <span className="text-[9px] text-rose-300 font-semibold normal-case">
                                                        (This Store)
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {isPending ? (
                                <tr>
                                    <td colSpan={12 + stores.length} className="p-14 text-center text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                                        <span className="font-medium text-xs">Loading Overall Stock Matrix data...</span>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={12 + stores.length} className="p-14 text-center text-muted-foreground">
                                        <AlertCircle className="h-9 w-9 mx-auto mb-2 text-muted-foreground/50" />
                                        <p className="font-semibold text-sm text-foreground">No stock matching your filters</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                            {inStockOnly
                                                ? "There are currently no items with stock > 0 matching this search."
                                                : outOfStockHereOnly
                                                ? "There are no items that are out of stock here but available in other stores."
                                                : "Try searching with a different SKU, barcode or clearing active filters."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, idx) => {
                                    return (
                                        <tr
                                            key={item.id}
                                            className={cn(
                                                "hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors",
                                                idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/30"
                                            )}
                                        >
                                            {/* Brand */}
                                            <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 z-10 bg-inherit border-r border-slate-100 dark:border-slate-800">
                                                {item.brand}
                                            </td>

                                            {/* SKU */}
                                            <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 sticky left-[90px] z-10 bg-inherit border-r border-slate-100 dark:border-slate-800">
                                                {item.sku}
                                            </td>

                                            {/* Article Name */}
                                            <td className="p-2.5 text-slate-800 dark:text-slate-200 max-w-[200px] truncate font-medium" title={item.articleName}>
                                                {item.articleName}
                                            </td>

                                            {/* Size */}
                                            <td className="p-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                                                    {item.size}
                                                </span>
                                            </td>

                                            {/* Color */}
                                            <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                                                {item.color}
                                            </td>

                                            {/* Barcode */}
                                            <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                                                {item.barcode}
                                            </td>

                                            {/* Stock Available At Summary */}
                                            <td className="p-2.5">
                                                {item.storesWithStock.length === 0 ? (
                                                    <span className="text-[10px] text-rose-500 font-medium">Out of Stock everywhere</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                                                        {item.storesWithStock.map((s) => {
                                                            const isThisStore = s.locationId === currentLocationId;
                                                            return (
                                                                <span
                                                                    key={s.locationId}
                                                                    className={cn(
                                                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs",
                                                                        isThisStore
                                                                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300/40"
                                                                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40"
                                                                    )}
                                                                    title={`${s.locationName}: ${s.qty} pcs`}
                                                                >
                                                                    <span>{s.shortCode || s.locationName}</span>
                                                                    <span className="px-1 rounded bg-white/80 dark:bg-black/50 text-[9px] font-black">
                                                                        {s.qty}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Totals */}
                                            <td className={cn(
                                                "p-2.5 text-right font-black",
                                                item.availableQty > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60"
                                            )}>
                                                {item.availableQty}
                                            </td>
                                            <td className="p-2.5 text-right text-amber-600 dark:text-amber-400 font-medium">
                                                {item.inTransit > 0 ? item.inTransit : "—"}
                                            </td>
                                            <td className="p-2.5 text-right text-purple-600 dark:text-purple-400 font-medium">
                                                {item.stockReserved > 0 ? item.stockReserved : "—"}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                                                {item.totalBalance}
                                            </td>
                                            <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                                                {item.sellingPrice ? formatCurrency(item.sellingPrice) : "—"}
                                            </td>

                                            {/* Store by Store Columns */}
                                            {stores.map((store) => {
                                                const qty = item.storeStocks[store.id] || 0;
                                                const isCurrent = store.id === currentLocationId;

                                                return (
                                                    <td
                                                        key={store.id}
                                                        className={cn(
                                                            "p-2.5 text-center transition-colors",
                                                            isCurrent && "border-x-2 border-rose-400/50 bg-rose-50/20 dark:bg-rose-950/20",
                                                            qty > 0
                                                                ? "font-black text-emerald-800 bg-emerald-100/70 dark:text-emerald-300 dark:bg-emerald-950/40"
                                                                : "text-slate-300 dark:text-slate-700 font-light"
                                                        )}
                                                    >
                                                        {qty > 0 ? (
                                                            <span className="px-1.5 py-0.5 rounded font-black text-emerald-800 dark:text-emerald-300">
                                                                {qty}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls - Matching App Theme */}
                <div className="flex items-center justify-between gap-4 md:flex-row flex-col p-4 border-t border-border/50 bg-card/60 backdrop-blur-sm">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2 order-3 md:order-1">
                        <Label htmlFor="pageSize" className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
                            Rows per page
                        </Label>
                        <Select
                            value={limit.toString()}
                            onValueChange={(value) => {
                                setLimit(Number(value));
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[85px] h-8 text-xs font-semibold">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {[25, 50, 100, 200, 500].map((size) => (
                                    <SelectItem key={size} value={size.toString()} className="text-xs">
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Page numbers with active indicator */}
                    <div className="flex items-center gap-1 order-1 md:order-2">
                        {getPageNumbers({
                            currentPage: page - 1,
                            totalPages: Math.max(1, pagination.totalPages),
                        }).map((p, idx) =>
                            p === "..." ? (
                                <span key={idx} className="px-1.5 text-xs text-muted-foreground select-none">
                                    ...
                                </span>
                            ) : (
                                <Button
                                    key={idx}
                                    size="sm"
                                    variant={p === page ? "default" : "ghost"}
                                    className={cn(
                                        "h-8 min-w-8 px-2 text-xs font-semibold transition-all",
                                        p === page && "shadow-xs font-bold"
                                    )}
                                    onClick={() => setPage(p as number)}
                                    disabled={isPending}
                                >
                                    {p}
                                </Button>
                            )
                        )}
                    </div>

                    {/* Range info and Arrow navigation */}
                    <div className="flex items-center gap-3 order-2 md:order-3">
                        <div className="text-muted-foreground text-xs whitespace-nowrap">
                            <span className="font-semibold text-foreground">
                                {pagination.total === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-foreground">
                                {pagination.total.toLocaleString()}
                            </span>
                        </div>

                        <Pagination>
                            <PaginationContent className="gap-1">
                                <PaginationItem>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8"
                                        onClick={() => setPage(1)}
                                        disabled={page <= 1 || isPending}
                                        aria-label="Go to first page"
                                        title="First Page"
                                    >
                                        <ChevronFirst size={15} />
                                    </Button>
                                </PaginationItem>
                                <PaginationItem>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1 || isPending}
                                        aria-label="Go to previous page"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft size={15} />
                                    </Button>
                                </PaginationItem>
                                <PaginationItem>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8"
                                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page >= pagination.totalPages || isPending}
                                        aria-label="Go to next page"
                                        title="Next Page"
                                    >
                                        <ChevronRight size={15} />
                                    </Button>
                                </PaginationItem>
                                <PaginationItem>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8"
                                        onClick={() => setPage(pagination.totalPages)}
                                        disabled={page >= pagination.totalPages || isPending}
                                        aria-label="Go to last page"
                                        title="Last Page"
                                    >
                                        <ChevronLast size={15} />
                                    </Button>
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            </Card>
        </div>
    );
}
