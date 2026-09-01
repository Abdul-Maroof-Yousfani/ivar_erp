"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { PrintClaimReceipt } from "@/components/pos/print-claim-receipt";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
import { listSalesActivities, queueSalesActivityExport } from "@/lib/actions/pos-sales";
import { getLocations } from "@/lib/actions/location";
import { getMerchants } from "@/lib/actions/vouchers";
import {
    Loader2, Search, Calendar, RefreshCcw, Printer, RotateCcw,
    Banknote, CreditCard, Ticket, BookOpen, AlertCircle, CheckCircle2,
    XCircle, Info, ShoppingBag, Eye, ArrowRight, User, Building, MapPin,
    ArrowUpDown, History, Receipt, Download, Filter, Store, CreditCard as CardIcon,
    TrendingUp, FileSpreadsheet, LayoutGrid, Table, Layers, DollarSign, PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TENDER_ICONS: Record<string, any> = {
    cash: Banknote,
    card: CreditCard,
    voucher: Ticket,
    bank_transfer: Building,
    credit_account: BookOpen,
};

const ACTIVITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    sale: { label: "Sale Checkout", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-400", icon: ShoppingBag },
    return: { label: "Return Slip", color: "bg-rose-500/10 text-rose-700 border-rose-300 dark:bg-rose-950/20 dark:text-rose-400", icon: RotateCcw },
    refund: { label: "Cash Refund", color: "bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-950/20 dark:text-purple-400", icon: Banknote },
    claim: { label: "Claim Request", color: "bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400", icon: AlertCircle },
};

export default function ERPSalesActivityReportPage() {
    const { hasPermission } = useAuth();
    const canPrint = hasPermission("pos.sales.history.print") || true;

    // Filters state
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [activityType, setActivityType] = useState<string>("all");
    const [locationId, setLocationId] = useState<string>("all");
    const [merchantId, setMerchantId] = useState<string>("all");
    const [paymentMethod, setPaymentMethod] = useState<string>("all");
    const [posId, setPosId] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<"cards" | "grid">("cards");
    const [isExporting, setIsExporting] = useState(false);

    // Printing state
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedClaim, setSelectedClaim] = useState<any>(null);
    const [returnDetails, setReturnDetails] = useState<any>(null);
    const [showPrint, setShowPrint] = useState(false);
    const [showGiftPrint, setShowGiftPrint] = useState(false);
    const [showReturnPrint, setShowReturnPrint] = useState(false);
    const [showClaimPrint, setShowClaimPrint] = useState(false);
    const [isRefundPrint, setIsRefundPrint] = useState(false);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    // Fetch Outlets/Locations list for dropdown
    const { data: locationsData } = useQuery({
        queryKey: ["erp-report-locations"],
        queryFn: () => getLocations(),
        staleTime: 60_000,
    });
    const locationsList = locationsData?.data ?? [];

    // Fetch Merchants list for dropdown
    const { data: merchantsData } = useQuery({
        queryKey: ["erp-report-merchants"],
        queryFn: () => getMerchants(),
        staleTime: 60_000,
    });
    const merchantsList = merchantsData?.data ?? [];

    // Fetch activities query with comprehensive ERP filters
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: [
            "erp-sales-activities",
            currentPage,
            pageSize,
            search,
            dateRange.from,
            dateRange.to,
            activityType,
            locationId,
            merchantId,
            paymentMethod,
            posId,
        ],
        queryFn: () => listSalesActivities({
            page: currentPage,
            limit: pageSize,
            search: search.trim() || undefined,
            startDate: dateRange.from?.toISOString(),
            endDate: dateRange.to?.toISOString(),
            activityType: activityType === "all" ? undefined : activityType,
            locationId: locationId === "all" ? undefined : locationId,
            merchantId: merchantId === "all" ? undefined : merchantId,
            paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
            posId: posId.trim() || undefined,
        }),
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });

    const orders = data?.data ?? [];
    const meta = data?.meta ?? { total: 0, page: 1, limit: pageSize, totalPages: 0 };
    const summary = meta?.summary ?? {
        totalCount: 0,
        totalSalesCount: 0,
        totalSalesAmount: 0,
        totalReturnsCount: 0,
        totalReturnsAmount: 0,
        totalRefundsCount: 0,
        totalRefundsAmount: 0,
        totalClaimsCount: 0,
        totalClaimsAmount: 0,
        totalNetRevenue: 0,
        totalIssuedVouchersCount: 0,
        totalIssuedVouchersAmount: 0,
        totalMerchantCommission: 0,
    };

    // Preset Date Range Helpers
    const setPresetRange = (preset: "today" | "yesterday" | "last7" | "last30" | "month" | "clear") => {
        const now = new Date();
        setCurrentPage(1);
        if (preset === "today") {
            const from = new Date(now.setHours(0, 0, 0, 0));
            const to = new Date(now.setHours(23, 59, 59, 999));
            setDateRange({ from, to });
        } else if (preset === "yesterday") {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const from = new Date(y.setHours(0, 0, 0, 0));
            const to = new Date(y.setHours(23, 59, 59, 999));
            setDateRange({ from, to });
        } else if (preset === "last7") {
            const from = new Date();
            from.setDate(from.getDate() - 7);
            from.setHours(0, 0, 0, 0);
            setDateRange({ from, to: new Date() });
        } else if (preset === "last30") {
            const from = new Date();
            from.setDate(from.getDate() - 30);
            from.setHours(0, 0, 0, 0);
            setDateRange({ from, to: new Date() });
        } else if (preset === "month") {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateRange({ from, to: new Date() });
        } else {
            setDateRange({ from: undefined, to: undefined });
        }
    };

    const handleFilterReset = () => {
        setSearch("");
        setDateRange({ from: undefined, to: undefined });
        setActivityType("all");
        setLocationId("all");
        setMerchantId("all");
        setPaymentMethod("all");
        setPosId("");
        setCurrentPage(1);
    };

    // Export handler
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await queueSalesActivityExport({
                search: search.trim() || undefined,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                activityType: activityType === "all" ? undefined : activityType,
                locationId: locationId === "all" ? undefined : locationId,
                merchantId: merchantId === "all" ? undefined : merchantId,
                paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
                posId: posId.trim() || undefined,
            });
            if (res.status) {
                toast.success(res.message || "Export job queued successfully. Check notifications when ready.");
            } else {
                toast.error(res.message || "Failed to queue export");
            }
        } catch {
            toast.error("Failed to queue export");
        } finally {
            setIsExporting(false);
        }
    };

    // Print handlers
    const openSalePrint = async (orderId: string, isGift = false) => {
        setIsLoadingReceipt(true);
        setSelectedOrder(null);
        if (isGift) {
            setShowGiftPrint(true);
        } else {
            setShowPrint(true);
        }
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}`);
            if (res.ok && res.data?.status) {
                setSelectedOrder({ ...res.data.data, isGiftReceipt: isGift });
            } else {
                toast.error("Failed to load order details");
            }
        } catch {
            toast.error("Failed to load order details");
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const openReturnPrint = async (order: any, type: "return" | "refund") => {
        setIsLoadingReceipt(true);
        setSelectedOrder(order);
        setIsRefundPrint(type === "refund");
        setReturnDetails(null);
        setShowReturnPrint(true);
        try {
            const orderId = order.orderId || order.id;
            const retRes = await authFetch(`/pos-sales/orders/${orderId}/return-details?type=${type}`);
            if (retRes.ok && retRes.data?.status) {
                setReturnDetails(retRes.data.data);
            } else {
                toast.error("Failed to load return/refund details");
            }
        } catch {
            toast.error("Failed to load return/refund details");
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const openClaimPrint = async (claim: any, originalOrderNumber: string) => {
        setIsLoadingReceipt(true);
        setSelectedClaim(null);
        setShowClaimPrint(true);
        try {
            const claimId = claim.claimId || claim.id;
            const res = await authFetch(`/pos-claims/${claimId}`);
            if (res.ok && res.data?.status) {
                setSelectedClaim(res.data.data);
            } else {
                setSelectedClaim({
                    ...claim,
                    claimNumber: claim.number || claim.claimNumber,
                    salesOrder: { orderNumber: originalOrderNumber || claim.orderNumber },
                    claimedLines: (claim.items || []).map((it: any) => ({
                        name: it.description || it.item?.description || "Item",
                        sku: it.sku || it.item?.sku || "",
                        claimedQty: it.quantity,
                        approvedQty: it.approvedQty,
                        unitPaidPrice: it.price || it.unitPaidPrice || 0,
                        claimedAmount: it.lineTotal || ((it.price || 0) * (it.quantity || 1)),
                        approvedAmount: it.approvedAmount,
                        itemStatus: it.status,
                    })),
                });
            }
        } catch {
            setSelectedClaim({
                ...claim,
                claimNumber: claim.number || claim.claimNumber,
                salesOrder: { orderNumber: originalOrderNumber || claim.orderNumber },
            });
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <History className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                Sales & Stock Activity Report
                                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                                    ERP Enterprise View
                                </Badge>
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Multi-outlet activity preview & audit reporting for sales, returns, cash refunds, claims, merchant bank acquiring & voucher flows.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={isExporting}
                        className="gap-2 font-medium"
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-600" />}
                        Export Excel Report
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                        <RefreshCcw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <Card className="bg-card border shadow-sm">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Total Activities</span>
                            <Layers className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-lg font-bold font-mono text-foreground">{meta.total}</div>
                        <div className="text-[10px] text-muted-foreground truncate">Filtered activity rows</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-emerald-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Gross Sales</span>
                            <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            Rs. {formatCurrency(summary.totalSalesAmount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{summary.totalSalesCount} Orders</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-rose-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Returns Value</span>
                            <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                            Rs. {formatCurrency(summary.totalReturnsAmount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{summary.totalReturnsCount} Return Slips</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-purple-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Cash Refunds</span>
                            <Banknote className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
                            Rs. {formatCurrency(summary.totalRefundsAmount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{summary.totalRefundsCount} Refund Slips</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-amber-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Claim Requests</span>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                            Rs. {formatCurrency(summary.totalClaimsAmount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{summary.totalClaimsCount} Claim Submissions</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Net Revenue</span>
                            <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                            Rs. {formatCurrency(summary.totalNetRevenue)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">Sales - Returns - Refunds</div>
                    </CardContent>
                </Card>

                <Card className="bg-card border shadow-sm border-l-4 border-l-indigo-500">
                    <CardContent className="p-3 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                            <span>Vouchers & Comm.</span>
                            <Ticket className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                        <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            Rs. {formatCurrency(summary.totalIssuedVouchersAmount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                            {summary.totalIssuedVouchersCount} Issued | Comm: Rs.{formatCurrency(summary.totalMerchantCommission)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Filter className="h-4 w-4 text-primary" /> Advanced Reporting Filters
                    </div>

                    {/* Quick Date Range Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Presets:</span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setPresetRange("today")}>Today</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setPresetRange("yesterday")}>Yesterday</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setPresetRange("last7")}>Last 7 Days</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setPresetRange("last30")}>Last 30 Days</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setPresetRange("month")}>This Month</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Search Field */}
                    <div className="space-y-1 col-span-1 md:col-span-2">
                        <Label className="text-xs font-semibold">Search Activity</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Scan Barcode, SKU, Order #, Return #, Claim #, Voucher..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="pl-8 text-xs h-9"
                            />
                        </div>
                    </div>

                    {/* Activity Type Selector */}
                    <div className="space-y-1 col-span-1">
                        <Label className="text-xs font-semibold">Activity Scenario</Label>
                        <Select
                            value={activityType}
                            onValueChange={v => { setActivityType(v); setCurrentPage(1); }}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="All Activities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Activities</SelectItem>
                                <SelectItem value="sale">Sales Checkout Only</SelectItem>
                                <SelectItem value="return">Returns Only</SelectItem>
                                <SelectItem value="refund">Cash Refunds Only</SelectItem>
                                <SelectItem value="claim">Claims Only</SelectItem>
                                <SelectItem value="exchange">Exchanges & Returns</SelectItem>
                                <SelectItem value="alliance">Alliance Discounts Only</SelectItem>
                                <SelectItem value="exchange_voucher">Exchange Vouchers Flow</SelectItem>
                                <SelectItem value="credit_voucher">Credit/Gift Vouchers Flow</SelectItem>
                                <SelectItem value="cash_split">Cash Split Payments</SelectItem>
                                <SelectItem value="merchant">Merchant Machine Sales</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Store Outlet Location Selector */}
                    <div className="space-y-1 col-span-1">
                        <Label className="text-xs font-semibold">Store Outlet</Label>
                        <Select
                            value={locationId}
                            onValueChange={v => { setLocationId(v); setCurrentPage(1); }}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="All Outlets" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Outlets (Global)</SelectItem>
                                {locationsList.map((loc: any) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Merchant Bank Machine Selector */}
                    <div className="space-y-1 col-span-1">
                        <Label className="text-xs font-semibold">Merchant / Bank</Label>
                        <Select
                            value={merchantId}
                            onValueChange={v => { setMerchantId(v); setCurrentPage(1); }}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="All Merchants" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Merchants</SelectItem>
                                {merchantsList.map((m: any) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.bankName || m.description} ({m.commissionRate}% comm)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Tender Selector */}
                    <div className="space-y-1 col-span-1">
                        <Label className="text-xs font-semibold">Payment Tender</Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={v => { setPaymentMethod(v); setCurrentPage(1); }}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="All Tenders" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tenders</SelectItem>
                                <SelectItem value="cash">Cash Only</SelectItem>
                                <SelectItem value="card">Card Machine</SelectItem>
                                <SelectItem value="voucher">Voucher Redeemed</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="credit_account">Credit Account</SelectItem>
                                <SelectItem value="split">Split Payment</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Date Range & Clear Filters Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t">
                    <div className="w-full sm:w-auto flex-1 max-w-md">
                        <DateRangePicker
                            range={dateRange}
                            onUpdate={({ range }) => { setDateRange(range); setCurrentPage(1); }}
                            placeholder="Filter by activity date range"
                            className="w-full"
                        />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* View Mode Toggle */}
                        <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
                            <Button
                                variant={viewMode === "cards" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs px-2.5 gap-1"
                                onClick={() => setViewMode("cards")}
                            >
                                <LayoutGrid className="h-3 w-3" /> Cards View
                            </Button>
                            <Button
                                variant={viewMode === "grid" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs px-2.5 gap-1"
                                onClick={() => setViewMode("grid")}
                            >
                                <Table className="h-3 w-3" /> Grid Table
                            </Button>
                        </div>

                        {(search || dateRange.from || dateRange.to || activityType !== "all" || locationId !== "all" || merchantId !== "all" || paymentMethod !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleFilterReset}
                                className="text-xs text-muted-foreground hover:text-foreground h-8"
                            >
                                Clear All Filters
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Activities List / Loader */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-xl bg-card">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Loading sales activity records...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="border border-dashed rounded-xl p-12 text-center bg-card">
                    <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-base font-semibold">No Activity Records Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        No transactions match your current search criteria and filters. Try adjusting the date range or selecting all outlets.
                    </p>
                </div>
            ) : viewMode === "cards" ? (
                /* Cards View */
                <div className="space-y-4">
                    {orders.map((act: any) => {
                        const cfg = ACTIVITY_CONFIG[act.type] || { label: "Activity", color: "bg-muted text-muted-foreground", icon: Info };
                        const Icon = cfg.icon;

                        return (
                            <div key={act.id} className={cn(
                                "bg-card border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 border-l-4",
                                act.type === "sale" ? "border-l-emerald-500" :
                                    act.type === "return" ? "border-l-rose-500" :
                                        act.type === "refund" ? "border-l-purple-500" :
                                            "border-l-amber-500"
                            )}>
                                {/* Card Header */}
                                <div className="bg-muted/30 border-b p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={cn("font-bold text-xs uppercase px-2 py-0.5", cfg.color)}>
                                                {cfg.label}
                                            </Badge>
                                            <span className="font-mono text-sm font-bold text-foreground">
                                                #{act.number}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            <span>{fmtDate(act.date)} at {fmtTime(act.date)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                            <User className="h-3 w-3" /> Customer Details
                                        </div>
                                        <div className="text-sm font-semibold truncate">
                                            {act.customer?.name || "Walk-in Customer"}
                                        </div>
                                        {act.customer?.contactNo && (
                                            <div className="text-xs font-mono text-muted-foreground">{act.customer.contactNo}</div>
                                        )}
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                            <Store className="h-3 w-3" /> Outlet / Terminal
                                        </div>
                                        <div className="text-xs font-semibold truncate text-foreground">
                                            {act.locationName || act.locationId || "Main Outlet"}
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground">
                                            POS ID: {act.posId || "N/A"}
                                        </div>
                                    </div>

                                    <div className="flex justify-between md:justify-end items-center gap-4">
                                        <div className="text-left md:text-right space-y-0.5">
                                            <div className="text-xs text-muted-foreground font-medium">
                                                {act.type === "claim" ? "Claim Total" : act.type === "return" ? "Returned Value" : act.type === "refund" ? "Refund Amount" : "Sale Amount"}
                                            </div>
                                            <div className="text-base font-bold text-foreground font-mono">
                                                Rs. {formatCurrency(act.approvedAmount ?? act.amount)}
                                            </div>
                                        </div>

                                        {canPrint && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {act.type === "sale" ? (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full shrink-0"
                                                                title="Print Options"
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openSalePrint(act.orderId || act.id, false)} className="gap-2 cursor-pointer text-xs">
                                                                <Printer className="h-3.5 w-3.5 text-primary" />
                                                                Print Sale Receipt
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openSalePrint(act.orderId || act.id, true)} className="gap-2 cursor-pointer text-xs">
                                                                <Ticket className="h-3.5 w-3.5 text-rose-500" />
                                                                Print Gift Receipt
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full shrink-0"
                                                        title={`Print ${cfg.label}`}
                                                        onClick={() => {
                                                            if (act.type === "return") {
                                                                openReturnPrint({ id: act.orderId || act.id, orderId: act.orderId, number: act.number, orderNumber: act.orderNumber, grandTotal: act.amount, date: act.date }, "return");
                                                            } else if (act.type === "refund") {
                                                                openReturnPrint({ id: act.orderId || act.id, orderId: act.orderId, number: act.number, orderNumber: act.orderNumber, grandTotal: act.amount, date: act.date }, "refund");
                                                            } else if (act.type === "claim") {
                                                                openClaimPrint(act, act.orderNumber);
                                                            }
                                                        }}
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 space-y-3">
                                    {act.type !== "sale" && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>Original Order Reference:</span>
                                            <span className="font-mono font-semibold text-foreground">#{act.orderNumber}</span>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    {act.items && act.items.length > 0 && (
                                        <div className="overflow-x-auto border rounded-lg bg-muted/10">
                                            <table className="w-full text-xs text-left">
                                                <thead>
                                                    <tr className="bg-muted/40 border-b text-muted-foreground">
                                                        <th className="font-semibold p-2">SKU / Item Description</th>
                                                        <th className="font-semibold p-2 text-center">Size / Color</th>
                                                        <th className="font-semibold p-2 text-center">
                                                            {act.type === "claim" ? "Claim / Appr Qty" : "Qty"}
                                                        </th>
                                                        <th className="font-semibold p-2 text-right">Unit Price</th>
                                                        <th className="font-semibold p-2 text-right">Line Total</th>
                                                        {act.type === "claim" && <th className="font-semibold p-2 text-center">Status</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {act.items.map((it: any, itIdx: number) => (
                                                        <tr key={itIdx} className="border-b last:border-0 border-muted/20 hover:bg-muted/5 transition-colors">
                                                            <td className="p-2 font-medium">
                                                                <div className="font-semibold text-foreground text-xs">{it.description}</div>
                                                                <div className="text-[10px] text-muted-foreground font-mono flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                                                    <span>SKU: {it.sku}</span>
                                                                    {it.barCode && it.barCode !== it.sku && <span>| BC: {it.barCode}</span>}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                                                                    {it.size && it.size !== "-" && (
                                                                        <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5 rounded-md">
                                                                            {it.size}
                                                                        </Badge>
                                                                    )}
                                                                    {it.color && it.color !== "-" && (
                                                                        <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/30">
                                                                            {it.color}
                                                                        </Badge>
                                                                    )}
                                                                    {(!it.size || it.size === "-") && (!it.color || it.color === "-") && (
                                                                        <span className="text-muted-foreground">—</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-center font-semibold">
                                                                {act.type === "claim" ? (
                                                                    <span>{it.quantity} <ArrowRight className="inline h-2.5 w-2.5 text-muted-foreground mx-0.5" /> {it.approvedQty ?? 0}</span>
                                                                ) : (
                                                                    it.quantity
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-right font-mono text-muted-foreground">
                                                                Rs. {formatCurrency(it.price)}
                                                            </td>
                                                            <td className="p-2 text-right font-mono font-semibold">
                                                                Rs. {formatCurrency(act.type === "claim" ? (it.approvedAmount ?? it.lineTotal) : it.lineTotal)}
                                                            </td>
                                                            {act.type === "claim" && (
                                                                <td className="p-2 text-center">
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[9px] uppercase px-1.5 py-0 h-4 font-mono",
                                                                        it.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" :
                                                                            it.status === "REJECTED" ? "bg-rose-500/10 text-rose-700 border-rose-300" :
                                                                                "bg-amber-500/10 text-amber-700 border-amber-300"
                                                                    )}>
                                                                        {it.status || "Pending"}
                                                                    </Badge>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Footer Tenders, Merchant & Vouchers Info */}
                                    <div className="flex flex-wrap gap-4 items-center justify-between pt-2 text-xs border-t">
                                        <div className="flex flex-wrap gap-2.5 items-center">
                                            {/* Merchant Card Machine Info */}
                                            {act.merchant && (
                                                <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400 font-mono text-[10px]">
                                                    <CardIcon className="h-3 w-3" />
                                                    Merchant: {act.merchant.bankName || act.merchant.description} ({act.merchant.commissionRate}% comm)
                                                </Badge>
                                            )}

                                            {/* Alliance Info */}
                                            {act.alliance && (
                                                <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-950/20 dark:text-blue-400 text-[10px]">
                                                    Alliance: {act.alliance.partnerName} ({act.alliance.discountPercent}%)
                                                </Badge>
                                            )}

                                            {/* Tenders Displayed */}
                                            {act.tenders && act.tenders.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-muted-foreground">Tenders:</span>
                                                    {act.tenders.map((tend: any, tIdx: number) => {
                                                        const TendIcon = TENDER_ICONS[tend.method] || Banknote;
                                                        return (
                                                            <Badge key={tIdx} variant="secondary" className="gap-1 font-mono text-[10px] capitalize">
                                                                <TendIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                                {tend.method.replace("_", " ")}
                                                                {tend.slipNo && <span className="text-[9px] text-muted-foreground ml-0.5">#{tend.slipNo}</span>}
                                                                <span className="font-semibold text-foreground ml-1">Rs.{formatCurrency(tend.amount)}</span>
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Issued Vouchers Highlight Box */}
                                            {act.issuedVouchers && act.issuedVouchers.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Issued Voucher:</span>
                                                    {act.issuedVouchers.map((v: any, vIdx: number) => (
                                                        <div key={vIdx} className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-200 dark:border-rose-950 text-rose-700 dark:text-rose-300 rounded px-2 py-0.5 font-mono text-[10px] font-semibold">
                                                            <Ticket className="h-3 w-3" />
                                                            <span>{v.code}</span>
                                                            <span className="text-muted-foreground border-l pl-1.5">Rs.{formatCurrency(v.faceValue)}</span>
                                                            {v.expiresAt && (
                                                                <span className="text-muted-foreground border-l pl-1.5 text-[9px]">Expires {fmtDate(v.expiresAt)}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Dense Grid Table View */
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                                    <th className="p-3">Date / Time</th>
                                    <th className="p-3">Activity Type</th>
                                    <th className="p-3">Ref Number</th>
                                    <th className="p-3">Outlet / POS</th>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3">Merchant / Alliance</th>
                                    <th className="p-3 text-center">Items</th>
                                    <th className="p-3 text-right">Amount</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((act: any) => {
                                    const cfg = ACTIVITY_CONFIG[act.type] || { label: "Activity", color: "bg-muted text-muted-foreground", icon: Info };

                                    return (
                                        <tr key={act.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="p-3 font-mono">
                                                <div>{fmtDate(act.date)}</div>
                                                <div className="text-[10px] text-muted-foreground">{fmtTime(act.date)}</div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="outline" className={cn("font-bold text-[10px] uppercase px-1.5 py-0.5", cfg.color)}>
                                                    {cfg.label}
                                                </Badge>
                                            </td>
                                            <td className="p-3 font-mono font-bold">
                                                #{act.number}
                                                {act.type !== "sale" && (
                                                    <div className="text-[10px] text-muted-foreground font-normal">
                                                        Order: #{act.orderNumber}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-foreground">{act.locationName || act.locationId}</div>
                                                <div className="text-[10px] font-mono text-muted-foreground">POS: {act.posId || "N/A"}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium">{act.customer?.name || "Walk-in"}</div>
                                                {act.customer?.contactNo && (
                                                    <div className="text-[10px] font-mono text-muted-foreground">{act.customer.contactNo}</div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {act.merchant ? (
                                                    <div className="font-semibold text-amber-700 dark:text-amber-400">
                                                        {act.merchant.bankName} ({act.merchant.commissionRate}%)
                                                    </div>
                                                ) : act.alliance ? (
                                                    <div className="font-semibold text-blue-600">
                                                        {act.alliance.partnerName}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center font-mono font-semibold">
                                                {act.items?.length || 0}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-foreground">
                                                Rs. {formatCurrency(act.approvedAmount ?? act.amount)}
                                            </td>
                                            <td className="p-3 text-center">
                                                {canPrint && (
                                                    <div className="flex items-center justify-center">
                                                        {act.type === "sale" ? (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                                                                        title="Print Options"
                                                                    >
                                                                        <Printer className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => openSalePrint(act.orderId || act.id, false)} className="gap-2 cursor-pointer text-xs">
                                                                        <Printer className="h-3.5 w-3.5 text-primary" />
                                                                        Print Sale Receipt
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openSalePrint(act.orderId || act.id, true)} className="gap-2 cursor-pointer text-xs">
                                                                        <Ticket className="h-3.5 w-3.5 text-rose-500" />
                                                                        Print Gift Receipt
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                                                                title={`Print ${cfg.label}`}
                                                                onClick={() => {
                                                                    if (act.type === "return") openReturnPrint({ id: act.orderId || act.id, orderId: act.orderId, number: act.number, orderNumber: act.orderNumber, grandTotal: act.amount, date: act.date }, "return");
                                                                    else if (act.type === "refund") openReturnPrint({ id: act.orderId || act.id, orderId: act.orderId, number: act.number, orderNumber: act.orderNumber, grandTotal: act.amount, date: act.date }, "refund");
                                                                    else if (act.type === "claim") openClaimPrint(act, act.orderNumber);
                                                                }}
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Showing</span>
                    <span className="font-mono font-semibold text-foreground">{orders.length}</span>
                    <span>of</span>
                    <span className="font-mono font-semibold text-foreground">{meta.total}</span>
                    <span>records</span>

                    <div className="ml-4 flex items-center gap-1.5">
                        <span>Per page:</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}
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
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                        onClick={() => setCurrentPage(prev => Math.min(meta.totalPages, prev + 1))}
                        className="h-8 text-xs"
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Print Modals */}
            {showPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: false }}
                    tenders={selectedOrder.tenders || []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => {
                        setShowPrint(false);
                        setSelectedOrder(null);
                        setIsLoadingReceipt(false);
                    }}
                />
            )}
            {showGiftPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: true }}
                    tenders={selectedOrder.tenders || []}
                    creditVouchers={selectedOrder.creditVouchers}
                    isLoading={isLoadingReceipt}
                    onClose={() => {
                        setShowGiftPrint(false);
                        setSelectedOrder(null);
                        setIsLoadingReceipt(false);
                    }}
                />
            )}
            {showReturnPrint && selectedOrder && (
                <PrintReturnReceipt
                    returnRef={
                        isRefundPrint
                            ? (returnDetails?.refundNumber || selectedOrder.refundNumber || selectedOrder.number || selectedOrder.orderNumber || "")
                            : (returnDetails?.returnNumber || selectedOrder.returnNumber || selectedOrder.number || selectedOrder.orderNumber || "")
                    }
                    isRefund={isRefundPrint}
                    isAlliance={!!selectedOrder.alliance}
                    originalOrders={[{ orderNumber: selectedOrder.orderNumber || selectedOrder.number, grandTotal: Number(selectedOrder.grandTotal || selectedOrder.amount || 0) }]}
                    returnedLines={(returnDetails?.items ?? []).map((item: any) => ({
                        name: item.item?.description || item.description || "Unknown Item",
                        sku: item.item?.sku || item.sku || "-",
                        size: typeof item.item?.size === 'object' ? item.item?.size?.name : (item.item?.size || item.size || ""),
                        brand: item.item?.brand?.name || item.brand,
                        returnQty: item.returnableQty || item.quantity,
                        paidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice || item.price || 0),
                        refundAmount: Number(item.refundAmount || 0),
                        orderNumber: selectedOrder.orderNumber || selectedOrder.number,
                        unitPrice: Number(item.unitPrice || item.price || 0),
                        discountAmount: Number(item.discountAmount || 0),
                        discountPercent: Number(item.discountPercent || 0),
                        taxAmount: Number(item.taxAmount || 0),
                        taxPercent: Number(item.taxPercent || 0),
                        refundPerUnit: item.refundPerUnit,
                        priceAdjusted: item.priceAdjusted || false,
                        originalPaidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice || item.price || 0),
                        couponDeduction: Number(item.couponDeduction || 0),
                    }))}
                    refundTotal={returnDetails?.items?.reduce((sum: number, item: any) => sum + Number(item.refundAmount || 0), 0) ?? 0}
                    notes={returnDetails?.reason}
                    discountNotes={returnDetails?.discountNotes}
                    returnedAt={returnDetails?.returnedAt || selectedOrder.date}
                    exchangeVoucher={returnDetails?.exchangeVoucher ?? null}
                    paymentMethod={selectedOrder.paymentMethod}
                    isLoading={isLoadingReceipt}
                    onClose={() => {
                        setShowReturnPrint(false);
                        setSelectedOrder(null);
                        setReturnDetails(null);
                        setIsLoadingReceipt(false);
                    }}
                />
            )}
            {showClaimPrint && selectedClaim && (
                <PrintClaimReceipt
                    claim={selectedClaim}
                    isLoading={isLoadingReceipt}
                    onClose={() => {
                        setShowClaimPrint(false);
                        setSelectedClaim(null);
                        setIsLoadingReceipt(false);
                    }}
                />
            )}
        </div>
    );
}
