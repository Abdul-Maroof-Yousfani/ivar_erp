"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getStockActivityReport } from "@/lib/actions/stock-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import {
    ChevronDown,
    ChevronRight,
    Download,
    Printer,
    Search,
    Loader2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Store,
    Layers,
    ShoppingCart,
    Inbox,
    RefreshCw
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { subDays, startOfMonth, endOfMonth, format } from "date-fns";

export default function PosStockActivityReportPage() {
    const { user } = useAuth();
    const locationId = user?.terminal?.location?.id || user?.locationId;
    const locationName = user?.terminal?.location?.name || "Store";

    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [reportData, setReportData] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [expandedSkus, setExpandedSkus] = useState<Record<string, boolean>>({});
    const [isExporting, setIsExporting] = useState(false);

    const fetchReport = useCallback(() => {
        if (!locationId || !dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getStockActivityReport({
                locationId,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                search: search || undefined,
            });
            if (result && result.status !== false) {
                setReportData(result.data || result);
            } else {
                toast.error("Failed to load report data");
            }
        });
    }, [locationId, dateRange, search]);

    useEffect(() => {
        fetchReport();
    }, [locationId]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReport();
    };

    const toggleExpandSku = (sku: string) => {
        setExpandedSkus((prev) => ({
            ...prev,
            [sku]: !prev[sku],
        }));
    };

    const toggleAllExpand = (expand: boolean) => {
        const next: Record<string, boolean> = {};
        if (expand) {
            reportData.forEach((group) => {
                next[group.sku] = true;
            });
        }
        setExpandedSkus(next);
    };

    const handleExportExcel = async () => {
        if (isExporting || !locationId || !dateRange.from || !dateRange.to) return;
        setIsExporting(true);
        try {
            const queryParams = new URLSearchParams();
            queryParams.append("locationId", locationId);
            queryParams.append("startDate", dateRange.from.toISOString());
            queryParams.append("endDate", dateRange.to.toISOString());
            if (search) queryParams.append("search", search);

            const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const downloadUrl = `${nextPublicApiUrl}/api/stock-ledger/activity-report/export?${queryParams.toString()}`;

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", `stock-activity-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Excel report download triggered");
        } catch (error) {
            console.error("Excel download error:", error);
            toast.error("Failed to download Excel file");
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const summaryMetrics = useMemo(() => {
        const m = {
            totalArticles: reportData.length,
            openingBal: 0,
            trfIn: 0,
            trfOut: 0,
            sales: 0,
            transit: 0,
            closingBal: 0,
        };
        for (const g of reportData) {
            m.openingBal += g.totals.bf;
            m.trfIn += g.totals.totalTrfIn;
            m.trfOut += g.totals.totalTrfOut;
            m.sales += g.totals.sales;
            m.transit += g.totals.transit;
            m.closingBal += g.totals.balance;
        }
        return m;
    }, [reportData]);

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Stock Activity Report
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        POS Level Report for <span className="text-foreground font-semibold">{locationName}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        disabled={reportData.length === 0}
                        className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 gap-2 font-semibold"
                    >
                        <Printer className="h-4 w-4" />
                        Print / PDF
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportExcel}
                        disabled={isExporting || reportData.length === 0}
                        className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 gap-2 font-semibold"
                    >
                        {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {isExporting ? "Downloading..." : "Export Excel"}
                    </Button>
                </div>
            </div>

            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Stock Activity Report</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Outlet: {locationName}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by SKU or Article Name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-background focus-visible:ring-1"
                        />
                    </div>
                    <Button type="submit" disabled={isPending} className="font-semibold">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                </form>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Date Period:
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchReport}
                        disabled={isPending}
                        className="text-primary hover:text-primary/95 text-xs font-bold"
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Articles</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summaryMetrics.totalArticles}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Opening Balance</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summaryMetrics.openingBal}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-600">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transfers IN (Net)</p>
                            <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">+{summaryMetrics.trfIn}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transfers OUT (Net)</p>
                            <h3 className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">-{summaryMetrics.trfOut}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Sales</p>
                            <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summaryMetrics.sales}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">In Transit</p>
                            <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-500">{summaryMetrics.transit}</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                            <RefreshCw className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-xl shadow-sm overflow-hidden bg-background">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b no-print">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllExpand(true)}
                            className="text-xs font-bold"
                        >
                            Expand All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllExpand(false)}
                            className="text-xs font-bold"
                        >
                            Collapse All
                        </Button>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                        Showing {reportData.length} Grouped Articles
                    </span>
                </div>

                <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-900 border-b border-border/80 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                                <th className="p-3 w-[260px] border-r">Article Info</th>
                                <th className="p-3 w-[100px] border-r text-center">Color</th>
                                <th className="p-3 w-[80px] border-r text-center">Size</th>
                                <th className="p-3 w-[90px] border-r text-right">BF</th>
                                <th className="p-3 w-[90px] text-right bg-emerald-500/5">Wh IN</th>
                                <th className="p-3 w-[90px] text-right bg-emerald-500/5">Out IN</th>
                                <th className="p-3 w-[90px] border-r text-right bg-emerald-500/10 font-extrabold text-emerald-700">Trf IN</th>
                                <th className="p-3 w-[90px] text-right bg-rose-500/5">Wh OUT</th>
                                <th className="p-3 w-[90px] text-right bg-rose-500/5">Out OUT</th>
                                <th className="p-3 w-[90px] border-r text-right bg-rose-500/10 font-extrabold text-rose-700">Trf OUT</th>
                                <th className="p-3 w-[80px] border-r text-right">Exchg</th>
                                <th className="p-3 w-[80px] border-r text-right">Refund</th>
                                <th className="p-3 w-[80px] border-r text-right">Claim</th>
                                <th className="p-3 w-[80px] border-r text-right">Sales</th>
                                <th className="p-3 w-[80px] border-r text-right">Adj</th>
                                <th className="p-3 w-[100px] border-r text-right bg-blue-500/5 font-extrabold text-blue-700">Available</th>
                                <th className="p-3 w-[80px] border-r text-right text-amber-700 font-extrabold">Transit</th>
                                <th className="p-3 w-[110px] text-right bg-slate-500/5 font-extrabold text-slate-800 dark:text-slate-100">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {isPending ? (
                                <tr>
                                    <td colSpan={18} className="p-8 text-center text-muted-foreground font-medium">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            Gathering stock ledger movements and computing balances...
                                        </div>
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={18} className="p-8 text-center text-muted-foreground font-medium">
                                        No stock ledger movements or inventory balances found for this period.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((group) => {
                                    const isExpanded = !!expandedSkus[group.sku];
                                    return (
                                        <React.Fragment key={group.sku}>
                                            <tr
                                                onClick={() => toggleExpandSku(group.sku)}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 cursor-pointer font-bold bg-slate-50/50 dark:bg-slate-950/20 transition-colors"
                                            >
                                                <td className="p-3 border-r flex items-center gap-1.5 min-w-[260px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-primary leading-none uppercase">{group.sku}</span>
                                                        <span className="mt-1 text-slate-700 dark:text-slate-300 font-bold max-w-[200px] truncate">{group.articleName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase">All Colors</td>
                                                <td className="p-3 border-r text-center text-[10px] font-bold text-muted-foreground uppercase">All Sizes</td>
                                                <td className="p-3 border-r text-right text-slate-700 font-bold">{group.totals.bf}</td>
                                                <td className="p-3 text-right text-slate-600 bg-emerald-500/5">{group.totals.fromWarehouse}</td>
                                                <td className="p-3 text-right text-slate-600 bg-emerald-500/5">{group.totals.fromOutlet}</td>
                                                <td className="p-3 border-r text-right bg-emerald-500/10 text-emerald-700 font-extrabold">{group.totals.totalTrfIn}</td>
                                                <td className="p-3 text-right text-slate-600 bg-rose-500/5">{group.totals.toWarehouse}</td>
                                                <td className="p-3 text-right text-slate-600 bg-rose-500/5">{group.totals.toOutlet}</td>
                                                <td className="p-3 border-r text-right bg-rose-500/10 text-rose-700 font-extrabold">{group.totals.totalTrfOut}</td>
                                                <td className="p-3 border-r text-right text-slate-600">{group.totals.exchg}</td>
                                                <td className="p-3 border-r text-right text-slate-600">{group.totals.refund}</td>
                                                <td className="p-3 border-r text-right text-slate-600">{group.totals.claim}</td>
                                                <td className="p-3 border-r text-right text-slate-600">{group.totals.sales}</td>
                                                <td className="p-3 border-r text-right text-slate-600">{group.totals.adj}</td>
                                                <td className="p-3 border-r text-right bg-blue-500/5 text-blue-700 font-extrabold">{group.totals.availableStock}</td>
                                                <td className="p-3 border-r text-right text-amber-700 font-extrabold">{group.totals.transit}</td>
                                                <td className="p-3 text-right bg-slate-500/5 text-slate-800 dark:text-slate-100 font-black">{group.totals.balance}</td>
                                            </tr>

                                            {isExpanded &&
                                                group.variants.map((v: any, index: number) => (
                                                    <tr
                                                        key={`${group.sku}-${v.color}-${v.size}-${index}`}
                                                        className="hover:bg-slate-100/30 dark:hover:bg-slate-900/20 text-slate-600 dark:text-slate-400 bg-background transition-colors"
                                                    >
                                                        <td className="p-3 border-r pl-9 text-muted-foreground italic">
                                                            — Variant Item
                                                        </td>
                                                        <td className="p-3 border-r text-center font-medium">{v.color}</td>
                                                        <td className="p-3 border-r text-center font-medium">{v.size}</td>
                                                        <td className="p-3 border-r text-right font-medium">{v.bf}</td>
                                                        <td className="p-3 text-right">{v.fromWarehouse}</td>
                                                        <td className="p-3 text-right">{v.fromOutlet}</td>
                                                        <td className="p-3 border-r text-right bg-emerald-500/5 font-semibold text-emerald-600">{v.totalTrfIn}</td>
                                                        <td className="p-3 text-right">{v.toWarehouse}</td>
                                                        <td className="p-3 text-right">{v.toOutlet}</td>
                                                        <td className="p-3 border-r text-right bg-rose-500/5 font-semibold text-rose-600">{v.totalTrfOut}</td>
                                                        <td className="p-3 border-r text-right">{v.exchg}</td>
                                                        <td className="p-3 border-r text-right">{v.refund}</td>
                                                        <td className="p-3 border-r text-right">{v.claim}</td>
                                                        <td className="p-3 border-r text-right">{v.sales}</td>
                                                        <td className="p-3 border-r text-right">{v.adj}</td>
                                                        <td className="p-3 border-r text-right bg-blue-500/5 font-bold text-blue-600">{v.availableStock}</td>
                                                        <td className="p-3 border-r text-right font-semibold text-amber-600">{v.transit}</td>
                                                        <td className="p-3 text-right bg-slate-500/5 font-bold text-slate-700 dark:text-slate-300">{v.balance}</td>
                                                    </tr>
                                                ))}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                        font-size: 10px !important;
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
                        padding: 6px 4px !important;
                        font-size: 9px !important;
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
